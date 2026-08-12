import { Banknote, Landmark, Split } from "lucide-react";
import { Input } from "@/components/ui/input";
import { calculatePaymentBalance } from "@/lib/incomes/income-commissions";
import { cn } from "@/lib/utils";
import type { IncomePayment } from "@/types/income-commissions";

export type PaymentMode = "cash" | "transfer" | "combined";
type Props = { mode: PaymentMode | null; payments: IncomePayment[]; total: number; onChange: (mode: PaymentMode, payments: IncomePayment[]) => void; error?: string };
const options = [{ value: "cash" as const, label: "Efectivo", icon: Banknote }, { value: "transfer" as const, label: "Transferencia", icon: Landmark }, { value: "combined" as const, label: "Combinado", icon: Split }];

export const PaymentMethodSelector = ({ mode, payments, total, onChange, error }: Props) => {
  const select = (next: PaymentMode) => onChange(next, next === "combined" ? [{ method: "cash", amount: 0 }, { method: "transfer", amount: total }] : [{ method: next, amount: total }]);
  const update = (method: "cash" | "transfer", amount: number) => {
    const safe = Math.max(0, Math.trunc(amount || 0));
    const next = payments.map((payment) => payment.method === method ? { ...payment, amount: safe } : payment);
    if (method === "cash") next.splice(1, 1, { method: "transfer", amount: Math.max(total - safe, 0) });
    onChange("combined", next);
  };
  const balance = calculatePaymentBalance(total, payments);
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">{options.map((option) => <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => select(option.value)} className={cn("flex min-h-20 flex-col items-start justify-between rounded-2xl p-3 text-left ring-1 transition-all hover:-translate-y-0.5", mode === option.value ? "bg-primary text-white ring-primary shadow-lg" : "bg-[#f6f5f2] ring-black/5 hover:bg-white hover:shadow-md")}><option.icon className="size-5"/><span className="text-xs font-semibold">{option.label}</span></button>)}</div>
    {mode === "combined" && <div className="grid gap-3 rounded-2xl bg-[#f6f5f2] p-3 sm:grid-cols-2"><label className="text-xs font-medium">Efectivo<Input aria-label="Monto en efectivo" type="number" min="0" value={payments.find((p) => p.method === "cash")?.amount || ""} onChange={(e) => update("cash", Number(e.target.value))}/></label><label className="text-xs font-medium">Transferencia<Input aria-label="Monto por transferencia" type="number" min="0" value={payments.find((p) => p.method === "transfer")?.amount || ""} onChange={(e) => onChange("combined", payments.map((p) => p.method === "transfer" ? { ...p, amount: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } : p))}/></label><p role="status" className={cn("text-xs sm:col-span-2", balance.remaining === 0 && balance.excess === 0 ? "text-emerald-700" : "text-destructive")}>{balance.remaining > 0 ? `Faltan $ ${balance.remaining.toLocaleString("es-AR")}` : balance.excess > 0 ? `Sobran $ ${balance.excess.toLocaleString("es-AR")}` : "Importe distribuido correctamente"}</p></div>}
    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
  </div>;
};
