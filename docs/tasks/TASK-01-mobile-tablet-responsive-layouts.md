# TASK-01 — Mobile and Tablet Responsive Layouts

## Goal

Resolve the client-reported mobile and tablet layout problems across the authenticated workspace without changing application behavior or data contracts.

## Context

The persistent sidebar and most dense desktop tables activate at `md`. At tablet widths, the expanded 16rem sidebar leaves too little route content width, causing clipped or cumbersome tables. Several mobile headers, action groups, pagination controls and detail views also force long content into a single row.

## Requirements

- Coordinate shell and content breakpoints so tablet users are not given desktop layouts in a sidebar-constrained content area.
- Keep existing mobile/card presentations through tablet widths where available; show dense tables only when the usable content width supports them.
- Contain unavoidable wide tables with local horizontal scrolling and an explicit minimum width; they must never create document-level horizontal overflow.
- Make page headings, manager actions and pagination wrap or stack cleanly on narrow screens.
- Make long names, contact values, identifiers, prices and definition rows wrap or truncate without hiding required information or actions.
- Keep dialogs and sheets within the viewport on narrow/short screens, with scrollable content and reachable actions.
- Preserve all current desktop layouts, role-based visibility, interactions and empty/loading/error states.

## Architecture

- Treat the dashboard shell as the shared responsive boundary: add width containment such as `min-w-0` to the content inset and align the sidebar mode with route presentation breakpoints.
- Reuse existing mobile lists/cards rather than creating a third tablet representation.
- Replace `overflow-hidden` as a workaround for wide content with either the responsive card representation or component-local `overflow-x-auto`.
- Apply responsive changes in presentation components only; do not alter APIs, services, schemas, authorization or database behavior.
- Add focused regression tests to existing component suites; do not add a new test framework solely for viewport testing.

## Affected Areas

- Shared shell: `src/components/ui/sidebar.tsx`, `src/app/(dashboard)/layout.tsx`.
- Users: `src/components/users/user-list.tsx`, related view tests.
- Customers: `src/components/customers/customers-view.tsx`, `customer-visits-dialog.tsx`.
- Products: `src/components/products/products-view.tsx`, product table/mobile list.
- Incomes: `src/components/incomes/incomes-view.tsx`, `income-detail-sheet.tsx`, table/mobile list.
- Expenses: `src/components/expenses/expenses-workspace.tsx`, `expense-detail-sheet.tsx`.
- Caja: `src/components/cash/cash-sales-audit.tsx`, `cash-history-table.tsx`, `cash-view.tsx`.
- Presentismo: `src/components/work-sessions/work-session-history.tsx`, `work-session-control.tsx`.
- Reports: `src/components/reports/report-trend-chart.tsx`.
- Shared overlays where needed: `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`.

## Security / Invariants

- Responsive visibility must not become an authorization mechanism; existing server and role checks remain unchanged.
- Mobile/tablet and desktop representations must render the same authorized records and actions.
- Do not expose hidden financial, commission, employee or audit data to roles that cannot currently access it.
- Preserve keyboard access, semantic labels, focus handling and minimum comfortable touch targets.

## Edge Cases

- 320px phones, long Spanish action labels and long customer/product/user names.
- 768px portrait tablets with the sidebar open and 1024px landscape tablets.
- Large text, long emails/UUIDs/currency values and multi-action rows.
- Empty lists, loading states, disabled pagination and manager-only controls.
- Short viewport height or an open software keyboard inside long dialogs.
- Tables whose full column set is required, especially Presentismo and Caja audit/history.

## Acceptance Criteria

- No authenticated route creates document-level horizontal scrolling at 320px, 768px or 1024px viewport widths.
- At tablet widths, Users, Customers, Products, Incomes, Expenses, Caja and Presentismo use a readable card/list layout or an intentionally contained table; no content is clipped by `overflow-hidden`.
- Route titles, management buttons and pagination remain visible, non-overlapping and operable on mobile and tablet.
- Detail dialogs/sheets keep long values inside their bounds and their close/confirm actions remain reachable.
- The mobile sidebar fits narrow viewports, and the main shell cannot be widened by a route child.
- Desktop behavior at supported large widths remains visually and functionally unchanged.
- Focused tests cover responsive representation/breakpoint selection and overflow-related class contracts for changed components.

## Verification

- Manually inspect representative manager and employee routes at 320×568, 768×1024 and 1024×768; confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- Verify dialogs, sheets, navigation, filters, actions and pagination using keyboard and touch-sized controls.
- Run focused Vitest suites for every changed component.
- Run `npm test`.
- Run `npm run lint`.
- Run `npx next typegen`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.

## Implementation

Status: IMPLEMENTED

### Changed Files

- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/layout.test.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/users/user-list.tsx`
- `src/components/customers/customers-view.tsx`
- `src/components/customers/customer-visits-dialog.tsx`
- `src/components/products/products-view.tsx`
- `src/components/products/products-view.test.tsx`
- `src/components/incomes/incomes-view.tsx`
- `src/components/incomes/income-detail-sheet.tsx`
- `src/components/expenses/expenses-workspace.tsx`
- `src/components/expenses/expense-detail-sheet.tsx`
- `src/components/expenses/expenses-workspace.test.tsx`
- `src/components/cash/cash-view.tsx`
- `src/components/cash/cash-sales-audit.tsx`
- `src/components/cash/cash-history-table.tsx`
- `src/components/work-sessions/work-session-history.tsx`
- `src/components/work-sessions/work-session-control.tsx`
- `src/components/reports/report-trend-chart.tsx`
- `src/components/reports/report-trend-chart.test.tsx`

### Notes

- Desktop sidebar/table presentations now begin at `xl`; tablet widths reuse existing mobile/card presentations and the shared shell has `min-w-0` containment.
- Wide tabular views use local scrolling with explicit minimum widths, while headings, actions, pagination, dialogs, sheets and long values wrap safely.
- Expense detail metadata stacks on narrow screens and the Reports trend chart no longer forces a 680px minimum canvas.
- No API, authorization, schema, service or database behavior was changed.
- The same implementation was reapplied after an external git reset; no scope or responsive design decision was changed.

## Verification Results

- lint: PASS (one pre-existing unused `Store` warning in `src/components/app-sidebar.tsx`)
- typecheck: PASS
- tests: PASS (225 files / 1028 tests; focused responsive suites also passed)
- next typegen: PASS
- build: PASS
- git diff --check: PASS

## Review

Status: CHANGES_REQUESTED

### IMPORTANT

- `src/components/expenses/expense-detail-sheet.tsx:7` still renders its metadata definition list with `grid grid-cols-2` at every viewport. Long dates, category/type values, or localized content can collide in the narrow sheet, so the requirement for mobile-safe detail rows is not met. Stack the rows on narrow screens and restore two columns only at an appropriate larger breakpoint, with breakable values.
- `src/components/reports/report-trend-chart.tsx:10` still forces the chart body to `min-w-[680px]`. The surrounding `overflow-x-auto` prevents document overflow, but it leaves the mobile/tablet report chart as a large horizontally scrolling desktop canvas. This was identified as a responsive usability issue and is not an unavoidable data table; provide a genuinely usable narrow layout or explicitly redesign the chart for small viewports.
- The responsive regression coverage is incomplete. Only the shared shell and Products representation received new assertions, while the changed Customers, Incomes, Expenses, Caja, Presentismo, dialogs/sheets and Reports behavior has no focused test proving breakpoint selection, action wrapping, or overflow containment. Add focused tests for the critical changed surfaces before approval.
