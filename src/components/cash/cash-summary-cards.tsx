import { IncomeComposition } from "@/components/incomes/income-composition";
import { IncomeTotals } from "@/components/incomes/income-totals";
import { buildCashIncomeComposition } from "@/lib/incomes/income-composition";
import type { CashSaleAuditItem, CashSummary } from "@/types/cash";

export const CashSummaryCards = ({ summary, sales = [] }: { summary: CashSummary; sales?: CashSaleAuditItem[] }) => (
  <section aria-label="Resumen de cobros de la caja" className="space-y-4">
    <IncomeTotals grossTotal={summary.salesGrossTotal} commissionTotal={summary.salesCommissionTotal} barbershopNet={summary.salesBarbershopNet} />
    {summary.adjustmentCount > 0 && <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">Cobros del día · antes de anulaciones posteriores. Esas anulaciones se muestran por separado más abajo.</p>}
    <IncomeComposition composition={buildCashIncomeComposition(sales)} />
  </section>
);
