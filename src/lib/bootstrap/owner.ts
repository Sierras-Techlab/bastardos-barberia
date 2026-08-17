import { z } from "zod";

import { AppError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";

const bootstrapOwnerEnvSchema = z.object({
  BOOTSTRAP_OWNER_FIRST_NAME: z.string().trim().min(1).max(80),
  BOOTSTRAP_OWNER_LAST_NAME: z.string().trim().min(1).max(80),
  BOOTSTRAP_OWNER_PASSWORD: z.string().min(10).max(128),
});

export type BootstrapOwnerInput = {
  firstName: string;
  lastName: string;
  password: string;
};

export type BootstrapOwnerDependencies = {
  countUsers: () => Promise<number>;
  createOwner: (input: {
    firstName: string;
    lastName: string;
    passwordHash: string;
    roleId: 1;
  }) => Promise<{ username: string }>;
  hashPassword: typeof hashPassword;
};

export const parseBootstrapOwnerEnv = (environment: Record<string, string | undefined>): BootstrapOwnerInput => {
  const values = bootstrapOwnerEnvSchema.parse(environment);
  return {
    firstName: values.BOOTSTRAP_OWNER_FIRST_NAME,
    lastName: values.BOOTSTRAP_OWNER_LAST_NAME,
    password: values.BOOTSTRAP_OWNER_PASSWORD,
  };
};

export const bootstrapOwner = async (input: BootstrapOwnerInput, dependencies: BootstrapOwnerDependencies) => {
  if (await dependencies.countUsers() > 0) {
    throw new AppError(
      "BOOTSTRAP_ALREADY_COMPLETED",
      "El bootstrap solo puede ejecutarse cuando no existen usuarios.",
      409,
    );
  }

  return dependencies.createOwner({
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash: await dependencies.hashPassword(input.password),
    roleId: 1,
  });
};
