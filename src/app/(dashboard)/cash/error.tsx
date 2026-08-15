"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

type CashErrorProps = { error: Error & { digest?: string }; retry: () => void };

const CashError = ({ retry }: CashErrorProps) => (
  <main className="flex min-h-svh items-center justify-center bg-[#f1f0ed] px-5">
    <div className="flex max-w-md flex-col items-center rounded-[1.75rem] bg-white px-8 py-10 text-center shadow-sm ring-1 ring-black/5">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertCircle className="size-5" /></span>
      <h1 className="mt-4 text-xl font-semibold">No pudimos calcular la caja</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Puede ser un problema temporal al conciliar los movimientos. Volvé a intentarlo.</p>
      <Button type="button" className="mt-5 rounded-xl" onClick={retry}><RotateCcw /> Intentar de nuevo</Button>
    </div>
  </main>
);

export default CashError;
