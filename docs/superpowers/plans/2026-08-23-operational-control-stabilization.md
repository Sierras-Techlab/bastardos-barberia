# Operational Control Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Corregir la integración incompleta de los bloques 020 a 023 para que precios, privacidad por rol, mensualidades, Caja y última visita funcionen sobre un único contrato coherente desde PostgreSQL hasta la UI.

**Architecture:** Los SQL canónicos 021 y 022 se corrigen en el lugar porque el producto continúa en desarrollo y no se permiten tablas, RPC ni migraciones con sufijo v2. La aplicación utilizará contratos discriminados manager/employee de extremo a extremo; nunca enviará precios, pagos, facturación ni neto de barbería al navegador de un empleado. Cada bloque debe quedar independientemente revisable y con pruebas que crucen Route Handler, cliente y UI, no sólo expresiones regulares sobre SQL.

**Tech Stack:** PostgreSQL/Supabase SQL manual, Next.js 16 App Router y Route Handlers, React 19, TypeScript estricto, Zod, Vitest, Testing Library y Sonner.

**Spec:** docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md

## Estado de partida confirmado el 2026-08-23

- Rama auditada: feat/changes-fullstack, commit 7b40ff1c698fefb25833f3c68a9d89a1863a599f.
- La suite actual pasa: 179 archivos / 770 tests, ESLint, next typegen, TypeScript y build Webpack.
- Esos resultados no prueban integración; existen incompatibilidades comprobadas entre UI, API y SQL.
- El bloque 019 responde correctamente en la base configurada y no necesita reimplementación general.
- El objetivo principal de 023, lastVisitBusinessDate en list_customers, responde y sólo necesita limpieza.
- La base configurada contiene funciones que no coinciden con los SQL versionados. La base no es fuente de verdad: primero se corrige la rama y luego un humano autorizado vuelve a ejecutar migraciones.

## Restricciones globales

- Leer completos AGENTS.md, context_snapshot.md, product.md, la especificación y los planes 020–023 antes de editar.
- Leer node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md y 05-server-and-client-components.md antes de modificar páginas o handlers.
- Ejecutar git status --short antes de cada tarea. Preservar trabajo ajeno y detenerse ante un solapamiento no atribuible.
- No ejecutar SQL remoto ni mutar datos de la base compartida sin autorización explícita.
- Corregir 020, 021, 022 y 023 en sus archivos canónicos. No crear 024, archivos fix, objetos v2 ni overloads paralelos.
- Montos monetarios: enteros ARS. $10.000 se representa como 10000, nunca como 1000000 ni como centavos.
- Manager: pagos por montos enteros positivos cuya suma coincide exactamente con el total cobrado.
- Employee: pagos por basisPoints enteros 0..10000 cuya suma es 10000; PostgreSQL calcula montos y asigna el resto al último medio.
- Un manager puede cobrar una línea a precio menor, mayor o 0; toda modificación exige motivo y auditoría. La comisión usa el importe cobrado.
- Owner y admin pueden tener tasas configurables 0..100. Nunca volver a imponer comisión cero por rol.
- Empleado: sólo conceptos, cantidades y ganancia propia; nunca precio de catálogo/cobrado, pagos, total, neto de barbería ni registrante.
- No actualizar context_snapshot.md durante tareas intermedias si otra IA trabaja. Releerlo y fusionar semánticamente sólo al cierre.
- Cada tarea termina con pruebas focalizadas, npx tsc --noEmit, git diff --check, revisión del diff y un commit independiente.

---

### Task 1: Agregar red de seguridad para la cadena de migraciones

**Files:**
- Create: src/lib/supabase/operational-control-migrations.test.ts
- Modify: src/lib/fixed-customer-payments/migration-021.test.ts
- Modify: src/lib/cash/migration-022.test.ts

**Interfaces:**
- Consumes: esquemas creados por 010, 011, 018, 019 y 020.
- Produces: regresiones que impiden reintroducir nombres inexistentes en 021/022.

- [ ] **Step 1: Escribir pruebas RED de compatibilidad cruzada**

La prueba debe leer las migraciones y comprobar:

