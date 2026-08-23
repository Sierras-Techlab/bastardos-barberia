import type { Metadata } from "next";

import { CashView } from "@/components/cash/cash-view";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requireManagerPage } from "@/lib/auth/authorization";
import { getBuenosAiresToday } from "@/lib/cash/date";
import { getCashDay, listCashHistory } from "@/lib/cash/service";

export const metadata: Metadata = {
  title: "Caja",
  description: "Consultá y auditá la caja diaria de Bastardos Barbería.",
};

const CashPage = async () => {
  const { user } = await requireManagerPage();
  const today = getBuenosAiresToday();
  const [day, history] = await Promise.all([
    getCashDay(user, today),
    listCashHistory(user, { page: 1, pageSize: 12 }),
  ]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-5 md:px-7 xl:px-8">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">Control diario de caja</p>
            <h1 className="truncate font-semibold">Caja</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7">
        <div className="mb-6 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Economía del negocio</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Controlá cada jornada de principio a fin</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Abrí la caja con el saldo inicial, seguí las ventas y cerrá el día con el conteo de efectivo.</p>
        </div>

        <CashView initialDay={day} initialHistory={history} viewerRole={user.role.name} />
      </main>
    </>
  );
};

export default CashPage;
