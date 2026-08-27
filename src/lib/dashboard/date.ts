const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

export const getBuenosAiresToday = (today = new Date()): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: ARGENTINA_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(today);
};