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
    const details = error.flatten();
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisá los datos ingresados.",
          fields: {
            ...details.fieldErrors,
            ...(details.formErrors.length > 0 ? { _form: details.formErrors } : {}),
          },
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json({
      error: {
        code: "INVALID_JSON",
        message: "El cuerpo de la solicitud no contiene JSON v\u00e1lido.",
      },
    }, { status: 400 });
  }

  console.error("Unexpected API error", error instanceof Error ? error.name : typeof error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado." } },
    { status: 500 },
  );
};
