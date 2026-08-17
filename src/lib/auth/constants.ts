export const ROLE_IDS = { owner: 1, admin: 2, employee: 3 } as const;
export const ROLE_NAMES = ["owner", "admin", "employee"] as const;
export const MANAGER_ROLES = new Set(["owner", "admin"]);

export const SESSION_COOKIE_NAME = "bastardos_session";
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1_000;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1_000;
