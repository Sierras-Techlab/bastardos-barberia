import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql021 = readFileSync(join(process.cwd(), "supabase", "queries", "021_fixed_customer_monthly_payments.sql"), "utf8");
const sql022 = readFileSync(join(process.cwd(), "supabase", "queries", "022_manual_cash_lifecycle.sql"), "utf8");

describe("operational control migration cross compatibility", () => {
  describe("021_fixed_customer_monthly_payments.sql", () => {
    it("does not reference legacy role_name column", () => {
      expect(sql021).not.toMatch(/\brole_name\b/i);
    });

    it("does not reference the legacy work_sessions table", () => {
      expect(sql021).not.toMatch(/public\.work_sessions\b/i);
    });

    it("does not write to the legacy customer_fixed_schedules.user_id column", () => {
      expect(sql021).not.toMatch(/customer_fixed_schedules[\s\S]*?\buser_id\b/i);
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

    it("does not produce a no-op set counted_cash = counted_cash assignment", () => {
      expect(sql022).not.toMatch(/set\s+counted_cash\s*=\s*counted_cash\b/i);
    });
  });

  describe("canonical schema invariants", () => {
    it("relies on role_id with owner/admin/employee integers for authorization", () => {
      expect(sql021).toMatch(/role_id\s+in\s*\(\s*1\s*,\s*2\s*\)/i);
      expect(sql022).toMatch(/role_id\s+in\s*\(\s*1\s*,\s*2\s*\)/i);
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