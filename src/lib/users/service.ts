import "server-only";

import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SessionRepository, UserRepository } from "@/lib/auth/repository-contracts";
import type { CreateUserInput, UpdateUserInput, UserListQuery } from "@/lib/auth/schemas";
import type { SafeUser } from "@/lib/auth/types";
import { sessionRepository } from "@/lib/sessions/repository";
import { userRepository } from "./repository";

export type UserServiceDependencies = {
  users: UserRepository;
  sessions: Pick<SessionRepository, "revokeAllForUser">;
  hashPassword: typeof hashPassword;
};

const defaultDependencies: UserServiceDependencies = {
  users: userRepository,
  sessions: sessionRepository,
  hashPassword,
};

const requireTarget = async (id: string, dependencies: UserServiceDependencies) => {
  const target = await dependencies.users.findById(id);
  if (!target) throw new AppError("USER_NOT_FOUND", "Usuario no encontrado.", 404);
  return target;
};

export const listUsers = (actor: SafeUser, query: UserListQuery, dependencies = defaultDependencies) => {
  assertManager(actor);
  return dependencies.users.list(query);
};

export const getUser = async (actor: SafeUser, id: string, dependencies = defaultDependencies) => {
  assertManager(actor);
  return requireTarget(id, dependencies);
};

export const createUser = async (actor: SafeUser, input: CreateUserInput, dependencies = defaultDependencies) => {
  assertManager(actor);
  const passwordHash = await dependencies.hashPassword(input.password);
  return dependencies.users.create({
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash,
    roleId: input.roleId,
    serviceCommissionRate: input.serviceCommissionRate,
    productCommissionRate: input.productCommissionRate,
    createdBy: actor.id,
  });
};

export const updateUser = async (
  actor: SafeUser,
  id: string,
  changes: UpdateUserInput,
  dependencies = defaultDependencies,
  now = new Date(),
) => {
  assertManager(actor);
  const target = await requireTarget(id, dependencies);

  if (actor.id === id && changes.isActive === false) {
    throw new AppError("CANNOT_DEACTIVATE_SELF", "No podés desactivar tu propia cuenta.", 409);
  }

  const removesActiveOwner = target.role.name === "owner" && target.isActive && (
    changes.isActive === false || (changes.roleId !== undefined && changes.roleId !== 1)
  );
  if (removesActiveOwner && await dependencies.users.countActiveOwners() <= 1) {
    throw new AppError("LAST_OWNER_REQUIRED", "Debe quedar al menos un owner activo.", 409);
  }

  const updated = await dependencies.users.update(id, changes);
  if (!updated) throw new AppError("USER_NOT_FOUND", "Usuario no encontrado.", 404);
  if (changes.isActive === false) {
    await dependencies.sessions.revokeAllForUser(id, now.toISOString());
  }
  return updated;
};

export const deleteUser = async (
  actor: SafeUser,
  id: string,
  dependencies = defaultDependencies,
  now = new Date(),
) => {
  assertManager(actor);
  await requireTarget(id, dependencies);

  if (actor.id === id) {
    throw new AppError(
      "CANNOT_DELETE_SELF",
      "No podés eliminar tu propia cuenta.",
      409,
    );
  }

  const deletedId = await dependencies.users.softDelete(
    id,
    actor.id,
    now.toISOString(),
  );
  if (!deletedId) {
    throw new AppError("USER_NOT_FOUND", "Usuario no encontrado.", 404);
  }

  return { id: deletedId };
};

export const resetUserPassword = async (
  actor: SafeUser,
  id: string,
  password: string,
  dependencies = defaultDependencies,
  now = new Date(),
) => {
  assertManager(actor);
  await requireTarget(id, dependencies);
  const at = now.toISOString();
  const updated = await dependencies.users.update(id, {
    passwordHash: await dependencies.hashPassword(password),
    passwordChangedAt: at,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
  if (!updated) throw new AppError("USER_NOT_FOUND", "Usuario no encontrado.", 404);
  await dependencies.sessions.revokeAllForUser(id, at);
  return updated;
};

export const listRoles = (actor: SafeUser, dependencies = defaultDependencies) => {
  assertManager(actor);
  return dependencies.users.listRoles();
};
