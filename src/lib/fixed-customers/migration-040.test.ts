import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "queries", "040_production_hardening.sql"),
  "utf8",
);

describe("migration 040 production hardening", () => {
  const listBody = sql.match(/create or replace function public\.list_fixed_customer_occurrences[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";
  const resolveBody = sql.match(/create or replace function public\.resolve_fixed_customer_occurrence[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

  it("derives manager access from the persisted actor role", () => {
    expect(listBody).toMatch(/select u\.role_id into actor_role_id[\s\S]+u\.id = actor_user_id/i);
    expect(resolveBody).toMatch(/select u\.role_id into actor_role_id[\s\S]+u\.id = actor_user_id/i);
    expect(sql).not.toMatch(/can_view_all/i);
  });

  it("returns only the active schedules assigned to an employee", () => {
    expect(listBody).toMatch(/actor_role_id in \(1, 2\)[\s\S]+exists \([\s\S]+s\.is_active[\s\S]+s\.responsible_user_id = actor_user_id/i);
  });

  it("prevents an employee from resolving another professional's occurrence", () => {
    expect(resolveBody).toMatch(/actor_role_id in \(1, 2\)[\s\S]+s\.is_active[\s\S]+s\.responsible_user_id = actor_user_id/i);
    expect(resolveBody).toMatch(/pg_advisory_xact_lock/i);
    expect(resolveBody.match(/FIXED_OCCURRENCE_NOT_FOUND/gi)).toHaveLength(2);
  });

  it("keeps both RPCs server-only and reloads the API schema", () => {
    expect(sql).toMatch(/revoke execute on function public\.list_fixed_customer_occurrences\(uuid, date, date, text\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.list_fixed_customer_occurrences\(uuid, date, date, text\) to service_role/i);
    expect(sql).toMatch(/revoke execute on function public\.resolve_fixed_customer_occurrence\(uuid, uuid, text, text\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.resolve_fixed_customer_occurrence\(uuid, uuid, text, text\) to service_role/i);
    expect(sql).toMatch(/notify pgrst, 'reload schema'/i);
  });

  it("keeps subscriptions out of visit history and visit counters", () => {
    expect(sql).toMatch(/create or replace function public\.list_customer_visits[\s\S]+i\.source_type = 'sale'/i);
    expect(sql).toMatch(/create or replace function public\.void_income[\s\S]+income_record\.source_type = 'sale'/i);
  });

  it("derives live expected cash through the adjustment-aware helper", () => {
    expect(sql).toMatch(/create or replace function public\.cash_day_as_json/i);
    expect(sql).toMatch(/expected_value := public\.current_cash_expected/i);
  });

  it("removes the obsolete legacy payment discriminator constraint", () => {
    expect(sql).toMatch(/drop constraint if exists incomes_payment_method_check/i);
  });
});
