import { z } from "zod";

const integer = z.number().int();
const nonnegativeAmount = integer.nonnegative();
const nonpositiveAmount = integer.max(0);

const cashPersonSchema = z
  .object({
    id: z.uuid(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  })
  .strict();

const cashLifecycleSchema = z
  .object({
    openingBalance: nonnegativeAmount,
    openingSource: z.enum(["manual", "first_income", "initial_balance"]).nullable(),
    openedAt: z.iso.datetime({ offset: true }).nullable(),
    openedBy: cashPersonSchema.nullable(),
    expectedCash: integer,
    countedCash: integer.nonnegative().nullable(),
    difference: integer.nullable(),
    closeMode: z.enum(["manual", "automatic"]).nullable(),
    reconciliationState: z.enum(["not_applicable", "pending_confirmation", "confirmed"]),
  })
  .strict()
  .superRefine((lifecycle, context) => {
    if (lifecycle.countedCash !== null && lifecycle.difference === null) {
      context.addIssue({ code: "custom", message: "El conteo requiere una diferencia calculada." });
    }
    if (lifecycle.difference !== null && lifecycle.countedCash === null) {
      context.addIssue({ code: "custom", message: "La diferencia requiere un conteo declarado." });
    }
    if (lifecycle.countedCash !== null && lifecycle.difference !== null) {
      const derived = lifecycle.countedCash - lifecycle.expectedCash;
      if (derived !== lifecycle.difference) {
        context.addIssue({ code: "custom", message: "La diferencia no coincide con el conteo esperado." });
      }
    }
    if (lifecycle.reconciliationState === "confirmed" && lifecycle.countedCash === null) {
      context.addIssue({ code: "custom", message: "Una caja confirmada necesita un conteo." });
    }
    if (lifecycle.reconciliationState === "not_applicable" && lifecycle.closeMode !== null) {
      context.addIssue({ code: "custom", message: "El modo de cierre requiere estado no aplicable." });
    }
  });

export const cashSummarySchema = z
  .object({
    salesGrossTotal: nonnegativeAmount,
    salesCommissionTotal: nonnegativeAmount,
    salesBarbershopNet: nonnegativeAmount,
    adjustmentGrossTotal: nonpositiveAmount,
    adjustmentCommissionTotal: nonpositiveAmount,
    adjustmentBarbershopNet: nonpositiveAmount,
    grossTotal: integer,
    commissionTotal: integer,
    barbershopNet: integer,
    serviceTotal: integer,
    productTotal: integer,
    saleCount: integer.nonnegative(),
    activeSaleCount: integer.nonnegative(),
    voidedSaleCount: integer.nonnegative(),
    adjustmentCount: integer.nonnegative(),
  })
  .strict()
  .superRefine((summary, context) => {
    const identitiesAreValid =
      summary.salesCommissionTotal + summary.salesBarbershopNet ===
        summary.salesGrossTotal &&
      summary.adjustmentCommissionTotal +
        summary.adjustmentBarbershopNet ===
        summary.adjustmentGrossTotal &&
      summary.salesGrossTotal + summary.adjustmentGrossTotal ===
        summary.grossTotal &&
      summary.salesCommissionTotal + summary.adjustmentCommissionTotal ===
        summary.commissionTotal &&
      summary.salesBarbershopNet + summary.adjustmentBarbershopNet ===
        summary.barbershopNet &&
      summary.serviceTotal + summary.productTotal === summary.grossTotal &&
      summary.activeSaleCount + summary.voidedSaleCount ===
        summary.saleCount;

    if (!identitiesAreValid) {
      context.addIssue({
        code: "custom",
        message: "Los totales de caja no se reconcilian.",
      });
    }
  });

const cashPaymentTotalSchema = z
  .object({
    paymentMethodId: z.uuid(),
    name: z.string().min(1),
    salesAmount: nonnegativeAmount,
    adjustmentAmount: nonpositiveAmount,
    netAmount: integer,
  })
  .strict()
  .refine(
    ({ salesAmount, adjustmentAmount, netAmount }) =>
      salesAmount + adjustmentAmount === netAmount,
    { message: "El total del medio de pago no se reconcilia." },
  );

const cashSaleAuditItemSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
    employee: cashPersonSchema,
    customerName: z.string().min(1).nullable(),
    kind: z.enum(["service", "products", "combined", "subscription"]),
    statusAtClose: z.enum(["active", "voided"]),
    currentStatus: z.enum(["active", "voided"]),
    grossTotal: nonnegativeAmount,
    commissionTotal: nonnegativeAmount,
    barbershopNet: nonnegativeAmount,
  })
  .strict()
  .refine(
    ({ grossTotal, commissionTotal, barbershopNet }) =>
      commissionTotal + barbershopNet === grossTotal,
    { message: "La venta auditada no se reconcilia." },
  );