~~~ts
expect(sql021).not.toMatch(/\brole_name\b/i);
expect(sql021).not.toMatch(/public\.work_sessions\b/i);
expect(sql021).not.toMatch(/customer_fixed_schedules[^;]*\buser_id\b/is);
expect(sql021).not.toMatch(/\bs\.period\b/i);
expect(sql021).not.toMatch(/\batt\.employee_earning\b/i);
expect(sql021).not.toMatch(/request_id,\s*user_id\b/i);

expect(sql022).not.toMatch(/\brole_name\b/i);
expect(sql022).not.toMatch(/\bcash_register_id\b/i);
expect(sql022).not.toMatch(/daily_cash_sales[^;]*\bpayment_method_id\b/is);
expect(sql022).not.toMatch(/set\s+counted_cash\s*=\s*counted_cash\b/i);
~~~

Exigir además role_id in (1, 2), employee_work_sessions, daily_cash_id, created_at_snapshot y las columnas registered_by, employee_id, commission_total y barbershop_net.

- [ ] **Step 2: Ejecutar RED**

~~~bash
npm test -- --run src/lib/supabase/operational-control-migrations.test.ts src/lib/fixed-customer-payments/migration-021.test.ts src/lib/cash/migration-022.test.ts
~~~

Expected: FAIL por los identificadores legacy presentes en 021 y 022.

- [ ] **Step 3: Confirmar que cada RED representa una incompatibilidad real**

Comparar contra 011 y 018. No prohibir user_id globalmente porque sessions.user_id sí es legítimo.

- [ ] **Step 4: Mantener estas pruebas en los commits de Tasks 3 y 5**

No dejar la rama permanentemente roja.

---

### Task 2: Completar el bloque 020 por rol

**Files:**
- Modify: src/types/income.ts
- Modify: src/lib/incomes/income-schema.ts
- Modify: src/lib/incomes/contracts.ts
- Modify: src/lib/incomes/client.ts
- Modify: src/app/(dashboard)/incomes/new/page.tsx
- Modify: src/app/(dashboard)/incomes/new/page.test.tsx
- Modify: src/components/incomes/income-form.tsx
- Modify: src/components/incomes/income-form.test.tsx
- Modify: src/components/incomes/payment-method-selector.tsx
- Modify: src/components/incomes/payment-method-selector.test.tsx
- Modify: src/components/incomes/commission-preview.tsx
- Modify: src/components/incomes/commission-preview.test.tsx
- Modify: src/components/incomes/line-price-editor.tsx
- Modify: src/components/incomes/incomes-view.tsx
- Modify: src/components/incomes/incomes-view.test.tsx
- Modify: src/components/incomes/income-table.tsx
- Modify: src/components/incomes/income-mobile-list.tsx
- Modify: src/components/incomes/income-detail-sheet.tsx
- Modify: src/components/incomes/income-metrics.tsx
- Modify: src/app/(dashboard)/incomes/page.tsx
- Modify: src/app/(dashboard)/incomes/page.test.tsx
- Modify: src/app/(dashboard)/(home)/page.tsx
- Modify: src/app/(dashboard)/(home)/page.test.tsx
- Modify: src/components/dashboard/income-summary-card.tsx
- Modify: src/components/dashboard/income-summary-card.test.tsx

**Interfaces:**
- Produces: ManagerIncomeFormData | EmployeeIncomeFormData discriminado por viewer.
- Consumes: esquemas Zod manager/employee existentes para create, list y detail.

- [ ] **Step 1: Definir contratos discriminados y escribir RED**

