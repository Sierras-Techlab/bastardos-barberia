import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EmployeeCommercialAgreement } from "@/types/chair-rental";
import { EmployeeAgreementDialog } from "./employee-agreement-dialog";

const agreement: EmployeeCommercialAgreement = {
  serviceCommissionEnabled: true,
  productCommissionEnabled: true,
  chairRentalEnabled: true,
  monthlyChairRentalAmount: 18000,
  chairRentalEffectiveFrom: "2026-10",
  chairRentalDueDay: 10,
};

describe("EmployeeAgreementDialog calendar selectors", () => {
  it("blocks editing and saving while the agreement is loading", () => {
    const onSave = vi.fn(async () => undefined);

    render(
      <EmployeeAgreementDialog
        employeeName="Lucía Ferreyra"
        agreement={null}
        agreementLoading
        open
        editable
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando acuerdo");
    expect(screen.queryByRole("button", { name: "Guardar acuerdo" })).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("offers a retry when loading the agreement fails", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <EmployeeAgreementDialog
        employeeName="Lucía Ferreyra"
        agreement={null}
        open
        editable
        error="No pudimos cargar el acuerdo."
        onClose={vi.fn()}
        onRetry={onRetry}
        onSave={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el acuerdo.");
    await user.click(screen.getByRole("button", { name: "Reintentar acuerdo" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("selects a month and a day without exposing free-form date inputs", async () => {
    const user = userEvent.setup();

    render(
      <EmployeeAgreementDialog
        employeeName="Lucía Ferreyra"
        agreement={agreement}
        open
        editable
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.queryByLabelText("Mes de inicio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Día de vencimiento")).not.toBeInTheDocument();
    expect(screen.getByText(/la tasa configurada se conserva/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Seleccionar mes de inicio" }));
    await user.click(screen.getByRole("button", { name: "noviembre" }));
    expect(screen.getByRole("button", { name: "Seleccionar mes de inicio" })).toHaveTextContent("noviembre de 2026");

    await user.click(screen.getByRole("button", { name: "Seleccionar día de vencimiento" }));
    await user.click(screen.getByRole("button", { name: "Día 15" }));
    expect(screen.getByRole("button", { name: "Seleccionar día de vencimiento" })).toHaveTextContent("Día 15");
    expect(screen.getByText("Vence el día")).toBeVisible();
    expect(screen.getByText(/El vencimiento se aplica todos los meses/)).toHaveClass("sm:col-span-3");
  });
});
