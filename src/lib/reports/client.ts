import { businessReportSchema } from "@/lib/reports/schemas";
import type { BusinessReport } from "@/types/report";

export class ReportApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ReportApiError";
  }
}

export const reportClient = {
  async get(month: string): Promise<BusinessReport> {
    const response = await fetch(`/api/reports/business?month=${encodeURIComponent(month)}`, { cache: "no-store" });
    const body = await response.json() as {
      data?: unknown;
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      throw new ReportApiError(
        response.status,
        body.error?.code ?? "INTERNAL_ERROR",
        body.error?.message ?? "No se pudo cargar el reporte.",
      );
    }
    return businessReportSchema.parse(body.data);
  },
};

export type ReportClient = typeof reportClient;
