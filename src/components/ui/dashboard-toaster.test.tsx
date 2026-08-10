import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { expect, it } from "vitest";

import { DashboardToaster } from "@/components/ui/dashboard-toaster";

it("renders accessible dismissible dashboard success notifications", async () => {
  const user = userEvent.setup();
  render(<DashboardToaster />);

  toast.success("Servicio añadido correctamente.");

  expect(
    await screen.findByText("Servicio añadido correctamente."),
  ).toBeVisible();
  expect(screen.getByLabelText(/^Notificaciones/)).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Cerrar notificación" }));
  await waitFor(() =>
    expect(
      screen.queryByText("Servicio añadido correctamente."),
    ).not.toBeInTheDocument(),
  );
});
