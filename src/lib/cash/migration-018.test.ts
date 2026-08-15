import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "018_automatic_daily_cash.sql",
);

const migration = () => readFileSync(migrationPath, "utf8");

describe("migration 018 automatic daily cash", () => {
  it("installs immutable daily closures and post-close void adjustments", () => {
    const sql = migration();

    expect(sql).toMatch(/create table public\.daily_cash_registers/i);
    expect(sql).toMatch(/business_date date not null unique/i);
    expect(sql).toMatch(/create table public\.daily_cash_sales/i);
    expect(sql).toMatch(/create table public\.daily_cash_payment_totals/i);
    expect(sql).toMatch(/create table public\.daily_cash_adjustments/i);
    expect(sql).toMatch(
      /create table public\.daily_cash_adjustment_payments/i,
    );
    expect(sql).toContain("America/Argentina/Buenos_Aires");
    expect(sql).toMatch(
      /old\.status = 'active'[\s\S]*new\.status = 'voided'/i,
    );
    expect(sql).toMatch(/unique \(source_income_id\)/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
  });

  it("exposes manager-only read RPCs and schedules the recovery-safe closer", () => {
    const sql = migration();

    expect(sql).toMatch(
      /create or replace function public\.close_pending_daily_cash/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.get_daily_cash/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.list_daily_cash/i,
    );
    expect(sql).toMatch(/cron\.schedule/i);
    expect(sql).toMatch(
      /alter table public\.daily_cash_registers enable row level security/i,
    );
    expect(sql).toMatch(/grant execute[\s\S]*to service_role/i);
  });
});