~~~ts
type ManagerIncomeFormData = {
  viewer: "manager";
  currentUser: CurrentUser;
  services: Array<{ id: string; name: string; price: number }>;
  products: Array<{ id: string; name: string; price: number; stock: number }>;
  employees: IncomeFormEmployee[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
};

type EmployeeIncomeFormData = {
  viewer: "employee";
  currentUser: CurrentUser;
  services: Array<{ id: string; name: string; earning: number }>;
  products: Array<{ id: string; name: string; earningUnit: number; stock: number }>;
  customers: Customer[];
  paymentMethods: PaymentMethod[];
};
~~~

El Server Component calcula earning/earningUnit antes de serializar props. El navegador employee no recibe el precio autoritativo.

Pruebas obligatorias:

~~~ts
expect(employeeProps.services[0]).not.toHaveProperty("price");
expect(employeeProps.products[0]).not.toHaveProperty("price");
expect(employeePayload.payments).toEqual([
  { paymentMethodId: cashId, basisPoints: 5000 },
  { paymentMethodId: transferId, basisPoints: 5000 },
]);
expect(screen.queryByText(/neto barbería/i)).not.toBeInTheDocument();
expect(screen.queryByText(/precio de catálogo|total de la venta/i)).not.toBeInTheDocument();
~~~

- [ ] **Step 2: Ejecutar RED focalizado**

~~~bash
npm test -- --run "src/app/(dashboard)/incomes/new/page.test.tsx" src/components/incomes/income-form.test.tsx src/components/incomes/commission-preview.test.tsx src/components/incomes/payment-method-selector.test.tsx
~~~

Expected: FAIL porque el formulario actual siempre usa precios y amount.

- [ ] **Step 3: Implementar la rama manager**

- Usar catálogo con precios sólo para viewer manager.
- Conectar LinePriceEditor al servicio y a cada producto.
- Persistir servicePriceOverride y productPriceOverrides.
- Cambiar priceOverrideSchema y priceOverrideFormSchema de positive a nonnegative.
- Si el total queda cero, limpiar pagos y permitir confirmar sin filas.
- Cambiar/quitar línea limpia su override; cambiar responsable limpia sólo excepciones 100%.
- Mantener pagos combinados por montos exactos.

- [ ] **Step 4: Implementar la rama employee**

- Forzar employeeId al autenticado y no renderizar selector.
- Mostrar sólo ganancia estimada por concepto y total propio.
- Presentar porcentajes 0..100 y convertir a basisPoints 0..10000.
- Exigir suma 10000, métodos distintos y al menos una asignación positiva.
- No renderizar editor de precio, precios, total bruto, pagos ARS, neto de barbería ni excepciones 100%.

- [ ] **Step 5: Cubrir precio cero y payloads exactos**

Manager: descuento, recargo, línea gratis, total cero sin pagos, motivo requerido. Employee: 100%, 50/50 y ausencia de claves financieras.

- [ ] **Step 6: Escribir RED de historial y dashboard employee**

~~~ts
const employeePage = {
  items: [{
    id: incomeId,
    createdAt: "2026-08-23T13:00:00.000-03:00",
    businessDate: "2026-08-23",
    status: "active",
    concepts: [{ type: "service", name: "Corte", quantity: 1, earning: 10000 }],
    employeeCommission: 10000,
  }],
  metrics: { count: 1, employeeCommissionTotal: 10000 },
  pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
};
~~~

Exigir que Ingresos e Inicio muestren $10.000 sin acceder a employee, payments, total o barbershopNet y sin as never.

- [ ] **Step 7: Implementar vistas separadas por rol**

- IncomesView acepta unión discriminada.
- Manager conserva filtros completos, métricas, anulación y detalle financiero.
- Employee muestra concepto, fecha, estado y ganancia propia.
- Eliminar data as never.
- Dashboard employee usa employeeCommission; no filtra esos registros.
- IncomeSummaryCard employee no renderiza promedio bruto ni medios de pago.

- [ ] **Step 8: Validar respuestas browser con Zod**

El cliente debe leer el sobre data y elegir esquema por viewer explícito. No castear respuestas employee a PaginatedIncomes.

- [ ] **Step 9: GREEN, checks y commit**

~~~bash
npm test -- --run "src/app/(dashboard)/incomes/new/page.test.tsx" "src/app/(dashboard)/incomes/page.test.tsx" "src/app/(dashboard)/(home)/page.test.tsx" src/components/incomes src/components/dashboard/income-summary-card.test.tsx src/lib/incomes
npx tsc --noEmit
git diff --check
git add src/types/income.ts src/lib/incomes src/app src/components/incomes src/components/dashboard
git commit -m "fix(incomes): complete role-safe pricing flows"
~~~

---

### Task 3: Reescribir 021 sobre el esquema canónico

**Files:**
- Modify: supabase/queries/021_fixed_customer_monthly_payments.sql
- Modify: src/lib/fixed-customer-payments/migration-021.test.ts
- Modify: src/lib/supabase/operational-control-migrations.test.ts
- Modify: src/lib/supabase/database.types.ts
- Modify: supabase/queries/README.md

**Interfaces:**
- Produces list_fixed_customer_months(uuid, boolean, text, uuid).
- Produces get_fixed_customer_month(uuid, boolean, uuid, text).
- Produces pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb).
- Preserva void_income(uuid, uuid), trigger de jornadas y ajustes de Caja 018.

