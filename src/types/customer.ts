export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  visits: number;
  createdAt: string;
};

export type CustomerCatalogData = {
  isMock: true;
  customers: Customer[];
};

export type CustomerSort = "original" | "visits-desc" | "visits-asc" | "newest" | "oldest";

export type CustomerEditorInput = Pick<Customer, "firstName" | "lastName" | "email" | "phone">;

export type CustomerMetrics = {
  totalCustomers: number;
  newCustomers: number;
  totalVisits: number;
};
