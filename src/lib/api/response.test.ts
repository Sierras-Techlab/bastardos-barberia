import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/auth/errors";
import { errorResponse, successResponse } from "./response";

describe("API responses", () => {
  it("wraps success data", async () => {
    const response = successResponse({ id: "user-id" }, 201);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: { id: "user-id" } });
  });

  it("maps application errors", async () => {
    const response = errorResponse(new AppError("FORBIDDEN", "Sin permiso.", 403));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: { code: "FORBIDDEN", message: "Sin permiso." } });
  });

  it("maps Zod errors to field details", async () => {
    const issue = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    if (issue.success) throw new Error("Expected invalid fixture");
    const response = errorResponse(issue.error);
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.name).toBeDefined();
  });

  it("keeps object-level validation details", async () => {
    const issue = z.object({ name: z.string().optional() }).refine((value) => value.name, {
      message: "Debe indicar al menos un cambio.",
    }).safeParse({});
    if (issue.success) throw new Error("Expected invalid fixture");
    const response = errorResponse(issue.error);
    expect((await response.json()).error.fields._form).toEqual(["Debe indicar al menos un cambio."]);
  });

  it("maps malformed JSON to a safe 400 response", async () => {
    const response = errorResponse(new SyntaxError("Unexpected token"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_JSON", message: "El cuerpo de la solicitud no contiene JSON v\u00e1lido." },
    });
  });

  it("sanitizes unexpected failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = errorResponse(new Error("database secret"));
    expect(await response.text()).not.toContain("database secret");
    expect(response.status).toBe(500);
  });
});
