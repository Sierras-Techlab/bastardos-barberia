import { z } from "zod";

import type { SafeUser } from "@/lib/auth/types";
import type { CommissionSafeUser } from "@/types/user-commissions";

const rateSchema = z.number().int().min(0).max(100);
export const commissionRatesSchema = z.object({
  serviceCommissionRate: rateSchema,
  productCommissionRate: rateSchema,
}).strict();

export const normalizeCommissionUser = (
  user: SafeUser & Partial<CommissionSafeUser>,
): CommissionSafeUser => ({
  ...user,
  serviceCommissionRate: user.serviceCommissionRate ?? 0,
  productCommissionRate: user.productCommissionRate ?? 0,
});
