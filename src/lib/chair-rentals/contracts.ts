import { z } from "zod";
import type { EmployeeCommercialAgreement, ChairRentalList, ChairRentalPayment } from "@/types/chair-rental";
import { confirmChairRentalSchema, periodSchema, voidChairRentalSchema } from "./schemas";

export const chairRentalPaymentSchema = z.object({
  id: z.uuid(), employeeId: z.uuid(), employeeName: z.string().min(1), period: periodSchema,
  amount: z.number().int().positive().safe(), status: z.enum(["pending", "paid", "overdue", "voided"]),
  paymentMethodId: z.uuid().nullable(), paymentMethodName: z.string().nullable(),
  confirmedBy: z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }).nullable(),
  paidAt: z.iso.datetime({ offset: true }).nullable(), businessDate: z.iso.date().nullable(), incomeId: z.uuid().nullable(),
  voidedAt: z.iso.datetime({ offset: true }).nullable(), voidedBy: z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }).nullable(),
  voidReason: z.string().nullable(),
}).strict();
export const chairRentalListSchema = z.object({
  items: z.array(chairRentalPaymentSchema), page: z.number().int().positive(), pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative(),
}).strict();

export type ChairRentalRepository = {
  getAgreement(actorId: string, employeeId: string): Promise<EmployeeCommercialAgreement | null>;
  updateAgreement(actorId: string, employeeId: string, input: EmployeeCommercialAgreement): Promise<EmployeeCommercialAgreement | null>;
  list(actorId: string, query: { period?: string; status?: string; page: number; pageSize: number }): Promise<ChairRentalList>;
  detail(actorId: string, employeeId: string): Promise<ChairRentalPayment[]>;
  confirm(actorId: string, employeeId: string, input: z.infer<typeof confirmChairRentalSchema>): Promise<ChairRentalPayment>;
  void(actorId: string, paymentId: string, input: z.infer<typeof voidChairRentalSchema>): Promise<ChairRentalPayment>;
};
export type ChairRentalDependencies = { rentals: ChairRentalRepository };
export type { EmployeeCommercialAgreement, ChairRentalList, ChairRentalPayment };
