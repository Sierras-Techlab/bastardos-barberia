# Dashboard Current Workweek Agenda Design

**Status:** Approved in conversation on 2026-08-13
**Branch:** `feat/backend-models`
**Timezone:** `America/Argentina/Buenos_Aires`

## Objective

Limit the fixed-customer agenda on the dashboard to the remaining days of the current operational week. The dashboard must never show recurring appointments from the following week before that next Monday begins.

## Weekly window

The operational week runs from Monday through Saturday in Buenos Aires local time.

- Monday requests Monday through Saturday.
- Tuesday through Friday request the current day through Saturday.
- Saturday requests Saturday only.
- Sunday requests no occurrences and renders an empty agenda.
- At the next Buenos Aires Monday, the range rotates automatically to that new Monday through Saturday.

Past days from the current week are not shown. Dates from the following week are not shown.

## Architecture and data flow

Add a small deterministic dashboard date-range helper that accepts an optional instant for testing and returns either:

- `{ dateFrom, dateTo }`, where `dateFrom` is the current Buenos Aires business date and `dateTo` is that week's Saturday; or
- `null` on Sunday.

The dashboard server page uses this helper independently from the existing seven-day income summary range. When a workweek range exists, it calls `listFixedOccurrences` with exactly that range. On Sunday it resolves the agenda to an empty array without calling the occurrence service.

The fixed-customer card receives only relevant occurrences. It keeps its existing chronological ordering and attendance transitions. Its empty-state copy changes to `No hay turnos fijos para el resto de la semana` so Sunday and genuinely empty remaining weeks are both described accurately.

## Boundaries

- No database schema or SQL migration changes are required.
- Recurrence generation, attendance persistence and optimistic status transitions remain unchanged.
- The income dashboard continues using its existing seven-day summary range.
- No navigation or dedicated agenda page is added.

## Error behavior

Existing authorization and repository errors continue to propagate from the dashboard server page. Sunday is a valid empty state, not an error.

## Testing

Add deterministic unit coverage for the Buenos Aires workweek calculation:

- Monday returns Monday through Saturday.
- Thursday returns Thursday through Saturday.
- Saturday returns Saturday only.
- Sunday returns `null`.
- A UTC instant near midnight is interpreted using the Buenos Aires calendar date.

Update the dashboard page tests to assert the exact occurrence query range and that Sunday skips the occurrence service. Update the card test for the new empty-state copy. Run the focused tests, complete test suite, lint and production build.
