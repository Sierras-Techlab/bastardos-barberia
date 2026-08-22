import type { Customer } from "@/types/customer";

const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

const dateOrdinal = (iso: string): number => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const formatRelativeLabel = (today: Date, businessDate: Date): string => {
  const todayOrdinal = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const businessOrdinal = Date.UTC(businessDate.getUTCFullYear(), businessDate.getUTCMonth(), businessDate.getUTCDate());
  const diffDays = Math.round((todayOrdinal - businessOrdinal) / 86_400_000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 14) return "hace 1 semana";
  if (diffDays < 30) return `hace ${Math.round(diffDays / 7)} semanas`;
  if (diffDays < 365) return `hace ${Math.round(diffDays / 30)} meses`;
  return `hace ${Math.round(diffDays / 365)} años`;
};

const formatDateLabel = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ARGENTINA_TIMEZONE,
  }).format(reference);
};

export type LastVisitFormat = { dateLabel: string; relativeLabel: string | null };

export const formatLastVisit = (
  businessDate: string | null,
  today: string,
): LastVisitFormat => {
  if (!businessDate) return { dateLabel: "Sin visitas", relativeLabel: null };
  const businessOrdinal = dateOrdinal(businessDate);
  const todayOrdinal = dateOrdinal(today);
  if (businessOrdinal > todayOrdinal) return { dateLabel: formatDateLabel(businessDate), relativeLabel: "próxima" };
  const [year, month, day] = businessDate.split("-").map(Number);
  const businessDateAsDate = new Date(Date.UTC(year, month - 1, day));
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const todayDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  return { dateLabel: formatDateLabel(businessDate), relativeLabel: formatRelativeLabel(todayDate, businessDateAsDate) };
};

export const noLeakage = (customer: Customer): boolean => {
  const serialized = JSON.stringify(customer);
  return !/payment|commission|employee|registeredBy|adjustment|netAmount|barbershopNet/i.test(serialized);
};