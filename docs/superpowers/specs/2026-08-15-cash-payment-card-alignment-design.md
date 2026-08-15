# Cash payment card alignment

**Date:** 2026-08-15
**Status:** Approved in conversation

## Problem

On desktop, the payment-method card starts at the top of the audit grid while
the sales table starts below its heading. Their upper edges are misaligned.

## Approved design

Add `lg:pt-[3.75rem]` to the right audit column. This offsets the card by the
desktop heading height and aligns it with the sales table without restructuring
the components. The padding applies only at the `lg` breakpoint, so mobile
stacking remains unchanged.

## Verification

- Add a focused component assertion for the desktop offset class.
- Validate alignment at the desktop viewport and unchanged stacking at 390×844.
- Run focused tests, lint and the production build.

## Non-goals

- Moving the audit heading outside `CashSalesAudit`.
- Changing card content, width, spacing or mobile order.
