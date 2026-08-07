import { createClient } from "@supabase/supabase-js";

import { hashPassword } from "../src/lib/auth/password";
import { bootstrapOwner, parseBootstrapOwnerEnv } from "../src/lib/bootstrap/owner";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");

const database = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const result = await bootstrapOwner(parseBootstrapOwnerEnv(process.env), {
  hashPassword,
  async countUsers() {
    const { count, error } = await database.from("users").select("id", { count: "exact", head: true });
    if (error) throw new Error(`No se pudo contar usuarios (${error.code ?? "database_error"}).`);
    return count ?? 0;
  },
  async createOwner(input) {
    const { data, error } = await database.from("users").insert({
      first_name: input.firstName,
      last_name: input.lastName,
      password_hash: input.passwordHash,
      role_id: input.roleId,
      created_by: null,
    }).select("username").single();
    if (error) throw new Error(`No se pudo crear el owner (${error.code ?? "database_error"}).`);
    return data as { username: string };
  },
});

console.log(result.username);
