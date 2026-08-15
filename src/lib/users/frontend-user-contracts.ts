import { z } from "zod";

import type { SafeUser } from "@/lib/auth/types";

const rateSchema = z.number().int().min(0).max(100);
export const commissionRatesSchema = z.object({
  serviceCommissionRate: rateSchema,
  productCommissionRate: rateSchema,
}).strict();

export const normalizeCommissionUser = (
  user: SafeUser,
): SafeUser => user;
