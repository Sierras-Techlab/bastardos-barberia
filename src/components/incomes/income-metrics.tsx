import { Banknote, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buildIncomeMetricCards } from "@/lib/incomes/income-metric-cards";
import type { IncomeListMetrics, UserRole } from "@/types/income";

type Props = { metrics: IncomeListMetrics; role?: UserRole };
const tones = { dark: "bg-[#202023] text-white", primary: "bg-primary text-primary-foreground", light: "bg-white text-foreground", muted: "bg-[#d9d7d2] text-foreground" };
const icons = [CircleDollarSign, WalletCards, ReceiptText, Banknote];
export const IncomeMetrics = ({ metrics, role = "owner" }: Props) => <section aria-label="Resumen de ingresos" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{buildIncomeMetricCards(metrics, role).map((item, index) => { const Icon = icons[index]; return <Card key={item.label} className={`min-h-36 rounded-[1.5rem] border-0 py-0 shadow-sm ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${tones[item.tone]}`}><CardContent className="flex h-full flex-col justify-between gap-6 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium opacity-65">{item.label}</p><span className="flex size-8 items-center justify-center rounded-full bg-current/5"><Icon className="size-4" /></span></div><div><p className="text-xl font-semibold tracking-tight sm:text-2xl">{item.value}</p><p className="mt-1 text-[11px] opacity-55">{item.detail}</p></div></CardContent></Card>; })}</section>;
