import type { RoleName } from "@/lib/auth/types";

export type RoleRow = { id: 1 | 2 | 3; name: RoleName; created_at: string };

export type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  password_hash: string;
  role_id: 1 | 2 | 3;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  password_changed_at: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UserWithRoleRow = UserRow & { role: Pick<RoleRow, "id" | "name"> };

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
  created_at: string;
};
