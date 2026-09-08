import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, type DatabaseError } from "pg";
import { cashDaySchema } from "../src/lib/cash/schemas";
import { businessReportSchema } from "../src/lib/reports/schemas";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const results: Array<{ test: string; status: "PASS" }> = [];
const migration040 = readFileSync(
  join(process.cwd(), "supabase", "queries", "040_production_hardening.sql"),
  "utf8",
)
  .replace(/^\s*begin;\s*/i, "")
  .replace(/\s*commit;\s*$/i, "");
const migration041 = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "queries",
    "041_employee_service_prices_and_automatic_cash.sql",
  ),
  "utf8",
)
  .replace(/^\s*begin;\s*/i, "")
  .replace(/\s*commit;\s*$/i, "");

const pass = (test: string) => results.push({ test, status: "PASS" });

const expectDatabaseError = async (test: string, sentinel: string, operation: () => Promise<unknown>) => {
  const savepoint = `acceptance_${results.length}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await operation();
    assert.fail(`${test}: expected ${sentinel}`);
  } catch (error) {
    const databaseError = error as DatabaseError;
    assert.match(databaseError.message, new RegExp(sentinel));
  } finally {
    await client.query(`rollback to savepoint ${savepoint}`);
  }
  pass(test);
};

const main = async () => {
  await client.connect();
  await client.query("begin");
  await client.query("set local statement_timeout = '20s'");
  await client.query("set local lock_timeout = '5s'");
  await client.query(migration040);
  pass("apply migration 040 inside the rollback-only acceptance transaction");
  await client.query(migration041);
  pass("apply migration 041 inside the rollback-only acceptance transaction");

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const phone = `549${Date.now().toString().slice(-10)}`;
  const passwordHash = "$argon2id$v=19$m=19456,t=2,p=1$YXVkaXQ$YXVkaXQ";

  const managerResult = await client.query<{ id: string }>(`
    insert into public.users (
      first_name, last_name, username, password_hash, role_id,
      service_commission_rate, product_commission_rate
    ) values ('Audit', 'Manager', $1, $2, 2, 0, 0)
    returning id
  `, [`audit.manager${suffix}`, passwordHash]);
  const managerId = managerResult.rows[0].id;

  const employeeResult = await client.query<{ id: string }>(`
    insert into public.users (
      first_name, last_name, username, password_hash, role_id, created_by,
      service_commission_rate, product_commission_rate
    ) values ('Audit', 'Employee', $1, $2, 3, $3, 25, 10)
    returning id
  `, [`audit.employee${suffix}`, passwordHash, managerId]);
  const employeeId = employeeResult.rows[0].id;
  const otherEmployeeResult = await client.query<{ id: string }>(`
    insert into public.users (
      first_name, last_name, username, password_hash, role_id, created_by,
      service_commission_rate, product_commission_rate
    ) values ('Audit', 'Other Employee', $1, $2, 3, $3, 15, 5)
    returning id
  `, [`audit.other.employee${suffix}`, passwordHash, managerId]);
  const otherEmployeeId = otherEmployeeResult.rows[0].id;
  const ownerResult = await client.query<{ id: string }>(`
    insert into public.users (
      first_name, last_name, username, password_hash, role_id, created_by,
      service_commission_rate, product_commission_rate
    ) values ('Audit', 'Owner', $1, $2, 1, $3, 50, 50)
    returning id
  `, [`audit.owner${suffix}`, passwordHash, managerId]);
  const ownerId = ownerResult.rows[0].id;
  pass("create manager, employee and owner fixtures");

  await client.query(`
    select public.update_user_profile(
      $1::uuid,
      false, null::text,
      false, null::text,
      false, null::smallint,
      false, null::boolean,
      true, 55::smallint,
      true, 35::smallint
    )
  `, [employeeId]);
  const rates = await client.query<{ service: number; product: number }>(`
    select service_commission_rate as service, product_commission_rate as product
      from public.users where id = $1
  `, [employeeId]);
  assert.deepEqual(rates.rows[0], { service: 55, product: 35 });
  pass("update user commission rates");

  await expectDatabaseError("reject commission above 100", "users_service_commission_rate_check", () =>
    client.query("update public.users set service_commission_rate = 101 where id = $1", [employeeId]));

  const categoryResult = await client.query<{ id: string }>(`
    insert into public.product_categories (name, normalized_name, created_by, updated_by)
    values ($1, '', $2, $2)
    returning id
  `, [`Audit category ${suffix}`, managerId]);
  const categoryId = categoryResult.rows[0].id;

  const unusedCategoryResult = await client.query<{ id: string }>(`
    insert into public.product_categories (name, normalized_name, created_by, updated_by)
    values ($1, '', $2, $2)
    returning id
  `, [`Audit unused ${suffix}`, managerId]);
  const unusedCategoryId = unusedCategoryResult.rows[0].id;
  pass("create product categories with normalized names");

  const productResult = await client.query<{ create_product: string }>(`
    select public.create_product(
      product_name => $1,
      product_category_id => $2,
      product_price => 12000,
      initial_stock => 5,
      actor_user_id => $3
    )
  `, [`Audit product ${suffix}`, categoryId, managerId]);
  const productId = productResult.rows[0].create_product;

  await client.query(`
    select public.adjust_product_stock(
      target_product_id => $1,
      actor_user_id => $2,
      movement_kind => 'entry',
      movement_quantity => 3
    )
  `, [productId, managerId]);
  const productStock = await client.query<{ stock: number; movements: string }>(`
    select p.stock, count(m.id)::text as movements
      from public.products p
      left join public.inventory_movements m on m.product_id = p.id
     where p.id = $1 group by p.id
  `, [productId]);
  assert.equal(productStock.rows[0].stock, 8);
  assert.equal(Number(productStock.rows[0].movements), 2);
  pass("create product and append audited stock entry");

  await expectDatabaseError("reject stock below zero", "INSUFFICIENT_STOCK", () => client.query(`
    select public.adjust_product_stock(
      target_product_id => $1,
      actor_user_id => $2,
      movement_kind => 'exit',
      movement_quantity => 9
    )
  `, [productId, managerId]));

  await expectDatabaseError("protect referenced product category deletion", "PRODUCT_CATEGORY_HAS_PRODUCTS", () =>
    client.query("select public.delete_product_category($1, $2)", [managerId, categoryId]));
  await client.query("select public.delete_product_category($1, $2)", [managerId, unusedCategoryId]);
  pass("delete unused product category");

  const serviceResult = await client.query<{ id: string }>(`
    insert into public.services (name, normalized_name, price, created_by, updated_by)
    values ($1, '', 18000, $2, $2)
    returning id
  `, [`Audit service ${suffix}`, managerId]);
  const serviceId = serviceResult.rows[0].id;
  const service = await client.query<{ name: string; normalized_name: string }>(`
    select name, normalized_name from public.services where id = $1
  `, [serviceId]);
  assert.equal(service.rows[0].name, `Audit service ${suffix}`);
  assert.notEqual(service.rows[0].normalized_name, "");
  pass("create service with normalized catalog snapshot");

  const paymentResult = await client.query<{ create_payment_method: string }>(`
    select public.create_payment_method($1, $2)
  `, [managerId, `Audit payment ${suffix}`]);
  const paymentMethodId = paymentResult.rows[0].create_payment_method;
  assert.ok(paymentMethodId);
  pass("create payment method");

  const cashMethod = await client.query<{ id: string }>(`
    select id from public.payment_methods where system_code = 'cash' and is_active
  `);
  assert.equal(cashMethod.rowCount, 1);
  await expectDatabaseError("protect canonical cash payment method", "CASH_PAYMENT_METHOD_PROTECTED", () =>
    client.query("select public.update_payment_method($1, $2, null, false)", [managerId, cashMethod.rows[0].id]));

  const customerResult = await client.query<{ create_customer: string }>(`
    select public.create_customer(
      actor_user_id => $1,
      new_first_name => 'Audit',
      new_last_name => 'Customer',
      new_phone => $2,
      new_email => $3,
      fixed_schedule => $4::jsonb
    )
  `, [
    managerId,
    phone,
    `audit.${suffix}@example.test`,
    JSON.stringify({ weekday: 2, time: "10:30", responsible_user_id: employeeId, monthly_price: 30000 }),
  ]);
  const customerId = customerResult.rows[0].create_customer;
  const schedule = await client.query<{ responsible_user_id: string; monthly_price: number }>(`
    select responsible_user_id, monthly_price
      from public.customer_fixed_schedules
     where customer_id = $1 and is_active
  `, [customerId]);
  assert.deepEqual(
    { ...schedule.rows[0], monthly_price: Number(schedule.rows[0].monthly_price) },
    { responsible_user_id: employeeId, monthly_price: 30000 },
  );
  pass("create customer with responsible fixed schedule");

  const occurrenceRange = await client.query<{ date_from: string; date_to: string }>(`
    select local_date::text as date_from, (local_date + 7)::text as date_to
    from (
      select pg_catalog.timezone('America/Argentina/Buenos_Aires', now())::date as local_date
    ) dates
  `);
  const listOccurrences = async (actorId: string) => {
    const result = await client.query<{ occurrences: Array<{ id: string; customer: { id: string } }> }>(`
      select public.list_fixed_customer_occurrences($1, $2::date, $3::date, null) as occurrences
    `, [actorId, occurrenceRange.rows[0].date_from, occurrenceRange.rows[0].date_to]);
    return result.rows[0].occurrences;
  };
  const managerOccurrences = await listOccurrences(managerId);
  const employeeOccurrences = await listOccurrences(employeeId);
  const otherEmployeeOccurrences = await listOccurrences(otherEmployeeId);
  const employeeOccurrence = employeeOccurrences.find((occurrence) => occurrence.customer.id === customerId);
  assert.ok(managerOccurrences.some((occurrence) => occurrence.customer.id === customerId));
  assert.ok(employeeOccurrence);
  assert.equal(otherEmployeeOccurrences.some((occurrence) => occurrence.customer.id === customerId), false);
  await expectDatabaseError("reject attendance mutation for another professional", "FIXED_OCCURRENCE_NOT_FOUND", () =>
    client.query("select public.resolve_fixed_customer_occurrence($1, $2, 'attended', 'pending')", [
      otherEmployeeId,
      employeeOccurrence.id,
    ]));
  pass("scope fixed-customer agenda to the responsible employee");

  await expectDatabaseError("reject employee sale without an open work session", "EMPLOYEE_WORK_SESSION_REQUIRED", () =>
    client.query(`
      select public.create_income(
        $1::uuid, $1::uuid, $2::uuid, null::uuid, $3::uuid,
        '[]'::jsonb, $4::jsonb, false, null::jsonb, '{}'::jsonb
      )
    `, [employeeId, randomUUID(), serviceId,
      JSON.stringify([{ paymentMethodId, basisPoints: 10000 }])]));

  const started = await client.query<{ start_work_session: unknown }>(`
    select public.start_work_session($1)
  `, [employeeId]);
  assert.ok(started.rows[0].start_work_session);
  await expectDatabaseError("reject duplicate open work session", "WORK_SESSION_ALREADY_OPEN", () =>
    client.query("select public.start_work_session($1)", [employeeId]));

  const managerRequestId = randomUUID();
  const managerProductItems = JSON.stringify([
    { productId, quantity: 2, grantFullCommission: false },
  ]);
  const managerPayments = JSON.stringify([
    { paymentMethodId, amount: 35000 },
  ]);
  const serviceOverride = JSON.stringify({ chargedUnitPrice: 15000, reason: "Acceptance discount" });
  const productOverrides = JSON.stringify({
    [productId]: { chargedUnitPrice: 10000, reason: "Acceptance discount" },
  });
  const managerIncomeResult = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
      $6::jsonb, $7::jsonb, false, $8::jsonb, $9::jsonb
    )
  `, [
    managerId,
    employeeId,
    managerRequestId,
    customerId,
    serviceId,
    managerProductItems,
    managerPayments,
    serviceOverride,
    productOverrides,
  ]);
  const managerIncomeId = managerIncomeResult.rows[0].create_income;
  const managerIncome = await client.query<{
    total: number;
    gross_total: number;
    commission_total: number;
    barbershop_net: number;
    outside_work_session: boolean;
    work_session_id: string | null;
  }>(`
    select total, gross_total, commission_total, barbershop_net,
           outside_work_session, work_session_id
      from public.incomes where id = $1
  `, [managerIncomeId]);
  assert.deepEqual(managerIncome.rows[0], {
    total: 35000,
    gross_total: 42000,
    commission_total: 15250,
    barbershop_net: 19750,
    outside_work_session: false,
    work_session_id: (started.rows[0].start_work_session as { id: string }).id,
  });
  pass("create manager combined sale with charged-price snapshots");

  const managerRetry = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
      $6::jsonb, $7::jsonb, false, $8::jsonb, $9::jsonb
    )
  `, [managerId, employeeId, managerRequestId, customerId, serviceId, managerProductItems,
    managerPayments, serviceOverride, productOverrides]);
  assert.equal(managerRetry.rows[0].create_income, managerIncomeId);
  pass("return the same income for an identical retry");

  await expectDatabaseError("reject semantic income request conflict", "INCOME_REQUEST_CONFLICT", () =>
    client.query(`
      select public.create_income(
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        $6::jsonb, $7::jsonb, false, null::jsonb, '{}'::jsonb
      )
    `, [managerId, employeeId, managerRequestId, customerId, serviceId, managerProductItems,
      JSON.stringify([{ paymentMethodId, amount: 42000 }])]));

  const productAfterSale = await client.query<{ stock: number }>(
    "select stock from public.products where id = $1",
    [productId],
  );
  assert.equal(productAfterSale.rows[0].stock, 6);
  pass("decrement product stock exactly once after retry");

  const managerDetail = await client.query<{ get_income_detail: Record<string, unknown> }>(`
    select public.get_income_detail($1, true, $2)
  `, [managerId, managerIncomeId]);
  assert.equal(managerDetail.rows[0].get_income_detail.total, 35000);
  assert.ok("payments" in managerDetail.rows[0].get_income_detail);
  pass("return complete manager income detail");

  const employeeRequestId = randomUUID();
  const employeeIncomeResult = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $1::uuid, $2::uuid, null::uuid, $3::uuid,
      '[]'::jsonb, $4::jsonb, false, $5::jsonb, '{}'::jsonb
    )
  `, [
    employeeId,
    employeeRequestId,
    serviceId,
    JSON.stringify([{ paymentMethodId, basisPoints: 10000 }]),
    JSON.stringify({
      chargedUnitPrice: 14000,
      reason: "Acceptance employee service adjustment",
    }),
  ]);
  const employeeIncomeId = employeeIncomeResult.rows[0].create_income;
  const employeeIncome = await client.query<{ total: number; commission_total: number }>(`
    select total, commission_total from public.incomes where id = $1
  `, [employeeIncomeId]);
  assert.deepEqual(employeeIncome.rows[0], { total: 14000, commission_total: 7700 });
  const employeeDetail = await client.query<{ get_income_detail: Record<string, unknown> }>(`
    select public.get_income_detail($1, false, $2)
  `, [employeeId, employeeIncomeId]);
  const employeeProjection = employeeDetail.rows[0].get_income_detail;
  for (const forbidden of ["total", "grossTotal", "payments", "barbershopNet", "registeredBy"]) {
    assert.equal(forbidden in employeeProjection, false, `employee projection leaked ${forbidden}`);
  }
  assert.equal(employeeProjection.employeeCommission, 7700);
  pass("create employee service-price adjustment with sanitized detail");

  await expectDatabaseError(
    "reject employee product-price adjustment",
    "PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE",
    () =>
      client.query(
        `
          select public.create_income(
            $1::uuid, $1::uuid, $2::uuid, null::uuid, null::uuid,
            $3::jsonb, $4::jsonb, false, null::jsonb, $5::jsonb
          )
        `,
        [
          employeeId,
          randomUUID(),
          JSON.stringify([
            { productId, quantity: 1, grantFullCommission: false },
          ]),
          JSON.stringify([{ paymentMethodId, basisPoints: 10000 }]),
          JSON.stringify({
            [productId]: {
              chargedUnitPrice: 10000,
              reason: "Acceptance forbidden product adjustment",
            },
          }),
        ],
      ),
  );

  await expectDatabaseError(
    "reject a service-price adjustment without a selected service",
    "INVALID_SERVICE_PRICE_OVERRIDE",
    () =>
      client.query(
        `
          select public.create_income(
            $1::uuid, $1::uuid, $2::uuid, null::uuid, null::uuid,
            $3::jsonb, $4::jsonb, false, $5::jsonb, '{}'::jsonb
          )
        `,
        [
          employeeId,
          randomUUID(),
          JSON.stringify([
            { productId, quantity: 1, grantFullCommission: false },
          ]),
          JSON.stringify([{ paymentMethodId, basisPoints: 10000 }]),
          JSON.stringify({
            chargedUnitPrice: 10000,
            reason: "Acceptance missing service",
          }),
        ],
      ),
  );

  const employeeSplitResult = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $1::uuid, $2::uuid, null::uuid, $3::uuid,
      '[]'::jsonb, $4::jsonb, false, null::jsonb, '{}'::jsonb
    )
  `, [employeeId, randomUUID(), serviceId, JSON.stringify([
    { paymentMethodId: cashMethod.rows[0].id, basisPoints: 4000 },
    { paymentMethodId, basisPoints: 6000 },
  ])]);
  const employeeSplit = await client.query<{ amount: number; basis_points: number }>(`
    select amount, basis_points from public.income_payments
     where income_id = $1 order by basis_points
  `, [employeeSplitResult.rows[0].create_income]);
  assert.deepEqual(employeeSplit.rows.map((row) => ({ ...row, amount: Number(row.amount) })), [
    { amount: 7200, basis_points: 4000 },
    { amount: 10800, basis_points: 6000 },
  ]);
  pass("distribute employee 40/60 payments deterministically");

  const fullCommissionResult = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $2::uuid, $3::uuid, null::uuid, $4::uuid,
      $5::jsonb, $6::jsonb, true, null::jsonb, '{}'::jsonb
    )
  `, [managerId, employeeId, randomUUID(), serviceId,
    JSON.stringify([{ productId, quantity: 1, grantFullCommission: true }]),
    JSON.stringify([{ paymentMethodId, amount: 30000 }])]);
  const fullCommission = await client.query<{ commission_total: number; barbershop_net: number }>(`
    select commission_total, barbershop_net from public.incomes where id = $1
  `, [fullCommissionResult.rows[0].create_income]);
  assert.deepEqual(fullCommission.rows[0], { commission_total: 30000, barbershop_net: 0 });
  pass("grant complete service and product-line commission");
  await client.query("select public.void_income($1, $2)", [fullCommissionResult.rows[0].create_income, managerId]);

  const ownerIncomeResult = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $2::uuid, $3::uuid, null::uuid, $4::uuid,
      '[]'::jsonb, $5::jsonb, false, null::jsonb, '{}'::jsonb
    )
  `, [managerId, ownerId, randomUUID(), serviceId,
    JSON.stringify([{ paymentMethodId, amount: 18000 }])]);
  const ownerIncome = await client.query<{ commission_total: number; barbershop_net: number }>(`
    select commission_total, barbershop_net from public.incomes where id = $1
  `, [ownerIncomeResult.rows[0].create_income]);
  assert.deepEqual(ownerIncome.rows[0], { commission_total: 9000, barbershop_net: 9000 });
  pass("snapshot configured owner commission");

  const zeroIncomeResult = await client.query<{ create_income: string }>(`
    select public.create_income(
      $1::uuid, $2::uuid, $3::uuid, null::uuid, $4::uuid,
      '[]'::jsonb, '[]'::jsonb, false, $5::jsonb, '{}'::jsonb
    )
  `, [managerId, employeeId, randomUUID(), serviceId,
    JSON.stringify({ chargedUnitPrice: 0, reason: "Acceptance free service" })]);
  const zeroIncome = await client.query<{ total: number; commission_total: number; payment_count: string }>(`
    select i.total, i.commission_total, count(ip.id)::text as payment_count
      from public.incomes i left join public.income_payments ip on ip.income_id = i.id
     where i.id = $1 group by i.id
  `, [zeroIncomeResult.rows[0].create_income]);
  assert.deepEqual(zeroIncome.rows[0], { total: 0, commission_total: 0, payment_count: "0" });
  pass("create zero-total manager sale without payments");

  await client.query("select public.void_income($1, $2)", [managerIncomeId, managerId]);
  const voided = await client.query<{ status: string; stock: number }>(`
    select i.status, p.stock
      from public.incomes i cross join public.products p
     where i.id = $1 and p.id = $2
  `, [managerIncomeId, productId]);
  assert.deepEqual(voided.rows[0], { status: "voided", stock: 8 });
  pass("void manager sale and restore product stock");

  const period = await client.query<{ period: string }>(`
    select to_char(pg_catalog.timezone('America/Argentina/Buenos_Aires', now()), 'YYYY-MM') as period
  `);
  const monthlyRequestId = randomUUID();
  const monthlyResult = await client.query<{ pay_fixed_customer_month: Record<string, unknown> }>(`
    select public.pay_fixed_customer_month($1, $2, $3, $4, $5::jsonb)
  `, [managerId, monthlyRequestId, customerId, period.rows[0].period,
    JSON.stringify([{ paymentMethodId, amount: 30000 }])]);
  assert.equal(monthlyResult.rows[0].pay_fixed_customer_month.status, "paid");
  const monthlyIncomeId = String(monthlyResult.rows[0].pay_fixed_customer_month.incomeId);
  const monthlyIncome = await client.query<{ source_type: string; customer_visits: number }>(`
    select i.source_type, c.visits as customer_visits
      from public.incomes i join public.customers c on c.id = i.customer_id
     where i.id = $1
  `, [monthlyIncomeId]);
  assert.equal(monthlyIncome.rows[0].source_type, "fixed_subscription");
  assert.equal(monthlyIncome.rows[0].customer_visits, 0);
  pass("pay fixed month without adding a customer visit");

  const visitHistory = await client.query<{ visits: { pagination: { total: number }; items: unknown[] } }>(`
    select public.list_customer_visits($1, $2, 1, 20) as visits
  `, [managerId, customerId]);
  assert.equal(visitHistory.rows[0].visits.pagination.total, 0);
  assert.deepEqual(visitHistory.rows[0].visits.items, []);
  pass("exclude fixed subscriptions from customer visit history");

  await client.query("savepoint fixed_subscription_void_acceptance");
  await client.query("select public.void_income($1, $2)", [monthlyIncomeId, managerId]);
  const voidedSubscription = await client.query<{ visits: number; attempt_status: string }>(`
    select c.visits, a.status as attempt_status
    from public.customers c
    join public.fixed_customer_monthly_payment_attempts a on a.customer_id = c.id
    where c.id = $1 and a.income_id = $2
  `, [customerId, monthlyIncomeId]);
  assert.deepEqual(voidedSubscription.rows[0], { visits: 0, attempt_status: "voided" });
  await client.query("rollback to savepoint fixed_subscription_void_acceptance");
  pass("void fixed subscription without decrementing customer visits");

  await expectDatabaseError("reject a second active monthly payment", "FIXED_MONTH_ALREADY_PAID", () =>
    client.query("select public.pay_fixed_customer_month($1, $2, $3, $4, $5::jsonb)", [
      managerId,
      randomUUID(),
      customerId,
      period.rows[0].period,
      JSON.stringify([{ paymentMethodId, amount: 30000 }]),
    ]));

  const businessDate = await client.query<{ business_date: string }>(`
    select pg_catalog.timezone('America/Argentina/Buenos_Aires', now())::date::text as business_date
  `);

  const manualLifecycleFunctions = await client.query<{
    open_function: string | null;
    close_function: string | null;
  }>(`
    select
      pg_catalog.to_regprocedure('public.open_daily_cash(uuid,date,bigint)')::text as open_function,
      pg_catalog.to_regprocedure('public.close_daily_cash(uuid,date,bigint)')::text as close_function
  `);
  assert.deepEqual(manualLifecycleFunctions.rows[0], {
    open_function: null,
    close_function: null,
  });
  pass("remove manual Caja opening and closing functions");

  const cashBeforeBalanceResult = await client.query<{ get_daily_cash: unknown }>(`
    select public.get_daily_cash($1, $2::date)
  `, [managerId, businessDate.rows[0].business_date]);
  const cashBeforeBalance = cashDaySchema.parse(
    cashBeforeBalanceResult.rows[0].get_daily_cash,
  );
  const balanceCreatedResult = await client.query<{
    set_daily_cash_opening_balance: unknown;
  }>(`
    select public.set_daily_cash_opening_balance($1, $2::date, 15000::bigint)
  `, [managerId, businessDate.rows[0].business_date]);
  const balanceCreated = cashDaySchema.parse(
    balanceCreatedResult.rows[0].set_daily_cash_opening_balance,
  );
  assert.equal(balanceCreated.lifecycle.openingBalance, 15000);
  assert.equal(balanceCreated.lifecycle.openingSource, "initial_balance");
  assert.equal(
    balanceCreated.lifecycle.expectedCash,
    cashBeforeBalance.lifecycle.expectedCash + 15000,
  );
  const balanceEditedResult = await client.query<{
    set_daily_cash_opening_balance: unknown;
  }>(`
    select public.set_daily_cash_opening_balance($1, $2::date, 12000::bigint)
  `, [managerId, businessDate.rows[0].business_date]);
  const balanceEdited = cashDaySchema.parse(
    balanceEditedResult.rows[0].set_daily_cash_opening_balance,
  );
  assert.equal(balanceEdited.lifecycle.openingBalance, 12000);
  assert.equal(
    balanceEdited.lifecycle.expectedCash,
    cashBeforeBalance.lifecycle.expectedCash + 12000,
  );
  pass("set and edit today's opening balance without manual Caja lifecycle");

  const cashBeforeExpenseResult = await client.query<{ get_daily_cash: unknown }>(`
    select public.get_daily_cash($1, $2::date)
  `, [managerId, businessDate.rows[0].business_date]);
  const parsedCash = cashDaySchema.safeParse(cashBeforeExpenseResult.rows[0].get_daily_cash);
  assert.equal(parsedCash.success, true, parsedCash.success ? undefined : parsedCash.error.message);
  if (!parsedCash.success) assert.fail("cash schema rejected the live projection");
  const subscriptionSale = parsedCash.data?.sales.find((sale) => sale.id === monthlyIncomeId);
  assert.equal(subscriptionSale?.kind, "subscription");
  assert.ok(parsedCash.data?.sales.some((sale) => sale.id === employeeIncomeId));
  pass("validate live Caja projection and subscription classification");

  assert.equal(parsedCash.data?.state, "live");
  const liveCashId = parsedCash.data?.id;
  assert.ok(liveCashId);
  await client.query("savepoint live_cash_adjustment_acceptance");
  const adjustmentResult = await client.query<{ id: string }>(`
    insert into public.daily_cash_adjustments (
      business_date, source_income_id, original_daily_cash_id, created_by,
      created_by_first_name_snapshot, created_by_last_name_snapshot,
      gross_delta, commission_delta, barbershop_net_delta, service_delta, product_delta
    ) values ($1::date, $2, $3, $4, 'Audit', 'Manager', -100, 0, -100, -100, 0)
    returning id
  `, [businessDate.rows[0].business_date, employeeIncomeId, liveCashId, managerId]);
  await client.query(`
    insert into public.daily_cash_adjustment_payments (
      adjustment_id, payment_method_id, method_name_snapshot, amount
    ) values ($1, $2, 'Efectivo', -100)
  `, [adjustmentResult.rows[0].id, cashMethod.rows[0].id]);
  const adjustedExpectedCash = await client.query<{ expected_cash: string }>(`
    select public.current_cash_expected($1::date, $2::bigint)::text as expected_cash
  `, [businessDate.rows[0].business_date, parsedCash.data.lifecycle.openingBalance]);
  assert.equal(
    Number(adjustedExpectedCash.rows[0].expected_cash),
    parsedCash.data.lifecycle.expectedCash - 100,
  );
  await client.query("rollback to savepoint live_cash_adjustment_acceptance");
  pass("include cash adjustments in live Caja expected cash");

  await client.query("savepoint automatic_cash_close_acceptance");
  const pastBusinessDateResult = await client.query<{ business_date: string }>(`
    select candidate::date::text as business_date
    from pg_catalog.generate_series(
      pg_catalog.timezone('America/Argentina/Buenos_Aires', now())::date - 10000,
      pg_catalog.timezone('America/Argentina/Buenos_Aires', now())::date - 1,
      interval '1 day'
    ) candidate
    where not exists (
      select 1 from public.daily_cash_registers r
      where r.business_date = candidate::date
    )
    limit 1
  `);
  const pastBusinessDate = pastBusinessDateResult.rows[0].business_date;
  const pastCashResult = await client.query<{ id: string }>(`
    insert into public.daily_cash_registers (
      business_date,
      sales_gross_total,
      sales_commission_total,
      sales_barbershop_net,
      service_sales_total,
      product_sales_total,
      sale_count,
      active_sale_count,
      voided_sale_count,
      opening_balance,
      opening_source,
      opened_at,
      opened_by,
      close_mode,
      expected_cash,
      reconciliation_state,
      closed_at
    ) values (
      $1::date, 0, 0, 0, 0, 0, 0, 0, 0,
      1234, 'initial_balance', pg_catalog.clock_timestamp(), $2,
      null, 1234, 'not_applicable', null
    )
    returning id
  `, [pastBusinessDate, managerId]);
  const automaticClose = await client.query<{ close_pending_daily_cash: number }>(`
    select public.close_pending_daily_cash()
  `);
  assert.ok(automaticClose.rows[0].close_pending_daily_cash >= 1);
  const closedCashResult = await client.query<{ get_daily_cash: unknown }>(`
    select public.get_daily_cash($1, $2::date)
  `, [managerId, pastBusinessDate]);
  const parsedClosedCash = cashDaySchema.parse(
    closedCashResult.rows[0].get_daily_cash,
  );
  assert.equal(parsedClosedCash.state, "closed");
  assert.equal(parsedClosedCash.lifecycle.closeMode, "automatic");
  assert.equal(
    parsedClosedCash.lifecycle.reconciliationState,
    "pending_confirmation",
  );
  assert.equal(parsedClosedCash.lifecycle.countedCash, null);
  const confirmedCashResult = await client.query<{ confirm_daily_cash: unknown }>(`
    select public.confirm_daily_cash($1, $2, 1200::bigint)
  `, [managerId, pastCashResult.rows[0].id]);
  const confirmedCash = cashDaySchema.parse(
    confirmedCashResult.rows[0].confirm_daily_cash,
  );
  assert.equal(confirmedCash.lifecycle.reconciliationState, "confirmed");
  assert.equal(confirmedCash.lifecycle.countedCash, 1200);
  assert.equal(confirmedCash.lifecycle.difference, -34);
  await client.query("rollback to savepoint automatic_cash_close_acceptance");
  pass("close Caja automatically and preserve physical-count confirmation");

  const expenseCategoryResult = await client.query<{ create_expense_category: Record<string, unknown> }>(`
    select public.create_expense_category($1, $2, 'supplies')
  `, [managerId, `Audit expense ${suffix}`]);
  const expenseCategoryId = String(expenseCategoryResult.rows[0].create_expense_category.id);
  const expenseRequestId = randomUUID();
  const expenseResult = await client.query<{ create_expense: Record<string, unknown> }>(`
    select public.create_expense($1, $2, $3::date, $4, 5000, $5, null, $6)
  `, [managerId, expenseRequestId, businessDate.rows[0].business_date, expenseCategoryId,
    `Audit expense ${suffix}`, paymentMethodId]);
  const expense = expenseResult.rows[0].create_expense;
  assert.equal(expense.amount, 5000);
  const expenseId = String(expense.id);
  const expenseRetry = await client.query<{ create_expense: Record<string, unknown> }>(`
    select public.create_expense($1, $2, $3::date, $4, 5000, $5, null, $6)
  `, [managerId, expenseRequestId, businessDate.rows[0].business_date, expenseCategoryId,
    `Audit expense ${suffix}`, paymentMethodId]);
  assert.equal(expenseRetry.rows[0].create_expense.id, expenseId);
  pass("create expense and return the same result on retry");

  await expectDatabaseError("reject semantic expense request conflict", "EXPENSE_REQUEST_CONFLICT", () =>
    client.query("select public.create_expense($1, $2, $3::date, $4, 6000, $5, null, $6)", [
      managerId,
      expenseRequestId,
      businessDate.rows[0].business_date,
      expenseCategoryId,
      `Audit expense ${suffix}`,
      paymentMethodId,
    ]));

  const expenseUpdateResult = await client.query<{ update_expense: Record<string, unknown> }>(`
    select public.update_expense(
      $1, $2, $3::timestamptz, 'Acceptance correction',
      null::date, null::uuid, 6000::bigint, null::text,
      null::text, false, null::uuid, false
    )
  `, [managerId, expenseId, String(expense.updatedAt)]);
  const updatedExpense = expenseUpdateResult.rows[0].update_expense;
  assert.equal(updatedExpense.amount, 6000);
  const voidExpenseResult = await client.query<{ void_expense: Record<string, unknown> }>(`
    select public.void_expense($1, $2, $3::timestamptz, 'Acceptance void')
  `, [managerId, expenseId, String(updatedExpense.updatedAt)]);
  assert.equal(voidExpenseResult.rows[0].void_expense.status, "voided");
  pass("update and void expense with optimistic versions");

  const cashAfterExpenseResult = await client.query<{ get_daily_cash: unknown }>(`
    select public.get_daily_cash($1, $2::date)
  `, [managerId, businessDate.rows[0].business_date]);
  assert.deepEqual(cashAfterExpenseResult.rows[0].get_daily_cash, cashBeforeExpenseResult.rows[0].get_daily_cash);
  pass("keep Caja byte-equivalent across the expense lifecycle");

  const reportResult = await client.query<{ get_business_report: unknown }>(`
    select public.get_business_report($1, $2)
  `, [managerId, period.rows[0].period]);
  const parsedReport = businessReportSchema.safeParse(reportResult.rows[0].get_business_report);
  assert.equal(parsedReport.success, true, parsedReport.success ? undefined : parsedReport.error.message);
  if (!parsedReport.success) assert.fail("business report schema rejected the database projection");
  assert.equal(parsedReport.data.availableMonths[0], period.rows[0].period);
  assert.ok(parsedReport.data.availableMonths.includes(parsedReport.data.month));
  assert.equal(parsedReport.data.summary.barbershopNet - parsedReport.data.summary.expenses,
    parsedReport.data.summary.operatingResult);
  assert.equal(parsedReport.data.incomeComposition.reduce((sum, item) => sum + item.amount, 0),
    parsedReport.data.summary.grossIncome);
  assert.equal(parsedReport.data.paymentComposition.reduce((sum, item) => sum + item.amount, 0),
    parsedReport.data.summary.grossIncome);
  assert.equal(parsedReport.data.daily.length, parsedReport.data.period.elapsedDays);
  const employeePerformance = parsedReport.data.teamPerformance.find((member) => member.id === employeeId);
  const ownerPerformance = parsedReport.data.teamPerformance.find((member) => member.id === ownerId);
  assert.ok(employeePerformance);
  assert.ok(ownerPerformance);
  assert.equal(employeePerformance.role, "employee");
  assert.ok(employeePerformance.current.saleCount > 0);
  assert.ok(employeePerformance.current.workedMinutes !== null);
  assert.equal(ownerPerformance.role, "owner");
  assert.equal(ownerPerformance.current.workedMinutes, null);
  assert.equal(ownerPerformance.current.grossPerHour, null);
  pass("project the manager business report with exact financial identities");

  await expectDatabaseError("reject employee business reports", "MANAGER_REQUIRED", () =>
    client.query("select public.get_business_report($1, $2)", [employeeId, period.rows[0].period]));

  const ended = await client.query<{ end_work_session: unknown }>(`
    select public.end_work_session($1)
  `, [employeeId]);
  assert.ok(ended.rows[0].end_work_session);
  pass("start and end employee work session");

  const retained = await client.query<{ count: string }>(`
    select count(*)::text as count from public.users where id = any($1::uuid[])
  `, [[managerId, employeeId, ownerId]]);
  assert.equal(Number(retained.rows[0].count), 3);

  await client.query("rollback");
  const afterRollback = await client.query<{ count: string }>(`
    select count(*)::text as count from public.users where id = any($1::uuid[])
  `, [[managerId, employeeId, ownerId]]);
  assert.equal(Number(afterRollback.rows[0].count), 0);
  pass("rollback removes every synthetic fixture");

  console.log(JSON.stringify({ suite: "catalog-and-identity", results }, null, 2));
};

main()
  .catch(async (error: unknown) => {
    try {
      await client.query("rollback");
    } catch {
      // The original database error is more useful than rollback cleanup failure.
    }
    const databaseError = error as DatabaseError;
    console.error(JSON.stringify({
      code: databaseError.code,
      message: databaseError.message,
      completed: results,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => client.end());
