import type { FixedCustomerOccurrence } from "@/types/fixed-customer";
import { getBuenosAiresRemainingWorkweekRange } from "@/lib/dashboard/workweek-range";

export type FixedOccurrenceGroups = {
  upcoming: FixedCustomerOccurrence[];
  unrecorded: FixedCustomerOccurrence[];
  resolved: FixedCustomerOccurrence[];
};

const buenosAiresDate = (instant: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(instant);

export const groupFixedOccurrencesByTime = (
  occurrences: FixedCustomerOccurrence[],
  reference: Date,
): FixedOccurrenceGroups => {
  const workweek = getBuenosAiresRemainingWorkweekRange(reference);
  if (!workweek) {
    return { upcoming: [], unrecorded: [], resolved: [] };
  }

  const today = buenosAiresDate(reference);
  const upcoming: FixedCustomerOccurrence[] = [];
  const unrecorded: FixedCustomerOccurrence[] = [];
  const resolved: FixedCustomerOccurrence[] = [];

  for (const occurrence of occurrences.filter(({ date }) => date >= workweek.dateFrom && date <= workweek.dateTo)) {
    if (occurrence.status !== "pending") {
      resolved.push(occurrence);
      continue;
    }
    const scheduledAt = new Date(`${occurrence.date}T${occurrence.time}:00-03:00`);
    (occurrence.date > today || scheduledAt > reference ? upcoming : unrecorded).push(occurrence);
  }

  const chronological = (left: FixedCustomerOccurrence, right: FixedCustomerOccurrence) =>
    `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`);
  return {
    upcoming: upcoming.sort(chronological),
    unrecorded: unrecorded.sort(chronological),
    resolved: resolved.sort(chronological),
  };
};
