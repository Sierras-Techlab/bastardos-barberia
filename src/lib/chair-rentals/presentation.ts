const BUENOS_AIRES_TIME_ZONE = "America/Argentina/Buenos_Aires";

const periodFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BUENOS_AIRES_TIME_ZONE,
});

export const formatChairRentalPeriod = (period: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return period;
  }

  return periodFormatter.format(new Date(`${period}-01T12:00:00.000Z`));
};

export const formatBuenosAiresDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const parsed = new Date(`${date}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormatter.format(parsed);
};

export const formatBuenosAiresDateTime = (timestamp: string) => {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : dateTimeFormatter.format(parsed);
};
