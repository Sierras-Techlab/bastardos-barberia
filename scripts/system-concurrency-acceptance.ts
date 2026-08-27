import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, type DatabaseError } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is required.");

const connect = async () => {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
};

let control: Client;
let first: Client;
let second: Client;
const results: Array<{ test: string; status: "PASS" }> = [];
const ids: Record<string, string | undefined> = {};
const pass = (test: string) => results.push({ test, status: "PASS" });

const cleanup = async () => {
  if (!control) return;
  await control.query("begin");
  try {
    await control.query("set local session_replication_role = replica");
    if (ids.incomeId) {
      await control.query("delete from public.income_payments where income_id = $1", [ids.incomeId]);
      await control.query("delete from public.income_items where income_id = $1", [ids.incomeId]);
      await control.query("delete from public.incomes where id = $1", [ids.incomeId]);
    }
    if (ids.productId) {
      await control.query("delete from public.inventory_movements where product_id = $1", [ids.productId]);
      await control.query("delete from public.products where id = $1", [ids.productId]);
    }
    if (ids.categoryId) await control.query("delete from public.product_categories where id = $1", [ids.categoryId]);
    if (ids.serviceId) await control.query("delete from public.services where id = $1", [ids.serviceId]);
    if (ids.employeeId) await control.query("delete from public.employee_work_sessions where employee_id = $1", [ids.employeeId]);
    if (ids.employeeId || ids.managerId) {
      const userIds = [ids.employeeId, ids.managerId].filter(Boolean);
      await control.query("delete from public.sessions where user_id = any($1::uuid[])", [userIds]);
      if (ids.employeeId) await control.query("delete from public.users where id = $1", [ids.employeeId]);
      if (ids.managerId) await control.query("delete from public.users where id = $1", [ids.managerId]);
    }
    await control.query("commit");
  } catch (error) {
    await control.query("rollback");
    throw error;
  }
};

const cleanupStaleFixtures = async () => {
  const staleUsers = await control.query<{ id: string }>(`
    select id from public.users where first_name in ('RaceManager', 'RaceEmployee')
  `);
  const userIds = staleUsers.rows.map((row) => row.id);
  if (userIds.length === 0) return;
  await control.query("begin");
  try {
    await control.query("set local session_replication_role = replica");
    const staleIncomes = await control.query<{ id: string }>(`
      select id from public.incomes where registered_by = any($1::uuid[])
    `, [userIds]);
    const incomeIds = staleIncomes.rows.map((row) => row.id);
    if (incomeIds.length > 0) {
      await control.query("delete from public.income_payments where income_id = any($1::uuid[])", [incomeIds]);
      await control.query("delete from public.income_items where income_id = any($1::uuid[])", [incomeIds]);
      await control.query("delete from public.incomes where id = any($1::uuid[])", [incomeIds]);
    }
    const staleProducts = await control.query<{ id: string }>(`
      select id from public.products where created_by = any($1::uuid[])
    `, [userIds]);
    const productIds = staleProducts.rows.map((row) => row.id);
    if (productIds.length > 0) {
      await control.query("delete from public.inventory_movements where product_id = any($1::uuid[])", [productIds]);
      await control.query("delete from public.products where id = any($1::uuid[])", [productIds]);
    }
    await control.query("delete from public.product_categories where created_by = any($1::uuid[])", [userIds]);
    await control.query("delete from public.services where created_by = any($1::uuid[])", [userIds]);
    await control.query("delete from public.employee_work_sessions where employee_id = any($1::uuid[])", [userIds]);
    await control.query("delete from public.sessions where user_id = any($1::uuid[])", [userIds]);
    await control.query("delete from public.users where id = any($1::uuid[])", [userIds]);
    await control.query("commit");
  } catch (error) {
    await control.query("rollback");
    throw error;
  }
};

