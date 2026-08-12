import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { createCustomerSchema } from "@/lib/customers/schemas";
import { createCustomer, listCustomers } from "@/lib/customers/service";
export async function GET() { try { const { user } = await requireUser(); return successResponse(await listCustomers(user)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const { user } = await requireUser(); const input = createCustomerSchema.parse(await request.json()); return successResponse(await createCustomer(user, input), 201); } catch (error) { return errorResponse(error); } }
