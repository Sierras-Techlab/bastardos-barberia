import {
  CircleDollarSign,
  CreditCard,
  Lock,
  MinusCircle,
  Scissors,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

import dashboardMock from "@/data/dashboard.mock.json";
import type { DashboardData } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";

const dashboard = dashboardMock as DashboardData;

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: dashboard.business.currency,
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: dashboard.business.currency,
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const quickActions = [
  { label: "Cargar ingreso", icon: CircleDollarSign, primary: true },
  { label: "Nuevo cliente", icon: UserPlus },
  { label: "Registrar gasto", icon: MinusCircle },
  { label: "Cerrar caja", icon: Lock },
];

const activityIcons = {
  income: CircleDollarSign,
  customer: UserPlus,
  expense: MinusCircle,
  cash: Lock,
};

const Home = async () => {
  await requirePageUser();
  const { summary, revenue, topServices, paymentMethods, recentActivity } =
    dashboard;
  const currentDate = dateFormatter.format(new Date());
  const maxRevenue = Math.max(...revenue.series.map((item) => item.value));

  const metrics = [
    {
      label: "Ingresos del día",
      value: compactCurrencyFormatter.format(summary.dailyRevenue),
      detail: "Facturación registrada",
      icon: WalletCards,
      className: "bg-[#202023] text-white",
      iconClassName: "bg-white/10 text-white",
    },
    {
      label: "Servicios realizados",
      value: summary.servicesPerformed.toString(),
      detail: "Cortes y servicios",
      icon: Scissors,
      className: "bg-primary text-primary-foreground",
      iconClassName: "bg-white/15 text-white",
    },
    {
      label: "Promedio por venta",
      value: compactCurrencyFormatter.format(summary.averageTicket),
      detail: "Promedio por venta",
      icon: CircleDollarSign,
      className: "bg-white text-[#18181b]",
      iconClassName: "bg-[#f1f0ed] text-primary",
    },
    {
      label: "Clientes atendidos",
      value: summary.customersServed.toString(),
      detail: "Personas atendidas",
      icon: Users,
      className: "bg-[#d9d7d2] text-[#18181b]",
      iconClassName: "bg-white/70 text-[#18181b]",
    },
  ];

  return (
    <>
          <header className="mx-auto flex h-16 w-full max-w-[1600px] shrink-0 items-center justify-between px-5 md:px-7 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <div className="min-w-0">
                <p className="truncate font-semibold">Dashboard</p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {currentDate}
                </p>
              </div>
            </div>
            <Badge className="rounded-full bg-white px-3 py-2 text-[#18181b] shadow-sm hover:bg-white">
              <span className="size-2 rounded-full bg-primary" />
              Datos de demostración
            </Badge>
          </header>

          <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-5 pb-5 md:px-7 xl:min-h-0 xl:gap-4 xl:overflow-hidden xl:px-8 xl:pb-7">
            <section className="grid shrink-0 items-end gap-6 xl:grid-cols-[minmax(14rem,0.62fr)_minmax(0,1.8fr)]">
              <div className="pb-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Resumen diario
                </p>
                <h1 className="max-w-sm text-3xl font-semibold leading-[1.02] tracking-[-0.04em] lg:text-4xl">
                  Resumen del negocio
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-5 text-muted-foreground">
                  La actividad de {dashboard.business.name}, de un vistazo.
                </p>
              </div>

              <div
                aria-label="Métricas del día"
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {metrics.map((metric, index) => (
                  <article
                    key={metric.label}
                    className={`flex min-h-36 flex-col justify-between rounded-[1.6rem] p-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_45px_-25px_rgba(0,0,0,0.35)] xl:h-40 2xl:h-44 ${metric.className}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[11px] font-medium opacity-55">
                        0{index + 1}
                      </span>
                      <span
                        className={`flex size-8 items-center justify-center rounded-full ${metric.iconClassName}`}
                      >
                        <metric.icon className="size-3.5" />
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold tracking-tight 2xl:text-3xl">
                        {metric.value}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold leading-tight">
                        {metric.label}
                      </p>
                      <p className="mt-1 text-[11px] opacity-55">{metric.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-4 xl:h-[54vh] xl:max-h-[510px] xl:min-h-0 xl:grid-cols-12">
              <Card className="rounded-[1.6rem] border-0 bg-white py-5 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] ring-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_65px_-38px_rgba(0,0,0,0.3)] xl:col-span-5 xl:min-h-0">
                <CardHeader className="px-5">
                  <div>
                    <CardTitle className="text-lg">Ingresos</CardTitle>
                    <CardDescription>{revenue.period}</CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-[#f1f0ed] text-[#18181b]"
                  >
                    +{revenue.changePercentage}%
                  </Badge>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col px-5">
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight">
                        {currencyFormatter.format(revenue.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Promedio por venta {currencyFormatter.format(revenue.averageTicket)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Meta {compactCurrencyFormatter.format(revenue.goal)}
                    </p>
                  </div>
                  <div className="flex min-h-28 flex-1 items-end gap-2 rounded-2xl bg-[#f6f5f2] px-3 pt-4 pb-2">
                    {revenue.series.map((item) => (
                      <div
                        key={item.label}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                      >
                        <div className="group/bar relative flex h-full w-full items-end justify-center">
                          <span className="pointer-events-none absolute top-0 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-1 rounded-lg bg-[#202023] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover/bar:-translate-y-2 group-hover/bar:opacity-100">
                            {item.transactions}{" "}
                            {item.transactions === 1 ? "ingreso" : "ingresos"} ·{" "}
                            {currencyFormatter.format(item.value)}
                          </span>
                          <div
                            className="w-full max-w-8 origin-bottom rounded-t-lg bg-primary transition-all duration-300 hover:scale-y-[1.04] hover:bg-[#d91f24]"
                            style={{
                              height: `${Math.max((item.value / maxRevenue) * 100, 4)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.6rem] border-0 bg-white py-5 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] ring-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_65px_-38px_rgba(0,0,0,0.3)] xl:col-span-3 xl:min-h-0">
                <CardHeader className="px-5">
                  <CardTitle className="text-lg">Servicios destacados</CardTitle>
                  <CardDescription>Por facturación semanal</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-center gap-2 px-5">
                  {topServices.map((service) => (
                    <div
                      key={service.name}
                      className="rounded-xl px-2 py-1.5 transition-colors duration-200 hover:bg-[#f6f5f2]"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{service.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {service.sales} ventas · {compactCurrencyFormatter.format(service.revenue)}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {service.share}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#eeece8]">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${service.share}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-1 border-t pt-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Medios de pago
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {paymentMethods.map((method) => (
                        <span
                          key={method.name}
                          className="rounded-full bg-[#f1f0ed] px-2 py-1 text-[10px] transition-colors hover:bg-primary hover:text-white"
                          title={`${method.transactions} operaciones · ${currencyFormatter.format(method.amount)}`}
                        >
                          {method.name} {method.share}%
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:col-span-4 xl:min-h-0 xl:grid-rows-[auto_1fr]">
                <Card className="rounded-[1.6rem] border-0 bg-[#202023] py-4 text-white ring-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                  <CardHeader className="px-5">
                    <CardTitle className="text-base text-white">Acciones rápidas</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-4 gap-2 px-5">
                    {quickActions.map((action) => (
                      <Button
                        key={action.label}
                        variant="ghost"
                        className={`aspect-square h-auto flex-col gap-2 rounded-2xl p-2 text-center text-[10px] whitespace-normal ${
                          action.primary
                            ? "bg-primary text-white hover:scale-[1.03] hover:bg-primary/90 hover:text-white"
                            : "bg-white/8 text-white hover:scale-[1.03] hover:bg-white/15 hover:text-white"
                        }`}
                      >
                        <action.icon className="size-4" />
                        <span className="leading-tight">{action.label}</span>
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-[1.6rem] border-0 bg-white py-4 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] ring-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_65px_-38px_rgba(0,0,0,0.3)] xl:min-h-0">
                  <CardHeader className="px-5">
                    <div>
                      <CardTitle className="text-base">Actividad reciente</CardTitle>
                      <CardDescription>
                        {paymentMethods.length} medios de pago activos
                      </CardDescription>
                    </div>
                    <CreditCard className="size-4 text-primary" />
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-center gap-2 px-5">
                    {recentActivity.slice(0, 3).map((activity) => {
                      const ActivityIcon = activityIcons[activity.type];

                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-3 rounded-xl bg-[#f6f5f2] p-2 transition-all duration-200 hover:translate-x-1 hover:bg-[#eeece8]"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                            <ActivityIcon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">
                              {activity.title}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {activity.description}
                            </p>
                          </div>
                          <span className="shrink-0 text-[9px] text-muted-foreground">
                            {activity.time}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </section>
          </main>
    </>
  );
};

export default Home;