const cashAdjustmentSchema = z
  .object({
    id: z.uuid(),
    sourceIncomeId: z.uuid(),
    originalBusinessDate: z.iso.date(),
    createdAt: z.iso.datetime({ offset: true }),
    createdBy: cashPersonSchema,
    grossDelta: integer.negative(),
    commissionDelta: nonpositiveAmount,
    barbershopNetDelta: nonpositiveAmount,
  })
  .strict()
  .refine(
    ({ grossDelta, commissionDelta, barbershopNetDelta }) =>
      commissionDelta + barbershopNetDelta === grossDelta,
    { message: "El ajuste de caja no se reconcilia." },
  );

export const cashDaySchema = z
  .object({
    id: z.uuid().nullable(),
    businessDate: z.iso.date(),
    state: z.enum(["live", "closed"]),
    closedAt: z.iso.datetime({ offset: true }).nullable(),
    lifecycle: cashLifecycleSchema,
    summary: cashSummarySchema,
    payments: z.array(cashPaymentTotalSchema),
    sales: z.array(cashSaleAuditItemSchema),
    adjustments: z.array(cashAdjustmentSchema),
  })
  .strict()
  .superRefine((cash, context) => {
    const validLifecycle =
      (cash.state === "live" && cash.closedAt === null) ||
      (cash.state === "closed" && cash.id !== null && cash.closedAt !== null);
    const paymentSales = cash.payments.reduce(
      (total, payment) => total + payment.salesAmount,
      0,
    );
    const paymentAdjustments = cash.payments.reduce(
      (total, payment) => total + payment.adjustmentAmount,
      0,
    );

    if (!validLifecycle) {
      context.addIssue({ code: "custom", message: "Estado de caja inválido." });
    }
    if (
      paymentSales !== cash.summary.salesGrossTotal ||
      paymentAdjustments !== cash.summary.adjustmentGrossTotal
    ) {
      context.addIssue({
        code: "custom",
        message: "Los medios de pago no se reconcilian con la caja.",
      });
    }
  });

export const cashHistoryItemSchema = z
  .object({
    id: z.uuid(),
    businessDate: z.iso.date(),
    state: z.literal("closed"),
    closedAt: z.iso.datetime({ offset: true }),
    lifecycle: cashLifecycleSchema,
    summary: cashSummarySchema,
    payments: z.array(cashPaymentTotalSchema).optional(),
    sales: z.array(cashSaleAuditItemSchema).optional(),
    adjustments: z.array(cashAdjustmentSchema).optional(),
  })
  .strict();

export const cashHistoryQuerySchema = z
  .object({
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict()
  .refine(
    ({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo,
    { message: "El rango de fechas no es válido." },
  );

export const paginatedCashHistorySchema = z
  .object({
    items: z.array(cashHistoryItemSchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const setCashOpeningBalanceInputSchema = z
  .object({ openingBalance: z.number().int().nonnegative() })
  .strict();
export const countedCashInputSchema = z
  .object({ countedCash: z.number().int().nonnegative() })
  .strict();
export const confirmCashInputSchema = countedCashInputSchema;
