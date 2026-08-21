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
      /function public\.correct_work_session\(\s*manager_user_id uuid,\s*target_session_id uuid,\s*expected_updated_at timestamptz,\s*corrected_started_at timestamptz,\s*corrected_ended_at timestamptz,\s*correction_reason text/i,
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

  it("removes the superseded correction signature before creating the canonical RPC", () => {
    const legacyDrop = sql.search(
      /drop function if exists public\.correct_work_session\(\s*uuid,\s*uuid,\s*timestamptz,\s*timestamptz,\s*text\s*\)/i,
    );
    const canonicalCreate = sql.search(
      /create or replace function public\.correct_work_session\(\s*manager_user_id uuid,\s*target_session_id uuid,\s*expected_updated_at timestamptz/i,
    );

    expect(legacyDrop).toBeGreaterThan(-1);
    expect(canonicalCreate).toBeGreaterThan(legacyDrop);
  });

  it("checks the locked correction version before overlap, audit or session writes", () => {
    const correctionFunction = sql.match(
      /create or replace function public\.correct_work_session\([\s\S]*?\nend;\n\$\$;/i,
    )?.[0] ?? "";
    const rowLock = correctionFunction.search(/select \* into current_session[\s\S]*for update;/i);
    const versionCheck = correctionFunction.search(
      /current_session\.updated_at\s+is distinct from\s+expected_updated_at[\s\S]*WORK_SESSION_CONFLICT/i,
    );
    const overlapCheck = correctionFunction.search(/if exists \(\s*select 1\s*from public\.employee_work_sessions other/i);
    const auditWrite = correctionFunction.search(/insert into public\.employee_work_session_corrections/i);
    const sessionWrite = correctionFunction.search(/update public\.employee_work_sessions/i);

    expect(rowLock).toBeGreaterThan(-1);
    expect(versionCheck).toBeGreaterThan(rowLock);
    expect(overlapCheck).toBeGreaterThan(versionCheck);
    expect(auditWrite).toBeGreaterThan(versionCheck);
    expect(sessionWrite).toBeGreaterThan(auditWrite);
    expect(sql).toMatch(/'updatedAt', session\.updated_at/i);
  });

  it("removes inherited service-role DML before granting read-only table access", () => {
    const sessionsRevoke = sql.indexOf(
      "revoke all on table public.employee_work_sessions from service_role;",
    );
    const correctionsRevoke = sql.indexOf(
      "revoke all on table public.employee_work_session_corrections from service_role;",
    );
    const sessionsGrant = sql.indexOf(
      "grant select on table public.employee_work_sessions to service_role;",
    );
    const correctionsGrant = sql.indexOf(
      "grant select on table public.employee_work_session_corrections to service_role;",
    );

    expect(sessionsRevoke).toBeGreaterThan(-1);
    expect(correctionsRevoke).toBeGreaterThan(-1);
    expect(sessionsRevoke).toBeLessThan(sessionsGrant);
    expect(correctionsRevoke).toBeLessThan(correctionsGrant);
  });

  it("documents rollback-wrapped acceptance for lifecycle, sale linkage and active metrics", () => {
    expect(readme).toMatch(/Validate work-session lifecycle[\s\S]*begin;[\s\S]*rollback;/i);
    for (const sentinel of [
      "WORK_SESSION_ACCEPTANCE_DUPLICATE_START_FAILED",
      "WORK_SESSION_ACCEPTANCE_EMPLOYEE_SALE_WITHOUT_SESSION_FAILED",
      "WORK_SESSION_ACCEPTANCE_EMPLOYEE_SALE_LINK_FAILED",
      "WORK_SESSION_ACCEPTANCE_MANAGER_OPEN_SESSION_LINK_FAILED",
      "WORK_SESSION_ACCEPTANCE_MANAGER_OUTSIDE_SALE_FAILED",
      "WORK_SESSION_ACCEPTANCE_CORRECTION_AUDIT_FAILED",
      "WORK_SESSION_ACCEPTANCE_STALE_AFTER_END_FAILED",
      "WORK_SESSION_ACCEPTANCE_STALE_CORRECTION_ACCEPTED",
      "WORK_SESSION_ACCEPTANCE_STALE_CORRECTION_OVERWROTE_VALID_CHANGE",
      "WORK_SESSION_ACCEPTANCE_SECOND_SESSION_FAILED",
      "WORK_SESSION_ACCEPTANCE_VOID_METRICS_FAILED",
    ]) {
      expect(readme).toContain(sentinel);
    }

    const managerAcceptanceStart = readme.indexOf(
      "manager_linked_income_id := public.create_income",
    );
    const managerAcceptanceEnd = readme.indexOf(
      "WORK_SESSION_ACCEPTANCE_MANAGER_OPEN_SESSION_LINK_FAILED",
    );
    expect(managerAcceptanceStart).toBeGreaterThan(-1);
    expect(managerAcceptanceEnd).toBeGreaterThan(managerAcceptanceStart);

    const managerAcceptanceBlock = readme.slice(
      managerAcceptanceStart,
      managerAcceptanceEnd,
    );
    expect(managerAcceptanceBlock).toMatch(
      /where id = manager_linked_income_id[\s\S]*work_session_id\s*=\s*first_session_id[\s\S]*not\s+outside_work_session/i,
    );
    expect(readme).toMatch(
      /first_session_json->'metrics'->>'saleCount'\)::integer\s*<>\s*2[\s\S]*employeeCommission'\)::bigint\s*<>\s*10000[\s\S]*grossTotal'\)::bigint\s*<>\s*20000[\s\S]*barbershopNet'\)::bigint\s*<>\s*10000/i,
    );
  });

  it("documents effective table and RPC grant checks for server and browser roles", () => {
    const grantBlock = readme.match(
      /Verify the work-session objects, RLS and canonical income trigger:[\s\S]*?(?=\nValidate work-session lifecycle)/i,
    )?.[0];
    expect(grantBlock).toBeDefined();
    const grants = grantBlock ?? "";

    const tableGrantStart = grants.indexOf("with work_session_tables");
    const functionGrantStart = grants.indexOf("with work_session_functions");
    const functionGrantEnd = grants.indexOf("```", functionGrantStart);
    expect(tableGrantStart).toBeGreaterThan(-1);
    expect(functionGrantStart).toBeGreaterThan(tableGrantStart);
    expect(functionGrantEnd).toBeGreaterThan(functionGrantStart);

    const tableGrantBlock = grants.slice(tableGrantStart, functionGrantStart);
    const functionGrantBlock = grants.slice(functionGrantStart, functionGrantEnd);
    const roleCte =
      /\),\s*roles\(role_name\) as \(\s*values \('service_role'\), \('anon'\), \('authenticated'\)\s*\)/i;
    expect(tableGrantBlock).toMatch(roleCte);
    expect(functionGrantBlock).toMatch(roleCte);
    expect(functionGrantBlock).not.toContain("with work_session_tables");

    expect(tableGrantBlock).toMatch(
      /privileges\(privilege_name\) as \([\s\S]*'SELECT'[\s\S]*'INSERT'[\s\S]*'UPDATE'[\s\S]*'DELETE'[\s\S]*'TRUNCATE'[\s\S]*'REFERENCES'[\s\S]*'TRIGGER'/i,
    );
    expect(tableGrantBlock).toMatch(
      /case\s+when role_name = 'service_role'\s+and privilege_name = 'SELECT'\s+then true\s+else false\s+end as expected/i,
    );
    expect(tableGrantBlock).toMatch(
      /has_table_privilege\(role_name, table_name, privilege_name\) as actual/i,
    );
    expect(functionGrantBlock).toMatch(/has_function_privilege\s*\(/i);
    expect(functionGrantBlock).toMatch(
      /case\s+when role_name = 'service_role'\s+then true\s+else false\s+end as expected/i,
    );

    for (const signature of [
      "start_work_session(uuid)",
      "end_work_session(uuid)",
      "get_current_work_session(uuid)",
      "correct_work_session(uuid,uuid,timestamptz,timestamptz,timestamptz,text)",
      "list_work_sessions(uuid,uuid,date,date,integer,integer)",
    ]) {
      expect(functionGrantBlock).toContain(signature);
    }
  });
});
