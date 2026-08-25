import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "queries", "010_income_commissions_and_split_payments.sql"),
  "utf8",
);
const repairSql = readFileSync(
  join(process.cwd(), "supabase", "queries", "029_user_commission_profile_rpc.sql"),
  "utf8",
);

describe("010 income commissions user profile RPC", () => {
  it("replaces the legacy profile RPC with the canonical commission-aware signature", () => {
    expect(sql).toMatch(
      /drop function if exists public\.update_user_profile\(\s*uuid,\s*boolean,\s*text,\s*boolean,\s*text,\s*boolean,\s*smallint,\s*boolean,\s*boolean\s*\)/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.update_user_profile\([\s\S]*set_service_commission_rate boolean,[\s\S]*new_service_commission_rate smallint,[\s\S]*set_product_commission_rate boolean,[\s\S]*new_product_commission_rate smallint[\s\S]*?\)\s*returns uuid/i,
    );
  });

  it("removes the temporary v2 RPC and grants only the canonical signature", () => {
    expect(sql).toMatch(/drop function if exists public\.update_user_profile_v2/i);
    expect(sql).not.toMatch(/create or replace function public\.update_user_profile_v2/i);
    expect(sql).not.toMatch(/(?:revoke|grant) execute on function public\.update_user_profile_v2/i);
    expect(sql).toMatch(
      /revoke execute on function public\.update_user_profile\(\s*uuid,\s*boolean,\s*text,\s*boolean,\s*text,\s*boolean,\s*smallint,\s*boolean,\s*boolean,\s*boolean,\s*smallint,\s*boolean,\s*smallint\s*\) from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.update_user_profile\(\s*uuid,\s*boolean,\s*text,\s*boolean,\s*text,\s*boolean,\s*smallint,\s*boolean,\s*boolean,\s*boolean,\s*smallint,\s*boolean,\s*smallint\s*\) to service_role/i,
    );
  });

  it("provides an incremental repair for databases that already installed 010", () => {
    expect(repairSql).toMatch(/drop function if exists public\.update_user_profile\(/i);
    expect(repairSql).toMatch(/drop function if exists public\.update_user_profile_v2\(/i);
    expect(repairSql).toMatch(
      /create or replace function public\.update_user_profile\([\s\S]*set_service_commission_rate boolean,[\s\S]*set_product_commission_rate boolean/i,
    );
    expect(repairSql).toMatch(/notify pgrst, 'reload schema'/i);
    expect(repairSql).not.toMatch(/create or replace function public\.update_user_profile_v2/i);
  });
});
