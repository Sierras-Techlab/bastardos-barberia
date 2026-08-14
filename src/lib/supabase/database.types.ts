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
  service_commission_rate: number;
  product_commission_rate: number;
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

export type CustomerFixedScheduleRow = {
  customer_id: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  local_time: string;
  is_active: boolean;
  version: number;
  effective_from: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type FixedCustomerOccurrenceRow = {
  id: string;
  schedule_customer_id: string;
  schedule_version: number;
  customer_id: string;
  occurrence_date: string;
  scheduled_time: string;
  status: "pending" | "attended" | "missed";
  status_changed_by: string | null;
  status_changed_at: string | null;
  created_at: string;
};

export type IncomePaymentMethod = "cash" | "transfer";
export type IncomeStatus = "active" | "voided";

export type IncomeRow = {
  id: string;
  request_id: string;
  registered_by: string;
  employee_id: string;
  responsible_role_snapshot: RoleName;
  request_fingerprint: string;
  customer_id: string | null;
  payment_method: IncomePaymentMethod | null;
  total: number;
  service_commission_base: number;
  product_commission_base: number;
  service_commission_rate: number;
  product_commission_rate: number;
  service_commission_amount: number;
  product_commission_amount: number;
  commission_total: number;
  barbershop_net: number;
  full_service_commission: boolean;
  full_service_commission_authorized_by: string | null;
  status: IncomeStatus;
  created_at: string;
  business_date: string;
  voided_at: string | null;
  voided_by: string | null;
};

export type IncomePaymentRow = {
  id: string;
  income_id: string;
  method: IncomePaymentMethod;
  amount: number;
  created_at: string;
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
