import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import type { IncomePaymentInput } from "@/types/payment-method";

import { PaymentMethodSelector } from "./payment-method-selector";

const methods = [
  { id: "60000000-0000-4000-8000-000000000001", name: "Efectivo", isActive: true },
  { id: "60000000-0000-4000-8000-000000000002", name: "Transferencia", isActive: true },
  { id: "60000000-0000-4000-8000-000000000003", name: "Tarjeta", isActive: true },
  { id: "60000000-0000-4000-8000-000000000004", name: "Cheque", isActive: false },
];

const EmployeeSelectorHarness = ({ onChange }: { onChange: (payments: IncomePaymentInput[]) => void }) => {
  const [payments, setPayments] = useState<IncomePaymentInput[]>([
    { paymentMethodId: methods[0].id, amount: 49000 },
  ]);

  return (
    <PaymentMethodSelector
      mode="employee"
      methods={methods}
      payments={payments}
      total={49000}
      onChange={(next) => {
        onChange(next);
        setPayments(next);
      }}
    />
  );
};

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

it("adds and removes distinct allocations while keeping the last method as the remainder", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { rerender } = render(
    <PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]} total={49000} onChange={onChange} />,
  );

  await user.click(screen.getByRole("button", { name: "Combinado" }));
  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 49000 }, { paymentMethodId: methods[1].id, amount: 0 }]} total={49000} onChange={onChange} />);
  const cashInput = screen.getByRole("spinbutton", { name: "Monto en Efectivo" });
  fireEvent.change(cashInput, { target: { value: "20000" } });
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 20000 },
    { paymentMethodId: methods[1].id, amount: 29000 },
  ]);

  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Tarjeta" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 20000 },
    { paymentMethodId: methods[1].id, amount: 29000 },
    { paymentMethodId: methods[2].id, amount: 0 },
  ]);

  rerender(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 19000 }, { paymentMethodId: methods[2].id, amount: 10000 }]} total={49000} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: /quitar tarjeta/i }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 20000 },
    { paymentMethodId: methods[1].id, amount: 29000 },
  ]);
});

it("shows the exact distribution and marks the last method as the automatic remainder", () => {
  render(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={vi.fn()} />);
  expect(screen.getByText(/importe distribuido correctamente/i)).toBeVisible();
  expect(screen.getByText("Resto")).toBeVisible();
  expect(screen.getByRole("spinbutton", { name: "Monto en Transferencia" })).toBeDisabled();
});

it("splits two methods in half with one action", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 49000 }, { paymentMethodId: methods[1].id, amount: 0 }]} total={49000} onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Mitad y mitad" }));

  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 24500 },
    { paymentMethodId: methods[1].id, amount: 24500 },
  ]);
});

it("keeps the distribution within the total when the sale amount decreases", () => {
  const onChange = vi.fn();
  const selected = [
    { paymentMethodId: methods[0].id, amount: 40000 },
    { paymentMethodId: methods[1].id, amount: 9000 },
  ];
  const { rerender } = render(<PaymentMethodSelector methods={methods} payments={selected} total={49000} onChange={onChange} />);

  rerender(<PaymentMethodSelector methods={methods} payments={selected} total={30000} onChange={onChange} />);

  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 30000 },
    { paymentMethodId: methods[1].id, amount: 0 },
  ]);
});

it("clears allocations for methods that disappear from the active catalog", () => {
  const onChange = vi.fn();
  const { rerender } = render(<PaymentMethodSelector methods={methods} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={onChange} />);

  rerender(<PaymentMethodSelector methods={[methods[0], { ...methods[1], isActive: false }, methods[2]]} payments={[{ paymentMethodId: methods[0].id, amount: 20000 }, { paymentMethodId: methods[1].id, amount: 29000 }]} total={49000} onChange={onChange} />);

  expect(onChange).toHaveBeenLastCalledWith([{ paymentMethodId: methods[0].id, amount: 49000 }]);
});

it("shows employee allocations as integer amounts without percentages", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<EmployeeSelectorHarness onChange={onChange} />);

  const cashAmount = screen.getByRole("spinbutton", { name: "Monto en Efectivo" });
  expect(cashAmount).toHaveValue(49000);
  expect(screen.queryByText(/porcentaje|%/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Transferencia" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 49000 },
    { paymentMethodId: methods[1].id, amount: 0 },
  ]);
});
