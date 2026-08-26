import { assertManager } from "@/lib/auth/authorization";
import type { SafeUser } from "@/lib/auth/types";
import type { ReportDependencies } from "./contracts";
import { reportRepository } from "./repository";

const defaults: ReportDependencies = { reports: reportRepository };

export const getBusinessReport = (
  actor: SafeUser,
  month: string,
  dependencies: ReportDependencies = defaults,
) => {
  assertManager(actor);
  return dependencies.reports.get(actor.id, month);
};
