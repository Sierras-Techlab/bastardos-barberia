# Caja e Ingresos claros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Hacer explícitos los cobros, comisiones, alquileres y alcance de los filtros en Caja e Ingresos.

**Architecture:** Componentes compartidos para resumen y composición de ingresos; Caja deriva la composición de su lista completa con statusAtClose. Ingresos consume composición opcional agregada en la consulta SQL existente, manteniendo compatibilidad anterior y la proyección del empleado.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind, Zod, Vitest, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-01-caja-ingresos-claridad-design.md`

## Global Constraints

- No se ejecutará SQL remoto sin autorización explícita.
- No se agregan dependencias ni una nueva navegación.
- Mantener cálculos históricos, firma RPC y permisos. La composición usa todas las operaciones filtradas antes de paginar.
- Preservar cambios preexistentes en context_snapshot.md y docs/audits.
- Implementación inline, revisión independiente al final. El usuario aprobó todo el diseño y la ejecución; no introducir nuevas confirmaciones de planificación.

## Review Focus

- Página parcial: los subtotales siguen correspondiendo al período completo (Task 1/2).
- Anulación posterior: no cambia la composición del cierre (Task 2).
- Respuesta anterior sin composition: no se inventan ceros (Task 1/2).
- Empleado: no recibe ni ve composition administrativa (Task 1/3).
- Pagos combinados y filtros fallidos: alcance explícito, sin totales anteriores bajo filtros nuevos (Task 3).

### Task 1: Contrato de composición y migración de lectura

**Files:** `src/types/income.ts`, `src/lib/incomes/contracts.ts`, `src/lib/incomes/income-composition.ts`, `src/lib/incomes/income-composition.test.ts`, `supabase/queries/046_income_composition.sql`, `supabase/queries/README.md`.

**Interfaces:** `IncomeComposition = { sales, subscriptions, chairRentals }`, cada grupo `{ grossTotal, commissionTotal, barbershopNet }`; opcional en métricas administrativas. `buildCashIncomeComposition(sales: CashSaleAuditItem[]): IncomeComposition`.

- [x] Escribir y ejecutar tests que fallen: parser administrativo acepta composición completa, rechaza composición incompleta/inconsistente, permite respuesta anterior; parser empleado rechaza composición; agrupación de Caja preserva statusAtClose y no duplica ventas combinadas.
- [x] Implementar tipos, parser y agrupación pura, y ejecutar pruebas enfocadas.
- [x] Preparar 046: extender el cuerpo de list_incomes de forma idempotente y validada, añadiendo agregados sobre filtered a la misma consulta; proyectar composición solo en managers. Documentar instalación y verificaciones manuales. No ejecutar SQL remoto.

### Task 2: Resúmenes claros de Caja e Ingresos

**Files:** `src/components/incomes/income-metrics.tsx`, `src/components/incomes/income-composition.tsx`, `src/components/cash/cash-summary-cards.tsx`, `src/components/cash/cash-view.tsx`, `src/components/cash/cash-payment-breakdown.tsx`, `src/components/cash/cash-sales-audit.tsx`, tests respectivos.

**Interfaces:** resumen consume métricas administrativas y composition opcional; composición presenta los tres grupos en móvil/escritorio. Caja consume la función del Task 1.

- [x] Escribir y ejecutar tests que fallen para el ejemplo $135.500/$56.750/$78.750, alquiler sin comisión, fallback sin desglose y permiso empleado.
- [x] Implementar tres tarjetas principales, relación de importes, composición y texto explicativo; contador de ventas secundario. Mantener etiquetas de utilidad donde sus consumidores las requieran.
- [x] Agrupar efectivo físico; simplificar estados y nombres de movimientos/medios; preservar acciones, cierres y ajustes. Actualizar tests por texto intencionalmente cambiado y ejecutar cobertura de Caja/Ingresos.

### Task 3: Filtros y alcance, integración y revisión

**Files:** `src/components/incomes/income-filters.tsx`, `src/components/incomes/income-filter-scope.tsx`, `src/components/incomes/incomes-view.tsx`, `src/app/(dashboard)/incomes/page.tsx`, tests respectivos, documentación de estado.

**Interfaces:** alcance consume `IncomeListFilters`, empleados y métodos, y `onChange`; acción Ver todos los conceptos cambia solo kind. Mismo estado de consulta y cancelación ya existente.

- [x] Escribir y ejecutar tests que fallen: exclusión de alquileres, restauración solo de kind, resumen visible en móvil, semántica de pago combinado, ausencia de opciones administrativas para empleado.
- [x] Mantener fechas/empleado visibles, controles adicionales accesibles, alcance antes del resumen, advertencias y títulos inclusivos. Conservar abort/retry y ocultación de números pendientes.
- [x] Ejecutar pruebas enfocadas y secuencia completa: npm test, npm run lint, npx next typegen, npx tsc --noEmit, npm run build, git diff --check.
- [x] Revisar interfaz con datos sintéticos en móvil/escritorio; solicitar revisión independiente y resolver hallazgos importantes. Actualizar context_snapshot.md y product.md con estado y límite SQL.

## Ledger

- Inicio: diseño aprobado; cambios previos son documentación de auditoría y snapshot, que se preservan. Se trabaja inline en rama codex propia del checkout para dejar el resultado directamente revisable, sin mover cambios existentes a otro directorio.
- Las pruebas de PostgreSQL real quedan pendientes de autorización; no confundir comprobaciones locales del contrato con ejecución de la migración.
- Ruling: el RPC anterior no aceptaba `subscription` y su serializador no identificaba mensualidades sin items. 046 añade el filtro y el concepto histórico de lectura; se expone la opción solo cuando composition está disponible. La prueba SQL carga el serializador real de 020 y el wrapper real de 045 para cubrir esta integración.
- Revisión independiente: corregidas la proyección mensual y la explicación de pagos del empleado. Segunda revisión sin hallazgos críticos/importantes.

- Final: 239 archivos / 1125 tests; lint (advertencia Store preexistente), typegen, typecheck, build y diff-check correctos. SQL verificado en memoria con datos sintéticos; aplicación remota de 046 y full-schema acceptance quedan pendientes de autorización. Revisión visual de componentes reales en escritorio y móvil de 390px; interacciones cubiertas por tests. Rama conservada para revisión local, sin merge/push ni incluir la auditoría preexistente en un commit.
