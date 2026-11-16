// Local, synthetic SQL verification. Never reads .env or connects to a server.
// Covers migrations 044-047, including free customer names and retries.
// Usage: node scripts/verify-income-composition.mjs <local @electric-sql/pglite directory>
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Pass a local PGlite package directory. This script never uses a connection string.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2], "dist/index.js")).href);
const db = new PGlite();
const read = (name) => readFile(new URL(`../supabase/queries/${name}`, import.meta.url), "utf8");
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const manager = id(1), employee = id(2), other = id(3), cash = id(4), transfer = id(5);
const emptyAmounts = { grossTotal: 0, commissionTotal: 0, barbershopNet: 0 };

try {
  await db.exec(`
    create table public.users(id uuid primary key, role_id smallint, is_active boolean default true, deleted_at timestamptz, first_name text, last_name text);
    create table public.customers(id uuid primary key, first_name text, last_name text);
    create table public.incomes(id uuid primary key, request_id uuid, employee_id uuid, customer_id uuid, customer_name text, business_date date, created_at timestamptz, status text, source_type text, total bigint, gross_total bigint, commission_total bigint, barbershop_net bigint, registered_by uuid, fixed_period text, chair_rental_period text, chair_rental_paid_at timestamptz);
    create table public.income_items(income_id uuid, item_type text, name_snapshot text, id uuid, service_id uuid, product_id uuid, created_at timestamptz, full_commission_authorized_by uuid, catalog_unit_price bigint, charged_unit_price bigint, catalog_subtotal bigint, charged_subtotal bigint, adjustment_amount bigint, price_override_reason text, line_subtotal bigint, commission_rate integer, commission_amount bigint, full_commission boolean, quantity integer);
    create table public.payment_methods(id uuid primary key, name text, created_at timestamptz default now());
    create table public.income_payments(income_id uuid, payment_method_id uuid, amount bigint, id uuid, method_name_snapshot text, basis_points integer, created_at timestamptz);
    create function public.normalize_catalog_name(value text) returns text language sql immutable as $$ select lower(trim(value)) $$;
    create role anon;
    create role authenticated;
    create role service_role;
    create function public.create_income(actor_user_id uuid, responsible_employee_id uuid, income_request_id uuid, selected_customer_id uuid, selected_service_id uuid, product_items jsonb, payment_items jsonb, grant_full_service_commission boolean, service_price_override jsonb, product_price_overrides jsonb) returns uuid language plpgsql as $$
    declare existing_id uuid;
    begin
      select id into existing_id from public.incomes where request_id=income_request_id and registered_by=actor_user_id;
      if found then return existing_id; end if;
      insert into public.incomes(id,request_id,employee_id,customer_id,customer_name,business_date,created_at,status,source_type,total,gross_total,commission_total,barbershop_net,registered_by)
      values(income_request_id,income_request_id,responsible_employee_id,selected_customer_id,null,'2026-10-15','2026-10-15T12:00:00Z','active','sale',0,0,0,0,actor_user_id);
      return income_request_id;
    end $$;
    create function public.income_as_employee_json(target_income_id uuid) returns jsonb language sql stable as $$ select jsonb_build_object('id', id, 'employeeCommission', commission_total) from public.incomes where id=target_income_id $$;
  `);
  await db.query("insert into public.users(id,role_id,first_name,last_name) values ($1,1,'Owner','Test'),($2,3,'Milton','Test'),($3,3,'Other','Test')", [manager, employee, other]);
  await db.query("insert into public.payment_methods(id,name) values ($1,'Efectivo'),($2,'Transferencia')", [cash, transfer]);

  // Exercise the real manager serializer too: subscriptions have no item rows.
  const migration020 = await read("020_income_pricing_owner_commissions_and_employee_privacy.sql");
  const serializerStart = migration020.indexOf("create or replace function public.income_as_json(target_income_id uuid)");
  await db.exec(migration020.slice(serializerStart, migration020.indexOf("\n$$;", serializerStart) + 4));
  await db.exec("alter function public.income_as_json(uuid) rename to income_as_json_045_base");

  // Use the real canonical reader and actual incremental 044/045 repairs.
  const canonical = await read("024_income_list_contract_repair.sql");
  const start = canonical.indexOf("create or replace function public.list_incomes(");
  await db.exec(canonical.slice(start, canonical.indexOf("\n$$;", start) + 4));
  await db.exec(await read("044_income_list_charged_totals.sql"));
  const migration045 = await read("045_employee_commercial_agreements_and_chair_rentals.sql");
  const sentinel = migration045.indexOf("LIST_INCOMES_CHAIR_RENTAL_TARGET_MISSING");
  await db.exec(migration045.slice(migration045.lastIndexOf("do $$", sentinel), migration045.indexOf("end $$;", sentinel) + 7));
  const wrapperStart = migration045.indexOf("create or replace function public.income_as_json(target_income_id uuid)");
  await db.exec(migration045.slice(wrapperStart, migration045.indexOf("\n$$;", wrapperStart) + 4));

  const addIncome = async (number, source, total, commission, kind = "service", status = "active") => {
    await db.query("insert into public.incomes(id,employee_id,customer_id,business_date,created_at,status,source_type,total,gross_total,commission_total,barbershop_net) values ($1,$2,null,'2026-10-13','2026-10-13T12:00:00Z',$3,$4,$5,$6,$7,$8)", [id(number), employee, status, source, total, total + 1000, commission, total - commission]);
    await db.query("update public.incomes set registered_by=$1, fixed_period='2026-10', chair_rental_period='2026-10', chair_rental_paid_at=created_at where id=$2", [manager, id(number)]);
    if (source === "sale") {
      for (const type of kind === "combined" ? ["service", "product"] : [kind]) {
        await db.query("insert into public.income_items values ($1,$2,$3)", [id(number), type, kind === "combined" ? "Combo" : type === "service" ? "Corte" : "Cera"]);
      }
    }
    await db.query("insert into public.income_payments values ($1,$2,$3)", [id(number), source === "chair_rental" ? transfer : cash, total]);
  };
  for (let number = 10; number < 17; number++) await addIncome(number, "sale", 16000, 8000);
  await addIncome(17, "sale", 7500, 750, "product");
  await addIncome(18, "chair_rental", 16000, 0);
  await addIncome(19, "sale", 9999, 4999, "service", "voided");
  await db.query("update public.income_payments set amount=8000 where income_id=$1", [id(10)]);
  await db.query("insert into public.income_payments values ($1,$2,8000)", [id(10), transfer]);

  const list = async ({ actor = manager, user = employee, kind = null, status = null, payment = null, query = null, from = "2026-10-13", page = 1 } = {}) => {
    const response = await db.query("select public.list_incomes($1,true,$2,$3,'2026-10-16',$4,$5,$6,$7,$8,1) as result", [actor, user, from, payment, kind, status, query, page]);
    return response.rows[0].result;
  };
  const migration046 = await read("046_income_composition.sql");
  await db.exec(migration046);
  const all = await list();
  assert.equal(all.items.length, 1);
  assert.equal(all.metrics.grossTotal, 135500);
  assert.equal(all.metrics.count, 8);
  assert.deepEqual(all.metrics.composition, {
    sales: { grossTotal: 119500, commissionTotal: 56750, barbershopNet: 62750 },
    subscriptions: emptyAmounts,
    chairRentals: { grossTotal: 16000, commissionTotal: 0, barbershopNet: 16000 },
  });
  assert.deepEqual((await list({ page: 2 })).metrics, all.metrics);
  assert.equal((await list({ kind: "service" })).metrics.grossTotal, 112000);
  assert.deepEqual((await list({ kind: "service" })).metrics.composition.chairRentals, emptyAmounts);
  assert.equal((await list({ kind: "products" })).metrics.commissionTotal, 750);
  assert.equal((await list({ kind: "chair_rental" })).metrics.grossTotal, 16000);
  assert.equal((await list({ kind: "chair_rental" })).metrics.count, 0);
  const split = await list({ payment: transfer });
  assert.equal(split.metrics.grossTotal, 32000);
  assert.equal(split.metrics.paymentTotals.find((p) => p.paymentMethodId === transfer).amount, 24000);
  assert.equal((await list({ user: other })).metrics.grossTotal, 0);
  assert.equal((await list({ query: "Cera" })).metrics.grossTotal, 7500);
  assert.equal((await list({ status: "voided" })).metrics.grossTotal, 0);
  assert.deepEqual((await list({ status: "voided" })).metrics.composition.sales, emptyAmounts);
  assert.equal((await list({ from: "2026-10-14" })).metrics.grossTotal, 0);
  const own = await list({ actor: employee, user: other });
  assert.deepEqual(own.metrics, { count: 8, employeeCommissionTotal: 56750 });
  assert.equal(JSON.stringify(own).includes("composition"), false);
  assert.equal((await list({ actor: employee, kind: "chair_rental" })).pagination.total, 0);
  await assert.rejects(list({ actor: id(999) }), /INVALID_ACTOR/);
  await assert.rejects(list({ kind: "unknown" }), /INVALID_INCOME_FILTER/);

  await addIncome(20, "fixed_subscription", 12000, 6000);
  const monthly = await list({ kind: "subscription" });
  assert.equal(monthly.metrics.composition.subscriptions.grossTotal, 12000);
  assert.equal(monthly.items[0].sourceType, "fixed_subscription");
  assert.deepEqual(monthly.items[0].subscription, { sourceType: "fixed_subscription", period: "2026-10", label: "2026-10", monthlyPrice: 12000, employeeEarning: 6000, barbershopNet: 6000 });
  assert.equal(monthly.items[0].service, null);
  assert.deepEqual(monthly.items[0].products, []);
  assert.equal(monthly.items[0].registeredBy.id, manager);
  await addIncome(21, "sale", 20000, 9000, "combined");
  const combined = await list({ kind: "combined" });
  assert.equal(combined.metrics.composition.sales.grossTotal, 20000);
  assert.equal(combined.metrics.count, 1);
  const withMonthly = await list();
  assert.equal(withMonthly.metrics.grossTotal, 167500);
  assert.equal(withMonthly.metrics.commissionTotal, 71750);
  assert.equal(withMonthly.metrics.barbershopNet, 95750);
  for (const key of ["grossTotal", "commissionTotal", "barbershopNet"]) {
    assert.equal(Object.values(withMonthly.metrics.composition).reduce((sum, group) => sum + group[key], 0), withMonthly.metrics[key]);
  }
  const definition = async () => (await db.query("select pg_get_functiondef('public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)'::regprocedure) as body")).rows[0].body;
  const before = await definition();
  await db.exec(migration046);
  assert.equal(await definition(), before);
  const migration047 = await read("047_income_free_customer_name.sql");
  await db.query("insert into public.customers(id,first_name,last_name) values ($1,'Raul','Gómez')", [id(99)]);
  await db.exec(migration047);
  const createFreeName = async (requestId, customerId, customerName) => (await db.query(
    "select public.create_income_with_customer_name($1,$2,$3,$4,null,'[]'::jsonb,'[]'::jsonb,false,null,'{}'::jsonb,$5) as id",
    [manager, employee, requestId, customerId, customerName],
  )).rows[0].id;
  assert.equal(await createFreeName(id(50), null, "  Raul  "), id(50));
  assert.equal((await db.query("select customer_id,customer_name from public.incomes where id=$1", [id(50)])).rows[0].customer_id, null);
  assert.equal((await db.query("select customer_name from public.incomes where id=$1", [id(50)])).rows[0].customer_name, "Raul");
  assert.equal((await db.query("select count(*)::int as count from public.customers")).rows[0].count, 1);
  assert.equal(await createFreeName(id(50), null, "Raul"), id(50));
  await assert.rejects(createFreeName(id(50), null, "Otra persona"), /INCOME_REQUEST_CONFLICT/);
  await assert.rejects(createFreeName(id(51), id(99), "Raul"), /CUSTOMER_IDENTITY_CONFLICT/);
  assert.equal(await createFreeName(id(51), id(99), null), id(51));
  assert.equal(await createFreeName(id(52), null, null), id(52));
  await db.query("insert into public.income_items(income_id,item_type,name_snapshot,id,service_id,created_at,quantity,commission_amount) values ($1,'service','Corte',$1,$1,'2026-10-15T12:00:00Z',1,0)", [id(50)]);
  const managerSearch = await list({ query: "Raul", page: 2 });
  assert.equal(managerSearch.pagination.total, 2);
  assert.equal(managerSearch.items[0].customerName, "Raul");
  const employeeSearch = await list({ actor: employee, user: other, query: "Raul", page: 2 });
  assert.equal(employeeSearch.pagination.total, 2);
  assert.equal(employeeSearch.items[0].customerName, "Raul");
  assert.equal("total" in employeeSearch.items[0], false);
  const finalDefinition = await definition();
  await db.exec(migration047);
  assert.equal(await definition(), finalDefinition);
  console.log("PASS: local PostgreSQL in-memory income composition and 047 free-name storage, mutual exclusion, retry identity, manager/employee projection, pre-pagination search, role scope and migration idempotence.");
} finally {
  await db.close();
}
