"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays } from "lucide-react";
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
  employeeIncomeFormSchema,
  managerIncomeFormSchema,
  type EmployeeIncomeFormValues,
  type IncomeFormValues,
  type ManagerIncomeFormValues,
} from "@/lib/incomes/income-schema";
import {
  calculateIncomeTotal,
  formatArs,
} from "@/lib/incomes/income-calculations";
import { incomeClient as defaultIncomeClient, type IncomeClient } from "@/lib/incomes/client";
import type {
  CreateIncomeInput,
  EmployeeCatalogProduct,
  EmployeeCatalogService,
  EmployeeIncomeListItem,
  IncomeFormData,
  IncomeFormEmployee,
  IncomeListItem,
} from "@/types/income";
import { IncomeConfirmationDialog } from "./income-confirmation-dialog";
import { CustomerSelector } from "./customer-selector";
import { IncomeSummary } from "./income-summary";
import { IncomeSuccessState } from "./income-success-state";
import { LinePriceEditor, type LinePriceOverride } from "./line-price-editor";
import { PaymentMethodSelector } from "./payment-method-selector";
import { ProductSelector } from "./product-selector";
import { ServiceSelector } from "./service-selector";
import { EmployeeSelector } from "./employee-selector";
import { CommissionPreview } from "./commission-preview";

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

const buildTotalInputs = (data: IncomeFormData) => {
  if (data.viewer === "manager") {
    return {
      services: data.services,
      products: data.products,
    };
  }
  const services: EmployeeCatalogService[] = data.services;
  const products: EmployeeCatalogProduct[] = data.products;
  return {
    services: services.map((service) => ({ id: service.id, name: service.name, price: service.earning })),
    products: products.map((product) => ({ id: product.id, name: product.name, price: product.earning, stock: product.stock })),
  };
};

const employeeFallback: IncomeFormEmployee = {
  id: "",
  firstName: "",
  lastName: "",
  role: "employee",
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
};

