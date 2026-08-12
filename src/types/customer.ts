export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  visits: number;
  createdAt: string;
};

export type CustomerCatalogData = { customers: Customer[] };

export type CustomerSort = "original" | "visits-desc" | "visits-asc" | "newest" | "oldest";

export type CustomerEditorInput = Pick<Customer, "firstName" | "lastName" | "email" | "phone">;
export type CreateCustomerInput = CustomerEditorInput;
export type UpdateCustomerInput = Partial<CustomerEditorInput>;

export type CustomerMetrics = {
  totalCustomers: number;
  newCustomers: number;
  totalVisits: number;
};
