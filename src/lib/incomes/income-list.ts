import type {
  IncomeKind,
  IncomeListFilters,
  IncomeListItem,
  IncomeListMetrics,
} from "@/types/income";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const productQuantity = (item: IncomeListItem) =>
  item.products.reduce((total, product) => total + product.quantity, 0);

export const getIncomeKind = (item: IncomeListItem): IncomeKind => {
  if (item.service && item.products.length > 0) {
    return "combined";
  }

  if (item.service) {
    return "service";
  }

  return "products";
};

export const formatIncomeConcept = (item: IncomeListItem) => {
  const quantity = productQuantity(item);
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

const matchesQuery = (item: IncomeListItem, rawQuery: string) => {
  const query = normalize(rawQuery);

  if (!query) {
    return true;
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

export const filterIncomeItems = (
  items: IncomeListItem[],
  filters: IncomeListFilters,
) => {
  const from = dateBoundary(filters.dateFrom, false);
  const to = dateBoundary(filters.dateTo, true);

  return items.filter((item) => {
    const createdAt = Date.parse(item.createdAt);

    return (
      matchesQuery(item, filters.query) &&
      createdAt >= from &&
      createdAt <= to &&
      (!filters.employeeId || item.employee.id === filters.employeeId) &&
      (filters.paymentMethod === "all" ||
        item.paymentMethod === filters.paymentMethod) &&
      (filters.kind === "all" || getIncomeKind(item) === filters.kind)
    );
  });
};

export const sortIncomeItems = (items: IncomeListItem[]) =>
  [...items].sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt),
  );

export const calculateIncomeMetrics = (
  items: IncomeListItem[],
): IncomeListMetrics => {
  const activeItems = items.filter((item) => item.status === "active");
  const total = activeItems.reduce((sum, item) => sum + item.total, 0);
  const cashTotal = activeItems
    .filter((item) => item.paymentMethod === "cash")
    .reduce((sum, item) => sum + item.total, 0);
  const transferTotal = total - cashTotal;

  return {
    total,
    count: activeItems.length,
    average: activeItems.length > 0 ? total / activeItems.length : 0,
    cashTotal,
    transferTotal,
  };
};
