import type {
  CreateServiceInput,
  ServiceCatalogItem,
  UpdateServiceInput,
} from "@/types/service-catalog";

export type ServiceCreateRecord = CreateServiceInput & { createdBy: string };
export type ServiceUpdateRecord = UpdateServiceInput & { updatedBy: string };

export type ServiceRepository = {
  list(includeInactive: boolean): Promise<ServiceCatalogItem[]>;
  findById(id: string): Promise<ServiceCatalogItem | null>;
  create(input: ServiceCreateRecord): Promise<ServiceCatalogItem>;
  update(id: string, changes: ServiceUpdateRecord): Promise<ServiceCatalogItem | null>;
  softDelete(id: string, actorId: string, at: string): Promise<string | null>;
};

export type ServiceServiceDependencies = {
  services: ServiceRepository;
  now?: () => string;
};
