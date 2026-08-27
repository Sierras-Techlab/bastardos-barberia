const reportMonthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
});

export const getBuenosAiresReportMonth = (now = new Date()) => {
  const parts = reportMonthFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("No se pudo calcular el mes del reporte.");
  return `${year}-${month}`;
};
