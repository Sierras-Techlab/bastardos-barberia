import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { IncomesView } from "@/components/incomes/incomes-view";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import mock from "@/data/incomes.mock";
import type { IncomeClient } from "@/lib/incomes/client";
import type { IncomeListItem, PaginatedIncomes } from "@/types/income";

const items = mock.incomes.slice(0, 2).map((item) => ({ ...item, businessDate: item.createdAt.slice(0, 10) })) as IncomeListItem[];
const grossTotal = items.reduce((sum, item) => sum + item.total, 0);
const paymentMethods = mock.paymentMethods;
const data: PaginatedIncomes = { items, metrics: { grossTotal, commissionTotal: 0, barbershopNet: grossTotal, count: 2, average: 32500, paymentTotals: [{ paymentMethodId: paymentMethods[0].id, name: paymentMethods[0].name, amount: 16000 }, { paymentMethodId: paymentMethods[1].id, name: paymentMethods[1].name, amount: 49000 }] }, pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 } };
const currentUser = { id: items[0].employee.id, firstName: "Lautaro", lastName: "Bastardos", role: "owner" as const };
const initialQuery = { dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 1, pageSize: 10 };
const client = (): Pick<IncomeClient, "list" | "void"> => ({ list: vi.fn().mockResolvedValue(data), void: vi.fn(async (id) => ({ ...items.find((item) => item.id === id)!, status: "voided" as const })) });

it("uses server-filtered results and lets managers filter registering users", async () => {
  const user = userEvent.setup(); const incomeClient = client();
  render(<IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={items.map(({ employee }) => employee)} paymentMethods={paymentMethods} canViewAll canVoid incomeClient={incomeClient} />);
  expect(screen.getByText("2 movimientos")).toBeVisible();
  await user.selectOptions(screen.getByRole("combobox", { name: /empleado/i }), items[1].employee.id);
  await waitFor(() => expect(incomeClient.list).toHaveBeenCalledWith(expect.objectContaining({ userId: items[1].employee.id, page: 1 })));
});

it("does not expose the user filter or void action to employees", async () => {
  const user = userEvent.setup();
  render(<IncomesView data={data} initialQuery={initialQuery} currentUser={{ ...currentUser, role: "employee" }} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll={false} canVoid={false} incomeClient={client()} />);
  expect(screen.queryByRole("combobox", { name: /empleado/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /administrar medios de pago/i })).not.toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: /abrir ingreso/i })[0]);
  expect(screen.queryByRole("button", { name: /anular venta/i })).not.toBeInTheDocument();
});

it("voids once after confirmation and refetches metrics", async () => {
  const user = userEvent.setup(); const incomeClient = client();
  render(<><IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={[currentUser]} paymentMethods={paymentMethods} canViewAll canVoid incomeClient={incomeClient} /><DashboardToaster /></>);
  await user.click(screen.getAllByRole("button", { name: /abrir ingreso/i })[0]);
  await user.click(screen.getByRole("button", { name: /anular venta/i }));
  await user.click(screen.getByRole("button", { name: /^anular venta$/i }));
  await waitFor(() => expect(incomeClient.void).toHaveBeenCalledOnce());
  expect(incomeClient.list).toHaveBeenCalled();
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
