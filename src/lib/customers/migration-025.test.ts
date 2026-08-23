import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "queries", "025_fixed_customer_schedule_mutation_repair.sql");

describe("migration 025 fixed customer schedule mutation repair", () => {
  it("ships an incremental repair migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("accepts and persists the complete habitual-customer schedule contract", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/responsible_user_id/);
    expect(sql).toMatch(/monthly_price/);
    expect(sql).toMatch(/parsed_responsible_user_id/);
    expect(sql).toMatch(/parsed_monthly_price/);
    expect(sql).toMatch(/count\(\*\) from jsonb_object_keys\(new_fixed_schedule\)\) <> 4/);
    expect(sql).toMatch(/insert into public\.customer_fixed_schedules[\s\S]*responsible_user_id[\s\S]*monthly_price/i);
    expect(sql).toMatch(/update public\.customer_fixed_schedules[\s\S]*responsible_user_id = parsed_responsible_user_id[\s\S]*monthly_price = parsed_monthly_price/i);
  });

  it("forces employee-created schedules to the authenticated employee", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/actor_role = 'employee'[\s\S]*parsed_responsible_user_id <> actor_user_id[\s\S]*FORBIDDEN/i);
  });
});