- [ ] **Step 1: Corregir horarios**

- Eliminar customer_fixed_schedules.user_id y s.period.
- period proviene de filter_period/target_period.
- Exigir responsable/precio sólo para horarios activos mediante check:

~~~sql
check (
  not is_active
  or (responsible_user_id is not null and monthly_price is not null and monthly_price > 0)
)
~~~

- No imponer NOT NULL global a filas históricas inactivas sin mapear.
- Profesional activo/no eliminado; manager reasigna y employee sólo usa su propia cuenta.

- [ ] **Step 2: Corregir autorización y jornadas**

- Reemplazar role_name por role_id 1/2/3 o join a roles.
- Reemplazar public.work_sessions por public.employee_work_sessions.
- No confiar en can_view_all: sólo role_id 1/2 puede filtrar a otro profesional.

- [ ] **Step 3: Corregir proyecciones**

- Join de attempt por customer y filter_period.
- employeeEarning proviene de incomes.commission_total.
- Manager recibe monthlyPrice; employee no recibe esa clave.
- Employee sólo ve schedules con responsible_user_id igual al actor.
- Pending se deriva cuando no existe attempt paid activo.

- [ ] **Step 4: Crear suscripción con columnas canónicas**

El insert debe incluir request_id, registered_by, employee_id, responsible_role_snapshot, request_fingerprint, customer_id, total, gross_total, bases/tasas/importes de comisión, commission_total, barbershop_net, created_at, business_date, source_type, fixed_customer_id, fixed_period y subscription_concept.

- registered_by es el actor; employee_id es el profesional.
- Comisión = monthly_price por service_commission_rate del profesional para cualquier rol, incluido owner.
- Nunca usar if actor_role = owner then commission_amount := 0.
- commission_total + barbershop_net = total.
- Permitir que el trigger 019 asocie jornada o outside-session.
- Retry idéntico devuelve el original; otro request activo devuelve FIXED_MONTH_ALREADY_PAID.

- [ ] **Step 5: Corregir pagos**

- Manager: montos distintos, positivos, suma exacta.
- Employee: basisPoints suma 10000; calcular todos salvo el último por división entera y asignar el resto al último.
- No insertar amount 0.
- Guardar payment_method_id, method_name_snapshot, amount y basis_points.

- [ ] **Step 6: Preservar void y Caja**

Partir del void_income canónico más reciente. Agregar estado voided del intento sin perder autorización, auditoría, ajuste post-cierre 018 ni posibilidad de repago con request nuevo.

- [ ] **Step 7: Agregar aceptación rollback-wrapped**

Probar owner con tasa no cero, employee con jornada, manager efectivo+transferencia, employee 3333/6667, privacidad employee, retry/conflicto, void/repago, visitas sin cambios y Caja/dashboard con la suscripción.

- [ ] **Step 8: GREEN y commit**

~~~bash
npm test -- --run src/lib/supabase/operational-control-migrations.test.ts src/lib/fixed-customer-payments/migration-021.test.ts src/lib/fixed-customer-payments/repository.test.ts src/lib/fixed-customer-payments/service.test.ts
npx tsc --noEmit
git diff --check
git add supabase/queries/021_fixed_customer_monthly_payments.sql supabase/queries/README.md src/lib/fixed-customer-payments src/lib/supabase
git commit -m "fix(subscriptions): align monthly payments with canonical schema"
~~~

---

### Task 4: Corregir cliente y UI de mensualidades

**Files:**
- Modify: src/lib/fixed-customer-payments/client.ts
- Modify: src/lib/fixed-customer-payments/client.test.ts
- Modify: src/app/api/fixed-customer-months/route.test.ts
- Modify: src/components/customers/customer-editor-dialog.tsx
- Modify: src/components/customers/customer-editor-dialog.test.tsx
- Modify: src/components/fixed-customers/fixed-customer-payment-dialog.tsx
- Modify: src/components/fixed-customers/fixed-customer-payment-dialog.test.tsx
- Modify: src/components/customers/customers-workspace.tsx
- Create: src/components/customers/customers-workspace.test.tsx

