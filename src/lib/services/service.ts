import { assertManager } from "@/lib/auth/authorization";
import { MANAGER_ROLES } from "@/lib/auth/constants";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { ServiceServiceDependencies } from "@/lib/services/contracts";
import { serviceRepository } from "@/lib/services/repository";
import type { CreateServiceInput, UpdateServiceInput } from "@/types/service-catalog";

const serviceNotFound = () =>
  new AppError("SERVICE_NOT_FOUND", "No encontramos el servicio.", 404);

const defaultDependencies: ServiceServiceDependencies = {
  services: serviceRepository,
  now: () => new Date().toISOString(),
};

export const listServices = async (
  actor: SafeUser,
  dependencies: ServiceServiceDependencies = defaultDependencies,
) => ({
  services: await dependencies.services.list(MANAGER_ROLES.has(actor.role.name)),
});

export const createService = async (
  actor: SafeUser,
  input: CreateServiceInput,
  dependencies: ServiceServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  return dependencies.services.create({ ...input, createdBy: actor.id });
};

export const updateService = async (
  actor: SafeUser,
  id: string,
  input: UpdateServiceInput,
  dependencies: ServiceServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const service = await dependencies.services.update(id, {
    ...input,
    updatedBy: actor.id,
  });
  if (!service) throw serviceNotFound();
  return service;
};

export const deleteService = async (
  actor: SafeUser,
  id: string,
  dependencies: ServiceServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const deletedId = await dependencies.services.softDelete(
    id,
    actor.id,
    (dependencies.now ?? defaultDependencies.now!)(),
  );
  if (!deletedId) throw serviceNotFound();
  return { id: deletedId };
};
