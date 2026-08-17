import { formatArs } from "@/lib/incomes/income-calculations";
import type { Customer } from "@/types/customer";
import type { DashboardData } from "@/types/dashboard";
import type { IncomeListItem } from "@/types/income";

export type RecentActivityItem = DashboardData["recentActivity"][number];

const absoluteDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
});

const formatRelativeTime = (createdAt: string, now: Date) => {
  const elapsedMilliseconds = Math.max(
    now.getTime() - new Date(createdAt).getTime(),
    0,
  );
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);

  if (elapsedMinutes < 1) return "Ahora";
  if (elapsedMinutes < 60) return `Hace ${elapsedMinutes} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Hace ${elapsedHours} h`;

  return absoluteDateFormatter.format(new Date(createdAt));
};

export const buildIncomeActivity = (
  income: IncomeListItem | null,
  now = new Date(),
): RecentActivityItem => {
  if (!income) {
    return {
      id: "activity-income-empty",
      type: "income",
      title: "Ingreso registrado",
      description: "Todavía no se registraron ingresos.",
      time: "Sin actividad",
    };
  }

  const concepts = [
    income.service?.name,
    ...income.products.map((product) =>
      product.quantity > 1
        ? `${product.name} x${product.quantity}`
        : product.name,
    ),
  ].filter((concept): concept is string => Boolean(concept));

  return {
    id: income.id,
    type: "income",
    title: "Ingreso registrado",
    description: `${concepts.join(" + ")} · ${formatArs(income.total)}`,
    time: formatRelativeTime(income.createdAt, now),
  };
};

export const buildCustomerActivity = (
  customer: Customer | null,
  now = new Date(),
): RecentActivityItem => {
  if (!customer) {
    return {
      id: "activity-customer-empty",
      type: "customer",
      title: "Nuevo cliente",
      description: "Todavía no se registraron clientes.",
      time: "Sin actividad",
    };
  }

  return {
    id: customer.id,
    type: "customer",
    title: "Nuevo cliente",
    description: `${customer.firstName} ${customer.lastName} fue agregado a clientes`,
    time: formatRelativeTime(customer.createdAt, now),
  };
};
