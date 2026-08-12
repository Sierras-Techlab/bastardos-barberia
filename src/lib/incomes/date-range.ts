export const getBuenosAiresMonthRange = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find(({ type }) => type === "year")?.value);
  const month = Number(parts.find(({ type }) => type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month).padStart(2, "0")}-${lastDay}`,
  };
};
