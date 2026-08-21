import { ArrowLeft, Clock3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { IncomeForm } from "@/components/incomes/income-form";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";
import { customerRepository } from "@/lib/customers/repository";
import { paymentMethodRepository } from "@/lib/payment-methods/repository";
import { productRepository } from "@/lib/products/repository";
import { serviceRepository } from "@/lib/services/repository";
import { userRepository } from "@/lib/users/repository";
import { getCurrentWorkSession } from "@/lib/work-sessions/service";
import type { IncomeFormData } from "@/types/income";

export const metadata: Metadata = {
  title: "Cargar ingreso",
  description: "Registrá una venta de Bastardos Barbería.",
};

const IncomePageHeader = () => (
  <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]">
    <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-5 md:px-7 xl:px-8">
      <SidebarTrigger className="-ml-1" />
      <Link
        href="/incomes"
        aria-label="Volver a ingresos"
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <ArrowLeft />
      </Link>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">Venta nueva</p>
        <h1 className="truncate font-semibold">Cargar ingreso</h1>
      </div>
    </div>
  </header>
);

const NewIncomePage = async () => {
  const { user } = await requirePageUser();
  const currentWorkSession =
    user.role.name === "employee"
      ? await getCurrentWorkSession(user)
      : null;

  if (user.role.name === "employee" && currentWorkSession === null) {
    return (
      <>
        <IncomePageHeader />
        <main className="mx-auto flex w-full max-w-[1600px] flex-1 items-start px-5 py-8 pb-32 md:px-7 xl:px-8 xl:py-12">
          <section className="w-full max-w-2xl rounded-[1.8rem] bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-primary">
              <Clock3 className="size-5" />
            </span>
            <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-primary uppercase">Jornada requerida</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              Iniciá tu jornada para cargar ventas
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              La entrada vincula cada venta con tu jornada real. Podés iniciarla desde Presentismo y volver a cargar el ingreso.
            </p>
            <Link
              href="/work-sessions"
              className={buttonVariants({ className: "mt-6 h-10 rounded-xl px-4" })}
            >
              Ir a Presentismo
            </Link>
          </section>
        </main>
      </>
    );
  }

  const [services, products, customers, paymentMethods, users] =
    await Promise.all([
      serviceRepository.list(false),
      productRepository.list(false),
      customerRepository.list(),
      paymentMethodRepository.list(false),
      user.role.name === "employee"
        ? Promise.resolve(null)
        : userRepository.list({
            page: 1,
            pageSize: 100,
            status: "active",
          }),
    ]);
  const remainingUserPages =
    users && users.totalPages > 1
      ? await Promise.all(
          Array.from({ length: users.totalPages - 1 }, (_, index) =>
            userRepository.list({
              page: index + 2,
              pageSize: 100,
              status: "active",
            }),
          ),
        )
      : [];
  const availableUsers = users
    ? [users.items, ...remainingUserPages.map((page) => page.items)].flat()
    : [user];
  const data: IncomeFormData = {
    currentUser: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    },
    services: services.map(({ id, name, price }) => ({ id, name, price })),
    products: products.map(({ id, name, price, stock }) => ({
      id,
      name,
      price,
      stock,
    })),
    customers,
    paymentMethods,
    employees: availableUsers.map((candidate) => ({
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      role: candidate.role.name,
      isActive: candidate.isActive,
      serviceCommissionRate: candidate.serviceCommissionRate,
      productCommissionRate: candidate.productCommissionRate,
    })),
  };

  return (
    <>
      <IncomePageHeader />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Nuevo movimiento</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Registrá la venta en pocos pasos</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Combiná un servicio con productos, elegí cómo se pagó y revisá todo antes de confirmar.</p>
        </div>
        <IncomeForm data={data} />
      </main>
    </>
  );
};

export default NewIncomePage;
