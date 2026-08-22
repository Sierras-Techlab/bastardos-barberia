import type { Metadata } from "next";
import { CustomersWorkspace } from "@/components/customers/customers-workspace";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";
import { listCustomers } from "@/lib/customers/service";
import { listPaymentMethods } from "@/lib/payment-methods/service";
import { listUsers } from "@/lib/users/service";

export const metadata: Metadata = { title: "Clientes", description: "Consultá y administrá los clientes de Bastardos Barbería." };
const CustomersPage = async () => {
  const { user } = await requirePageUser();
  const isManager = user.role.name === "owner" || user.role.name === "admin";
  const [customersData, paymentMethodsResponse, professionalList] = await Promise.all([
    listCustomers(user),
    listPaymentMethods(user),
    isManager ? listUsers(user, { page: 1, pageSize: 100, status: "active" }).then((result) => result.items) : Promise.resolve([]),
  ]);
  const paymentMethods = paymentMethodsResponse.paymentMethods;
  const canDelete = isManager;
  const professionals = professionalList.map((professional) => ({ id: professional.id, firstName: professional.firstName, lastName: professional.lastName, isActive: professional.isActive }));
  return <><header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]"><div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-5 md:px-7 xl:px-8"><SidebarTrigger className="-ml-1" /><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">Directorio actual</p><h1 className="truncate font-semibold">Clientes</h1></div></div></header><main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7"><div className="mb-6 max-w-2xl"><p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Base de clientes</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Tu comunidad, siempre cerca</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Encontrá rápidamente los datos de contacto, consultá visitas y cobrá las mensualidades de los clientes habituales.</p></div><CustomersWorkspace data={customersData} canDelete={canDelete} currentUserId={user.id} currentUserRole={user.role.name} professionals={professionals} paymentMethods={paymentMethods} /></main></>;
};
export default CustomersPage;
