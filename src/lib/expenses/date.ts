export const getBuenosAiresToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const getBuenosAiresMonth = () => getBuenosAiresToday().slice(0, 7);

export const getMonthBounds = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
};
