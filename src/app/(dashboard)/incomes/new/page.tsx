import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IncomeForm } from "@/components/incomes/income-form";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";
import { customerRepository } from "@/lib/customers/repository";
import { productRepository } from "@/lib/products/repository";
import { serviceRepository } from "@/lib/services/repository";
import type { IncomeFormData } from "@/types/income";

export const metadata: Metadata = { title: "Cargar ingreso", description: "Registrá una venta de Bastardos Barbería." };
const NewIncomePage = async () => {
  const { user } = await requirePageUser();
  const [services, products, customers] = await Promise.all([
    serviceRepository.list(false), productRepository.list(false), customerRepository.list(),
  ]);
  const data: IncomeFormData = {
    currentUser: { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role.name },
    services: services.map(({ id, name, price }) => ({ id, name, price })),
    products: products.map(({ id, name, price, stock }) => ({ id, name, price, stock })),
    customers,
  };
  return <><header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]"><div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-5 md:px-7 xl:px-8"><SidebarTrigger className="-ml-1" /><Link href="/incomes" aria-label="Volver a ingresos" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}><ArrowLeft /></Link><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">Venta nueva</p><h1 className="truncate font-semibold">Cargar ingreso</h1></div></div></header><main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7"><div className="mb-6 max-w-2xl"><p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Nuevo movimiento</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Registrá la venta en pocos pasos</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Combiná un servicio con productos, elegí cómo se pagó y revisá todo antes de confirmar.</p></div><IncomeForm data={data} /></main></>;
};
export default NewIncomePage;
