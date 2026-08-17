import type { UserRepository, NewUserRecord, UserRecordChanges } from "@/lib/auth/repository-contracts";
import type { CredentialUser, Role, SafeUser } from "@/lib/auth/types";
import { AppError } from "@/lib/auth/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { UserWithRoleRow } from "@/lib/supabase/database.types";

export type SafeUserRow = Pick<
  UserWithRoleRow,
  "id" | "first_name" | "last_name" | "username" | "is_active" | "service_commission_rate" | "product_commission_rate" | "last_login_at" | "created_at" | "updated_at" | "role"
>;

const SAFE_USER_SELECT = "id,first_name,last_name,username,is_active,service_commission_rate,product_commission_rate,last_login_at,created_at,updated_at,role:roles!users_role_id_fkey(id,name)";
const CREDENTIAL_USER_SELECT = "id,first_name,last_name,username,password_hash,is_active,service_commission_rate,product_commission_rate,failed_login_attempts,locked_until,last_login_at,created_at,updated_at,role:roles!users_role_id_fkey(id,name)";

const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

export const userMutationFailure = (operation: string, error: { code?: string; message?: string }): never => {
  if (error.code === "22023" && error.message === "INVALID_USERNAME_COMPONENT") {
    throw new AppError(
      "INVALID_USERNAME_COMPONENT",
      "El nombre y el apellido deben generar un usuario v\u00e1lido.",
      400,
    );
  }
  if (error.code === "P0001" && error.message === "LAST_OWNER_REQUIRED") {
    throw new AppError("LAST_OWNER_REQUIRED", "Debe quedar al menos un owner activo.", 409);
  }
  if (error.code === "P0001" && error.message === "CANNOT_DELETE_SELF") {
    throw new AppError(
      "CANNOT_DELETE_SELF",
      "No podés eliminar tu propia cuenta.",
      409,
    );
  }
  return databaseFailure(operation, error);
};

export const toSafeUser = (row: SafeUserRow): SafeUser => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  username: row.username,
  role: row.role,
  isActive: row.is_active,
  serviceCommissionRate: row.service_commission_rate,
  productCommissionRate: row.product_commission_rate,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toCredentialUser = (row: UserWithRoleRow): CredentialUser => ({
  ...toSafeUser(row),
  passwordHash: row.password_hash,
  failedLoginAttempts: row.failed_login_attempts,
  lockedUntil: row.locked_until,
});

const asUserRow = (value: unknown) => value as UserWithRoleRow;
const asSafeUserRow = (value: unknown) => value as SafeUserRow;

const findSafeUserById = async (id: string) => {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select(SAFE_USER_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) databaseFailure("find user", error);
  return data ? toSafeUser(asSafeUserRow(data)) : null;
};

