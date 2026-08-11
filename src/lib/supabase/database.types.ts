import type { RoleName } from "@/lib/auth/types";

export type RoleRow = { id: 1 | 2 | 3; name: RoleName; created_at: string };

export type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  password_hash: string;
  role_id: 1 | 2 | 3;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  password_changed_at: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UserWithRoleRow = UserRow & { role: Pick<RoleRow, "id" | "name"> };

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
  created_at: string;
};

export type ProductCategoryRow =
  | "hair-care"
  | "styling"
  | "beard-care"
  | "fragrance";

export type ProductRow = {
  id: string;
  name: string;
  normalized_name: string;
  category: ProductCategoryRow;
  price: number;
  stock: number;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type InventoryMovementType =
  | "initial"
  | "entry"
  | "exit"
  | "sale"
  | "sale_void";

export type InventoryMovementRow = {
  id: string;
  product_id: string;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  stock_after: number;
  user_id: string;
  income_id: string | null;
  created_at: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  normalized_name: string;
  price: number;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  normalized_phone: string;
  email: string | null;
  visits: number;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IncomePaymentMethod = "cash" | "transfer";
export type IncomeStatus = "active" | "voided";

export type IncomeRow = {
  id: string;
  request_id: string;
  user_id: string;
  customer_id: string | null;
  payment_method: IncomePaymentMethod;
  total: number;
  status: IncomeStatus;
  created_at: string;
  business_date: string;
  voided_at: string | null;
  voided_by: string | null;
};

export type IncomeItemType = "service" | "product";

export type IncomeItemRow = {
  id: string;
  income_id: string;
  item_type: IncomeItemType;
  service_id: string | null;
  product_id: string | null;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
};
