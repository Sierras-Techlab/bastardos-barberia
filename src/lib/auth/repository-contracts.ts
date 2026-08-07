import type { UserListQuery } from "./schemas";
import type {
  CredentialUser,
  PaginatedUsers,
  Role,
  SafeUser,
  SessionWithUser,
} from "./types";

export type NewUserRecord = {
  firstName: string;
  lastName: string;
  passwordHash: string;
  roleId: 1 | 2 | 3;
  createdBy: string | null;
};

export type UserRecordChanges = Partial<{
  firstName: string;
  lastName: string;
  roleId: 1 | 2 | 3;
  isActive: boolean;
  passwordHash: string;
  passwordChangedAt: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}>;

export interface UserRepository {
  findCredentialsByUsername(username: string): Promise<CredentialUser | null>;
  findById(id: string): Promise<SafeUser | null>;
  list(query: UserListQuery): Promise<PaginatedUsers>;
  create(input: NewUserRecord): Promise<SafeUser>;
  update(id: string, changes: UserRecordChanges): Promise<SafeUser | null>;
  recordFailedLogin(id: string, maxAttempts: number, attemptedAt: string, lockedUntil: string): Promise<void>;
  recordSuccessfulLogin(id: string, at: string): Promise<void>;
  countActiveOwners(): Promise<number>;
  countUsers(): Promise<number>;
  listRoles(): Promise<Role[]>;
}

export interface SessionRepository {
  create(userId: string, tokenHash: string, expiresAt: string): Promise<string>;
  findByTokenHash(tokenHash: string): Promise<SessionWithUser | null>;
  touch(id: string, at: string): Promise<void>;
  revoke(id: string, at: string): Promise<void>;
  revokeAllForUser(userId: string, at: string): Promise<void>;
}
