import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

import { hashPassword } from "../src/lib/auth/password";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is required.");

const port = Number(process.env.ACCEPTANCE_PORT ?? 3000);
const baseUrl = `http://127.0.0.1:${port}`;
const password = `Acceptance-${randomUUID()}-Aa1`;
const resetPassword = `Reset-${randomUUID()}-Bb2`;
const results: Array<{ test: string; status: "PASS" }> = [];
const createdUserIds: string[] = [];
const resources: {
  categoryId?: string;
  productId?: string;
  serviceId?: string;
  paymentMethodId?: string;
  customerId?: string;
} = {};

const pass = (test: string) => results.push({ test, status: "PASS" });

const request = (path: string, init: RequestInit = {}, cookie?: string) => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
};

const login = async (username: string, candidatePassword: string) => {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password: candidatePassword }),
  });
  const setCookie = response.headers.get("set-cookie");
  return {
    response,
    cookie: setCookie?.split(";", 1)[0] ?? null,
  };
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // Development server is still starting.
    }
    await delay(500);
  }
  throw new Error("Next.js acceptance server did not start.");
};

const database = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
let server: ChildProcess | null = null;
let serverErrors = "";

const ensureServer = async () => {
  try {
    const response = await fetch(`${baseUrl}/login`);
    if (response.ok) return;
  } catch {
    // Start an isolated server below.
  }
  server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_PUBLIC_APP_URL: baseUrl },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    serverErrors += chunk.toString();
  });
  await waitForServer();
};

const cleanup = async () => {
  if (resources.customerId) {
    await database.query("delete from public.fixed_customer_occurrences where customer_id = $1", [resources.customerId]);
    await database.query("delete from public.customer_fixed_schedules where customer_id = $1", [resources.customerId]);
    await database.query("delete from public.customers where id = $1", [resources.customerId]);
    resources.customerId = undefined;
  }
  if (resources.productId) {
    await database.query("delete from public.inventory_movements where product_id = $1", [resources.productId]);
    await database.query("delete from public.products where id = $1", [resources.productId]);
    resources.productId = undefined;
  }
  if (resources.categoryId) {
    await database.query("delete from public.product_categories where id = $1", [resources.categoryId]);
    resources.categoryId = undefined;
  }
  if (resources.serviceId) {
    await database.query("delete from public.services where id = $1", [resources.serviceId]);
    resources.serviceId = undefined;
  }
  if (resources.paymentMethodId) {
    await database.query("delete from public.payment_methods where id = $1", [resources.paymentMethodId]);
    resources.paymentMethodId = undefined;
  }
  if (createdUserIds.length > 0) {
    await database.query("delete from public.sessions where user_id = any($1::uuid[])", [createdUserIds]);
    for (const id of [...createdUserIds].reverse()) {
      await database.query("delete from public.users where id = $1", [id]);
    }
  }
};