export const IncomeForm = ({ data, incomeClient = defaultIncomeClient }: IncomeFormProps) => {
  const [reviewValues, setReviewValues] = useState<IncomeFormValues | null>(
    null,
  );
  const [createdIncome, setCreatedIncome] = useState<IncomeListItem | EmployeeIncomeListItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState(data.customers);
  const submittingRef = useRef(false);
  const requestIdRef = useRef(crypto.randomUUID());

  const isManager = data.viewer === "manager";
  const schema = isManager ? managerIncomeFormSchema : employeeIncomeFormSchema;
  const activePaymentMethods = data.paymentMethods.filter((method) => method.isActive);
  const form = useForm<ManagerIncomeFormValues | EmployeeIncomeFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: isManager
      ? ({
          customerId: null,
          employeeId: data.currentUser.id,
          serviceId: null,
          products: [],
          payments: [],
          grantFullServiceCommission: false,
          servicePriceOverride: null,
          productPriceOverrides: [],
        } satisfies ManagerIncomeFormValues)
      : ({
          customerId: null,
          employeeId: data.currentUser.id,
          serviceId: null,
          products: [],
          payments: activePaymentMethods.length > 0
            ? [{ paymentMethodId: activePaymentMethods[0].id, basisPoints: 10000 }]
            : [],
          grantFullServiceCommission: false,
          servicePriceOverride: null,
          productPriceOverrides: [],
        } satisfies EmployeeIncomeFormValues),
  });

  const values = useWatch({ control: form.control }) as ManagerIncomeFormValues | EmployeeIncomeFormValues;
  const liveData = { ...data, customers };
  const totalInputs = buildTotalInputs(data);

  const handleReview = (validValues: ManagerIncomeFormValues | EmployeeIncomeFormValues) => {
    setSubmitError(null);
    const total = calculateIncomeTotal(validValues, totalInputs.services, totalInputs.products);
    if (isManager) {
      const managerValues = validValues as ManagerIncomeFormValues;
      if (total === 0 && managerValues.payments.length === 0) {
        setReviewValues(managerValues);
        return;
      }
      const totalAmount = managerValues.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      if (totalAmount !== total) {
        form.setError("payments", { message: "Distribuí el importe total entre medios de pago válidos." });
        setSubmitError("Distribuí el importe total entre medios de pago válidos.");
        return;
      }
    } else {
      const employeeValues = validValues as EmployeeIncomeFormValues;
      const employeeBasisSum = employeeValues.payments.reduce(
        (sum, payment) => sum + payment.basisPoints,
        0,
      );
      if (employeeBasisSum !== 10000) {
        form.setError("payments", { message: "Los porcentajes deben sumar 100%." });
        setSubmitError("Los porcentajes deben sumar 100%.");
        return;
      }
    }
    setReviewValues(validValues as IncomeFormValues);
  };

  const handleConfirm = async () => {
    if (
      !reviewValues ||
      submittingRef.current
    ) {
      return;
    }

    const payments: CreateIncomeInput["payments"] = isManager
      ? (reviewValues as ManagerIncomeFormValues).payments
          .filter((payment) => payment.amount > 0)
          .map((payment) => ({ paymentMethodId: payment.paymentMethodId, amount: payment.amount }))
      : (reviewValues as EmployeeIncomeFormValues).payments
          .filter((payment) => payment.basisPoints > 0)
          .map((payment) => ({ paymentMethodId: payment.paymentMethodId, basisPoints: payment.basisPoints }));

    const managerReview = isManager ? (reviewValues as ManagerIncomeFormValues) : null;
    const servicePriceOverride = managerReview?.servicePriceOverride ?? null;
    const productPriceOverridesEntries = (managerReview?.productPriceOverrides ?? [])
      .filter((entry) => entry.override !== null) as Array<{ productId: string; override: { chargedUnitPrice: number; reason: string } }>;
    const productPriceOverrides = productPriceOverridesEntries.length > 0
      ? Object.fromEntries(productPriceOverridesEntries.map((entry) => [entry.productId, entry.override]))
      : undefined;

    const input: CreateIncomeInput = {
      requestId: requestIdRef.current,
      employeeId: reviewValues.employeeId,
      customerId: reviewValues.customerId,
      serviceId: reviewValues.serviceId,
      products: reviewValues.products,
      payments,
      grantFullServiceCommission: reviewValues.grantFullServiceCommission,
      ...(isManager ? { servicePriceOverride, productPriceOverrides } : {}),
    };
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const income = await incomeClient.create(data.currentUser.role, input);
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
    form.reset(
      isManager
        ? ({
            customerId: null,
            employeeId: data.currentUser.id,
            serviceId: null,
            products: [],
            payments: [],
            grantFullServiceCommission: false,
            servicePriceOverride: null,
            productPriceOverrides: [],
          } satisfies ManagerIncomeFormValues)
        : ({
            customerId: null,
            employeeId: data.currentUser.id,
            serviceId: null,
            products: [],
            payments: activePaymentMethods.length > 0
              ? [{ paymentMethodId: activePaymentMethods[0].id, basisPoints: 10000 }]
              : [],
            grantFullServiceCommission: false,
            servicePriceOverride: null,
            productPriceOverrides: [],
          } satisfies EmployeeIncomeFormValues),
    );
    setCreatedIncome(null);
    setSubmitError(null);
    setReviewValues(null);
  };

  if (createdIncome) {
    return <IncomeSuccessState income={createdIncome} viewerRole={data.currentUser.role} onReset={handleReset} />;
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleReview as never)}
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
            {isManager && data.viewer === "manager" && <div className="space-y-2">
              <label
                htmlFor="employeeId"
                className="text-sm font-medium text-foreground"
              >
                Empleado responsable
              </label>
              <Controller control={form.control} name="employeeId" render={({ field, fieldState }) => <EmployeeSelector currentUser={data.currentUser} employees={data.employees ?? [employeeFallback]} value={field.value} onChange={(id) => { field.onChange(id); form.setValue("grantFullServiceCommission", false); form.setValue("products", values.products.map((product) => ({ ...product, grantFullCommission: false }))); }} error={fieldState.error?.message} />} />
            </div>}

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
                  onChange={(serviceId) => {
                    field.onChange(serviceId);
                    form.setValue("grantFullServiceCommission", false);
                    form.setValue("servicePriceOverride", null);
                  }}
                  error={fieldState.error?.message}
                />
              )}
            />
            {isManager && values.serviceId && (() => {
              const catalogService = data.services.find((s) => "price" in s && s.id === values.serviceId);
              if (!catalogService) return null;
              return <Controller control={form.control} name="servicePriceOverride" render={({ field }) => (
                <div className="mt-3">
                  <LinePriceEditor
                    catalogUnitPrice={"price" in catalogService ? catalogService.price : 0}
                    label={catalogService.name}
                    value={field.value as LinePriceOverride | null}
                    onChange={(next) => field.onChange(next)}
                  />
                </div>
              )} />;
            })()}
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
                  canGrantFullCommission={isManager && data.viewer === "manager" && (data.currentUser.role === "owner" || data.currentUser.role === "admin") && values.employeeId !== data.currentUser.id && (data.employees?.find((employee) => employee.id === values.employeeId)?.role ?? data.currentUser.role) !== "owner"}
                />
              )}
            />
            {isManager && values.products.length > 0 && (
              <div className="mt-3 space-y-3">
                <Controller control={form.control} name="productPriceOverrides" render={({ field }) => (
                  <>
                    {values.products.map((productLine) => {
                      const catalogProduct = data.products.find((p) => p.id === productLine.productId);
                      if (!catalogProduct) return null;
                      const currentOverrides = field.value as Array<{ productId: string; override: LinePriceOverride | null }>;
                      const existing = currentOverrides.find((o) => o.productId === productLine.productId);
                      return (
                        <LinePriceEditor
                          key={productLine.productId}
                          catalogUnitPrice={"price" in catalogProduct ? catalogProduct.price : 0}
                          label={`${catalogProduct.name} × ${productLine.quantity}`}
                          value={existing?.override ?? null}
                          onChange={(next) => {
                            const others = currentOverrides.filter((o) => o.productId !== productLine.productId);
                            field.onChange([...others, { productId: productLine.productId, override: next }]);
                          }}
                        />
                      );
                    })}
                  </>
                )} />
              </div>
            )}
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
              name="payments"
              render={({ field, fieldState }) => (
                <PaymentMethodSelector
                  mode={isManager ? "manager" : "employee"}
                  methods={data.paymentMethods}
                  payments={field.value}
                  total={isManager ? calculateIncomeTotal(values, totalInputs.services, totalInputs.products) : undefined}
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
        <CommissionPreview values={values} data={liveData} onGrantFullServiceCommission={(checked) => form.setValue("grantFullServiceCommission", checked)} />
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
          {isManager && (
            <div className="min-w-0 flex-1 px-2 xl:hidden">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total actual
              </span>
              <span className="block truncate text-lg font-semibold tracking-tight">
                {formatArs(
                  calculateIncomeTotal(values, totalInputs.services, totalInputs.products),
                )}
              </span>
            </div>
          )}
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
