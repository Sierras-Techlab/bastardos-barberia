"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  incomeFormSchema,
  type IncomeFormValues,
} from "@/lib/incomes/income-schema";
import {
  calculateIncomeTotal,
  formatArs,
} from "@/lib/incomes/income-calculations";
import { incomeClient as defaultIncomeClient, type IncomeClient } from "@/lib/incomes/client";
import type {
  CreateIncomeInput,
  Income,
  IncomeFormData,
} from "@/types/income";
import { IncomeConfirmationDialog } from "./income-confirmation-dialog";
import { CustomerSelector } from "./customer-selector";
import { IncomeSummary } from "./income-summary";
import { IncomeSuccessState } from "./income-success-state";
import { PaymentMethodSelector } from "./payment-method-selector";
import { ProductSelector } from "./product-selector";
import { ServiceSelector } from "./service-selector";

type IncomeFormProps = {
  data: IncomeFormData;
  incomeClient?: Pick<IncomeClient, "create">;
};

const currentDateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export const IncomeForm = ({ data, incomeClient = defaultIncomeClient }: IncomeFormProps) => {
  const [reviewValues, setReviewValues] = useState<IncomeFormValues | null>(
    null,
  );
  const [createdIncome, setCreatedIncome] = useState<Income | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState(data.customers);
  const submittingRef = useRef(false);
  const requestIdRef = useRef(crypto.randomUUID());
  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      customerId: null,
      serviceId: null,
      products: [],
      paymentMethod: null,
    },
  });
  const values = useWatch({ control: form.control }) as IncomeFormValues;
  const liveData = { ...data, customers };

  const handleReview = (validValues: IncomeFormValues) => {
    setSubmitError(null);
    setReviewValues(validValues);
  };

  const handleConfirm = async () => {
    if (
      !reviewValues ||
      !reviewValues.paymentMethod ||
      submittingRef.current
    ) {
      return;
    }

    const input: CreateIncomeInput = {
      requestId: requestIdRef.current,
      customerId: reviewValues.customerId,
      serviceId: reviewValues.serviceId,
      products: reviewValues.products,
      paymentMethod: reviewValues.paymentMethod,
    };
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const income = await incomeClient.create(input);
      setCreatedIncome(income);
      setReviewValues(null);
      requestIdRef.current = crypto.randomUUID();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el ingreso.",
      );
      setReviewValues(null);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    form.reset({
      customerId: null,
      serviceId: null,
      products: [],
      paymentMethod: null,
    });
    setCreatedIncome(null);
    setSubmitError(null);
    setReviewValues(null);
  };

  if (createdIncome) {
    return <IncomeSuccessState income={createdIncome} onReset={handleReset} />;
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleReview)}
      className="grid items-start gap-5 pb-24 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.38fr)] xl:pb-0"
      noValidate
    >
      <div className="space-y-5">
        <Card className="overflow-visible rounded-[1.6rem] border-0 bg-white shadow-sm ring-0">
          <CardHeader>
            <CardTitle>Datos de la venta</CardTitle>
            <CardDescription>
              Identificá quién registra el ingreso y, si corresponde, al
              cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="employeeId"
                className="text-sm font-medium text-foreground"
              >
                Empleado responsable
              </label>
              <div id="employeeId" className="flex h-11 items-center gap-2 rounded-xl bg-[#f6f5f2] px-3 text-sm">
                <UserRound className="size-4 text-primary" />
                {data.currentUser.firstName} {data.currentUser.lastName}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="customerId"
                className="text-sm font-medium text-foreground"
              >
                Cliente opcional
              </label>
              <Controller
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <CustomerSelector
                    id="customerId"
                    customers={customers}
                    value={field.value}
                    onChange={field.onChange}
                    onCustomerCreated={(customer) => {
                      setCustomers((current) => [...current, customer]);
                      field.onChange(customer.id);
                    }}
                  />
                )}
              />
            </div>

            <div className="flex items-center gap-2 text-xs capitalize text-muted-foreground sm:col-span-2">
              <CalendarDays className="size-4 text-primary" />
              {currentDateFormatter.format(new Date())}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-0">
          <CardHeader>
            <CardTitle>Servicio</CardTitle>
            <CardDescription>
              Podés registrar la venta sin servicio si solo incluye productos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="serviceId"
              render={({ field, fieldState }) => (
                <ServiceSelector
                  services={data.services}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-0">
          <CardHeader>
            <CardTitle>Productos</CardTitle>
            <CardDescription>
              Buscá productos y ajustá sus cantidades antes de continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="products"
              render={({ field }) => (
                <ProductSelector
                  products={data.products}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-0">
          <CardHeader>
            <CardTitle>Medio de pago</CardTitle>
            <CardDescription>
              Seleccioná cómo se recibió el importe total.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="paymentMethod"
              render={({ field, fieldState }) => (
                <PaymentMethodSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-20">
        <IncomeSummary values={values} data={liveData} />
        {submitError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm font-medium text-destructive"
          >
            {submitError}
          </p>
        )}
        <div
          role="region"
          aria-label="Acción de ingreso"
          className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl bg-white/95 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur xl:static xl:block xl:bg-transparent xl:p-0 xl:shadow-none xl:ring-0"
        >
          <div className="min-w-0 flex-1 px-2 xl:hidden">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total actual
            </span>
            <span className="block truncate text-lg font-semibold tracking-tight">
              {formatArs(
                calculateIncomeTotal(values, data.services, data.products),
              )}
            </span>
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-12 flex-1 rounded-xl text-base shadow-[0_14px_30px_-16px_rgba(229,37,42,0.75)] xl:w-full"
          >
            Revisar ingreso
          </Button>
        </div>
      </aside>

      {reviewValues && (
        <IncomeConfirmationDialog
          open
          values={reviewValues}
          data={liveData}
          pending={isSubmitting}
          onBack={() => setReviewValues(null)}
          onConfirm={handleConfirm}
        />
      )}
    </form>
  );
};
