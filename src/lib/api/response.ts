import { ZodError } from "zod";

import { AppError } from "@/lib/auth/errors";

export const successResponse = <T>(data: T, status = 200) =>
  Response.json({ data }, { status });

export const errorResponse = (error: unknown) => {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisá los datos ingresados.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  console.error("Unexpected API error", error instanceof Error ? error.name : typeof error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado." } },
    { status: 500 },
  );
};
