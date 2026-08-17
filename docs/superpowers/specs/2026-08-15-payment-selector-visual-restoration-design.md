# Payment selector visual restoration design

## Goal

Restore the previous card-based payment selection hierarchy in `/incomes/new` while preserving the current dynamic payment-method catalog and arbitrary split-allocation behavior.

## User experience

- Render every active payment method as a large rounded selection card.
- Render one additional `Combinado` card when at least two active methods exist.
- Use the established visual language: primary red for the selected card, warm light gray for unselected cards, rounded corners, subtle ring/shadow and hover lift.
- Selecting one payment-method card replaces the allocation list with that method for the full sale total.
- Selecting `Combinado` keeps valid existing allocations when there are already multiple; otherwise it starts with the current method covering the total plus the next available active method at zero.
- The combined panel retains the dynamic rows used today: method selector, editable integer amount, remove action, add-method action and remaining/excess feedback.
- Inactive methods never appear. When an active method disappears, the existing catalog-cleanup behavior remains authoritative.
- With fewer than two active methods, the combined option is unavailable and the only active method remains usable.

## Component boundary and data flow

`PaymentMethodSelector` keeps its existing public props and continues receiving `methods`, `payments`, `total`, `onChange` and `error`. Selection mode is derived from the allocation list rather than added to the income form schema:

- one allocation means its payment-method card is selected;
- two or more allocations means `Combinado` is selected;
- no allocations are normalized by the existing effect to the first active method.

No backend, API, database, income schema or persisted contract changes are included.

## Accessibility and responsive behavior

- Cards are real buttons with `aria-pressed`.
- Dynamic names remain the accessible labels; behavior never depends on fixed names such as cash or transfer.
- The card grid wraps responsively and keeps touch targets at least as large as the previous selector.
- Combined allocation controls keep their existing explicit amount/removal labels and status announcement.

## Error handling

- Zero active methods retain the existing blocking alert.
- Duplicate selections remain impossible because row options exclude methods already allocated elsewhere.
- Remaining and excess amounts retain the existing status copy and colors.
- The current form-level error remains visible below the selector.

## Testing

- Prove active methods and `Combinado` render as pressable cards with correct selected state.
- Prove selecting a single card assigns the complete total.
- Prove selecting `Combinado` starts a valid dynamic allocation pair.
- Preserve the existing add/remove, balance and catalog-change regression tests.
- Run the focused selector/form tests, full suite, lint, build and `git diff --check`.

## Out of scope

- A standalone payment-method administration route.
- Sidebar navigation changes.
- Payment-method CRUD or migration changes.
- Changes to the income confirmation or history presentation.
