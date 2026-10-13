import type { EmployeeCommercialAgreement, ChairRentalList, ChairRentalPayment } from "@/types/chair-rental";
import { z } from "zod";
import type { ConfirmChairRentalInput, VoidChairRentalInput } from "./service-types";
import { chairRentalListSchema, chairRentalPaymentSchema } from "./contracts";
import { employeeCommercialAgreementSchema } from "./schemas";

type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
export class ChairRentalApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string[]>) { super(message); this.name = "ChairRentalApiError"; }
}
const request = async <T>(url: string, schema: { parse: (value: unknown) => T }, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json() as ErrorBody & { data?: T };
  if (!response.ok) throw new ChairRentalApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operación.", body.error?.fields);
   try {
     return schema.parse(body.data);
   } catch {
     throw new ChairRentalApiError(response.status, "INVALID_RESPONSE", "La respuesta del alquiler no es válida.");
   }
};
const json = (method: "PATCH" | "POST", body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const chairRentalClient = {
  list(query = "") { return request<ChairRentalList>(`/api/chair-rentals${query ? `?${query}` : ""}`, chairRentalListSchema); },
  detail(employeeId: string) { return request<ChairRentalPayment[]>(`/api/chair-rentals/${encodeURIComponent(employeeId)}`, z.array(chairRentalPaymentSchema)); },
  agreement(employeeId: string) { return request<EmployeeCommercialAgreement>(`/api/admin/users/${encodeURIComponent(employeeId)}/agreement`, employeeCommercialAgreementSchema); },
  updateAgreement(employeeId: string, input: EmployeeCommercialAgreement) { return request<EmployeeCommercialAgreement>(`/api/admin/users/${encodeURIComponent(employeeId)}/agreement`, employeeCommercialAgreementSchema, json("PATCH", input)); },
  confirm(employeeId: string, input: ConfirmChairRentalInput) { return request<ChairRentalPayment>(`/api/chair-rentals/${encodeURIComponent(employeeId)}/payments`, chairRentalPaymentSchema, json("POST", input)); },
  void(paymentId: string, input: VoidChairRentalInput) { return request<ChairRentalPayment>(`/api/chair-rentals/payments/${encodeURIComponent(paymentId)}/void`, chairRentalPaymentSchema, json("POST", input)); },
};
