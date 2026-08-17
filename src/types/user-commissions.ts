import type { SafeUser } from "@/lib/auth/types";

export type CommissionRates = Pick<SafeUser, "serviceCommissionRate" | "productCommissionRate">;
export type CommissionSafeUser = SafeUser;
export type FrontendCreateUserInput = import("@/lib/auth/schemas").CreateUserInput;
export type FrontendUpdateUserInput = import("@/lib/auth/schemas").UpdateUserInput;
