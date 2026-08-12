import type { CreateUserInput, UpdateUserInput } from "@/lib/auth/schemas";
import type { SafeUser } from "@/lib/auth/types";

export type CommissionRates = {
  serviceCommissionRate: number;
  productCommissionRate: number;
};

export type CommissionSafeUser = SafeUser & CommissionRates;
export type FrontendCreateUserInput = CreateUserInput & CommissionRates;
export type FrontendUpdateUserInput = UpdateUserInput & Partial<CommissionRates>;
