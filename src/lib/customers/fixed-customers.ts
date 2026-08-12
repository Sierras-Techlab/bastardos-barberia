import type { FixedCustomerOccurrence, FixedCustomerScheduleFixture, FixedOccurrenceStatus, FixedSchedule, IsoWeekday } from "@/types/fixed-customer";

const weekdayNames: Record<IsoWeekday, string> = { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábados", 7: "domingos" };
export const formatFixedSchedule = (schedule: FixedSchedule) => `Todos los ${weekdayNames[schedule.weekday]} a las ${schedule.time}`;
export const sortFixedOccurrences = (occurrences: FixedCustomerOccurrence[]) => [...occurrences].sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
export const updateOccurrenceStatus = (occurrences: FixedCustomerOccurrence[], id: string, status: FixedOccurrenceStatus) => occurrences.map((occurrence) => occurrence.id === id ? { ...occurrence, status } : occurrence);

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export const buildUpcomingFixedOccurrences = (schedules: FixedCustomerScheduleFixture[], dateFrom: string) => {
  const startDate = new Date(`${dateFrom}T12:00:00.000Z`);
  const startWeekday = startDate.getUTCDay() || 7;

  return sortFixedOccurrences(schedules.map(({ id, customer, schedule }) => {
    const occurrenceDate = new Date(startDate);
    const dayOffset = (schedule.weekday - startWeekday + 7) % 7;
    occurrenceDate.setUTCDate(occurrenceDate.getUTCDate() + dayOffset);
    const date = formatIsoDate(occurrenceDate);

    return {
      id: `${id}:${date}`,
      customer,
      date,
      time: schedule.time,
      status: "pending" as const,
    };
  }));
};
