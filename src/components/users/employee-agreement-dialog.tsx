"use client";

import { CalendarDays, ChevronDown, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatChairRentalPeriod } from "@/lib/chair-rentals/presentation";
import type { EmployeeCommercialAgreement } from "@/types/chair-rental";

type Props = { employeeName: string; agreement: EmployeeCommercialAgreement | null; open: boolean; editable: boolean; pending?: boolean; agreementLoading?: boolean; error?: string | null; onClose: () => void; onRetry?: () => void; onSave: (value: EmployeeCommercialAgreement) => Promise<void> };
const empty: EmployeeCommercialAgreement = { serviceCommissionEnabled: true, productCommissionEnabled: true, chairRentalEnabled: false, monthlyChairRentalAmount: null, chairRentalEffectiveFrom: null, chairRentalDueDay: null };

const MAX_RECURRING_DUE_DAY = 28;
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2020, index, 1))),
);

const daysInPeriod = (period: string) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return 0;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
};

type FloatingCalendarProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  ariaLabel: string;
  className: string;
  children: ReactNode;
};

const FloatingCalendar = ({ open, anchorRef, ariaLabel, className, children }: FloatingCalendarProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    opacity: 0,
    zIndex: 100,
  });
  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gutter = 12;
    const below = anchorRect.bottom + 8;
    const top = below + panelRect.height <= window.innerHeight - gutter
      ? below
      : Math.max(gutter, anchorRect.top - panelRect.height - 8);
    const left = Math.min(
      Math.max(gutter, anchorRect.left),
      Math.max(gutter, window.innerWidth - panelRect.width - gutter),
    );
    setStyle({ position: "fixed", top, left, opacity: 1, zIndex: 100 });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={panelRef} role="dialog" aria-label={ariaLabel} style={style} className={className}>
      {children}
    </div>,
    document.body,
  );
};

