export type ServiceCatalogItem = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
};

export type ServiceCatalogData = {
  isMock: true;
  services: ServiceCatalogItem[];
};

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
