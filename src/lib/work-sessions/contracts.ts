import type {
  EmployeeWorkSession,
  ManagerWorkSession,
  PaginatedWorkSessions,
  WorkSession,
  WorkSessionCorrectionInput,
  WorkSessionListQuery,
} from "@/types/work-session";

export type WorkSessionRepository = {
  getCurrent(employeeId: string): Promise<WorkSession | null>;
  start(employeeId: string): Promise<EmployeeWorkSession>;
  end(employeeId: string): Promise<EmployeeWorkSession>;
  list(
    requestingUserId: string,
    query: WorkSessionListQuery,
  ): Promise<PaginatedWorkSessions>;
  correct(
    managerId: string,
    sessionId: string,
    input: WorkSessionCorrectionInput,
  ): Promise<ManagerWorkSession>;
};

export type WorkSessionServiceDependencies = {
  workSessions: WorkSessionRepository;
};