export const EmployeeAgreementDialog = ({ employeeName, agreement, open, editable, pending = false, agreementLoading = false, error, onClose, onRetry, onSave }: Props) => {
  const [value, setValue] = useState<EmployeeCommercialAgreement>(agreement ?? empty);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = useRef(false);
  const existingRentalChanged = Boolean(
    agreement?.chairRentalEnabled && (
      !value.chairRentalEnabled
      || agreement.monthlyChairRentalAmount !== value.monthlyChairRentalAmount
      || agreement.chairRentalEffectiveFrom !== value.chairRentalEffectiveFrom
      || agreement.chairRentalDueDay !== value.chairRentalDueDay
    ),
  );
  const selectedPeriod = value.chairRentalEffectiveFrom;
  const selectedYear = Number(selectedPeriod?.slice(0, 4));
  const currentYear = new Date().getFullYear();
  const calendarYear = Number.isInteger(selectedYear) && selectedYear > 0 ? selectedYear : currentYear;
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(calendarYear);
  const monthSelectorRef = useRef<HTMLButtonElement>(null);
  const daySelectorRef = useRef<HTMLButtonElement>(null);
  const firstYear = Math.min(currentYear - 5, monthPickerYear);
  const lastYear = Math.max(currentYear + 5, monthPickerYear);
  const selectableDays = selectedPeriod ? Math.min(daysInPeriod(selectedPeriod), MAX_RECURRING_DUE_DAY) : 0;
  const set = <K extends keyof EmployeeCommercialAgreement>(key: K, next: EmployeeCommercialAgreement[K]) => setValue((current) => ({ ...current, [key]: next }));
  const chooseMonth = (month: number) => {
    const nextPeriod = `${monthPickerYear}-${String(month).padStart(2, "0")}`;
    set("chairRentalEffectiveFrom", nextPeriod);
    if (value.chairRentalDueDay && value.chairRentalDueDay > Math.min(daysInPeriod(nextPeriod), MAX_RECURRING_DUE_DAY)) {
      set("chairRentalDueDay", Math.min(daysInPeriod(nextPeriod), MAX_RECURRING_DUE_DAY));
    }
    setMonthPickerOpen(false);
    setDayPickerOpen(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || pending) return;
    if (value.chairRentalEnabled && (!Number.isSafeInteger(value.monthlyChairRentalAmount) || (value.monthlyChairRentalAmount ?? 0) <= 0 || !value.chairRentalEffectiveFrom || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.chairRentalEffectiveFrom) || !Number.isInteger(value.chairRentalDueDay) || (value.chairRentalDueDay ?? 0) < 1 || (value.chairRentalDueDay ?? 0) > 28)) { setLocalError("Completá un importe entero positivo, un mes de inicio y un día de vencimiento entre 1 y 28."); return; }
    const normalized = value.chairRentalEnabled ? value : { ...value, monthlyChairRentalAmount: null, chairRentalEffectiveFrom: null, chairRentalDueDay: null };
    setLocalError(null); submitting.current = true; try { await onSave(normalized); } finally { submitting.current = false; }
  };
  return <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
    <DialogContent className="max-h-[calc(100svh-2rem)] min-w-0 scroll-py-6 overflow-x-hidden overflow-y-auto scroll-smooth rounded-[1.6rem] p-5 sm:max-w-lg">
      <form onSubmit={submit}>
        <DialogHeader><span className="flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><SlidersHorizontal className="size-5" /></span><DialogTitle>Acuerdo comercial</DialogTitle><DialogDescription>{employeeName}. Las tasas se administran desde los datos del usuario.</DialogDescription></DialogHeader>
        {agreementLoading || !agreement ? <div className="mt-5 grid gap-4">
          {agreementLoading ? <p role="status" className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" />Cargando acuerdo…</p> : <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">{error ?? "No pudimos cargar el acuerdo."}</p>}
          <DialogFooter className="-mx-5 -mb-5 mt-1 p-5">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose} className="rounded-xl">Cerrar</Button>
            {!agreementLoading && onRetry && <Button type="button" disabled={pending} onClick={onRetry} className="rounded-xl">Reintentar acuerdo</Button>}
          </DialogFooter>
        </div> : <>
        <div className="mt-5 grid gap-3">
          <label className="flex items-center justify-between rounded-xl bg-[#f7f6f3] p-3 text-sm">Comisión de servicios<input aria-label="Comisión de servicios habilitada" type="checkbox" checked={value.serviceCommissionEnabled} disabled={!editable || pending} onChange={(e) => set("serviceCommissionEnabled", e.target.checked)} /></label>
          <label className="flex items-center justify-between rounded-xl bg-[#f7f6f3] p-3 text-sm">Comisión de productos<input aria-label="Comisión de productos habilitada" type="checkbox" checked={value.productCommissionEnabled} disabled={!editable || pending} onChange={(e) => set("productCommissionEnabled", e.target.checked)} /></label>
          <p className="px-1 text-xs leading-5 text-zinc-500">Al desactivar una comisión, la tasa configurada se conserva para una futura reactivación, pero no se aplica a ventas nuevas.</p>
          <label className="flex items-center justify-between rounded-xl bg-[#f7f6f3] p-3 text-sm">Alquiler de silla<input aria-label="Alquiler de silla habilitado" type="checkbox" checked={value.chairRentalEnabled} disabled={!editable || pending} onChange={(e) => set("chairRentalEnabled", e.target.checked)} /></label>
          {value.chairRentalEnabled && <div className="grid min-w-0 gap-3 rounded-2xl border border-black/5 p-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm sm:col-span-3">Importe mensual<input aria-label="Importe mensual" type="number" min="1" step="1" required disabled={!editable || pending} value={value.monthlyChairRentalAmount ?? ""} onChange={(e) => set("monthlyChairRentalAmount", e.target.value ? Number(e.target.value) : null)} className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-[#f7f6f3] px-3" /></label>
            <div className="min-w-0 space-y-1 text-sm sm:col-span-2">
              <span className="block">Mes de inicio</span>
              <div>
                <Button ref={monthSelectorRef} type="button" variant="outline" disabled={!editable || pending} aria-haspopup="dialog" aria-expanded={monthPickerOpen} aria-label="Seleccionar mes de inicio" onClick={() => { setMonthPickerOpen((current) => !current); setDayPickerOpen(false); }} className="h-11 w-full justify-between rounded-xl border-black/10 bg-[#f7f6f3] px-3 font-normal">
                  <span className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />{selectedPeriod ? formatChairRentalPeriod(selectedPeriod) : "Elegí un mes"}</span>
                  <ChevronDown className="size-4 text-zinc-500" />
                </Button>
                <FloatingCalendar open={monthPickerOpen} anchorRef={monthSelectorRef} ariaLabel="Seleccionar mes de inicio" className="max-h-[calc(100svh-1.5rem)] w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-black/10 bg-white p-3 shadow-2xl">
                  <label className="block text-xs font-semibold text-zinc-500">Año<select aria-label="Año del mes de inicio" value={monthPickerYear} onChange={(e) => setMonthPickerYear(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-[#f7f6f3] px-3 text-sm font-normal text-zinc-900">
                    {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map((year) => <option key={year} value={year}>{year}</option>)}
                  </select></label>
                  <div className="mt-3 grid grid-cols-3 gap-2">{monthNames.map((monthName, index) => { const month = index + 1; const monthValue = String(month).padStart(2, "0"); const active = selectedPeriod === `${monthPickerYear}-${monthValue}`; return <Button key={monthValue} type="button" variant={active ? "default" : "outline"} aria-pressed={active} onClick={() => chooseMonth(month)} className="h-10 rounded-xl px-2 text-xs capitalize">{monthName}</Button>; })}</div>
                </FloatingCalendar>
              </div>
              <span className="block text-xs leading-5 text-zinc-500">{selectedPeriod ? `Se generará desde ${formatChairRentalPeriod(selectedPeriod)}.` : "Elegí el mes desde el que empieza el acuerdo."}</span>
            </div>
            <div className="min-w-0 space-y-1 text-sm">
              <span className="block">Vence el día</span>
              <div>
                <Button ref={daySelectorRef} type="button" variant="outline" disabled={!editable || pending || !selectedPeriod} aria-haspopup="dialog" aria-expanded={dayPickerOpen} aria-label="Seleccionar día de vencimiento" onClick={() => { setDayPickerOpen((current) => !current); setMonthPickerOpen(false); }} className="h-11 w-full justify-between rounded-xl border-black/10 bg-[#f7f6f3] px-3 font-normal">
                  <span>{value.chairRentalDueDay ? `Día ${value.chairRentalDueDay}` : "Elegí un día"}</span><ChevronDown className="size-4 text-zinc-500" />
                </Button>
                <FloatingCalendar open={dayPickerOpen && Boolean(selectedPeriod)} anchorRef={daySelectorRef} ariaLabel="Seleccionar día de vencimiento" className="max-h-[calc(100svh-1.5rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-black/10 bg-white p-3 shadow-2xl">
                  <p className="text-xs font-semibold text-zinc-500">Día de {selectedPeriod ? formatChairRentalPeriod(selectedPeriod) : ""}</p>
                  <div className="mt-3 grid grid-cols-4 gap-2">{Array.from({ length: selectableDays }, (_, index) => index + 1).map((day) => <Button key={day} type="button" variant={value.chairRentalDueDay === day ? "default" : "outline"} aria-pressed={value.chairRentalDueDay === day} aria-label={`Día ${day}`} onClick={() => { set("chairRentalDueDay", day); setDayPickerOpen(false); }} className="h-9 rounded-lg px-0 text-xs">{day}</Button>)}</div>
                </FloatingCalendar>
              </div>
            </div>
            <p className="text-xs leading-5 text-zinc-500 sm:col-span-3">El vencimiento se aplica todos los meses. Elegí un día del 1 al 28 para que siempre exista.</p>
          </div>}
          {existingRentalChanged && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Los períodos y pagos ya registrados se conservan sin cambios. Esta configuración se aplica a las obligaciones nuevas.</p>}
        </div>
        {(localError || error) && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{localError ?? error}</p>}
        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" disabled={pending} onClick={onClose} className="rounded-xl">Cerrar</Button>{editable && <Button type="submit" disabled={pending} className="rounded-xl">{pending && <LoaderCircle className="animate-spin" />}Guardar acuerdo</Button>}</DialogFooter>
        </>}
      </form>
    </DialogContent>
  </Dialog>;
};
