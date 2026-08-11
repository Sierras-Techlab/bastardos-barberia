import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { createIncomeSchema, incomeListQuerySchema } from "@/lib/incomes/income-schema";
import { createIncome, listIncomes } from "@/lib/incomes/service";

const listInput = (request: Request) => {
  const params = new URL(request.url).searchParams;
  const optional = (name: string) => params.get(name) || undefined;
  return incomeListQuerySchema.parse({
    query: optional("query"), dateFrom: optional("dateFrom"), dateTo: optional("dateTo"),
    userId: optional("userId"), paymentMethod: optional("paymentMethod"), kind: optional("kind"), status: optional("status"),
    page: params.has("page") ? Number(params.get("page")) : 1,
    pageSize: params.has("pageSize") ? Number(params.get("pageSize")) : 10,
  });
};
export async function GET(request: Request) { try { const { user } = await requireUser(); return successResponse(await listIncomes(user, listInput(request))); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const { user } = await requireUser(); const input = createIncomeSchema.parse(await request.json()); return successResponse(await createIncome(user, input), 201); } catch (error) { return errorResponse(error); } }