**Interfaces:**
- API success: { data: { items } } o { data: { month } }.
- Manager payments: Array<{paymentMethodId, amount}>.
- Employee payments: Array<{paymentMethodId, basisPoints}>.

- [ ] **Step 1: Escribir prueba Route Handler → cliente**

Mockear respuestas reales:

~~~ts
Response.json({ data: { items: [month] } });
Response.json({ data: { month } }, { status: 201 });
~~~

Exigir que list/get/pay retornen el dato interno y que errores lean body.error.message.

- [ ] **Step 2: Corregir envelope y Zod**

Leer data, validar con esquemas estrictos y crear FixedCustomerPaymentApiError con status/code/message/fields.

- [ ] **Step 3: Corregir ARS mensual**

Eliminar /100 y *100. Guardado 15000 muestra 15000; escribir 20000 envía monthlyPrice 20000. Input step 1.

- [ ] **Step 4: Permitir pagos combinados manager**

Reemplazar selectedMethod por asignaciones. Probar:

~~~ts
expect(payload.payments).toEqual([
  { paymentMethodId: cashId, amount: 10000 },
  { paymentMethodId: transferId, amount: 10000 },
]);
~~~

- [ ] **Step 5: Verificar privacidad employee**

El diálogo employee no recibe ni renderiza monthlyPrice; sólo estado, cliente, profesional y ganancia propia.

- [ ] **Step 6: GREEN y commit**

~~~bash
npm test -- --run src/lib/fixed-customer-payments/client.test.ts src/app/api/fixed-customer-months src/components/customers/customer-editor-dialog.test.tsx src/components/fixed-customers/fixed-customer-payment-dialog.test.tsx src/components/customers/customers-workspace.test.tsx
npx tsc --noEmit
git diff --check
git add src/lib/fixed-customer-payments src/app/api/fixed-customer-months src/components/customers src/components/fixed-customers
git commit -m "fix(subscriptions): reconcile monthly payment interface"
~~~

---

### Task 5: Reescribir 022 sobre Caja 018

**Files:**
- Modify: supabase/queries/022_manual_cash_lifecycle.sql
- Modify: src/lib/cash/migration-022.test.ts
- Modify: src/lib/supabase/operational-control-migrations.test.ts
- Modify: src/lib/supabase/database.types.ts
- Modify: supabase/queries/README.md

**Interfaces:**
- Consumes daily_cash_registers, daily_cash_sales.daily_cash_id, daily_cash_payment_totals.daily_cash_id y daily_cash_adjustments.original_daily_cash_id de 018.
- Produces RPC canónicas open/close/confirm/ensure/cash_day/get/list/close_pending.

- [ ] **Step 1: Corregir estados persistidos**

- Permitir closed_at null mientras está abierta.
- Abierta persistida: id no null, state live, close_mode null, counted null, reconciliation not_applicable.
- No abierta: proyección id null, sin fila.
- Backfill 018 conserva finanzas; apertura 0/first_income, cierre automatic, pending_confirmation.
- No inventar opened_by histórico ni hacer NOT NULL columnas que legítimamente admiten null.

- [ ] **Step 2: Corregir autorización**

Usar role_id in (1, 2). ensure_daily_cash_open sólo service_role dentro de transacciones autorizadas.

- [ ] **Step 3: Corregir apertura**

Manual sólo fecha Buenos Aires actual y saldo entero no negativo. Primera venta normal, mensualidad o ajuste abre en 0 en su misma transacción; si falla, la apertura hace rollback.

- [ ] **Step 4: Calcular efectivo esperado**

~~~text
expectedCash = openingBalance + netAmount del método system_code = cash
~~~

Transferencia, QR y otros medios no afectan efectivo físico.

- [ ] **Step 5: Corregir cierre**

- Manual siempre cierra y queda confirmed, incluso con sobrante/faltante.
- Automático congela finanzas, close_mode automatic y pending_confirmation sin count.
- Confirmación histórica agrega actor/fecha/count/difference una vez, sin recalcular.
- Renombrar parámetros para evitar set counted_cash = counted_cash.

