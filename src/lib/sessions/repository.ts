import type { SessionRepository } from "@/lib/auth/repository-contracts";
import type { SessionWithUser } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SessionRow, UserWithRoleRow } from "@/lib/supabase/database.types";
import { toSafeUser } from "@/lib/users/repository";

type SessionJoinRow = SessionRow & { user: UserWithRoleRow };

const SESSION_SELECT = "id,user_id,token_hash,expires_at,revoked_at,last_seen_at,created_at,user:users!sessions_user_id_fkey(id,first_name,last_name,username,password_hash,role_id,is_active,failed_login_attempts,locked_until,last_login_at,password_changed_at,created_by,created_at,updated_at,role:roles!users_role_id_fkey(id,name))";

const fail = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

export const sessionRepository: SessionRepository = {
  async create(userId, tokenHash, expiresAt) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
      .select("id")
      .single();
    if (error) fail("create session", error);
    if (!data) fail("create session", new Error("Missing inserted session"));
    return data!.id as string;
  },

  async findByTokenHash(tokenHash) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) fail("find session", error);
    if (!data) return null;
    const row = data as unknown as SessionJoinRow;
    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      user: toSafeUser(row.user),
    } satisfies SessionWithUser;
  },

  async touch(id, at) {
    const { error } = await getSupabaseAdmin().from("sessions").update({ last_seen_at: at }).eq("id", id);
    if (error) fail("touch session", error);
  },

  async revoke(id, at) {
    const { error } = await getSupabaseAdmin().from("sessions").update({ revoked_at: at }).eq("id", id).is("revoked_at", null);
    if (error) fail("revoke session", error);
  },

  async revokeAllForUser(userId, at) {
    const { error } = await getSupabaseAdmin().from("sessions").update({ revoked_at: at }).eq("user_id", userId).is("revoked_at", null);
    if (error) fail("revoke user sessions", error);
  },
};
