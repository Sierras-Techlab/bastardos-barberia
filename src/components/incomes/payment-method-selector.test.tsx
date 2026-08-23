import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { PaymentMethodSelector } from "./payment-method-selector";

const methods = [
  { id: "60000000-0000-4000-8000-000000000001", name: "Efectivo", isActive: true },
  { id: "60000000-0000-4000-8000-000000000002", name: "Transferencia", isActive: true },
  { id: "60000000-0000-4000-8000-000000000003", name: "Tarjeta", isActive: true },
  { id: "60000000-0000-4000-8000-000000000004", name: "Cheque", isActive: false },
];

it("auto-fills the first active method with the complete total", () => {
  const onChange = vi.fn();
  render(<PaymentMethodSelector methods={methods} payments={[]} total={49000} onChange={onChange} error="Seleccioná un medio de pago." />);

  expect(onChange).toHaveBeenCalledWith([{ paymentMethodId: methods[0].id, amount: 49000 }]);
  expect(screen.queryByRole("button", { name: "Cheque" })).not.toBeInTheDocument();
  expect(screen.getByText("Seleccioná un medio de pago.")).toBeVisible();
});

it("renders active methods and combined as selectable cards", () => {
  render(
    <PaymentMethodSelector
      methods={methods}
      payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]}
      total={49000}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Transferencia" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Combinado" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByRole("button", { name: "Cheque" })).not.toBeInTheDocument();
});

it("adds the clicked method to existing single allocations as combined", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <PaymentMethodSelector
      methods={methods}
      payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]}
      total={49000}
      onChange={onChange}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Tarjeta" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 49000 },
    { paymentMethodId: methods[2].id, amount: 0 },
  ]);
});

it("opens combined mode with two distinct dynamic methods", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <PaymentMethodSelector
      methods={methods}
      payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]}
      total={49000}
      onChange={onChange}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Combinado" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 49000 },
    { paymentMethodId: methods[1].id, amount: 0 },
  ]);
});

it("adds and removes distinct allocations up to every active method", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { rerender } = render(
    <PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]} total={49000} onChange={onChange} />,
  );

  await user.click(screen.getByRole("button", { name: "Combinado" }));
  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 49000 }, { paymentMethodId: methods[1].id, amount: 0 }]} total={49000} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Tarjeta" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 49000 },
    { paymentMethodId: methods[1].id, amount: 0 },
    { paymentMethodId: methods[2].id, amount: 0 },
  ]);

  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 19000 }, { paymentMethodId: methods[2].id, amount: 10000 }]} total={49000} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: /quitar tarjeta/i }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 20000 },
    { paymentMethodId: methods[1].id, amount: 19000 },
  ]);
});

it("reports remaining, exact and excess allocations", () => {
  const { rerender } = render(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 39000 }, { paymentMethodId: methods[1].id, amount: 0 }]} total={49000} onChange={vi.fn()} />);
  expect(screen.getByText(/faltan \$ ?10\.000/i)).toBeVisible();

  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={vi.fn()} />);
  expect(screen.getByText(/importe distribuido correctamente/i)).toBeVisible();

  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 50000 }, { paymentMethodId: methods[1].id, amount: 0 }]} total={49000} onChange={vi.fn()} />);
  expect(screen.getByText(/sobran \$ ?1\.000/i)).toBeVisible();
});

it("clears allocations for methods that disappear from the active catalog", () => {
  const onChange = vi.fn();
  const { rerender } = render(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={onChange} />);

  rerender(<PaymentMethodSelector methods={[methods[0], { ...methods[1], isActive: false }, methods[2]]} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={onChange} />);

  expect(onChange).toHaveBeenLastCalledWith([{ paymentMethodId: methods[0].id, amount: 20000 }]);
});
