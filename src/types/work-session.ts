export type WorkSessionState = "open" | "closed";

export type WorkSessionEmployee = {
  id: string;
  firstName: string;
  lastName: string;
};

export type WorkSessionMetrics = {
  workedMinutes: number;
  saleCount: number;
  employeeCommission: number;
};

export type ManagerWorkSessionMetrics = WorkSessionMetrics & {
  grossTotal: number;
  barbershopNet: number;
};

export type WorkSessionBase = {
  id: string;
  employee: WorkSessionEmployee;
  businessDate: string;
  startedAt: string;
  endedAt: string | null;
  state: WorkSessionState;
};

export type EmployeeWorkSession = WorkSessionBase & {
  metrics: WorkSessionMetrics;
};

export type ManagerWorkSession = WorkSessionBase & {
  metrics: ManagerWorkSessionMetrics;
};

export type WorkSession = EmployeeWorkSession | ManagerWorkSession;

export type WorkSessionCorrectionInput = {
  startedAt: string;
  endedAt: string | null;
  reason: string;
};

export type WorkSessionListQuery = {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

export type WorkSessionPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedEmployeeWorkSessions = {
  items: EmployeeWorkSession[];
  pagination: WorkSessionPagination;
};

export type PaginatedManagerWorkSessions = {
  items: ManagerWorkSession[];
  pagination: WorkSessionPagination;
};

export type PaginatedWorkSessions =
  | PaginatedEmployeeWorkSessions
  | PaginatedManagerWorkSessions;