export const userRepository: UserRepository = {
  async findCredentialsByUsername(username) {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select(CREDENTIAL_USER_SELECT)
      .eq("username", username)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) databaseFailure("find user credentials", error);
    return data ? toCredentialUser(asUserRow(data)) : null;
  },

  async findById(id) {
    return findSafeUserById(id);
  },

  async list(queryInput) {
    const from = (queryInput.page - 1) * queryInput.pageSize;
    let query = getSupabaseAdmin()
      .from("users")
      .select(SAFE_USER_SELECT, { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + queryInput.pageSize - 1);

    const search = queryInput.search?.replace(/[,()%]/g, "").trim();
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%`);
    if (queryInput.roleId) query = query.eq("role_id", queryInput.roleId);
    if (queryInput.status !== "all") query = query.eq("is_active", queryInput.status === "active");

    const { data, error, count } = await query;
    if (error) databaseFailure("list users", error);
    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => toSafeUser(asSafeUserRow(row))),
      page: queryInput.page,
      pageSize: queryInput.pageSize,
      total,
      totalPages: Math.ceil(total / queryInput.pageSize),
    };
  },

  async create(input: NewUserRecord) {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .insert({ first_name: input.firstName, last_name: input.lastName, password_hash: input.passwordHash, role_id: input.roleId, service_commission_rate: input.serviceCommissionRate, product_commission_rate: input.productCommissionRate, created_by: input.createdBy })
      .select(SAFE_USER_SELECT)
      .single();
    if (error) userMutationFailure("create user", error);
    return toSafeUser(asSafeUserRow(data));
  },

  async update(id, changes: UserRecordChanges) {
    const hasProfileChanges = changes.firstName !== undefined
      || changes.lastName !== undefined
      || changes.roleId !== undefined
      || changes.isActive !== undefined
      || changes.serviceCommissionRate !== undefined
      || changes.productCommissionRate !== undefined;
    const hasCredentialChanges = changes.passwordHash !== undefined
      || changes.passwordChangedAt !== undefined
      || changes.failedLoginAttempts !== undefined
      || changes.lockedUntil !== undefined;

    if (hasProfileChanges && hasCredentialChanges) {
      throw new Error("Profile and credential changes must be separate operations.");
    }

    if (hasProfileChanges) {
      const { error } = await getSupabaseAdmin().rpc("update_user_profile", {
        target_user_id: id,
        set_first_name: changes.firstName !== undefined,
        new_first_name: changes.firstName ?? null,
        set_last_name: changes.lastName !== undefined,
        new_last_name: changes.lastName ?? null,
        set_role_id: changes.roleId !== undefined,
        new_role_id: changes.roleId ?? null,
        set_is_active: changes.isActive !== undefined,
        new_is_active: changes.isActive ?? null,
        set_service_commission_rate: changes.serviceCommissionRate !== undefined,
        new_service_commission_rate: changes.serviceCommissionRate ?? null,
        set_product_commission_rate: changes.productCommissionRate !== undefined,
        new_product_commission_rate: changes.productCommissionRate ?? null,
      });
      if (error) userMutationFailure("update user profile", error);
      return findSafeUserById(id);
    }

    const values: Record<string, unknown> = {};
    if (changes.passwordHash !== undefined) values.password_hash = changes.passwordHash;
    if (changes.passwordChangedAt !== undefined) values.password_changed_at = changes.passwordChangedAt;
    if (changes.failedLoginAttempts !== undefined) values.failed_login_attempts = changes.failedLoginAttempts;
    if (changes.lockedUntil !== undefined) values.locked_until = changes.lockedUntil;

    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .update(values)
      .eq("id", id)
      .is("deleted_at", null)
      .select(SAFE_USER_SELECT)
      .maybeSingle();
    if (error) databaseFailure("update user", error);
    return data ? toSafeUser(asSafeUserRow(data)) : null;
  },

  async softDelete(id, actorId, at) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "soft_delete_user",
      {
        target_user_id: id,
        actor_user_id: actorId,
        deletion_time: at,
      },
    );
    if (error) userMutationFailure("delete user", error);
    return typeof data === "string" ? data : null;
  },

  async recordFailedLogin(id, maxAttempts, attemptedAt, lockedUntil) {
    const { error } = await getSupabaseAdmin().rpc("record_failed_login", {
      target_user_id: id,
      max_attempts: maxAttempts,
      attempted_at: attemptedAt,
      lock_until: lockedUntil,
    });
    if (error) databaseFailure("record failed login", error);
  },

  async recordSuccessfulLogin(id, at) {
    const { error } = await getSupabaseAdmin().from("users").update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: at,
    }).eq("id", id);
    if (error) databaseFailure("record successful login", error);
  },

  async countActiveOwners() {
    const { count, error } = await getSupabaseAdmin()
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role_id", 1)
      .eq("is_active", true)
      .is("deleted_at", null);
    if (error) databaseFailure("count active owners", error);
    return count ?? 0;
  },

  async countUsers() {
    const { count, error } = await getSupabaseAdmin().from("users").select("id", { count: "exact", head: true });
    if (error) databaseFailure("count users", error);
    return count ?? 0;
  },

  async listRoles() {
    const { data, error } = await getSupabaseAdmin().from("roles").select("id,name").order("id");
    if (error) databaseFailure("list roles", error);
    return (data ?? []) as Role[];
  },
};
