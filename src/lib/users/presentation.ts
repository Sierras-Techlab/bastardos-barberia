import type { SafeUser } from "@/lib/auth/types";

export const ROLE_LABELS = {
  owner: "Dueño",
  admin: "Administrador",
  employee: "Empleado",
} as const;

const lastLoginFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Argentina/Buenos_Aires",
});

export const formatLastLogin = (value: string | null) => {
  if (!value) return "Nunca";
  const parts = Object.fromEntries(
    lastLoginFormatter
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return [
    parts.day,
    parts.month?.replace(".", ""),
    parts.year + ",",
    parts.hour + ":" + parts.minute,
  ].join(" ");
};

export const summarizeUserPage = (items: SafeUser[]) => ({
  total: items.length,
  active: items.filter((user) => user.isActive).length,
  inactive: items.filter((user) => !user.isActive).length,
});

export const getUserInitials = (user: SafeUser) =>
  ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();
