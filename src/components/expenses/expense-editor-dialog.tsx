"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createExpenseSchema, updateExpenseSchema } from "@/lib/expenses/schemas";
import type { CreateExpenseInput, Expense, ExpenseCategory, UpdateExpenseInput } from "@/types/expense";
import type { PaymentMethod } from "@/types/payment-method";

type SharedProps = { categories: ExpenseCategory[]; paymentMethods: PaymentMethod[]; today: string; onClose(): void; onManageCategories(): void };
type Props = SharedProps & (
  | { mode: "create"; onSave(input: CreateExpenseInput): Promise<void> }
  | { mode: "edit"; expense: Expense; onSave(input: UpdateExpenseInput): Promise<void> }
);
export const ExpenseEditorDialog = (props: Props) => {
  const { categories, paymentMethods, today, onClose, onManageCategories } = props;
  const expense = props.mode === "edit" ? props.expense : undefined;
  const availableCategories = categories.filter((item) => item.isActive || item.id === expense?.categoryId);
  const [requestId] = useState(() => crypto.randomUUID());
  const [concept, setConcept] = useState(expense?.concept ?? "");
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? categories.find((item) => item.isActive)?.id ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [accountingDate, setAccountingDate] = useState(expense?.accountingDate ?? today);
  const [paymentMethodId, setPaymentMethodId] = useState(expense?.paymentMethodId ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (props.mode === "create") {
      const parsed = createExpenseSchema.safeParse({ accountingDate, categoryId, amount: Number(amount), concept, notes, paymentMethodId: paymentMethodId || null, requestId });
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados."); return; }
      setPending(true); setError(null);
      try { await props.onSave(parsed.data); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el gasto."); } finally { setPending(false); }
      return;
    }
    const original = props.expense;
    const input: UpdateExpenseInput = { expectedUpdatedAt: original.updatedAt, reason };
    if (accountingDate !== original.accountingDate) input.accountingDate = accountingDate;
    if (categoryId !== original.categoryId) input.categoryId = categoryId;
    if (Number(amount) !== original.amount) input.amount = Number(amount);
    if (concept.trim() !== original.concept) input.concept = concept;
    if ((notes.trim() || null) !== original.notes) input.notes = notes;
    if ((paymentMethodId || null) !== original.paymentMethodId) input.paymentMethodId = paymentMethodId || null;
    const parsed = updateExpenseSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados."); return; }
    setPending(true); setError(null);
    try { await props.onSave(parsed.data); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el gasto."); } finally { setPending(false); }
  };
  const control = "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm";
  return <Dialog open onOpenChange={(open) => !open && !pending && onClose()}><DialogContent className="max-h-[90svh] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-xl"><DialogHeader><DialogTitle>{expense ? "Editar gasto" : "Registrar gasto"}</DialogTitle><DialogDescription>El importe se registra en pesos enteros. El medio de pago es informativo y no modifica Caja.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-medium">Concepto</span><Input value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={200} /></label>
    <div className="space-y-1.5"><label htmlFor="expense-category" className="text-sm font-medium">Categoría</label>{availableCategories.length ? <select id="expense-category" className={control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3"><p className="text-sm text-amber-900">No hay categorías activas.</p><Button type="button" variant="link" className="mt-1 h-auto p-0 text-amber-900" onClick={onManageCategories}>Crear o reactivar una categoría</Button></div>}</div>
    <label className="space-y-1.5"><span className="text-sm font-medium">Importe (ARS)</span><Input aria-label="Importe (ARS)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></label>
    <label className="space-y-1.5"><span className="text-sm font-medium">Fecha contable</span><Input aria-label="Fecha contable" type="date" max={today} value={accountingDate} onChange={(e) => setAccountingDate(e.target.value)} /></label>
    <label className="space-y-1.5"><span className="text-sm font-medium">Medio de pago (opcional)</span><select aria-label="Medio de pago (opcional)" className={control} value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}><option value="">Sin especificar</option>{paymentMethods.filter((item) => item.isActive || item.id === expense?.paymentMethodId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-medium">Notas (opcional)</span><textarea className={`${control} min-h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></label>
    {expense && <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-medium">Motivo de edición</span><textarea aria-label="Motivo de edición" className={`${control} min-h-20 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></label>}
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
    <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending || availableCategories.length === 0}>{pending ? "Guardando..." : expense ? "Guardar cambios" : "Registrar gasto"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
};
