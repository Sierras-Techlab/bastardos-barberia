import { LoaderCircle } from "lucide-react";

const CashLoading = () => (
  <main className="flex min-h-svh items-center justify-center bg-[#f1f0ed] px-5">
    <div role="status" aria-label="Cargando caja" className="flex max-w-sm flex-col items-center rounded-[1.75rem] bg-white px-8 py-10 text-center shadow-sm ring-1 ring-black/5">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><LoaderCircle className="size-5 animate-spin" /></span>
      <p className="mt-4 font-semibold">Calculando la caja</p>
      <p className="mt-1 text-sm text-muted-foreground">Estamos conciliando ventas, comisiones y medios de pago.</p>
    </div>
  </main>
);

export default CashLoading;

