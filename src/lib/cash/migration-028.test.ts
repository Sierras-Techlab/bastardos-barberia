import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase", "queries", "028_open_cash_projection_repair.sql"), "utf8");

describe("migration 028 open cash projection repair", () => {
  it("returns the persisted register ID for a live open day", () => {
    expect(sql).toMatch(/create or replace function public\.cash_day_as_json/i);
    expect(sql).toMatch(/if is_live and target_cash_id is not null then\s+base:=jsonb_set\(base,'\{id\}',to_jsonb\(target_cash_id\),true\)/i);
  });

  it("keeps the projection private to the server role", () => {
    expect(sql).toMatch(/revoke execute on function public\.cash_day_as_json\(date,uuid,boolean\) from public,anon,authenticated,service_role/i);
    expect(sql).toMatch(/grant execute on function public\.cash_day_as_json\(date,uuid,boolean\) to service_role/i);
  });
});