- [ ] **Step 6: Rehacer cash_day_as_json con columnas 018**

- Usar daily_cash_id, created_at_snapshot, customer_name_snapshot y status_at_close.
- Usar daily_cash_payment_totals directamente; daily_cash_sales no tiene payment_method_id.
- Evitar joins cartesianos y conservar snapshots.

- [ ] **Step 7: Preservar Efectivo protegido**

RPC de medios autorizan por role_id y bloquean rename/deactivate/delete del system_code cash sin cambiar firmas.

- [ ] **Step 8: Aceptación rollback-wrapped**

Probar apertura 0/10000, auto-open, rollback de venta fallida, suscripción, cash+transfer, cierre manual exacto/sobrante/faltante, auto pendiente, confirmación al día siguiente, confirmación repetida, void mismo día y posterior.

- [ ] **Step 9: GREEN y commit**

~~~bash
npm test -- --run src/lib/supabase/operational-control-migrations.test.ts src/lib/cash/migration-022.test.ts src/lib/cash/repository.test.ts src/lib/cash/service.test.ts
npx tsc --noEmit
git diff --check
git add supabase/queries/022_manual_cash_lifecycle.sql supabase/queries/README.md src/lib/cash src/lib/supabase
git commit -m "fix(cash): align manual lifecycle with daily snapshots"
~~~

---

### Task 6: Corregir contrato y UI de Caja

**Files:**
- Modify: src/lib/cash/schemas.ts
- Modify: src/lib/cash/schemas.test.ts
- Modify: src/components/cash/cash-view.tsx
- Modify: src/components/cash/cash-view.test.tsx
- Modify: src/components/cash/cash-open-dialog.tsx
- Create: src/components/cash/cash-open-dialog.test.tsx
- Modify: src/components/cash/cash-close-dialog.tsx
- Create: src/components/cash/cash-close-dialog.test.tsx
- Modify: src/components/cash/cash-confirm-dialog.tsx
- Create: src/components/cash/cash-confirm-dialog.test.tsx

- [ ] **Step 1: Escribir RED de estados**

~~~ts
expect(cashDaySchema.safeParse(notOpenedProjection).success).toBe(true);
expect(cashDaySchema.safeParse(openPersistedRegister).success).toBe(true);
expect(cashDaySchema.safeParse(manualConfirmedClose).success).toBe(true);
expect(cashDaySchema.safeParse(automaticPendingClose).success).toBe(true);
~~~

Rechazar count en caja abierta, confirmed sin count/difference y manual pending.

- [ ] **Step 2: Corregir ARS**

Eliminar /100, *100 y step 0.01 de los tres diálogos. Inputs enteros step 1.

- [ ] **Step 3: Corregir acciones**

~~~ts
canClose = isManager && isToday && day.state === "live" && day.id !== null;
canConfirm = isManager
  && day.state === "closed"
  && lifecycle.reconciliationState === "pending_confirmation";
~~~

Confirmación funciona para días históricos; apertura/cierre sólo hoy.

- [ ] **Step 4: Corregir copy**

Manual: Cerrar y confirmar incluso con diferencia. Automático: Confirmar conteo. Saldo inicial separado de ventas.

- [ ] **Step 5: GREEN y commit**

~~~bash
npm test -- --run src/lib/cash src/components/cash
npx tsc --noEmit
git diff --check
git add src/lib/cash src/components/cash
git commit -m "fix(cash): reconcile open close and count UI"
~~~

---

### Task 7: Limpiar 023 y documentación

**Files:**
- Modify: supabase/queries/023_customer_last_visit.sql
- Modify: src/lib/customers/migration-023.test.ts
- Verify: src/lib/customers/repository.ts
- Modify: docs/superpowers/plans/2026-08-21-020-income-pricing-owner-commissions-and-employee-privacy.md
- Modify: docs/superpowers/plans/2026-08-21-021-fixed-customer-monthly-payments.md
- Modify: docs/superpowers/plans/2026-08-21-022-manual-cash-lifecycle.md
- Modify: docs/superpowers/plans/2026-08-21-023-customer-last-visit.md
- Modify: docs/superpowers/plans/2026-08-22-operational-control-roadmap-status.md
- Modify: product.md
- Modify: context_snapshot.md
- Modify only if invariants changed: AGENTS.md