const main = async () => {
  [control, first, second] = await Promise.all([connect(), connect(), connect()]);
  await cleanupStaleFixtures();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const users = await control.query<{ id: string; role_id: number }>(`
    insert into public.users (first_name, last_name, username, password_hash, role_id)
    values
      ('RaceManager', $1, 'placeholder.racemanager', '$argon2id$acceptance', 2),
      ('RaceEmployee', $1, 'placeholder.raceemployee', '$argon2id$acceptance', 3)
    returning id, role_id
  `, [`Acceptance${suffix}`]);
  ids.managerId = users.rows.find((row) => row.role_id === 2)?.id;
  ids.employeeId = users.rows.find((row) => row.role_id === 3)?.id;
  assert.ok(ids.managerId && ids.employeeId);

  const category = await control.query<{ id: string }>(`
    insert into public.product_categories (name, normalized_name, created_by, updated_by)
    values ($1, '', $2, $2) returning id
  `, [`Race category ${suffix}`, ids.managerId]);
  ids.categoryId = category.rows[0].id;
  const product = await control.query<{ create_product: string }>(`
    select public.create_product($1, $2, 10000, 1, $3)
  `, [`Race product ${suffix}`, ids.categoryId, ids.managerId]);
  ids.productId = product.rows[0].create_product;

  const stockRace = await Promise.allSettled([
    first.query("select public.adjust_product_stock($1, $2, 'exit', 1)", [ids.productId, ids.managerId]),
    second.query("select public.adjust_product_stock($1, $2, 'exit', 1)", [ids.productId, ids.managerId]),
  ]);
  assert.equal(stockRace.filter((result) => result.status === "fulfilled").length, 1);
  const rejectedStock = stockRace.find((result) => result.status === "rejected");
  assert.ok(rejectedStock?.status === "rejected");
  assert.match((rejectedStock.reason as DatabaseError).message, /INSUFFICIENT_STOCK/);
  const stock = await control.query<{ stock: number; exits: string }>(`
    select p.stock, count(m.id) filter (where m.movement_type = 'exit')::text as exits
      from public.products p left join public.inventory_movements m on m.product_id = p.id
     where p.id = $1 group by p.id
  `, [ids.productId]);
  assert.deepEqual(stock.rows[0], { stock: 0, exits: "1" });
  pass("serialize competing stock exits without negative inventory");

  const sessionRace = await Promise.allSettled([
    first.query("select public.start_work_session($1)", [ids.employeeId]),
    second.query("select public.start_work_session($1)", [ids.employeeId]),
  ]);
  assert.equal(sessionRace.filter((result) => result.status === "fulfilled").length, 1);
  const rejectedSession = sessionRace.find((result) => result.status === "rejected");
  assert.ok(rejectedSession?.status === "rejected");
  assert.match((rejectedSession.reason as DatabaseError).message, /WORK_SESSION_ALREADY_OPEN/);
  const openSessions = await control.query<{ count: string }>(`
    select count(*)::text as count from public.employee_work_sessions
     where employee_id = $1 and ended_at is null
  `, [ids.employeeId]);
  assert.equal(openSessions.rows[0].count, "1");
  pass("serialize competing work-session starts");

  const service = await control.query<{ id: string }>(`
    insert into public.services (name, normalized_name, price, created_by, updated_by)
    values ($1, '', 14000, $2, $2) returning id
  `, [`Race service ${suffix}`, ids.managerId]);
  ids.serviceId = service.rows[0].id;
  const cashMethod = await control.query<{ id: string }>(`
    select id from public.payment_methods where system_code = 'cash' and is_active
  `);
  assert.equal(cashMethod.rowCount, 1);
  const requestId = randomUUID();
  const incomeArgs = [
    ids.managerId,
    ids.employeeId,
    requestId,
    ids.serviceId,
    JSON.stringify([{ paymentMethodId: cashMethod.rows[0].id, amount: 14000 }]),
  ];
  const incomeSql = `
    select public.create_income(
      $1::uuid, $2::uuid, $3::uuid, null::uuid, $4::uuid,
      '[]'::jsonb, $5::jsonb, false, null::jsonb, '{}'::jsonb
    ) as id
  `;
  const incomeRace = await Promise.all([first.query<{ id: string }>(incomeSql, incomeArgs), second.query<{ id: string }>(incomeSql, incomeArgs)]);
  assert.equal(incomeRace[0].rows[0].id, incomeRace[1].rows[0].id);
  ids.incomeId = incomeRace[0].rows[0].id;
  const incomeCount = await control.query<{ count: string }>(`
    select count(*)::text as count from public.incomes
     where registered_by = $1 and request_id = $2
  `, [ids.managerId, requestId]);
  assert.equal(incomeCount.rows[0].count, "1");
  pass("coalesce simultaneous identical income requests into one sale");

  await cleanup();
  for (const key of Object.keys(ids)) ids[key] = undefined;
  const residue = await control.query<{ count: string }>(`
    select count(*)::text as count from public.users
     where first_name in ('RaceManager', 'RaceEmployee') and last_name = $1
  `, [`Acceptance${suffix}`]);
  assert.equal(residue.rows[0].count, "0");
  pass("remove committed concurrency fixtures");
  console.log(JSON.stringify({ suite: "multi-connection-concurrency", results }, null, 2));
};

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({
      message: error instanceof Error ? error.message : "Concurrency acceptance failed",
      completed: results,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => undefined);
    await Promise.all([control?.end(), first?.end(), second?.end()]);
  });
