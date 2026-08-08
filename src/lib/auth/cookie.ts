import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "./constants";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const getSessionCookie = async () =>
  (await cookies()).get(SESSION_COOKIE_NAME)?.value;

export const setSessionCookie = async (token: string) => {
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_DURATION_MS / 1_000,
  });
};

export const clearSessionCookie = async () => {
  (await cookies()).set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
};
