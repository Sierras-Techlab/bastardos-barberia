export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticatedError = () =>
  new AppError("UNAUTHENTICATED", "Debés iniciar sesión.", 401);

export const invalidCredentialsError = () =>
  new AppError("INVALID_CREDENTIALS", "Usuario o contraseña incorrectos.", 401);
