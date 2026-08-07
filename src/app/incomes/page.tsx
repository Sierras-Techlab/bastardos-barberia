import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { IncomesView } from "@/components/incomes/incomes-view";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import incomesMock from "@/data/incomes.mock.json";
import { authorizeIncomeListData } from "@/lib/incomes/income-list";
import type { IncomeListData } from "@/types/income";

export const metadata: Metadata = {
  title: "Ingresos",
  description: "Consultá el historial de ventas de Bastardos Barbería.",
};

const incomesData = authorizeIncomeListData(incomesMock as IncomeListData);

const IncomesPage = () => (
  <>
    <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-5 md:px-7 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  Ventas · Agosto 2026
                </p>
                <h1 className="truncate font-semibold">Ingresos</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="hidden rounded-full bg-white px-3 py-2 text-[#18181b] shadow-sm hover:bg-white sm:flex">
                <span className="size-2 rounded-full bg-primary" />
                Datos de demostración
              </Badge>
              <Link
                href="/incomes/new"
                className={buttonVariants({ className: "rounded-xl" })}
              >
                <Plus />
                <span className="hidden sm:inline">Cargar ingreso</span>
                <span className="sm:hidden">Cargar</span>
              </Link>
            </div>
          </div>
    </header>

    <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7">
          <div className="mb-6 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Libro de ventas
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              Todo lo que ingresó, en un solo lugar
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Revisá servicios y productos vendidos, filtrá movimientos y
              consultá el detalle de cada operación.
            </p>
          </div>

          <IncomesView data={incomesData} />
    </main>
  </>
);

export default IncomesPage;
