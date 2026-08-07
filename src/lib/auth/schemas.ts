import { z } from "zod";

export const roleIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const nameSchema = z.string().trim().min(1).max(80);
const newPasswordSchema = z.string().min(10).max(128);

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const createUserSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  password: newPasswordSchema,
  roleId: roleIdSchema,
});

export const updateUserSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    roleId: roleIdSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Debe indicar al menos un cambio.",
  });

export const resetPasswordSchema = z.object({ password: newPasswordSchema });
export const userIdSchema = z.string().uuid();

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(80).optional(),
  roleId: z.coerce.number().pipe(roleIdSchema).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
