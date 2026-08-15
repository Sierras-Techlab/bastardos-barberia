const BUENOS_AIRES_TIME_ZONE = "America/Argentina/Buenos_Aires";

const buenosAiresDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUENOS_AIRES_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const getBuenosAiresToday = (now = new Date()): string =>
  buenosAiresDateFormatter.format(now);
