# Persistent Dashboard Shell Design

## Goal

Prevent the application shell from disappearing and remounting while navigating between private views, and remove avoidable authentication latency without changing any public URL or weakening session and role checks.

## Route Architecture

Private pages will live under the URL-transparent `app/(dashboard)` route group. Its layout will call `requirePageUser()` once and render the shared `TooltipProvider`, `SidebarProvider`, `AppSidebar`, and `SidebarInset` around `children`.

The resulting routes remain:

- `/` for the dashboard
- `/incomes` for income history
- `/incomes/new` for income creation
- `/users` for user administration
- `/login` outside the private group

Because route-group names are omitted from URLs, moving the files does not change links or bookmarks.

## Authorization

The shared dashboard layout authenticates entry into the private shell and supplies the authenticated user to the sidebar. Dashboard and income pages also call `requirePageUser()` at their leaf boundary so every client navigation rechecks revocation, expiration, and account status even when Next.js reuses the layout.

The users page will retain `requireManagerPage()` because it needs stricter owner/admin authorization. Its nested layout will be removed so it cannot recreate the application shell.

Authentication reads will be memoized for the lifetime of a single React server request. If both the layout and a protected leaf boundary require the current session during an initial render, they receive the same result instead of issuing duplicate database work. A later navigation starts a new request and performs a fresh lookup.

## Session Activity

Validating a session requires one database read. Updating `last_seen_at` on every validation adds a second blocking network request to every navigation without improving authorization correctness.

The session record returned by the repository will include `lastSeenAt`. A valid session will only be touched when its stored activity timestamp is at least five minutes old. Recent sessions skip the write entirely. The read remains mandatory so revoked, expired, deleted, deactivated, or role-changed users take effect on the next protected server request.

The five-minute interval affects activity bookkeeping only. It does not cache authorization across requests and does not extend the absolute session expiration.

## Rendering Behavior

Next.js will continue generating Server Component payloads during dynamic navigation because authentication reads the session cookie and validates the database session. That server work is expected. The shared layout remains mounted during client-side navigation, so only the route content changes and the sidebar keeps its interactive state.

A loading boundary inside the shared shell will provide immediate visual feedback when a destination page still needs server data. It replaces only the main content; the sidebar remains visible and interactive.

## UI Responsibilities

The shared layout owns only the persistent shell. Each page continues to own its header, title, badges, main content, and route-specific error states. The sidebar determines its active entry from the current pathname rather than requiring a different layout instance per section.

## Testing

Tests will verify that the shared layout authenticates and renders the shell with arbitrary child content. Page tests will prove that each private destination revalidates the live session, while `/users` enforces manager authorization. Memoization tests will cover reuse within one request and isolation across later requests. Session tests will cover both recent activity, which performs no write, and stale activity, which updates `last_seen_at`. Sidebar tests will verify pathname-derived active navigation, and the loading boundary will be checked independently. The complete test suite, lint, production build, and route navigation will be checked after the refactor.
