import type { SessionRepository } from "./repository-contracts";
import type { AuthenticatedSession } from "./types";
import { unauthenticatedError } from "./errors";
import { hashSessionToken } from "./session-token";
import { sessionRepository } from "@/lib/sessions/repository";

export type SessionDependencies = {
  sessions: Pick<SessionRepository, "findByTokenHash" | "touch" | "revoke">;
  hashToken: typeof hashSessionToken;
};

const defaultDependencies: SessionDependencies = {
  sessions: sessionRepository,
  hashToken: hashSessionToken,
};

const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const getCurrentSession = async (
  token: string | undefined,
  dependencies = defaultDependencies,
  now = new Date(),
): Promise<AuthenticatedSession> => {
  if (!token) throw unauthenticatedError();

  const stored = await dependencies.sessions.findByTokenHash(dependencies.hashToken(token));
  if (!stored) throw unauthenticatedError();

  const invalid = Boolean(stored.revokedAt) || new Date(stored.expiresAt) <= now || !stored.user.isActive;
  if (invalid) {
    if (!stored.revokedAt) await dependencies.sessions.revoke(stored.id, now.toISOString());
    throw unauthenticatedError();
  }

  const lastSeenAt = new Date(stored.lastSeenAt).getTime();
  if (now.getTime() - lastSeenAt >= SESSION_TOUCH_INTERVAL_MS) {
    await dependencies.sessions.touch(stored.id, now.toISOString());
  }
  return { sessionId: stored.id, expiresAt: stored.expiresAt, user: stored.user };
};

export const revokeSession = async (
  token: string | undefined,
  dependencies = defaultDependencies,
  now = new Date(),
) => {
  if (!token) return;
  const stored = await dependencies.sessions.findByTokenHash(dependencies.hashToken(token));
  if (stored && !stored.revokedAt) await dependencies.sessions.revoke(stored.id, now.toISOString());
};
