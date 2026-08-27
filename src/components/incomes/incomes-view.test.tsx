import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncomesView } from "@/components/incomes/incomes-view";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import mock from "@/data/incomes.mock";
import type { IncomeClient } from "@/lib/incomes/client";
import type { EmployeeIncomeListItem, EmployeePaginatedIncomes, IncomeListItem, ManagerPaginatedIncomes } from "@/types/income";

const items = mock.incomes.slice(0, 2).map((item) => ({ ...item, businessDate: item.createdAt.slice(0, 10) })) as IncomeListItem[];
const grossTotal = items.reduce((sum, item) => sum + item.total, 0);
const paymentMethods = mock.paymentMethods;
const data: ManagerPaginatedIncomes = { items, metrics: { grossTotal, commissionTotal: 0, barbershopNet: grossTotal, count: 2, average: 32500, paymentTotals: [{ paymentMethodId: paymentMethods[0].id, name: paymentMethods[0].name, amount: 16000 }, { paymentMethodId: paymentMethods[1].id, name: paymentMethods[1].name, amount: 49000 }] }, pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 } };
const currentUser = { id: items[0].employee.id, firstName: "Lautaro", lastName: "Bastardos", role: "owner" as const };
const initialQuery = { dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 1, pageSize: 10 };
const client = (): Pick<IncomeClient, "listAs" | "list" | "void"> => ({
  listAs: vi.fn().mockResolvedValue(data),
  list: vi.fn().mockResolvedValue(data),
  void: vi.fn(async (id) => ({ ...items.find((item) => item.id === id)!, status: "voided" as const })),
});

describe("IncomesView (manager)", () => {
  it("uses server-filtered results and lets managers filter registering users", async () => {
    const user = userEvent.setup(); const incomeClient = client();
    render(<IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={items.map(({ employee }) => employee)} paymentMethods={paymentMethods} canViewAll canVoid incomeClient={incomeClient} />);
    expect(screen.getByText("2 movimientos")).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado/i }), items[1].employee.id);
    await waitFor(() => expect(incomeClient.listAs).toHaveBeenCalledWith("owner", expect.objectContaining({ userId: items[1].employee.id, page: 1 })));
  });

  it("voids once after confirmation and refetches metrics", async () => {
    const user = userEvent.setup(); const incomeClient = client();
    render(<><IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll canVoid incomeClient={incomeClient} /><DashboardToaster /></>);
    await user.click(screen.getAllByRole("button", { name: /abrir ingreso/i })[0]);
    await user.click(screen.getByRole("button", { name: /anular venta/i }));
    await user.click(screen.getByRole("button", { name: /^anular venta$/i }));
    await waitFor(() => expect(incomeClient.void).toHaveBeenCalledOnce());
    expect(incomeClient.listAs).toHaveBeenCalled();
    expect(await screen.findByText("Venta anulada correctamente.")).toBeVisible();
  });

  it("keeps detail and exposes retry when voiding fails", async () => {
    const user = userEvent.setup(); const incomeClient = client(); vi.mocked(incomeClient.void).mockRejectedValue(new Error("No se pudo anular."));
    render(<IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll canVoid incomeClient={incomeClient} />);
    await user.click(screen.getAllByRole("button", { name: /abrir ingreso/i })[0]); await user.click(screen.getByRole("button", { name: /anular venta/i })); await user.click(screen.getByRole("button", { name: /^anular venta$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo anular.");
    expect(screen.getByRole("dialog", { name: /anular venta/i })).toBeVisible();
  });

  it("exposes payment-method administration only to managers", () => {
    render(<IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll canVoid incomeClient={client()} />);
    expect(screen.getByRole("button", { name: /administrar medios de pago/i })).toBeVisible();
  });

  it("uses one server paginator for the income table", async () => {
    const user = userEvent.setup();
    const secondPage = {
      ...data,
      pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2 },
    };
    const firstPage = {
      ...data,
      pagination: { page: 1, pageSize: 10, total: 12, totalPages: 2 },
    };
    const incomeClient = client();
    vi.mocked(incomeClient.listAs).mockResolvedValueOnce(secondPage);

    render(
      <IncomesView
        data={firstPage}
        initialQuery={initialQuery}
        currentUser={currentUser}
        employees={[currentUser]}
        paymentMethods={paymentMethods}
        canViewAll
        canVoid
        incomeClient={incomeClient}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Anterior" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Siguiente" })).toHaveLength(1);
    expect(screen.getAllByText("Página 1 de 2")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() =>
      expect(incomeClient.listAs).toHaveBeenCalledWith(
        "owner",
        expect.objectContaining({ page: 2, pageSize: 10 }),
      ),
    );
    expect(await screen.findByText("Página 2 de 2")).toBeVisible();
  });
});

const employeeIncomeItems: EmployeeIncomeListItem[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-23T15:00:00.000Z",
    businessDate: "2026-08-23",
    customer: { id: "30000000-0000-4000-8000-000000000099", firstName: "Cliente", lastName: "Fiel" },
    concepts: [
      { id: "10000000-0000-4000-8000-000000000001", type: "service", name: "Corte", quantity: 1, earning: 5000 },
      { id: "10000000-0000-4000-8000-000000000002", type: "product", name: "Cera", quantity: 2, earning: 2000 },
    ],
    employeeCommission: 7000,
    status: "active",
  },
];
const employeeData: EmployeePaginatedIncomes = {
  items: employeeIncomeItems,
  metrics: { count: 1, employeeCommissionTotal: 7000 },
  pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
};

describe("IncomesView (employee)", () => {
  it("hides the manager-only filters and renders the sanitized employee view", () => {
    render(<IncomesView data={employeeData} initialQuery={initialQuery} currentUser={{ ...currentUser, role: "employee" }} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll={false} canVoid={false} incomeClient={client()} />);
    expect(screen.getByRole("heading", { name: "Tus ventas registradas" })).toBeVisible();
    expect(screen.getAllByText("Corte + 2 productos").length).toBeGreaterThan(0);
    expect(screen.getByText("Tu ingreso")).toBeVisible();
    expect(screen.getAllByText("$ 7.000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Facturación bruta")).not.toBeInTheDocument();
    expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /empleado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /administrar medios de pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /anular venta/i })).not.toBeInTheDocument();
  });

  it("never leaks manager-only financial keys through the employee detail sheet", async () => {
    const user = userEvent.setup();
    render(<IncomesView data={employeeData} initialQuery={initialQuery} currentUser={{ ...currentUser, role: "employee" }} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll={false} canVoid={false} incomeClient={client()} />);
    await user.click(screen.getAllByRole("button", { name: /abrir ingreso/i })[0]);
    const detailText = (screen.getByRole("dialog").textContent ?? "").replace(/\s+/g, " ");
    expect(detailText).toContain("Tu ganancia");
    expect(detailText).toContain("7.000");
    FORBIDDEN_DETAIL_KEYS.forEach((phrase) => expect(detailText.toLowerCase()).not.toContain(phrase.toLowerCase()));
  });
});

const FORBIDDEN_DETAIL_KEYS = [
  "barbershopnet",
  "registrado por",
  "monto en efectivo",
  "combinado (",
  "precio de catálogo",
  "total de la venta",
];

describe("IncomesView (employee) forbidden filter", () => {
  it("does not expose the user filter or void action to employees", () => {
    render(<IncomesView data={employeeData} initialQuery={initialQuery} currentUser={{ ...currentUser, role: "employee" }} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll={false} canVoid={false} incomeClient={client()} />);
    expect(screen.queryByRole("combobox", { name: /empleado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /administrar medios de pago/i })).not.toBeInTheDocument();
  });
});
