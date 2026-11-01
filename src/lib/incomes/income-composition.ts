import type { CashSaleAuditItem } from "@/types/cash";
import type { IncomeComposition } from "@/types/income";

// Closed days keep their original collection; later voids belong to adjustments.
export const buildCashIncomeComposition = (sales: CashSaleAuditItem[]): IncomeComposition => {
  const composition: IncomeComposition = {
    sales: { grossTotal: 0, commissionTotal: 0, barbershopNet: 0 },
    subscriptions: { grossTotal: 0, commissionTotal: 0, barbershopNet: 0 },
    chairRentals: { grossTotal: 0, commissionTotal: 0, barbershopNet: 0 },
  };
  for (const sale of sales) {
    if (sale.statusAtClose !== "active") continue;
    const group = sale.kind === "chair_rental" ? "chairRentals" : sale.kind === "subscription" ? "subscriptions" : "sales";
    composition[group].grossTotal += sale.grossTotal;
    composition[group].commissionTotal += sale.commissionTotal;
    composition[group].barbershopNet += sale.barbershopNet;
  }
  return composition;
};
