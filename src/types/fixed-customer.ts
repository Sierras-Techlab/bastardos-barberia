export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type FixedSchedule = { weekday: IsoWeekday; time: string };
export type FixedOccurrenceStatus = "pending" | "attended" | "missed";
export type FixedCustomerIdentity = { id: string; firstName: string; lastName: string };
export type FixedCustomerOccurrence = { id: string; customer: FixedCustomerIdentity; date: string; time: string; status: FixedOccurrenceStatus };
export type FixedOccurrenceQuery = { dateFrom: string; dateTo: string; status?: FixedOccurrenceStatus };
export type ResolveFixedOccurrenceInput = { status: "attended" | "missed"; expectedStatus: "pending" };
