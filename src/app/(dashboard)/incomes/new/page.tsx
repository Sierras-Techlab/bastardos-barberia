import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IncomeForm } from "@/components/incomes/income-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import incomeFormMock from "@/data/income-form.mock.json";
import type { IncomeFormData } from "@/types/income";
import { requirePageUser } from "@/lib/auth/authorization";

export const metadata: Metadata = {
  title: "Cargar ingreso",
  description: "Registrá una venta de Bastardos Barbería.",
};

const incomeFormData = incomeFormMock as IncomeFormData;

const NewIncomePage = async () => {
  await requirePageUser();

  return (
  <>
    <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-5 md:px-7 xl:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Link
                href="/incomes"
                aria-label="Volver a ingresos"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <ArrowLeft />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  Venta nueva
                </p>
                <h1 className="truncate font-semibold">Cargar ingreso</h1>
              </div>
            </div>
            <Badge className="rounded-full bg-white px-3 py-2 text-[#18181b] shadow-sm hover:bg-white">
              <span className="size-2 rounded-full bg-primary" />
              Datos de demostración
            </Badge>
          </div>
    </header>

    <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7">
          <div className="mb-6 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Nuevo movimiento
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              Registrá la venta en pocos pasos
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Combiná un servicio con productos, elegí cómo se pagó y revisá
              todo antes de confirmar.
            </p>
          </div>

          <IncomeForm data={incomeFormData} />
    </main>
  </>
  );
};

export default NewIncomePage;
