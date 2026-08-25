import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration022 = readFileSync(
  "supabase/queries/022_manual_cash_lifecycle.sql",
  "utf8",
).toLowerCase();
const repair035 = readFileSync(
  "supabase/queries/035_cash_charged_price_snapshot_repair.sql",
  "utf8",
).toLowerCase();

describe("migration 035 charged-price Caja repair", () => {
  it("derives service and product totals from charged item snapshots", () => {
    for (const sql of [migration022, repair035]) {
      expect(sql).toContain("sum(ii.charged_subtotal)");
      expect(sql).toContain("charged_service_total");
      expect(sql).toContain("charged_product_total");
    }
  });

  it("keeps subscription totals in the service bucket", () => {
    expect(repair035).toContain(
      "when i.source_type = 'fixed_subscription' then i.total",
    );
    expect(repair035).toContain(
      "when new.source_type = 'fixed_subscription' then new.total",
    );
  });

  it("does not create post-close adjustments for zero-total sales", () => {
    expect(repair035).toContain("if new.total = 0 then return new; end if;");
  });
});
