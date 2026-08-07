import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./app-sidebar";

it("uses the session identity and hides owner navigation from employees", () => {
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          user={{
            id: "employee-fer",
            firstName: "Fernanda",
            lastName: "Pérez",
            role: "employee",
          }}
        />
      </SidebarProvider>
    </TooltipProvider>,
  );

  expect(screen.getByText("Fernanda")).toBeVisible();
  expect(screen.getByText("Empleado")).toBeVisible();
  expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Caja" })).not.toBeInTheDocument();
});
