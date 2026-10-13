# TASK-02 — Acuerdo comercial y alquiler mensual de silla

## Goal

Permitir que el owner configure de forma independiente las comisiones de servicios, las comisiones de productos y el alquiler mensual de silla de cada employee, y que confirme o anule pagos de alquiler como ingresos reales, auditables e integrados con reportes, resúmenes y Caja.

## Context

- La rama de implementación debe partir de `origin/dev` actualizado y llamarse `codex/employee-chair-rental`; no hacer push, deploy ni ejecutar SQL remoto sin autorización.
- La siguiente migración es `supabase/queries/045_employee_commercial_agreements_and_chair_rentals.sql`; `001`–`044` son historia append-only y no deben modificarse.
- Las ventas usan snapshots atómicos en `incomes`; `fixed_subscription` es el antecedente para cobros mensuales, idempotencia y reapertura tras anulación.
- Caja conserva cierres históricos y representa anulaciones posteriores mediante ajustes. Reportes calcula resultado operativo como `barbershop_net - expenses`.
- Antes de implementar, leer los diseños aprobados relevantes y las guías de Next.js 16 en `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `15-route-handlers.md` y `node_modules/next/dist/docs/01-app/02-guides/forms.md`.

## Requirements

- Incorporar al acuerdo de cada employee:
  - `serviceCommissionEnabled: boolean`.
  - `productCommissionEnabled: boolean`.
  - `chairRentalEnabled: boolean`.
  - `monthlyChairRentalAmount`: ARS entero positivo.
  - `chairRentalEffectiveFrom`: período canónico `YYYY-MM`.
  - `chairRentalDueDay`: entero `1..28`.
- Las tres modalidades son independientes y pueden coexistir. Cuando una comisión está deshabilitada, las nuevas líneas de ese tipo generan comisión cero; nunca se recalculan snapshots históricos ni se descuenta alquiler de comisiones.
- Aplicar el acuerdo sólo a usuarios con rol `employee`. El owner es el único que puede cambiarlo; admin puede verlo y conservar las demás facultades no financieras de administración de usuarios.
- Si `chairRentalEnabled` es true, importe, período inicial y día de vencimiento son obligatorios; si es false, la configuración activa de alquiler queda en `null` sin borrar auditoría ni pagos previos.
- En `/users`, mostrar a cada employee con alquiler vigente: importe, período actual de Buenos Aires, vencimiento, estado `Pendiente`, `Pagado`, `Vencido` o `Anulado`, y el control `Pagó [mes]`.
- El control abre una confirmación con employee, período, importe snapshot de sólo lectura, un medio de pago activo obligatorio y fecha efectiva. `paidAt` y `business_date` son autoritativos del servidor/reloj PostgreSQL; la UI muestra la fecha Buenos Aires y no puede enviarla como autoridad.
- Confirmar crea una sola asignación de pago por el importe completo, muestra fecha, importe, medio y owner confirmante, y es atómico e idempotente por `requestId`.
- No permitir dos pagos activos del mismo employee/período. Tras una anulación puede existir un nuevo intento activo, sin sobrescribir el intento anulado.
- La anulación requiere motivo, sólo la ejecuta owner, conserva el registro original y snapshots, marca el ingreso/intento como anulado y revierte su efecto financiero. No exponer borrado ni “desmarcado”.
- Agregar al detalle del employee la sección `Alquiler de silla` con todos los intentos: período, importe, estado, pago, medio, confirmante y, cuando corresponda, fecha, actor y motivo de anulación.
- Crear `source_type = 'chair_rental'`. El ingreso guarda employee ocupante, owner registrante, período facturado, importe y medio históricos, `paidAt`, `requestId`, estado, comisión cero y neto de barbería igual al importe.
- Usar criterio de caja: el mes financiero proviene de `paidAt/business_date`; el período facturado se conserva aparte. Un alquiler de septiembre confirmado el 2 de octubre suma a octubre.
- Incluir alquileres activos en ingreso bruto, neto de barbería, medios de pago, resumen diario/mensual y Caja. Efectivo aumenta `expectedCash`; otros medios aparecen sólo en su desglose.
- Excluir alquileres de ventas de servicio/producto, ticket promedio, visitas, productividad, comisiones, rankings y sesiones laborales. Confirmar alquiler nunca requiere jornada abierta.
- Reportes y resumen mensual deben distinguir ingresos de ventas, clientes fijos y alquileres, y mantener `operatingResult = barbershopNet - expenses`. No crear gastos automáticos.
- Agregar al reporte mensual de alquileres: total cobrado y cantidad por fecha efectiva dentro del mes, empleados que pagaron, y obligaciones pendientes/vencidas del período facturado seleccionado. Intentos anulados quedan en auditoría, no suman y una obligación sin reemplazo activo sigue pendiente/vencida financieramente.

## Architecture

- Implementar el dominio en `src/lib/chair-rentals/` con tipos/Zod estrictos, repositorio server-only, servicio, cliente no-store y errores públicos estables. Usar envelopes `{ data }`/`{ error }` y autorizar antes de parsear mutaciones.
- Mantener separadas las mutaciones de identidad general y del acuerdo comercial. Exponer una mutación owner-only para el acuerdo y lecturas manager-only; un admin no debe poder cambiar tasas, flags ni alquiler mediante el `PATCH` genérico de usuarios ni payloads adicionales.
- Hacer autoritativa la autorización también en PostgreSQL: los RPC reciben `actor_user_id`, bloquean y revalidan owner activo y employee objetivo. Las transiciones de rol no pueden activar o preservar operativamente un acuerdo sin una decisión posterior del owner.
- Auditar cada cambio del acuerdo en una tabla append-only con actor, fecha y snapshots anterior/nuevo. Preservar las tasas existentes en `users`; agregar campos o una relación uno-a-uno sin duplicar dos fuentes activas de verdad.
- Migrar employees existentes con cada flag de comisión en true sólo si su tasa actual es mayor a cero; alquiler deshabilitado y campos `null`. No reinterpretar ingresos históricos. Mantener el comportamiento de comisión vigente de owner/admin fuera del acuerdo de employees.
- La comisión efectiva de nuevas ventas debe resolverse dentro del RPC canónico `create_income`: para un employee, un flag deshabilitado fuerza tasa/importe snapshot cero. Una excepción del 100% no puede eludir un flag deshabilitado. Aplicar `serviceCommissionEnabled` también a futuros cobros `fixed_subscription`, que hoy usan la tasa de servicio.
- Actualizar previews y datos del formulario para reflejar exactamente las tasas efectivas, sin convertir la UI en fuente de autoridad.
- Crear una entidad append-only de intentos/pagos mensuales con amount/method/name snapshots, vínculo al `income`, estado y metadatos de anulación. Usar índice parcial único por `(employee_id, period)` activo y una restricción/idempotency fingerprint por request.
- Crear RPCs canónicos `confirm_chair_rental_payment` y `void_chair_rental_payment`. Confirmación bloquea acuerdo, período y medio en orden determinista, obtiene importe del acuerdo, crea `income`, `income_payments` e intento en una transacción. Anulación bloquea intento/ingreso, exige motivo y produce una única transición.
- Extender el contrato de `incomes` con referencias válidas por source: `sale`, `fixed_subscription` y `chair_rental`. Un alquiler no tiene customer ni items, usa `work_session_id = null` y `outside_work_session = false`; ajustar `attach_income_work_session` para omitirlo explícitamente.
- Impedir que `void_income` permita a admin anular `chair_rental`; la anulación debe pasar por el RPC owner-only con motivo. Conservar el trigger/flujo común de Caja para la transición activa→anulada.
- Extender `income_as_json`, `get_income_detail` y `list_incomes`: managers pueden auditar alquileres con concepto propio; employees nunca los reciben como producción propia. En métricas manager, bruto/neto/pagos incluyen alquiler, pero count/average de ventas lo excluyen.
- Extender Caja con kind/desglose `chair_rental` y totales/ajustes que reconcilien `service + product + chair rental = gross`. Los conteos rotulados como ventas excluyen alquileres; el audit diario puede mostrar el movimiento. Una anulación posterior al cierre agrega una única reversión negativa, sin mutar el cierre original.
- Extender `get_business_report` y `get_expense_month_summary` usando ingresos activos y `business_date`. Excluir `chair_rental` de `teamPerformance`, tickets, rankings y productividad; agregar composición y resumen de alquileres sin reconstruir snapshots.
- En `/users`, owner y admin comparten lectura; sólo owner recibe controles habilitados. Reusar patrones responsive del módulo y del diálogo de mensualidades, pero el alquiler usa un único medio por el importe completo.
- Definir estados derivados en Buenos Aires: antes/equivalente al vencimiento sin pago activo = `Pendiente`; después = `Vencido`; intento activo = `Pagado`; sin activo y con último intento anulado = `Anulado` en historial/vista, aunque siga contando como obligación impaga en reportes.

## Affected Areas

- Migración y documentación SQL: `supabase/queries/045_*.sql`, `supabase/queries/README.md`.
- Usuarios/auth: `src/lib/auth/{types,schemas,authorization,repository-contracts}.ts`, `src/lib/users/*`, `src/app/api/admin/users/**`, `src/components/users/*`, `src/app/(dashboard)/users/*`, sesiones y tipos Supabase.
- Nuevo dominio/API: `src/lib/chair-rentals/*`, `src/types/*chair-rental*`, `src/app/api/chair-rentals/**` y componentes de acuerdo, confirmación, anulación e historial.
- Ventas/ingresos/dashboard: `src/lib/incomes/*`, `src/types/income.ts`, `src/app/(dashboard)/incomes/**`, `src/components/incomes/*`, `src/lib/dashboard/income-summary.ts` y dashboard home.
- Caja: `src/lib/cash/*`, `src/types/cash.ts`, `src/components/cash/*` y funciones SQL de snapshot, proyección, expected cash y ajustes post-cierre.
- Reportes/resúmenes/gastos: `src/lib/reports/*`, `src/types/report.ts`, `src/components/reports/*`, `src/lib/expenses/*`, `src/types/expense.ts`, `src/components/expenses/expenses-workspace.tsx`.
- Verificación DB: `scripts/system-db-acceptance.ts`, `system-db-audit.ts`, `system-clean-install-acceptance.ts`, `system-concurrency-acceptance.ts` y tests `migration-045`/dominio enfocados.
- Documentación de producto: nueva spec en `docs/superpowers/specs/`, `product.md`, `context_snapshot.md` y, sólo si agrega invariantes durables, `AGENTS.md`.

## Security / Invariants

- Browser code nunca importa el cliente Supabase admin ni recibe la secret key.
- Owner-only se aplica en UI, Route Handler, servicio y RPC; admin/employee no pueden modificar acuerdos ni confirmar/anular alquileres.
- PostgreSQL determina actor, importe, timestamps, business date, método activo, snapshots, comisión y neto; no confiar en esos valores desde JSON.
- Todos los importes son enteros ARS seguros; período `YYYY-MM`; día `1..28`; motivo de anulación trim no vacío.
- RLS habilitado sin policies browser y sin grants para `PUBLIC`, `anon` o `authenticated`; sólo `service_role` ejecuta RPCs necesarios.
- Idempotencia igual devuelve el resultado original; mismo `requestId` con semántica diferente devuelve conflicto; concurrencia nunca duplica ingreso, pago, intento ni efecto de Caja.
- Pagos, anulaciones y revisiones se conservan; no hay deletes ni reescritura de snapshots históricos.
- `commission_total = 0` y `barbershop_net = total` para alquiler; identidades financieras de ingresos y Caja siempre reconcilian.
- Cierres de Caja son inmutables y las anulaciones tardías se expresan como ajustes; no ejecutar SQL contra producción.

## Edge Cases

- Sólo comisión, sólo alquiler, ambas, servicio on/producto off y combinación inversa.
- Tasa positiva con flag apagado, tasa cero con flag encendido y excepción 100% sobre tipo deshabilitado.
- Effective-from futuro, período anterior al inicio, día 28 en febrero y cambio de importe/día después de pagos históricos.
- Employee inactivo/eliminado o cambio de rol con historial de alquiler; el historial sigue legible y no se crean nuevas obligaciones fuera del rol employee.
- Medio inactivo entre apertura y confirmación; request repetido, conflictivo y concurrente; doble click.
- Pago de período anterior confirmado en el mes actual; el período y el mes financiero no se confunden.
- Intento anulado sin reemplazo, reemplazo activo posterior y varias anulaciones históricas del mismo período.
- Anulación antes del cierre, después del cierre y repetición idempotente; efectivo y transferencia/otro medio.
- Mes sin actividad, sólo alquiler, alquiler más gastos, valores negativos de resultado y employees con obligación pero sin pago.

## Acceptance Criteria

- Owner puede guardar cualquier combinación válida del acuerdo para employees; admin la ve en sólo lectura y toda mutación de admin/employee falla con 403 sin cambios parciales.
- Ventas futuras y mensualidades fijas generan comisión cero exactamente para los tipos deshabilitados; ventas anteriores no cambian.
- Confirmar un alquiler crea exactamente un ingreso `chair_rental`, un pago y un intento con snapshots correctos, sin sesión laboral; retries y carreras convergen.
- El período queda marcado pagado y muestra todos los datos de auditoría. Un segundo pago activo falla; anular exige motivo, conserva historia y permite un nuevo intento.
- Efectivo y transferencia/otro medio actualizan correctamente Caja y sus desgloses. La anulación posterior al cierre crea el ajuste exacto y no reescribe el cierre.
- Reportes y resumen mensual muestran ventas, clientes fijos, alquileres, bruto, gastos y resultado operativo reconciliados; el desglose de alquileres informa total, cantidad, pendientes, vencidos y employees pagadores.
- Alquileres anulados no suman; alquileres cobrados no alteran visitas, inventario, ventas/tickets, promedios, comisiones, presentismo ni team performance.
- La migración de employees existentes cumple los defaults solicitados y una instalación limpia `001`–`045` conserva RLS/grants y todos los invariantes.
- La UI funciona en desktop/móvil, evita doble submit y conserva estados loading/error/empty con accesibilidad de diálogo y controles.
- Existe una spec aprobada que documenta explícitamente criterio de caja, período facturado versus fecha efectiva y comportamiento de anulación; `product.md` y `context_snapshot.md` reflejan sólo trabajo efectivamente verificado/instalado.

## Verification

- Ejecutar tests Vitest enfocados de users/agreement, chair rentals, incomes, dashboard, reports, expenses y Caja.
- Ejecutar aceptación PostgreSQL con rollback: `npm run acceptance:db`.
- Ejecutar concurrencia sólo contra una base disposable/de test autorizada, nunca producción: `npm run acceptance:concurrency`.
- Ejecutar auditoría read-only y clean install disposable cuando las credenciales de test lo permitan: `npm run audit:db` y `npx tsx --env-file=.env scripts/system-clean-install-acceptance.ts --confirm-disposable`.
- Ejecutar `npm test`.
- Ejecutar `npm run lint`.
- Ejecutar `npx next typegen`.
- Ejecutar `npx tsc --noEmit`.
- Ejecutar `npm run build`.
- Ejecutar `git diff --check`.
- Verificar manualmente owner/admin en `/users`, pago/anulación, historial, reportes y Caja; documentar cualquier gate externo sin aplicar migraciones remotas, desplegar ni hacer push.

## Implementation

Status: IMPLEMENTED

### Changed Files

- `supabase/queries/045_employee_commercial_agreements_and_chair_rentals.sql`
- `supabase/queries/README.md`
- `scripts/system-db-acceptance.ts`, `scripts/system-db-audit.ts`, `scripts/system-clean-install-acceptance.ts`, `scripts/system-concurrency-acceptance.ts`
- `src/lib/incomes/`, `src/types/income.ts`, `src/components/incomes/`
- `src/lib/dashboard/`, `src/components/dashboard/`
- `src/lib/cash/`, `src/types/cash.ts`, `src/components/cash/`
- `src/lib/reports/`, `src/types/report.ts`, `src/components/reports/`
- `src/lib/expenses/`, `src/types/expense.ts`, `src/components/expenses/`
- `src/components/users/users-view.tsx`, `src/components/users/user-list.tsx`, `src/components/users/user-editor-dialog.tsx`
- `src/components/users/employee-agreement-dialog.tsx`, `src/components/users/chair-rental-dialogs.tsx`, `src/components/users/chair-rental-history-sheet.tsx`
- `src/app/(dashboard)/users/page.tsx`, `src/components/users/users-view.test.tsx`, `src/lib/chair-rentals/client.ts`, `src/lib/chair-rentals/client.test.ts`
- `src/lib/users/service.ts`, `src/lib/users/service.test.ts`
- Review follow-up: `src/components/reports/reports-workspace.tsx`, `src/components/reports/report-composition.tsx`, `src/components/reports/reports-workspace.test.tsx`, `src/lib/incomes/contracts.ts`, `src/lib/incomes/frontend-contracts.test.ts`, `src/lib/incomes/income-presentation.test.ts`, `src/lib/supabase/database.types.ts`, `src/components/cash/cash-summary-cards.tsx`
- Final verification follow-up: `src/lib/chair-rentals/migration-045.test.ts`, `src/lib/reports/schemas.ts`, `src/types/report.ts`, `src/lib/reports/schemas.test.ts`, `src/lib/reports/client.test.ts`, `src/lib/reports/repository.test.ts`, `scripts/system-db-acceptance.ts`, `scripts/system-db-audit.ts`, `scripts/system-clean-install-acceptance.ts`, `scripts/system-concurrency-acceptance.ts`

### Notes

- Added strict application contracts for the migration-045 rental composition, including charged totals, payment reconciliation and pending/overdue obligations.
- Rental entries are presented as manager-only income, included in financial totals and payment breakdowns, while sale counts, averages and employee productivity remain sale-only.
- Existing pre-045 responses remain readable where the new response member is absent; no database SQL was changed or executed.
- `/users` loads agreements and current-period rentals independently from the ordinary user list. Owners receive agreement, confirmation and void controls; admins receive read-only agreement/history views. Confirmation sends only period, active payment method and a generated request id.
- The page now supplies the Buenos Aires period from the server; browser rental refreshes reuse that value. Browser responses are parsed with strict client-safe schemas, and dialog submissions guard duplicate requests and validate agreement/void inputs before sending.
- Admin creation rejects nonzero commissions before hashing or persistence. Desktop employee rows now include rental period, amount, status, due day and the owner payment action; agreement/rental reads expose loading, error and empty states and replace maps only after successful reads.
- Review follow-up forwards rental composition to reports, keeps rental-only periods visible, renders payer/obligation details, and shows chair rentals separately in Caja while preserving gross reconciliation. Manager schemas accept SQL rental fields while employee projections remain strict and rental-free.
- Migration review follow-up adds immutable obligation snapshots, rental-aware automatic close/Caja projections, strict attempt metadata and income-attempt link constraints, idempotent repeated voids, actor-aware generic rate auditing, and security-definer helper grant auditing. No remote SQL was executed.
- Final SQL repair distinguishes effective cash-month payer aggregation from billed obligations and derives closed Caja rental totals from immutable sales snapshots plus same-day adjustments; live Caja continues to use active incomes plus same-day adjustments.
- Final review follow-up normalizes agreement defaults on user insert by role, promotes explicit non-null rental configuration checks, preserves detail history after role changes, and exposes `byEffectiveDate` rental report entries. Rollback acceptance now covers independent commission flags, owner-only mutations, rental confirm/void/replay, Caja post-close adjustment behavior and historical detail.

## Verification Results

- lint: PASS (zero errors; pre-existing unused `Store` warning)
- typecheck: PASS
- tests: PASS (231 files / 1083 tests; migration-045 static suite: 11 tests)
- focused report/chair-rental tests: PASS (5 files / 29 tests)
- next typegen: PASS
- build: PASS
- git diff --check: PASS
- PostgreSQL acceptance/audit/concurrency/clean-install: NOT RUN (no authorized disposable/remote SQL execution)

## Review

Status: APPROVED

The previously reported nullable rental-configuration CHECK and missing database acceptance coverage are resolved in the current diff. Focused review tests pass (5 files / 27 tests), and `git diff --check` passes.

PostgreSQL rollback acceptance, audit, concurrency, and clean-install execution remain pending because no authorized disposable/remote database was available; do not deploy migration 045 until those gates are run against an authorized test database.
