# Income pagination deduplication

**Date:** 2026-08-15
**Status:** Approved in conversation
**Scope:** `/incomes` pagination and repository-wide pagination audit

## Problem

`/incomes` renders two independent pagination controls for one server-paginated
collection. `IncomesView` owns the authoritative API pagination, while
`IncomeTable` paginates the already limited page again with TanStack Table.
Consequently, the inner control reports only the size of the received page and
cannot navigate to additional server pages.

## Approved design

- Keep `IncomesView` as the only owner of income pagination.
- Remove the pagination feature, pagination state and pagination controls from
  `IncomeTable`.
- Keep the table responsible only for rendering the server-provided rows.
- Preserve the shared server paginator below the desktop table and mobile list,
  so both responsive presentations use the same state and API request.
- Do not change income API contracts, page size, filters, metrics or mobile
  rendering.

## Repository audit

The user directory, cash history and customer visit history each expose one
server-backed paginator. Product, service and customer catalog views do not
contain the same nested-pagination pattern. No additional production change is
required outside `/incomes`.

## Regression coverage

- Render an income result with more than one server page.
- Assert that the view exposes one `Anterior`, one `Siguiente` and one current
  page indicator.
- Activate `Siguiente` and assert that the income client receives the next
  server page while preserving the configured page size and role-safe filters.
- Run the focused income tests and the complete verification suite.

## Non-goals

- Changing the visual style or placement of the surviving paginator.
- Client-side pagination of a complete income dataset.
- Refactoring unrelated table implementations.
