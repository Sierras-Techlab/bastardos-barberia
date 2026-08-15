export type DashboardWorkweekRange = {
  dateFrom: string;
  dateTo: string;
};

const formatBuenosAiresDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export const getBuenosAiresRemainingWorkweekRange = (
  now = new Date(),
): DashboardWorkweekRange | null => {
  const dateFrom = formatBuenosAiresDate(now);
  const currentDate = new Date(`${dateFrom}T12:00:00.000Z`);
  const weekday = currentDate.getUTCDay();

  if (weekday === 0) return null;

  const saturday = new Date(currentDate);
  saturday.setUTCDate(currentDate.getUTCDate() + (6 - weekday));

  return {
    dateFrom,
    dateTo: saturday.toISOString().slice(0, 10),
  };
};
