import type { ROLE_NAMES } from "./constants";

export type RoleName = (typeof ROLE_NAMES)[number];

export type Role = {
  id: 1 | 2 | 3;
  name: RoleName;
};

export type SafeUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CredentialUser = SafeUser & {
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
};

export type SessionWithUser = {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  user: SafeUser;
};

export type AuthenticatedSession = {
  sessionId: string;
  expiresAt: string;
  user: SafeUser;
};

export type PaginatedUsers = {
  items: SafeUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
