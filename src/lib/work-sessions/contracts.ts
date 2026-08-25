import type {
  EmployeeWorkSession,
  ManagerWorkSession,
  PaginatedEmployeeWorkSessions,
  PaginatedManagerWorkSessions,
  WorkSessionCorrectionInput,
  WorkSessionListQuery,
} from "@/types/work-session";

export type WorkSessionRepository = {
  getCurrent(employeeId: string): Promise<EmployeeWorkSession | null>;
  start(employeeId: string): Promise<EmployeeWorkSession>;
  end(employeeId: string): Promise<EmployeeWorkSession>;
  listEmployee(
    requestingUserId: string,
    query: WorkSessionListQuery,
  ): Promise<PaginatedEmployeeWorkSessions>;
  listManager(
    requestingUserId: string,
    query: WorkSessionListQuery,
  ): Promise<PaginatedManagerWorkSessions>;
  correct(
    managerId: string,
    sessionId: string,
    input: WorkSessionCorrectionInput,
  ): Promise<ManagerWorkSession>;
};

export type WorkSessionServiceDependencies = {
  workSessions: WorkSessionRepository;
};
