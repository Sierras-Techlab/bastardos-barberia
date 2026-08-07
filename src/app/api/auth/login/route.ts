import { login } from "@/lib/auth/authentication";
import { setSessionCookie } from "@/lib/auth/cookie";
import { loginSchema } from "@/lib/auth/schemas";
import { errorResponse, successResponse } from "@/lib/api/response";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const result = await login(input);
    await setSessionCookie(result.token);
    return successResponse({ user: result.user });
  } catch (error) {
    return errorResponse(error);
  }
}
