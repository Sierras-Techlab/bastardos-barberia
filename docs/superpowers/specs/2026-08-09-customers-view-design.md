# Customers View Design

## Goal

Create a responsive frontend prototype at `/customers` for finding, reviewing, creating and editing Bastardos customers without depending on backend work.

## Customer model

```ts
type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  visits: number;
  createdAt: string;
};
```

First name, last name, email and phone are required because the existing booking system requires the same identity and contact information. `visits` is visible but never editable in the customer form.

Every future income associated with a customer counts as one visit, whether it contains a service, products or both. The backend will own that update when income persistence is integrated. The prototype uses fixed visit counts in its mock fixture and does not attempt to synchronize `/incomes/new`.

## Validation

- Trim first name and last name and reject empty values.
- Normalize email with trim and lowercase before duplicate comparison.
- Require a syntactically valid email.
- Normalize phone for duplicate comparison by retaining digits only.
- Require enough digits to represent a usable phone number.
- Reject another customer's normalized email or normalized phone.
- Allow an edited customer to retain their own email and phone.
- New mock customers start with `visits: 0` and receive a generated local ID and timestamp.

## Information architecture

The authenticated `/customers` page uses the persistent dashboard shell and sidebar. It contains:

1. A compact metric row for total customers, new customers in the current mock period and accumulated visits.
2. A filter surface with free-text search and ordering.
3. A desktop table with customer, contact, visits and registration date.
4. Mobile customer cards with direct `tel:` and `mailto:` actions.
5. A manager action to create a customer and row/card actions to edit one.

Search covers first name, last name, full name, email and phone. Ordering options are original order, most/least visits and newest/oldest registration.

The desktop table and mobile cards deliberately share the same filtered collection while using different presentations. The table optimizes scanning; cards preserve touch usability.

## Permissions

All authenticated roles may view and search customers because employees need them during operational sales entry. Owner and admin may create or edit customers in the prototype. Employees receive a read-only presentation.

These checks are presentation-only until backend endpoints exist. Future customer APIs must authorize mutations independently at the server boundary.

## Mock lifecycle and feedback

Customer data comes from a strict JSON fixture validated before rendering. Client-side changes live in `CustomersView` state and reset on reload or remount.

Successful create and edit actions use the same accessible temporary feedback pattern established by products. Loading and error components are prepared at the route boundary for future asynchronous integration; the current mock route renders synchronously.

## Scope exclusions

- No backend, API, Supabase or SQL changes.
- No deletion, archive or `isActive` behavior.
- No customer visit-history detail screen.
- No manual visit editing.
- No automatic update from the mock income form.
- No email or phone messaging integration beyond native `mailto:` and `tel:` links.
- No pagination in this prototype; filtering and sorting operate over the bounded mock dataset.

## Testing

Pure tests cover fixture validation, normalization, duplicate detection, filtering, sorting and metrics. Component tests cover role-specific actions, responsive representations, create/edit workflows, accessible feedback, empty results and reset-on-remount behavior. The route test verifies authentication and the manager capability passed to the client view.
