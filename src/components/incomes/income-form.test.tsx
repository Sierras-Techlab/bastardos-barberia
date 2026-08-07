import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import incomeFormMock from "@/data/income-form.mock.json";
import type {
  CreateIncomeInput,
  Income,
  IncomeFormData,
  IncomeService,
} from "@/types/income";
import { IncomeForm } from "./income-form";

const ownerData = incomeFormMock as IncomeFormData;

const createDeferredService = () => {
  const calls: CreateIncomeInput[] = [];
  let resolveIncome: (income: Income) => void = () => undefined;
  let rejectIncome: (error: Error) => void = () => undefined;
  const pending = new Promise<Income>((resolve, reject) => {
    resolveIncome = resolve;
    rejectIncome = reject;
  });
  const service: IncomeService = {
    create: (input) => {
      calls.push(input);
      return pending;
    },
  };

  return { service, calls, resolveIncome, rejectIncome };
};

const selectValidServiceEntry = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole("button", {
      name: /corte de pelo y perfilado de cejas/i,
    }),
  );
  await user.click(screen.getByRole("button", { name: /efectivo/i }));
  await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
};

describe("IncomeForm", () => {
  it("defaults the responsible employee from the owner session and allows changing it", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} />);

    const employee = screen.getByRole("combobox", {
      name: /empleado responsable/i,
    });
    expect(employee).toHaveValue("employee-lautaro");

    await user.selectOptions(employee, "employee-fer");

    expect(employee).toHaveValue("employee-fer");
  });

  it("keeps the session employee fixed for a non-owner", () => {
    const employeeData: IncomeFormData = {
      ...ownerData,
      currentUser: {
        id: "employee-fer",
        firstName: "Fernanda",
        lastName: "Pérez",
        role: "employee",
      },
    };

    render(<IncomeForm data={employeeData} />);

    expect(
      screen.queryByRole("combobox", { name: /empleado responsable/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Fernanda Pérez")).toHaveLength(2);
  });

  it("keeps the customer optional and allows associating one", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} />);

    const customer = screen.getByRole("combobox", {
      name: /cliente opcional/i,
    });
    expect(customer).toHaveValue("");

    await user.type(customer, "tom");

    expect(
      screen
        .getByRole("button", { name: /seleccionar tomás pereyra/i })
        .closest('[data-slot="card"]'),
    ).toHaveClass("overflow-visible");

    await user.click(
      screen.getByRole("button", { name: /seleccionar tomás pereyra/i }),
    );

    expect(
      within(screen.getByRole("region", { name: /resumen del ingreso/i })).getByText(
        "Tomás Pereyra",
      ),
    ).toBeInTheDocument();
  });

  it("shows section errors when reviewing an empty entry", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} />);

    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));

    expect(
      await screen.findByText(
        "Seleccioná un servicio o agregá al menos un producto.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Seleccioná un medio de pago."),
    ).toBeInTheDocument();
  });

  it("updates the summary and accepts a service with a payment method", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} />);

    await user.click(
      screen.getByRole("button", {
        name: /corte de pelo y perfilado de cejas/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /efectivo/i }));
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));

    expect(
      await screen.findByRole("dialog", { name: /confirmar ingreso/i }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: /resumen del ingreso/i })).getAllByText(
        /16\.000/,
      ),
    ).toHaveLength(2);
  });

  it("keeps a single responsive action with the current total", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} />);

    await user.click(
      screen.getByRole("button", {
        name: /corte de pelo y perfilado de cejas/i,
      }),
    );

    const action = screen.getByRole("region", {
      name: /acción de ingreso/i,
    });

    expect(within(action).getByText(/16\.000/)).toBeInTheDocument();
    expect(
      within(action).getAllByRole("button", { name: /revisar ingreso/i }),
    ).toHaveLength(1);
  });

  it("keeps the sticky summary below the top navigation", () => {
    render(<IncomeForm data={ownerData} />);

    expect(
      screen
        .getByRole("region", { name: /resumen del ingreso/i })
        .closest("aside"),
    ).toHaveClass("xl:top-20");
  });

  it("accepts products without a service and calculates their total", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} />);

    await user.click(
      screen.getByRole("button", { name: /agregar hunter cream/i }),
    );
    await user.click(screen.getByRole("button", { name: /transferencia/i }));
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));

    expect(
      await screen.findByRole("dialog", { name: /confirmar ingreso/i }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: /resumen del ingreso/i })).getAllByText(
        /30\.000/,
      ),
    ).toHaveLength(2);
  });

  it("creates only after final confirmation and locks duplicate submission", async () => {
    const deferred = createDeferredService();
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} incomeService={deferred.service} />);

    await selectValidServiceEntry(user);
    expect(deferred.calls).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));

    expect(deferred.calls).toEqual([
      {
        employeeId: "employee-lautaro",
        customerId: null,
        serviceId: "service-haircut-eyebrows",
        products: [],
        paymentMethod: "cash",
      },
    ]);
    expect(screen.getByRole("button", { name: /registrando ingreso/i })).toBeDisabled();

    deferred.resolveIncome({
      ...deferred.calls[0],
      id: "income-1",
      total: 16000,
      createdAt: "2026-08-07T12:00:00.000Z",
    });

    expect(
      await screen.findByRole("heading", { name: /ingreso registrado/i }),
    ).toBeVisible();
  });

  it("resets the draft after a successful entry", async () => {
    const service: IncomeService = {
      create: async (input) => ({
        ...input,
        id: "income-1",
        total: 16000,
        createdAt: "2026-08-07T12:00:00.000Z",
      }),
    };
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} incomeService={service} />);

    await selectValidServiceEntry(user);
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    await user.click(
      await screen.findByRole("button", { name: /cargar otro ingreso/i }),
    );

    expect(
      screen.getByRole("button", {
        name: /corte de pelo y perfilado de cejas/i,
      }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /efectivo/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("preserves the draft and allows retry after a service error", async () => {
    const service: IncomeService = {
      create: async () => {
        throw new Error("No se pudo registrar el ingreso.");
      },
    };
    const user = userEvent.setup();
    render(<IncomeForm data={ownerData} incomeService={service} />);

    await selectValidServiceEntry(user);
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));

    expect(
      await screen.findByText("No se pudo registrar el ingreso."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /corte de pelo y perfilado de cejas/i,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /revisar ingreso/i })).toBeEnabled();
  });
});
