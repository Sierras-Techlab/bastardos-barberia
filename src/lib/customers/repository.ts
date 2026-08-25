import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/auth/errors";
import type { CustomerRepository } from "@/lib/customers/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CustomerRow } from "@/lib/supabase/database.types";
import type { Customer } from "@/types/customer";
import { authorizeCustomerCatalogData } from "@/lib/customers/customer-catalog";

const paginatedCustomerVisitsSchema = z.object({
  items: z.array(z.object({
    id: z.uuid(),
    occurredAt: z.iso.datetime({ offset: true }),
    businessDate: z.iso.date(),
    totalSpent: z.number().int().nonnegative(),
    items: z.array(z.object({
      type: z.enum(["service", "product"]),
      name: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().int().nonnegative(),
      subtotal: z.number().int().nonnegative(),
    }).strict().refine(
      ({ quantity, unitPrice, subtotal }) => subtotal === unitPrice * quantity,
      { message: "Invalid customer visit subtotal" },
    )).min(1),
  }).strict()),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const CUSTOMER_SELECT = "id,first_name,last_name,phone,normalized_phone,email,visits,created_by,updated_by,deleted_at,deleted_by,created_at,updated_at,fixed_schedule:customer_fixed_schedules(weekday,local_time,is_active,version,monthly_price,responsible_user:users!customer_fixed_schedules_responsible_user_id_fkey(id,first_name,last_name))";
type CustomerScheduleRow = {
  weekday: number;
  local_time: string;
  is_active: boolean;
  version: number;
  monthly_price: number | string;
  responsible_user: { id: string; first_name: string; last_name: string } | Array<{ id: string; first_name: string; last_name: string }> | null;
};
type CustomerWithScheduleRow = CustomerRow & {
  fixed_schedule?: CustomerScheduleRow | Array<CustomerScheduleRow> | null;
};
const readSchedule = (row: CustomerWithScheduleRow) => {
  const schedule = Array.isArray(row.fixed_schedule) ? row.fixed_schedule[0] : row.fixed_schedule;
  if (!schedule) return null;
  const responsible = Array.isArray(schedule.responsible_user) ? schedule.responsible_user[0] : schedule.responsible_user;
  return { schedule, responsible };
};
export const normalizeCustomerPhone = (value: string) => value.replace(/\D/g, "");
export const toCustomer = (row: CustomerWithScheduleRow): Customer => {
  const resolved = readSchedule(row);
  const schedule = resolved?.schedule;
  const responsible = resolved?.responsible;
  const monthlyPrice = schedule ? Number(schedule.monthly_price) : 0;
  return ({
  id: row.id, firstName: row.first_name, lastName: row.last_name, phone: row.phone,
  email: row.email, visits: row.visits, createdAt: row.created_at,
  fixedSchedule: schedule?.is_active && responsible ? {
    weekday: schedule.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    time: schedule.local_time.slice(0, 5),
    responsibleProfessional: { id: responsible.id, firstName: responsible.first_name, lastName: responsible.last_name },
    monthlyPrice,
  } : null,
  fixedScheduleVersion: schedule?.version ?? null,
  lastVisitBusinessDate: null,
} as unknown as Customer);
};
const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};
const mutationFailure = (operation: string, error: { code?: string; details?: string; message?: string }): never => {
  const description = `${error.details ?? ""} ${error.message ?? ""}`;
  if (error.code === "23505" && description.includes("email")) {
    throw new AppError("CUSTOMER_EMAIL_EXISTS", "Ya existe un cliente con ese email.", 409);
  }
  if (error.code === "23505") {
    throw new AppError("CUSTOMER_PHONE_EXISTS", "Ya existe un cliente con ese teléfono.", 409);
  }
  if (description.includes("FIXED_SCHEDULE_INVALID")) {
    throw new AppError("FIXED_SCHEDULE_INVALID", "El horario habitual no es vÃ¡lido.", 400);
  }
  if (description.includes("FIXED_SCHEDULE_CONFLICT")) {
    throw new AppError("FIXED_SCHEDULE_CONFLICT", "El horario habitual fue modificado por otro usuario.", 409);
  }
  return databaseFailure(operation, error);
};
const readById = async (id: string) => {
  const { data, error } = await getSupabaseAdmin().from("customers").select(CUSTOMER_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) databaseFailure("find customer", error);
  return data ? toCustomer(data as unknown as CustomerWithScheduleRow) : null;
};
export const customerRepository: CustomerRepository = {
  async list(actorId) {
    const { data, error } = await getSupabaseAdmin().rpc("list_customers", { actor_user_id: actorId });
    if (error) databaseFailure("list customers", error);
    return authorizeCustomerCatalogData({ customers: data ?? [] }).customers;
  },
  async latest() {
    const { data, error } = await getSupabaseAdmin()
      .from("customers")
      .select(CUSTOMER_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) databaseFailure("latest customer", error);
    return data ? toCustomer(data as unknown as CustomerWithScheduleRow) : null;
  },
  async findById(id) {
    return readById(id);
  },
  async findByNormalizedPhone(phone) {
    const { data, error } = await getSupabaseAdmin().from("customers").select(CUSTOMER_SELECT).eq("normalized_phone", normalizeCustomerPhone(phone)).is("deleted_at", null).maybeSingle();
    if (error) databaseFailure("find customer by phone", error);
    return data ? toCustomer(data as unknown as CustomerWithScheduleRow) : null;
  },
  async create(input) {
    const { data, error } = await getSupabaseAdmin().rpc("create_customer", {
      actor_user_id: input.createdBy,
      new_first_name: input.firstName,
      new_last_name: input.lastName,
      new_phone: input.phone,
      new_email: input.email,
      fixed_schedule: input.fixedSchedule ? {
        weekday: input.fixedSchedule.weekday,
        time: input.fixedSchedule.time,
        responsible_user_id: input.fixedSchedule.responsibleUserId ?? null,
        monthly_price: input.fixedSchedule.monthlyPrice,
      } : null,
    });
    if (error) mutationFailure("create customer", error);
    if (typeof data !== "string") return databaseFailure("create customer", new Error("Missing customer"));
    const customer = await readById(data);
    if (!customer) return databaseFailure("create customer", new Error("Missing customer"));
    return customer;
  },
  async update(id, changes) {
    const { data, error } = await getSupabaseAdmin().rpc("update_customer", {
      target_customer_id: id,
      actor_user_id: changes.updatedBy,
      set_first_name: changes.firstName !== undefined,
      new_first_name: changes.firstName ?? null,
      set_last_name: changes.lastName !== undefined,
      new_last_name: changes.lastName ?? null,
      set_phone: changes.phone !== undefined,
      new_phone: changes.phone ?? null,
      set_email: changes.email !== undefined,
      new_email: changes.email ?? null,
      set_fixed_schedule: changes.fixedSchedule !== undefined,
      new_fixed_schedule: changes.fixedSchedule ? {
        weekday: changes.fixedSchedule.weekday,
        time: changes.fixedSchedule.time,
        responsible_user_id: changes.fixedSchedule.responsibleUserId ?? null,
        monthly_price: changes.fixedSchedule.monthlyPrice,
      } : null,
      expected_schedule_version: changes.expectedScheduleVersion ?? null,
    });
    if (error) mutationFailure("update customer", error);
    return typeof data === "string" ? readById(data) : null;
  },
  async softDelete(id, actorId, at) {
    const { data, error } = await getSupabaseAdmin().from("customers").update({ deleted_at: at, deleted_by: actorId, updated_by: actorId }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
    if (error) databaseFailure("delete customer", error);
    return data && typeof data.id === "string" ? data.id : null;
  },
  async listVisits(actorId, customerId, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_customer_visits", {
      actor_user_id: actorId,
      target_customer_id: customerId,
      page_number: query.page,
      page_size: query.pageSize,
    });
    if (error) databaseFailure("list customer visits", error);
    if (data === null) throw new AppError("CUSTOMER_NOT_FOUND", "No encontramos el cliente.", 404);
    const parsed = paginatedCustomerVisitsSchema.safeParse(data);
    if (!parsed.success) return databaseFailure("list customer visits", parsed.error);
    return parsed.data;
  },
};
