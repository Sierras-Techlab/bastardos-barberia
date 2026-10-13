import type { z } from "zod";
import type { confirmChairRentalSchema, voidChairRentalSchema } from "./schemas";
export type ConfirmChairRentalInput = z.infer<typeof confirmChairRentalSchema>;
export type VoidChairRentalInput = z.infer<typeof voidChairRentalSchema>;
