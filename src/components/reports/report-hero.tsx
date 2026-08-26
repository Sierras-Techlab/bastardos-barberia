import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });

export function ReportHero({ cutoff, result, previousResult, projectedResult }: {
  month: string; cutoff: string; result: number; previousResult: number; projectedResult: number | null;
}) {
  const improved = result >= previousResult;
  return <section className="overflow-hidden rounded-[1.75rem] bg-[#20231f] p-5 text-white shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">Resultado operativo</p><p className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{money.format(result)}</p><p className="mt-2 text-sm text-white/60">Datos hasta el {day.format(new Date(`${cutoff}T12:00:00Z`))}</p></div>
      <div className="rounded-2xl bg-white/8 px-4 py-3 text-sm"><div className="flex items-center gap-2">{improved ? <ArrowUpRight className="size-4 text-emerald-300" /> : <ArrowDownRight className="size-4 text-rose-300" />}<span>{money.format(result - previousResult)} frente al período comparable</span></div></div>
    </div>
    {projectedResult !== null && <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5"><Sparkles className="size-4 text-amber-300" /><div><p className="text-xs text-white/55">Estimación de cierre</p><p className="font-semibold">{money.format(projectedResult)}</p></div></div>}
  </section>;
}
