"use client";

import { UserRoundPlus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { validateUniqueCustomerContact } from "@/lib/customers/customer-catalog";
import { formatFixedSchedule } from "@/lib/customers/fixed-customers";
import { fixedScheduleSchema, frontendCustomerEditorSchema, type FrontendCustomerEditorInput } from "@/lib/customers/frontend-customer-contracts";
import type { Customer } from "@/types/customer";
import type { FixedScheduleInput, IsoWeekday } from "@/types/fixed-customer";

export type CustomerEditorProfessional = { id: string; firstName: string; lastName: string; isActive: boolean };
export type CustomerEditorDialogProps = {
  mode: "create" | "edit";
  customer: Customer | null;
  customers: Customer[];
  currentUserRole: "owner" | "admin" | "employee";
  availableProfessionals?: CustomerEditorProfessional[];
  onClose(): void;
  onSave(input: FrontendCustomerEditorInput): Promise<Customer>;
};
const fieldClassName = "h-11 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";
const weekdayOptions: { value: IsoWeekday; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export const CustomerEditorDialog = ({ mode, customer, customers, currentUserRole, availableProfessionals = [], onClose, onSave }: CustomerEditorDialogProps) => {
  const isManager = currentUserRole === "owner" || currentUserRole === "admin";
  const activeProfessionals = availableProfessionals.filter((professional) => professional.isActive);
  const initialProfessionalId = customer?.fixedSchedule?.responsibleProfessional.id
    ?? (isManager ? "" : "self");
  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [hasFixedSchedule, setHasFixedSchedule] = useState(Boolean(customer?.fixedSchedule));
  const [weekday, setWeekday] = useState<IsoWeekday>(customer?.fixedSchedule?.weekday ?? 1);
  const [time, setTime] = useState(customer?.fixedSchedule?.time ?? "");
  const [monthlyPrice, setMonthlyPrice] = useState<string>(customer?.fixedSchedule ? String(customer.fixedSchedule.monthlyPrice) : "");
  const [professionalId, setProfessionalId] = useState<string>(initialProfessionalId);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (savingRef.current) return;
    const parsedSchedule: FixedScheduleInput | null = hasFixedSchedule ? {
      weekday,
      time,
      responsibleUserId: isManager && professionalId ? professionalId : undefined,
      monthlyPrice: Math.max(0, Math.round(Number(monthlyPrice || "0"))),
    } : null;
    const parsed = frontendCustomerEditorSchema.safeParse({
      firstName,
      lastName,
      email,
      phone,
      fixedSchedule: parsedSchedule,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.");
      return;
    }
    const duplicate = validateUniqueCustomerContact(parsed.data, customers, customer?.id);
    if (duplicate) {
      setError(duplicate);
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el cliente.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const schedulePreview = fixedScheduleSchema.partial({ responsibleProfessional: true, monthlyPrice: true }).safeParse({ weekday, time });
  return <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
    <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-lg">
      <form noValidate onSubmit={submit}>
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><UserRoundPlus className="size-5" /></span>
          <DialogTitle>{mode === "create" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle>
          <DialogDescription>El teléfono es obligatorio y único. El email es opcional.</DialogDescription>
        </DialogHeader>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">Nombre<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={fieldClassName} /></label>
          <label className="space-y-1.5 text-sm font-medium">Apellido<Input value={lastName} onChange={(event) => setLastName(event.target.value)} className={fieldClassName} /></label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Email (opcional)<Input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClassName} /></label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Teléfono<Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClassName} /></label>
        </div>
        <section className="mt-4 rounded-2xl border border-black/8 bg-[#f7f6f3] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={hasFixedSchedule} onChange={(event) => setHasFixedSchedule(event.target.checked)} className="mt-0.5 size-4 accent-red-600" />
            <span><span className="block text-sm font-semibold">¿Es cliente habitual?</span><span className="mt-0.5 block text-xs text-muted-foreground">Podés asignarle un día, horario, profesional responsable y un precio mensual.</span></span>
          </label>
          {hasFixedSchedule && <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">Día fijo<select aria-label="Día fijo" value={weekday} onChange={(event) => setWeekday(Number(event.target.value) as IsoWeekday)} className={`${fieldClassName} w-full px-3 text-sm`}>{weekdayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium">Hora fija<Input aria-label="Hora fija" type="time" value={time} onChange={(event) => setTime(event.target.value)} className={fieldClassName} /></label>
            {isManager ? <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Profesional responsable<select aria-label="Profesional responsable" value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} className={`${fieldClassName} w-full px-3 text-sm`}><option value="">Sin asignar</option>{activeProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>)}</select></label> : <p className="text-xs text-muted-foreground sm:col-span-2">El profesional responsable se asigna a vos automáticamente.</p>}
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Precio mensual (ARS)<Input aria-label="Precio mensual" type="number" inputMode="numeric" min="0" step="1" value={monthlyPrice} onChange={(event) => setMonthlyPrice(event.target.value)} className={fieldClassName} /></label>
            {schedulePreview.success && <p className="rounded-xl bg-white px-3 py-2 text-sm font-medium sm:col-span-2">{formatFixedSchedule(schedulePreview.data as { weekday: IsoWeekday; time: string })}</p>}
          </div>}
        </section>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl">Cancelar</Button><Button type="submit" disabled={isSaving} className="rounded-xl">{isSaving ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
};
