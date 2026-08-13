import { createCustomerSchema } from "@/lib/customers/schemas";
import type { CreateCustomerInput } from "@/types/customer";

export { fixedScheduleSchema } from "@/lib/customers/schemas";

export const frontendCustomerEditorSchema = createCustomerSchema;
export type FrontendCustomerEditorInput = CreateCustomerInput;
