import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql021 = readFileSync(join(process.cwd(), "supabase", "queries", "021_fixed_customer_monthly_payments.sql"), "utf8");
const sql022 = readFileSync(join(process.cwd(), "supabase", "queries", "022_manual_cash_lifecycle.sql"), "utf8");

describe("operational control migration cross compatibility", () => {
  describe("021_fixed_customer_monthly_payments.sql", () => {
    it("does not reference the legacy role_name column", () => {
      expect(sql021).not.toMatch(/\brole_name\b/i);
    });

    it("does not reference the legacy work_sessions table", () => {
      expect(sql021).not.toMatch(/public\.work_sessions\b/i);
    });

    it("does not write to the legacy customer_fixed_schedules.user_id column", () => {
      expect(sql021).not.toMatch(/customer_fixed_schedules[\s\S]*?\buser_id\b(?!\s*_snapshot)/i);
    });

    it("does not rely on s.period from customer_fixed_schedules", () => {
      expect(sql021).not.toMatch(/\bs\.period\b/i);
    });

    it("does not select att.employee_earning from fixed_customer_monthly_payment_attempts", () => {
      expect(sql021).not.toMatch(/\batt\.employee_earning\b/i);
    });

    it("does not write request_id, user_id together into the attempts table", () => {
      expect(sql021).not.toMatch(/request_id,\s*user_id\b/i);
    });

    it("does not call ensure_daily_cash_open so migration 022 owns universal opening", () => {
      const executableSql = sql021.replace(/--[^\n]*\n/g, "");
      expect(executableSql).not.toMatch(/ensure_daily_cash_open/i);
    });

    it("does not read JWT settings to derive the viewer discriminant", () => {
      expect(sql021).not.toMatch(/request\.jwt\.claim/i);
      expect(sql021).not.toMatch(/current_setting/i);
    });

    it("uses a hexadecimal text fingerprint and never casts uuid to jsonb", () => {
      expect(sql021).toMatch(/pg_catalog\.encode\([\s\S]+extensions\.digest\([\s\S]+'hex'[\s\S]+\)/i);
      expect(sql021).not.toMatch(/uuid\]?::jsonb/i);
    });

    it("does not replace the canonical void_income RPC", () => {
      expect(sql021).not.toMatch(/create or replace function public\.void_income/i);
    });
  });

  describe("022_manual_cash_lifecycle.sql", () => {
    it("does not reference the legacy role_name column", () => {
      expect(sql022).not.toMatch(/\brole_name\b/i);
    });

    it("does not reference the legacy cash_register_id column", () => {
      expect(sql022).not.toMatch(/\bcash_register_id\b/i);
    });

    it("does not write to daily_cash_sales.payment_method_id", () => {
      expect(sql022).not.toMatch(/daily_cash_sales[\s\S]*?\bpayment_method_id\b/i);
    });

    it("adds payment_methods.system_code before any query that reads it", () => {
      const columnIdx = sql022.search(/add column if not exists system_code text/i);
      const preflightIdx = sql022.search(/CASH_PAYMENT_METHOD_REQUIRED/i);
      expect(columnIdx).toBeGreaterThan(0);
      expect(preflightIdx).toBeGreaterThan(columnIdx);
    });

    it("relaxes the legacy daily_cash_counts_check so a register may open with zero sales", () => {
      expect(sql022).toMatch(/drop constraint if exists daily_cash_counts_check/i);
      expect(sql022).not.toMatch(/sale_count \+ adjustment_count > 0/i);
    });

    it("uses named PL/pgSQL variables and never references $4 in three-argument RPCs", () => {
      expect(sql022).not.toMatch(/= \$4,/i);
      expect(sql022).toMatch(/diff_value\s*:=\s*counted_cash\s*-\s*expected_value/i);
    });

    it("computes expected_cash from opening_balance plus Efectivo-only payments", () => {
      expect(sql022).toMatch(/pm\.system_code = 'cash'/i);
      expect(sql022).not.toMatch(/sales_gross_total \+ opening_balance/i);
    });

    it("installs an AFTER INSERT income trigger that opens the daily cash register", () => {
      expect(sql022).toMatch(/trg_income_open_daily_cash/i);
      expect(sql022).toMatch(/after insert on public\.incomes/i);
    });
  });

  describe("canonical schema invariants", () => {
    it("relies on role_id with owner/admin/employee integers for authorization", () => {
      expect(sql022).toMatch(/role_id\s+in\s*\(\s*1\s*,\s*2\s*\)/i);
    });

    it("selects the role as text for new subscription projections", () => {
      expect(sql021).toMatch(/when 1 then 'owner' when 2 then 'admin' when 3 then 'employee'/i);
    });

    it("references the canonical employee_work_sessions table", () => {
      expect(sql021).toMatch(/employee_work_sessions/i);
    });

    it("references daily_cash_id for cash snapshots", () => {
      expect(sql022).toMatch(/daily_cash_id/i);
    });

    it("preserves the 018 created_at_snapshot on the daily cash snapshots", () => {
      expect(sql022).toMatch(/created_at_snapshot/i);
    });

    it("records registered_by and employee_id separately on cash snapshots", () => {
      expect(sql022).toMatch(/registered_by/i);
      expect(sql022).toMatch(/employee_id/i);
    });

    it("captures commission_total and barbershop_net on the cash snapshot", () => {
      expect(sql022).toMatch(/commission_total/i);
      expect(sql022).toMatch(/barbershop_net/i);
    });
  });
});