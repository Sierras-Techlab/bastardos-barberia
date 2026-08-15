import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { PaymentMethodServiceDependencies } from "@/lib/payment-methods/contracts";
import { paymentMethodRepository } from "@/lib/payment-methods/repository";
import type {
  PaymentMethodInput,
  PaymentMethodUpdate,
} from "@/types/payment-method";

const paymentMethodNotFound = () =>
  new AppError(
    "PAYMENT_METHOD_NOT_FOUND",
    "No encontramos el medio de pago.",
    404,
  );

const defaultDependencies: PaymentMethodServiceDependencies = {
  methods: paymentMethodRepository,
};

export const listPaymentMethods = async (
  _actor: SafeUser,
  dependencies: PaymentMethodServiceDependencies = defaultDependencies,
) => ({
  paymentMethods: await dependencies.methods.list(true),
});

export const getPaymentMethod = async (
  _actor: SafeUser,
  id: string,
  dependencies: PaymentMethodServiceDependencies = defaultDependencies,
) => {
  const method = await dependencies.methods.findById(id);
  if (!method) throw paymentMethodNotFound();
  return method;
};

export const createPaymentMethod = async (
  actor: SafeUser,
  input: PaymentMethodInput,
  dependencies: PaymentMethodServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  return dependencies.methods.create(actor.id, input);
};

export const updatePaymentMethod = async (
  actor: SafeUser,
  id: string,
  input: PaymentMethodUpdate,
  dependencies: PaymentMethodServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const method = await dependencies.methods.update(actor.id, id, input);
  if (!method) throw paymentMethodNotFound();
  return method;
};

export const deletePaymentMethod = async (
  actor: SafeUser,
  id: string,
  dependencies: PaymentMethodServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const deletedId = await dependencies.methods.remove(actor.id, id);
  if (!deletedId) throw paymentMethodNotFound();
  return { id: deletedId };
};
