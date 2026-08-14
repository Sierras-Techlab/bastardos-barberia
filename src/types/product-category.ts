export type ProductCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ProductCategoryInput = { name: string };

export type ProductCategoryUpdate = {
  name?: string;
  isActive?: true;
};
