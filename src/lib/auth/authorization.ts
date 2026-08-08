import "server-only";

import { redirect } from "next/navigation";
import { MANAGER_ROLES } from "./constants";
import { getSessionCookie } from "./cookie";
import { AppError } from "./errors";
import { getCurrentSession } from "./session";
import type { SafeUser } from "./types";

export const assertManager = (user: SafeUser) => {
  if (!MANAGER_ROLES.has(user.role.name)) {
    throw new AppError("FORBIDDEN", "No tenés permisos para realizar esta acción.", 403);
  }
  return user;
};

export const requireUser = async () =>
  getCurrentSession(await getSessionCookie());

export const requireManager = async () => {
  const session = await requireUser();
  assertManager(session.user);
  return session;
};

export const requirePageUser = async () => {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
};
