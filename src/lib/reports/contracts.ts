import type { BusinessReport } from "@/types/report";

export type ReportRepository = {
  get(actorId: string, month: string): Promise<BusinessReport>;
};

export type ReportDependencies = { reports: ReportRepository };
