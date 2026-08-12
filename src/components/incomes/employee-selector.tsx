import { LockKeyhole, UserRound } from "lucide-react";

import type { CurrentUser, IncomeFormEmployee } from "@/types/income";

type Props = { currentUser: CurrentUser; employees: IncomeFormEmployee[]; value: string; onChange: (id: string) => void; error?: string };

export const EmployeeSelector = ({ currentUser, employees, value, onChange, error }: Props) => {
  const eligible = employees.filter((employee) => employee.isActive);
  const current = eligible.find((employee) => employee.id === currentUser.id) ?? { ...currentUser };
  if (currentUser.role === "employee") return (
    <div className="space-y-2">
      <div className="flex h-11 items-center gap-2 rounded-xl bg-[#f6f5f2] px-3 text-sm"><UserRound className="size-4 text-primary" />{current.firstName} {current.lastName}<LockKeyhole className="ml-auto size-4 text-muted-foreground" /></div>
      <p className="text-xs text-muted-foreground">La venta se asignará automáticamente a tu usuario.</p>
    </div>
  );
  return (
    <div className="space-y-2">
      <select aria-label="Empleado responsable" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10">
        {eligible.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
      </select>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
};
