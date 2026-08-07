import type { UserRepository, NewUserRecord, UserRecordChanges } from "@/lib/auth/repository-contracts";
import type { CredentialUser, Role, SafeUser } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { UserWithRoleRow } from "@/lib/supabase/database.types";

const USER_SELECT = "id,first_name,last_name,username,password_hash,role_id,is_active,failed_login_attempts,locked_until,last_login_at,password_changed_at,created_by,created_at,updated_at,role:roles!users_role_id_fkey(id,name)";

const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

export const toSafeUser = (row: UserWithRoleRow): SafeUser => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  username: row.username,
  role: row.role,
  isActive: row.is_active,
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

export const userRepository: UserRepository = {
  async findCredentialsByUsername(username) {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select(USER_SELECT)
      .eq("username", username)
      .maybeSingle();
    if (error) databaseFailure("find user credentials", error);
    return data ? toCredentialUser(asUserRow(data)) : null;
  },

  async findById(id) {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select(USER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) databaseFailure("find user", error);
    return data ? toSafeUser(asUserRow(data)) : null;
  },

  async list(queryInput) {
    const from = (queryInput.page - 1) * queryInput.pageSize;
    let query = getSupabaseAdmin()
      .from("users")
      .select(USER_SELECT, { count: "exact" })
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
      items: (data ?? []).map((row) => toSafeUser(asUserRow(row))),
      page: queryInput.page,
      pageSize: queryInput.pageSize,
      total,
      totalPages: Math.ceil(total / queryInput.pageSize),
    };
  },

  async create(input: NewUserRecord) {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .insert({ first_name: input.firstName, last_name: input.lastName, password_hash: input.passwordHash, role_id: input.roleId, created_by: input.createdBy })
      .select(USER_SELECT)
      .single();
    if (error) databaseFailure("create user", error);
    return toSafeUser(asUserRow(data));
  },

  async update(id, changes: UserRecordChanges) {
    const values: Record<string, unknown> = {};
    if (changes.firstName !== undefined) values.first_name = changes.firstName;
    if (changes.lastName !== undefined) values.last_name = changes.lastName;
    if (changes.roleId !== undefined) values.role_id = changes.roleId;
    if (changes.isActive !== undefined) values.is_active = changes.isActive;
    if (changes.passwordHash !== undefined) values.password_hash = changes.passwordHash;
    if (changes.passwordChangedAt !== undefined) values.password_changed_at = changes.passwordChangedAt;
    if (changes.failedLoginAttempts !== undefined) values.failed_login_attempts = changes.failedLoginAttempts;
    if (changes.lockedUntil !== undefined) values.locked_until = changes.lockedUntil;

    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .update(values)
      .eq("id", id)
      .select(USER_SELECT)
      .maybeSingle();
    if (error) databaseFailure("update user", error);
    return data ? toSafeUser(asUserRow(data)) : null;
  },

  async recordFailedLogin(id, attempts, lockedUntil) {
    const { error } = await getSupabaseAdmin().from("users").update({
      failed_login_attempts: attempts,
      locked_until: lockedUntil,
    }).eq("id", id);
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
      .eq("is_active", true);
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
