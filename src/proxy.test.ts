import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

describe("proxy", () => {
  it("redirects protected pages without a session cookie", () => {
    const response = proxy(new NextRequest("http://localhost/incomes/new"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("allows protected pages when a session cookie is present", () => {
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: "bastardos_session=opaque-token" },
    });

    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });
});
