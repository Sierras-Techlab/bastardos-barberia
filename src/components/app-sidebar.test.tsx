import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const { replace, refresh, pathname } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  pathname: { value: "/" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ replace, refresh }),
}));

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./app-sidebar";

const employee = {
  id: "00000000-0000-4000-8000-000000000003",
  firstName: "Fernanda",
  lastName: "P\u00e9rez",
  username: "fernanda.perez",
  role: { id: 3 as const, name: "employee" as const },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

const owner = {
  ...employee,
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1 as const, name: "owner" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  pathname.value = "/";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

it("uses the session identity and hides owner navigation from employees", () => {
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={employee} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  expect(screen.getByText("Fernanda P\u00e9rez")).toBeVisible();
  expect(screen.getByText("Empleado")).toBeVisible();
  expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Caja" })).not.toBeInTheDocument();
});

it("closes the database session and returns to login", async () => {
  const browser = userEvent.setup();
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={employee} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  await browser.click(screen.getByRole("button", { name: /cerrar sesi/i }));

  expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  expect(replace).toHaveBeenCalledWith("/login");
  expect(refresh).toHaveBeenCalledOnce();
});

it("links managers to the active user administration page", () => {
  pathname.value = "/users";
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={owner} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  const link = screen.getByRole("link", { name: "Usuarios" });
  expect(link).toHaveAttribute("href", "/users");
  expect(link).toHaveAttribute("data-active");
});

it("links only managers to the active cash workspace", () => {
  pathname.value = "/cash";
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={owner} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  const link = screen.getByRole("link", { name: "Caja" });
  expect(link).toHaveAttribute("href", "/cash");
  expect(link).toHaveAttribute("data-active");
});

it("keeps payment-method administration contextual to incomes", () => {
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={owner} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  expect(screen.queryByText("Medios de pago")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute(
    "href",
    "/incomes",
  );
});

it("keeps incomes active on nested income routes", () => {
  pathname.value = "/incomes/new";
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={owner} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute(
    "data-active",
  );
  expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute(
    "data-active",
  );
});

it("links to the active product catalog", () => {
  pathname.value = "/products";
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={employee} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  const link = screen.getByRole("link", { name: "Productos" });
  expect(link).toHaveAttribute("href", "/products");
  expect(link).toHaveAttribute("data-active");
});

it("links every authenticated role to customers", () => {
  pathname.value = "/customers";
  render(
    <TooltipProvider><SidebarProvider><AppSidebar user={employee} /></SidebarProvider></TooltipProvider>,
  );
  const link = screen.getByRole("link", { name: "Clientes" });
  expect(link).toHaveAttribute("href", "/customers");
  expect(link).toHaveAttribute("data-active");
});

it("links every authenticated role to services", () => {
  pathname.value = "/services";
  render(
    <TooltipProvider><SidebarProvider><AppSidebar user={employee} /></SidebarProvider></TooltipProvider>,
  );
  const link = screen.getByRole("link", { name: "Servicios" });
  expect(link).toHaveAttribute("href", "/services");
  expect(link).toHaveAttribute("data-active");
});
