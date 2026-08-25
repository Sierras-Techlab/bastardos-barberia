import type {
  EmployeeIncomeListItem,
  EmployeeIncomeListMetrics,
  IncomeKind,
  IncomeListFilters,
  IncomeListItem,
  IncomeListMetrics,
  IncomeListRow,
} from "@/types/income";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const managerProductQuantity = (item: IncomeListItem) =>
  item.products.reduce((total, product) => total + product.quantity, 0);

const incomePayments = (item: IncomeListItem) => item.payments;

const isEmployeeRow = (item: IncomeListRow): item is EmployeeIncomeListItem =>
  Array.isArray((item as EmployeeIncomeListItem).concepts);

const isManagerRow = (item: IncomeListRow): item is IncomeListItem =>
  Array.isArray((item as IncomeListItem).payments) &&
  "total" in item;

export const getIncomeKind = (item: IncomeListItem): IncomeKind => {
  if (item.service && item.products.length > 0) {
    return "combined";
  }

  if (item.service) {
    return "service";
  }

  return "products";
};

export const formatIncomeConcept = (item: IncomeListRow): string => {
  if (isEmployeeRow(item)) {
    const quantity = item.concepts.reduce((total, concept) => total + concept.quantity, 0);
    if (quantity === 0) return "Ingreso";
    const productCount = item.concepts.filter((concept) => concept.type === "product").reduce((total, concept) => total + concept.quantity, 0);
    const serviceCount = item.concepts.filter((concept) => concept.type === "service").length;
    const serviceNames = item.concepts.filter((concept) => concept.type === "service").map((concept) => concept.name);
    if (serviceCount > 0 && productCount > 0) {
      return `${serviceNames.join(" + ")} + ${productCount} ${productCount === 1 ? "producto" : "productos"}`;
    }
    if (serviceCount > 0) {
      return serviceNames.join(" + ");
    }
    return `${quantity} ${quantity === 1 ? "producto" : "productos"}`;
  }
  if (item.sourceType === "fixed_subscription" && item.subscription) {
    return `Mensualidad ${item.subscription.label}`;
  }
  const quantity = managerProductQuantity(item);
  const productLabel = `${quantity} ${quantity === 1 ? "producto" : "productos"}`;

  if (item.service && quantity > 0) {
    return `${item.service.name} + ${productLabel}`;
  }

  if (item.service) {
    return item.service.name;
  }

  return productLabel;
};

export const formatIncomeDateTime = (createdAt: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(createdAt));

const matchesQuery = (item: IncomeListRow, rawQuery: string) => {
  const query = normalize(rawQuery);

  if (!query) {
    return true;
  }

  if (isEmployeeRow(item)) {
    const searchableValues = [
      item.customer?.firstName ?? "",
      item.customer?.lastName ?? "",
      ...item.concepts.map((concept) => concept.name),
    ];
    return normalize(searchableValues.join(" ")).includes(query);
  }

  const searchableValues = [
    item.employee.firstName,
    item.employee.lastName,
    item.customer?.firstName ?? "",
    item.customer?.lastName ?? "",
    item.service?.name ?? "",
    ...item.products.map((product) => product.name),
  ];

  return normalize(searchableValues.join(" ")).includes(query);
};

const dateBoundary = (value: string, endOfDay: boolean) => {
  if (!value) {
    return endOfDay ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  return new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`,
  ).getTime();
};

export const filterIncomeItems = <T extends IncomeListRow>(
  items: T[],
  filters: IncomeListFilters,
): T[] => {
  const from = dateBoundary(filters.dateFrom, false);
  const to = dateBoundary(filters.dateTo, true);

  return items.filter((item) => {
    const createdAt = Date.parse(item.createdAt);

    return (
      matchesQuery(item, filters.query) &&
      createdAt >= from &&
      createdAt <= to &&
      (filters.employeeId === "" ||
        (isManagerRow(item) && item.employee.id === filters.employeeId) ||
        !isManagerRow(item)) &&
      (filters.paymentMethodId === "all" ||
        (isManagerRow(item) && incomePayments(item).some(
          (payment) => payment.paymentMethodId === filters.paymentMethodId,
        )) ||
        !isManagerRow(item)) &&
      (filters.kind === "all" || (isManagerRow(item) && getIncomeKind(item) === filters.kind))
    );
  });
};

export const sortIncomeItems = <T extends IncomeListRow>(items: T[]): T[] =>
  [...items].sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt),
  );

export const calculateIncomeMetrics = (
  items: IncomeListRow[],
): IncomeListMetrics | EmployeeIncomeListMetrics => {
  const activeItems = items.filter((item) => item.status === "active");
  const isEmployeeView = activeItems.length > 0 && isEmployeeRow(activeItems[0]);
  if (isEmployeeView) {
    const employeeItems = activeItems.filter(isEmployeeRow);
    const employeeCommissionTotal = employeeItems.reduce(
      (sum, item) => sum + item.employeeCommission,
      0,
    );
    return {
      count: employeeItems.length,
      employeeCommissionTotal,
    } satisfies EmployeeIncomeListMetrics;
  }
  const managerItems = activeItems.filter(isManagerRow);
  const total = managerItems.reduce((sum, item) => sum + item.total, 0);
  const commissionTotal = managerItems.reduce(
    (sum, item) => sum + item.commission.total,
    0,
  );
  const barbershopNet = managerItems.reduce(
    (sum, item) => sum + item.commission.barbershopNet,
    0,
  );
  const paymentTotalsById = new Map<string, { paymentMethodId: string; name: string; amount: number }>();
  for (const payment of managerItems.flatMap((item) => incomePayments(item))) {
    const current = paymentTotalsById.get(payment.paymentMethodId);
    paymentTotalsById.set(payment.paymentMethodId, {
      paymentMethodId: payment.paymentMethodId,
      name: payment.methodName,
      amount: (current?.amount ?? 0) + payment.amount,
    });
  }

  return {
    grossTotal: total,
    commissionTotal,
    barbershopNet,
    count: managerItems.length,
    average: managerItems.length > 0 ? total / managerItems.length : 0,
    paymentTotals: [...paymentTotalsById.values()],
  } satisfies IncomeListMetrics;
};
