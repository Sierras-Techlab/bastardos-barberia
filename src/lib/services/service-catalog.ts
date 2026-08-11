import { z } from "zod";

import type {
  ServiceCatalogData,
  ServiceCatalogFilters,
  ServiceCatalogItem,
  ServiceCatalogMetrics,
  ServiceCatalogSort,
} from "@/types/service-catalog";

const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().positive(),
  isActive: z.boolean(),
}).strict();

const serviceCatalogFixtureSchema = z.object({
  isMock: z.literal(true),
  services: z.array(serviceSchema),
}).strict();

const serviceCatalogSchema = z.union([
  serviceCatalogFixtureSchema,
  z.object({ services: z.array(serviceSchema) }).strict(),
]).transform(({ services }) => ({ services }));

export const serviceEditorSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del servicio."),
  price: z.number({ error: "Ingresá un precio válido." }).int("El precio debe ser un número entero.").positive("El precio debe ser mayor a cero."),
});

const normalizeName = (value: string) => value.trim().toLocaleLowerCase("es-AR");

export const authorizeServiceCatalogData = (input: unknown): ServiceCatalogData =>
  serviceCatalogSchema.parse(input);

export const filterServices = (
  services: ServiceCatalogItem[],
  filters: ServiceCatalogFilters,
) => {
  const query = normalizeName(filters.query);
  return services.filter((service) => {
    const matchesQuery = !query || normalizeName(service.name).includes(query);
    const matchesState = filters.activeState === "all"
      || (filters.activeState === "active" ? service.isActive : !service.isActive);
    return matchesQuery && matchesState;
  });
};

export const sortServices = (services: ServiceCatalogItem[], sort: ServiceCatalogSort) => {
  const sorted = [...services];
  if (sort === "name-asc") return sorted.sort((a, b) => a.name.localeCompare(b.name, "es-AR"));
  if (sort === "price-asc") return sorted.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") return sorted.sort((a, b) => b.price - a.price);
  return sorted;
};

export const calculateServiceMetrics = (services: ServiceCatalogItem[]): ServiceCatalogMetrics => {
  const prices = services.map(({ price }) => price);
  return {
    activeServices: services.filter(({ isActive }) => isActive).length,
    averagePrice: prices.length ? Math.round(prices.reduce((total, price) => total + price, 0) / prices.length) : 0,
    minimumPrice: prices.length ? Math.min(...prices) : 0,
    maximumPrice: prices.length ? Math.max(...prices) : 0,
  };
};

export const validateUniqueServiceName = (
  name: string,
  services: ServiceCatalogItem[],
  ignoredServiceId?: string,
) => services.some((service) => service.id !== ignoredServiceId && normalizeName(service.name) === normalizeName(name))
  ? "Ya existe un servicio con ese nombre."
  : null;
