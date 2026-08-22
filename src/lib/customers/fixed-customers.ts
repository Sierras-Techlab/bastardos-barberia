import type { FixedCustomerOccurrence, FixedSchedule, IsoWeekday } from "@/types/fixed-customer";

const weekdayNames: Record<IsoWeekday, string> = {
  1: "lunes",
  2: "martes",
  3: "miércoles",
  4: "jueves",
  5: "viernes",
  6: "sábados",
  7: "domingos",
};
export const formatFixedSchedule = (schedule: { weekday: IsoWeekday; time: string }) =>
  `Todos los ${weekdayNames[schedule.weekday]} a las ${schedule.time}`;
export const sortFixedOccurrences = (occurrences: FixedCustomerOccurrence[]) =>
  [...occurrences].sort((left, right) =>
    `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`),
  );
