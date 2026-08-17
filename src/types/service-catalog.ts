export type ServiceCatalogItem = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
};

export type ServiceCatalogData = {
  services: ServiceCatalogItem[];
};

export type CreateServiceInput = Pick<ServiceCatalogItem, "name" | "price">;
export type UpdateServiceInput = Partial<
  Pick<ServiceCatalogItem, "name" | "price" | "isActive">
>;

export type ServiceActiveState = "all" | "active" | "inactive";
export type ServiceCatalogFilters = { query: string; activeState: ServiceActiveState };
export type ServiceCatalogSort = "original" | "name-asc" | "price-asc" | "price-desc";
export type ServiceEditorInput = Pick<ServiceCatalogItem, "name" | "price">;
export type ServiceCatalogMetrics = {
  activeServices: number;
  averagePrice: number;
  minimumPrice: number;
  maximumPrice: number;
};
