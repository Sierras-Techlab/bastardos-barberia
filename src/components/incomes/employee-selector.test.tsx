import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EmployeeSelector } from "./employee-selector";

const currentUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Lautaro", lastName: "Bastardos", role: "owner" as const };
const employees = [{ ...currentUser, isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 }, { id: "00000000-0000-4000-8000-000000000002", firstName: "Fer", lastName: "Pérez", role: "employee" as const, isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 }, { id: "00000000-0000-4000-8000-000000000003", firstName: "Inactivo", lastName: "Test", role: "employee" as const, isActive: false, serviceCommissionRate: 45, productCommissionRate: 10 }];

it("lets managers choose only active users", async () => { const onChange = vi.fn(); const user = userEvent.setup(); render(<EmployeeSelector currentUser={currentUser} employees={employees} value={currentUser.id} onChange={onChange} />); expect(screen.queryByText(/inactivo test/i)).not.toBeInTheDocument(); await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), employees[1].id); expect(onChange).toHaveBeenCalledWith(employees[1].id); });
it("locks employees to their own identity", () => { render(<EmployeeSelector currentUser={{ ...currentUser, role: "employee" }} employees={employees} value={currentUser.id} onChange={vi.fn()} />); expect(screen.queryByRole("combobox")).not.toBeInTheDocument(); expect(screen.getByText(/automáticamente a tu usuario/i)).toBeVisible(); });