- [ ] **Step 1: Eliminar RPC paralelo**

023 no necesita get_customer_visits. El repositorio usa list_customer_visits de 013. Eliminar la sección extra y exigir sólo list_customers, índice parcial y ausencia de v2.

- [ ] **Step 2: Verificar última visita**

Probar venta activa antigua, venta void más reciente y suscripción todavía más reciente. Sólo gana la venta normal activa; al anular una nueva venta reaparece la anterior.

- [ ] **Step 3: Releer documentación antes de editar**

Ejecutar git status, releer archivos actuales y fusionar sólo hechos verificados. No sobrescribir otra IA.

- [ ] **Step 4: Corregir contradicciones**

- Owner commission configurable; quitar owner siempre cero.
- Marcar 020–023 implementados sólo tras checks verdes.
- Registrar reconciliación SQL 021/022.
- No afirmar instalación remota no ejecutada.
- Employee sale requiere su propia jornada, no la del manager.

- [ ] **Step 5: GREEN y commit**

~~~bash
npm test -- --run src/lib/customers/migration-023.test.ts src/lib/customers/repository.test.ts src/lib/customers/last-visit.test.ts src/components/customers/customers-view.test.tsx
npx tsc --noEmit
git diff --check
git add supabase/queries/023_customer_last_visit.sql src/lib/customers docs/superpowers/plans product.md context_snapshot.md AGENTS.md
git commit -m "docs(operations): reconcile stabilized rollout"
~~~

---

### Task 8: Verificación integrada final

- [ ] **Step 1: Suite completa una sola vez sobre HEAD final**

~~~bash
npm test -- --maxWorkers=2
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
git status --short
~~~

Expected: exit 0 y árbol tracked limpio.

- [ ] **Step 2: Auditar privacidad**

~~~bash
rg -n "as never|Neto barbería|catalogUnitPrice|chargedUnitPrice|paymentTotals" src/app src/components/incomes src/components/dashboard
~~~

Toda coincidencia debe pertenecer a manager o a un test de ausencia employee.

- [ ] **Step 3: Auditar SQL legacy**

~~~bash
rg -n "role_name|public\.work_sessions|cash_register_id|s\.period|att\.employee_earning|request_id, user_id" supabase/queries/021_fixed_customer_monthly_payments.sql supabase/queries/022_manual_cash_lifecycle.sql
~~~

Expected: ninguna coincidencia.

- [ ] **Step 4: Handoff humano para Supabase, sin ejecutar remoto**

1. Backup o proyecto test.
2. Ejecutar desde el último script confirmado en orden 019 → 020 → 021 → 022 → 023.
3. Correr aceptaciones dentro de transacciones con rollback.
4. Probar owner, admin y employee.
5. Verificar jornada, descuento cero, mensualidad combinada, owner con comisión no cero, caja 10000, auto-open, cierre con diferencia, confirmación histórica y última visita.
6. Promover sólo después.

- [ ] **Step 5: Revisión final desde 7b40ff1**

Rechazar entrega si ocurre cualquiera:

- employee recibe precio/total/neto/pagos;
- owner se normaliza a cero;
- mensualidad no crea ingreso/pagos/commission snapshot;
- saldo inicial aparece como venta;
- caja abierta persistida no valida;
- cierre manual con diferencia queda abierto;
- SQL depende de correcciones manuales no versionadas;
- documentación afirma despliegue remoto no realizado.

## Definition of Done

- 019: sin regresiones; employee inicia/finaliza jornada y ventas propias requieren jornada.
- 020: manager descuenta/recarga/regala; employee carga porcentajes y sólo ve su ganancia.
- 021: mensualidad usa profesional único, tasa configurada incluido owner, pagos combinados e ingreso real; void reabre mes.
- 022: apertura manual/automática, saldo físico, efectivo esperado, cierre manual confirmado y automático pendiente funcionan sobre 018.
- 023: última visita deriva sólo de ventas normales activas mediante RPC canónico.
- No hay objetos v2 nuevos y 021/022 pueden instalarse desde una cadena limpia.
- Pruebas focalizadas/completas, TypeScript, lint y build verdes; árbol limpio y documentación sin contradicciones.
