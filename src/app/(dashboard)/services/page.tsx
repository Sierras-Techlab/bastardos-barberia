import type { Metadata } from "next";

import { ServicesView } from "@/components/services/services-view";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import servicesMock from "@/data/services.mock.json";
import { requirePageUser } from "@/lib/auth/authorization";
import { authorizeServiceCatalogData } from "@/lib/services/service-catalog";

export const metadata: Metadata = { title: "Servicios", description: "Consultá y administrá los servicios de Bastardos Barbería." };
const servicesData = authorizeServiceCatalogData(servicesMock);

const ServicesPage = async () => {
  const { user } = await requirePageUser();
  const canManage = user.role.name === "owner" || user.role.name === "admin";
  return <><header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]"><div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-5 md:px-7 xl:px-8"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="-ml-1" /><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">Catálogo · Agosto 2026</p><h1 className="truncate font-semibold">Servicios</h1></div></div><Badge className="rounded-full bg-white px-3 py-2 text-[#18181b] shadow-sm hover:bg-white"><span className="size-2 rounded-full bg-primary" /><span className="hidden sm:inline">Datos de demostración</span><span className="sm:hidden">Demo</span></Badge></div></header><main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7"><div className="mb-6 max-w-2xl"><p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Carta de servicios</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Simple de consultar, fácil de mantener</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Revisá los servicios disponibles y sus precios actuales antes de registrar una venta.</p></div><ServicesView data={servicesData} canManage={canManage} /></main></>;
};

export default ServicesPage;