const main = async () => {
  await database.connect();
  const passwordHash = await hashPassword(password);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);

  const fixtures = await database.query<{ id: string; username: string; role_id: number }>(`
    insert into public.users (first_name, last_name, username, password_hash, role_id)
    values
      ('HttpManager', $1, 'placeholder.manager', $2, 2),
      ('HttpEmployee', $1, 'placeholder.employee', $2, 3)
    returning id, username, role_id
  `, [`Acceptance${suffix}`, passwordHash]);
  createdUserIds.push(...fixtures.rows.map((row) => row.id));
  const manager = fixtures.rows.find((row) => row.role_id === 2);
  const employee = fixtures.rows.find((row) => row.role_id === 3);
  assert.ok(manager && employee);

  await ensureServer();

  const anonymousAdmin = await request("/api/admin/users");
  assert.equal(anonymousAdmin.status, 401);
  pass("reject anonymous manager API access");

  const employeeLogin = await login(employee.username, password);
  assert.equal(employeeLogin.response.status, 200);
  assert.ok(employeeLogin.cookie);
  const employeeAdmin = await request("/api/admin/users", {}, employeeLogin.cookie ?? undefined);
  assert.equal(employeeAdmin.status, 403);
  pass("reject employee manager API access");

  const managerLogin = await login(manager.username, password);
  assert.equal(managerLogin.response.status, 200);
  assert.ok(managerLogin.cookie);
  const managerCookie = managerLogin.cookie ?? undefined;
  const currentManager = await request("/api/auth/me", {}, managerCookie);
  assert.equal(currentManager.status, 200);
  pass("login manager and hydrate current session");

  const createdResponse = await request("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      firstName: "HttpTarget",
      lastName: `Acceptance${suffix}`,
      password,
      roleId: 3,
      serviceCommissionRate: 20,
      productCommissionRate: 10,
    }),
  }, managerCookie);
  assert.equal(createdResponse.status, 201);
  const createdEnvelope = await createdResponse.json() as { data: { id: string; username: string } };
  const target = createdEnvelope.data;
  createdUserIds.push(target.id);
  pass("create user through authenticated manager API");

  const updateResponse = await request(`/api/admin/users/${target.id}`, {
    method: "PATCH",
    body: JSON.stringify({ serviceCommissionRate: 65, productCommissionRate: 35 }),
  }, managerCookie);
  assert.equal(updateResponse.status, 200);
  const updatedEnvelope = await updateResponse.json() as {
    data: { serviceCommissionRate: number; productCommissionRate: number };
  };
  assert.equal(updatedEnvelope.data.serviceCommissionRate, 65);
  assert.equal(updatedEnvelope.data.productCommissionRate, 35);
  pass("update user commissions through manager API");

  const targetLogin = await login(target.username, password);
  assert.equal(targetLogin.response.status, 200);
  assert.ok(targetLogin.cookie);

  const resetResponse = await request(`/api/admin/users/${target.id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password: resetPassword }),
  }, managerCookie);
  assert.equal(resetResponse.status, 200);
  const revokedAfterReset = await request("/api/auth/me", {}, targetLogin.cookie ?? undefined);
  assert.equal(revokedAfterReset.status, 401);
  const oldPasswordLogin = await login(target.username, password);
  assert.equal(oldPasswordLogin.response.status, 401);
  const resetPasswordLogin = await login(target.username, resetPassword);
  assert.equal(resetPasswordLogin.response.status, 200);
  assert.ok(resetPasswordLogin.cookie);
  pass("reset password and revoke prior sessions");

  const deactivateResponse = await request(`/api/admin/users/${target.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  }, managerCookie);
  assert.equal(deactivateResponse.status, 200);
  const revokedAfterDeactivate = await request("/api/auth/me", {}, resetPasswordLogin.cookie ?? undefined);
  assert.equal(revokedAfterDeactivate.status, 401);
  const inactiveLogin = await login(target.username, resetPassword);
  assert.equal(inactiveLogin.response.status, 401);

  const reactivateResponse = await request(`/api/admin/users/${target.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: true }),
  }, managerCookie);
  assert.equal(reactivateResponse.status, 200);
  const reactivatedLogin = await login(target.username, resetPassword);
  assert.equal(reactivatedLogin.response.status, 200);
  assert.ok(reactivatedLogin.cookie);
  pass("deactivate, revoke and reactivate user");

  const deleteResponse = await request(`/api/admin/users/${target.id}`, {
    method: "DELETE",
  }, managerCookie);
  assert.equal(deleteResponse.status, 200);
  const revokedAfterDelete = await request("/api/auth/me", {}, reactivatedLogin.cookie ?? undefined);
  assert.equal(revokedAfterDelete.status, 401);
  const deletedLogin = await login(target.username, resetPassword);
  assert.equal(deletedLogin.response.status, 401);
  pass("logically delete user and revoke sessions");

  const categoryResponse = await request("/api/product-categories", {
    method: "POST",
    body: JSON.stringify({ name: `HTTP category ${suffix}` }),
  }, managerCookie);
  assert.equal(categoryResponse.status, 201);
  const categoryEnvelope = await categoryResponse.json() as { data: { id: string } };
  resources.categoryId = categoryEnvelope.data.id;

  const employeeCategoryMutation = await request("/api/product-categories", {
    method: "POST",
    body: JSON.stringify({ name: `Forbidden category ${suffix}` }),
  }, employeeLogin.cookie ?? undefined);
  assert.equal(employeeCategoryMutation.status, 403);
  pass("create category as manager and reject employee mutation");

  const productResponse = await request("/api/products", {
    method: "POST",
    body: JSON.stringify({
      name: `HTTP product ${suffix}`,
      categoryId: resources.categoryId,
      price: 12000,
      stock: 4,
    }),
  }, managerCookie);
  assert.equal(productResponse.status, 201);
  const productEnvelope = await productResponse.json() as { data: { id: string; stock: number } };
  resources.productId = productEnvelope.data.id;
  assert.equal(productEnvelope.data.stock, 4);

  const stockResponse = await request(`/api/products/${resources.productId}/stock-movements`, {
    method: "POST",
    body: JSON.stringify({ kind: "entry", quantity: 3 }),
  }, managerCookie);
  assert.equal(stockResponse.status, 201);
  const stockEnvelope = await stockResponse.json() as { data: { stock: number } };
  assert.equal(stockEnvelope.data.stock, 7);
  const excessiveExit = await request(`/api/products/${resources.productId}/stock-movements`, {
    method: "POST",
    body: JSON.stringify({ kind: "exit", quantity: 8 }),
  }, managerCookie);
  assert.equal(excessiveExit.status, 409);
  pass("create product, adjust stock and reject negative inventory");

  const referencedCategoryDelete = await request(`/api/product-categories/${resources.categoryId}`, {
    method: "DELETE",
  }, managerCookie);
  assert.equal(referencedCategoryDelete.status, 409);
  pass("protect product category referenced by a product");

  const serviceResponse = await request("/api/services", {
    method: "POST",
    body: JSON.stringify({ name: `HTTP service ${suffix}`, price: 18000 }),
  }, managerCookie);
  assert.equal(serviceResponse.status, 201);
  const serviceEnvelope = await serviceResponse.json() as { data: { id: string } };
  resources.serviceId = serviceEnvelope.data.id;
  const serviceDelete = await request(`/api/services/${resources.serviceId}`, {
    method: "DELETE",
  }, managerCookie);
  assert.equal(serviceDelete.status, 200);
  pass("create and logically delete service through manager API");

  const paymentResponse = await request("/api/payment-methods", {
    method: "POST",
    body: JSON.stringify({ name: `HTTP payment ${suffix}` }),
  }, managerCookie);
  assert.equal(paymentResponse.status, 201);
  const paymentEnvelope = await paymentResponse.json() as { data: { id: string } };
  resources.paymentMethodId = paymentEnvelope.data.id;
  const paymentDelete = await request(`/api/payment-methods/${resources.paymentMethodId}`, {
    method: "DELETE",
  }, managerCookie);
  assert.equal(paymentDelete.status, 200);
  resources.paymentMethodId = undefined;
  pass("create and permanently delete unused payment method");

  const customerResponse = await request("/api/customers", {
    method: "POST",
    body: JSON.stringify({
      firstName: "HTTP",
      lastName: `Customer${suffix}`,
      phone: `549${Date.now().toString().slice(-10)}`,
      email: `http.${suffix}@example.test`,
      fixedSchedule: { weekday: 3, time: "11:30", monthlyPrice: 25000 },
    }),
  }, employeeLogin.cookie ?? undefined);
  assert.equal(customerResponse.status, 201);
  const customerEnvelope = await customerResponse.json() as {
    data: { id: string; fixedSchedule: { responsibleProfessional: { id: string } } | null };
  };
  resources.customerId = customerEnvelope.data.id;
  assert.equal(customerEnvelope.data.fixedSchedule?.responsibleProfessional.id, employee.id);
  pass("create customer as employee with server-forced schedule ownership");

  const employeeDeleteCustomer = await request(`/api/customers/${resources.customerId}`, {
    method: "DELETE",
  }, employeeLogin.cookie ?? undefined);
  assert.equal(employeeDeleteCustomer.status, 403);
  const managerDeleteCustomer = await request(`/api/customers/${resources.customerId}`, {
    method: "DELETE",
  }, managerCookie);
  assert.equal(managerDeleteCustomer.status, 200);
  pass("restrict customer deletion to managers");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await login(employee.username, "definitely-wrong-password");
    assert.equal(failed.response.status, 401);
  }
  const lockedLogin = await login(employee.username, password);
  assert.equal(lockedLogin.response.status, 401);
  const lockState = await database.query<{ failed_login_attempts: number; locked: boolean }>(`
    select failed_login_attempts, locked_until > now() as locked from public.users where id = $1
  `, [employee.id]);
  assert.equal(lockState.rows[0].failed_login_attempts, 5);
  assert.equal(lockState.rows[0].locked, true);
  pass("lock account after five failed attempts");

  const logoutResponse = await request("/api/auth/logout", { method: "POST" }, managerCookie);
  assert.equal(logoutResponse.status, 200);
  const afterLogout = await request("/api/auth/me", {}, managerCookie);
  assert.equal(afterLogout.status, 401);
  pass("logout revokes the current session");

  await cleanup();
  createdUserIds.length = 0;
  pass("remove committed HTTP acceptance fixtures");
  console.log(JSON.stringify({ suite: "authenticated-http", results }, null, 2));
};

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({
      message: error instanceof Error ? error.message : "HTTP acceptance failed",
      serverErrors: serverErrors.slice(-2000),
      completed: results,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await database.end().catch(() => undefined);
      server?.kill("SIGTERM");
    }
  });
