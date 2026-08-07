import {
  LOGIN_LOCK_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  SESSION_DURATION_MS,
} from "./constants";
import { invalidCredentialsError } from "./errors";
import { verifyPassword } from "./password";
import type { UserRepository, SessionRepository } from "./repository-contracts";
import type { LoginInput } from "./schemas";
import { generateSessionToken, hashSessionToken } from "./session-token";
import { sessionRepository } from "@/lib/sessions/repository";
import { userRepository } from "@/lib/users/repository";

export type LoginDependencies = {
  users: Pick<UserRepository, "findCredentialsByUsername" | "recordFailedLogin" | "recordSuccessfulLogin">;
  sessions: Pick<SessionRepository, "create">;
  verifyPassword: typeof verifyPassword;
  generateToken: typeof generateSessionToken;
  hashToken: typeof hashSessionToken;
};

const defaultDependencies: LoginDependencies = {
  users: userRepository,
  sessions: sessionRepository,
  verifyPassword,
  generateToken: generateSessionToken,
  hashToken: hashSessionToken,
};

export const login = async (
  input: LoginInput,
  dependencies = defaultDependencies,
  now = new Date(),
) => {
  const user = await dependencies.users.findCredentialsByUsername(input.username.trim().toLowerCase());
  const currentlyLocked = user?.lockedUntil && new Date(user.lockedUntil) > now;

  if (!user || !user.isActive || currentlyLocked) throw invalidCredentialsError();

  let passwordMatches = false;
  try {
    passwordMatches = await dependencies.verifyPassword(user.passwordHash, input.password);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_LOGIN_ATTEMPTS
      ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS).toISOString()
      : null;
    await dependencies.users.recordFailedLogin(user.id, attempts, lockedUntil);
    throw invalidCredentialsError();
  }

  const at = now.toISOString();
  await dependencies.users.recordSuccessfulLogin(user.id, at);
  const token = dependencies.generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
  await dependencies.sessions.create(user.id, dependencies.hashToken(token), expiresAt);

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: at,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
    expiresAt,
  };
};
