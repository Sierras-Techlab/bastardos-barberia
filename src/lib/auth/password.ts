import { hash, verify, type Options } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const satisfies Options;

export const hashPassword = (password: string) => hash(password, ARGON2_OPTIONS);

export const verifyPassword = (passwordHash: string, password: string) =>
  verify(passwordHash, password, ARGON2_OPTIONS);
