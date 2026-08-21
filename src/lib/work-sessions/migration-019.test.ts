import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "019_employee_work_sessions.sql",
);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const readme = readFileSync(
  join(process.cwd(), "supabase", "queries", "README.md"),
  "utf8",
);

describe("migration 019 employee work sessions", () => {
  it("installs the secured canonical work-session schema and income linkage", () => {
    expect(sql).toMatch(/create table public\.employee_work_sessions/i);
    expect(sql).toMatch(/where ended_at is null/i);
    expect(sql).toMatch(/create table public\.employee_work_session_corrections/i);
    expect(sql).toMatch(/alter table public\.incomes[\s\S]*work_session_id/i);
    expect(sql).toMatch(/create trigger attach_income_work_session/i);
    expect(sql).toContain("EMPLOYEE_WORK_SESSION_REQUIRED");
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).not.toMatch(/_v2/i);
  });

  it("keeps income attachment server-derived and lock-protected", () => {
    expect(sql).toMatch(
      /create (?:or replace )?function public\.attach_income_work_session\(\)[\s\S]*from public\.users[\s\S]*for share[\s\S]*from public\.employee_work_sessions[\s\S]*for update/i,
    );
    expect(sql).toMatch(/new\.registered_by\s*<>\s*new\.employee_id/i);
    expect(sql).toMatch(/new\.work_session_id\s*:=\s*open_session_id/i);
    expect(sql).toMatch(/new\.outside_work_session\s*:=\s*responsible_role\s*=\s*'employee'/i);
    expect(sql).toMatch(/before insert on public\.incomes/i);
  });

  it("installs canonical RPCs, role-specific JSON and immutable correction audit", () => {
    expect(sql).toMatch(/function public\.start_work_session\(\s*employee_user_id uuid/i);
    expect(sql).toMatch(/function public\.end_work_session\(\s*employee_user_id uuid/i);
    expect(sql).toMatch(/function public\.get_current_work_session\(\s*employee_user_id uuid/i);
    expect(sql).toMatch(
      /function public\.correct_work_session\(\s*manager_user_id uuid,\s*target_session_id uuid,\s*corrected_started_at timestamptz,\s*corrected_ended_at timestamptz,\s*correction_reason text/i,
    );
    expect(sql).toMatch(
      /function public\.list_work_sessions\(\s*requesting_user_id uuid,\s*filter_employee_id uuid,\s*filter_date_from date,\s*filter_date_to date,\s*page_number integer,\s*page_size integer/i,
    );
    expect(sql).toMatch(
      /if requester_role_id = 3 then[\s\S]*work_session_as_json\(page\.id, false\)[\s\S]*else[\s\S]*work_session_as_json\(page\.id, true\)/i,
    );
    expect(sql).toMatch(
      /insert into public\.employee_work_session_corrections[\s\S]*update public\.employee_work_sessions/i,
    );
    expect(sql).toMatch(
      /create trigger employee_work_session_corrections_prevent_mutation\s+before update or delete on public\.employee_work_session_corrections/i,
    );
  });

  it("documents rollback-wrapped acceptance for lifecycle, sale linkage and active metrics", () => {
    expect(readme).toMatch(/Validate work-session lifecycle[\s\S]*begin;[\s\S]*rollback;/i);
    for (const sentinel of [
      "WORK_SESSION_ACCEPTANCE_DUPLICATE_START_FAILED",
      "WORK_SESSION_ACCEPTANCE_EMPLOYEE_SALE_WITHOUT_SESSION_FAILED",
      "WORK_SESSION_ACCEPTANCE_EMPLOYEE_SALE_LINK_FAILED",
      "WORK_SESSION_ACCEPTANCE_MANAGER_OUTSIDE_SALE_FAILED",
      "WORK_SESSION_ACCEPTANCE_CORRECTION_AUDIT_FAILED",
      "WORK_SESSION_ACCEPTANCE_SECOND_SESSION_FAILED",
      "WORK_SESSION_ACCEPTANCE_VOID_METRICS_FAILED",
    ]) {
      expect(readme).toContain(sentinel);
    }
  });
});
