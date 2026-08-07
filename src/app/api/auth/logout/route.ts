import { clearSessionCookie, getSessionCookie } from "@/lib/auth/cookie";
import { revokeSession } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/api/response";

export async function POST() {
  try {
    await revokeSession(await getSessionCookie());
    await clearSessionCookie();
    return successResponse({ loggedOut: true });
  } catch (error) {
    await clearSessionCookie();
    return errorResponse(error);
  }
}
