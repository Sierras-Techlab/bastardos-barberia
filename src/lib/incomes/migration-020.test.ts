import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import type { IncomeItemRow, IncomePaymentRow, IncomeRow } from "@/lib/supabase/database.types";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "020_income_pricing_owner_commissions_and_employee_privacy.sql",
);

const migration = () => readFileSync(migrationPath, "utf8");
const repairMigrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "025_create_income_override_record_repair.sql",
);

describe("migration 020 charged prices and owner privacy contract", () => {
  it("exposes the new per-line price override columns to server adapters", () => {
    expectTypeOf<IncomeItemRow>().toHaveProperty("catalog_unit_price");
    expectTypeOf<IncomeItemRow>().toHaveProperty("charged_unit_price");
    expectTypeOf<IncomeItemRow>().toHaveProperty("catalog_subtotal");
    expectTypeOf<IncomeItemRow>().toHaveProperty("charged_subtotal");
    expectTypeOf<IncomeItemRow>().toHaveProperty("adjustment_amount");
    expectTypeOf<IncomeItemRow>().toHaveProperty("price_override_by");
    expectTypeOf<IncomeItemRow>().toHaveProperty("price_override_reason");
  });

  it("records basis points on every payment allocation row", () => {
    expectTypeOf<IncomePaymentRow["basis_points"]>().toEqualTypeOf<number | null>();
  });

  it("wraps the entire migration in a single transaction", () => {
    const sql = migration();
    expect(sql).toMatch(/^begin;/m);
    expect(sql).toMatch(/commit;\s*$/);
  });

  it("removes the owner zero-rate rules from users and incomes", () => {
    const sql = migration();
    expect(sql).toMatch(/drop trigger if exists enforce_owner_user_commission_rates on public\.users/i);
    expect(sql).toMatch(/drop trigger if exists enforce_owner_income_commission on public\.incomes/i);
    expect(sql).toMatch(/drop constraint if exists users_owner_commission_rates_check/i);
    expect(sql).toMatch(/drop function if exists public\.enforce_owner_user_commission_rates\(\)/i);
    expect(sql).toMatch(/drop function if exists public\.enforce_owner_income_commission\(\)/i);
  });

  it("lets create_income honor the configured owner rates without forced zero", () => {
    const sql = migration();
    expect(sql).not.toMatch(/when responsible_role = 'owner' then 0/i);
    expect(sql).toMatch(/employee_record\.service_commission_rate/i);
    expect(sql).toMatch(/employee_record\.product_commission_rate/i);
  });

  it("snapshots catalog and charged prices plus override actor and reason", () => {
    const sql = migration();
    expect(sql).toContain("catalog_unit_price");
    expect(sql).toContain("charged_unit_price");
    expect(sql).toContain("catalog_subtotal");
    expect(sql).toContain("charged_subtotal");
    expect(sql).toContain("adjustment_amount");
    expect(sql).toContain("price_override_by");
    expect(sql).toContain("price_override_reason");
    expect(sql).toMatch(/coalesce.*override.*p\.price/i);
  });

  it("rejects employee overrides and missing override reasons", () => {
    const sql = migration();
    expect(sql).toContain("PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE");
    expect(sql).toContain("PRICE_OVERRIDE_REASON_REQUIRED");
  });

  it("supports integer basis-point allocations with deterministic remainder", () => {
    const sql = migration();
    expect(sql).toContain("basis_points");
    expect(sql).toContain("PAYMENT_BASIS_POINTS_OUT_OF_RANGE");
    expect(sql).toMatch(/basisPoints.*integer|sum.*basisPoints/i);
  });

  it("allows zero-total sales without payment allocations", () => {
    const sql = migration();
    expect(sql).toContain("ZERO_TOTAL_SALE_REQUIRES_NO_PAYMENTS");
    expect(sql).toMatch(/zero_total_sale/);
  });

  it("exposes charged price snapshots through the canonical json helpers", () => {
    const sql = migration();
    expect(sql).toContain("'chargedUnitPrice'");
    expect(sql).toContain("'catalogUnitPrice'");
    expect(sql).toContain("'catalogSubtotal'");
    expect(sql).toContain("'chargedSubtotal'");
    expect(sql).toContain("'adjustmentAmount'");
    expect(sql).toContain("'priceOverrideReason'");
  });

  it("publishes a sanitized employee projection that omits price, payments and totals", () => {
    const sql = migration();
    expect(sql).toMatch(/create or replace function public\.income_as_employee_json\s*\(/i);
    expect(sql).toContain("'earning'");
    expect(sql).not.toMatch(/income_as_employee_json[\s\S]*?jsonb_build_object\(\s*'price'/);
  });

  it("keeps every canonical RPC name without v2 or duplicate suffixed tables", () => {
    const sql = migration();
    expect(sql).not.toMatch(/_v2/i);
    expect(sql).not.toMatch(/create table public\.income_payments_v2/i);
    expect(sql).toMatch(/create or replace function public\.create_income\s*\(/i);
    expect(sql).toMatch(/create or replace function public\.list_incomes\s*\(/i);
    expect(sql).toMatch(/create or replace function public\.get_income_detail\s*\(/i);
  });

  it("preserves the work-session linkage columns and triggers from migration 019", () => {
    const sql = migration();
    expect(sql).not.toMatch(/drop column if exists public\.incomes\.work_session_id/i);
    expect(sql).not.toMatch(/drop column if exists public\.incomes\.outside_work_session/i);
  });

  it("does not shadow SQL relation aliases with PL/pgSQL record variables", () => {
    const sql = migration();
    const recordVariables = new Set(
      [...sql.matchAll(/^\s*([a-z_][a-z0-9_]*)\s+record\s*;/gim)]
        .map((match) => match[1].toLowerCase()),
    );
    const lateralAliases = new Set(
      [...sql.matchAll(/\)\s+([a-z_][a-z0-9_]*)\s+on\s+true/gim)]
        .map((match) => match[1].toLowerCase()),
    );

    expect([...recordVariables].filter((name) => lateralAliases.has(name))).toEqual([]);
  });

  it("ships an incremental canonical repair for databases that already ran 020", () => {
    expect(existsSync(repairMigrationPath)).toBe(true);

    const sql = readFileSync(repairMigrationPath, "utf8");
    expect(sql).toMatch(/^begin;/m);
    expect(sql).toMatch(/pg_get_functiondef/i);
    expect(sql).toMatch(/public\.create_income\(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb\)/i);
    expect(sql).toContain("charged_product_record");
    expect(sql).not.toMatch(/_v2/i);
    expect(sql).toMatch(/commit;\s*$/);
  });

  it("persists a charged gross total on the parent income", () => {
    expectTypeOf<IncomeRow>().toHaveProperty("gross_total");
  });
});
