const INCOME_LOAD_TIMEOUT_MS = 15_000;

export const withIncomeLoadDeadline = <T>(
  operation: Promise<T>,
  timeoutMs = INCOME_LOAD_TIMEOUT_MS,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("La carga inicial de ingresos tardó demasiado."));
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
