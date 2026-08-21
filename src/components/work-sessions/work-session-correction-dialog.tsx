"use client";

import { Clock3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  workSessionClient as defaultWorkSessionClient,
  type WorkSessionClient,
} from "@/lib/work-sessions/client";
import type { ManagerWorkSession } from "@/types/work-session";

type WorkSessionCorrectionDialogProps = {
  session: ManagerWorkSession;
  onClose: () => void;
  onSaved: (session: ManagerWorkSession) => void | Promise<void>;
  workSessionClient?: Pick<WorkSessionClient, "correct">;
};

const toBuenosAiresInput = (timestamp: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(timestamp))
    .replace(" ", "T");

const fromBuenosAiresInput = (value: string) =>
  new Date(`${value}:00-03:00`).toISOString();

export const WorkSessionCorrectionDialog = ({
  session,
  onClose,
  onSaved,
  workSessionClient = defaultWorkSessionClient,
}: WorkSessionCorrectionDialogProps) => {
  const [startedAt, setStartedAt] = useState(() =>
    toBuenosAiresInput(session.startedAt),
  );
  const [startedAtDirty, setStartedAtDirty] = useState(false);
  const [endedAt, setEndedAt] = useState(() =>
    session.endedAt ? toBuenosAiresInput(session.endedAt) : "",
  );
  const [endedAtDirty, setEndedAtDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Indicá el motivo de la corrección.");
      return;
    }
    if (!startedAt) {
      setError("Indicá el horario de entrada corregido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const corrected = await workSessionClient.correct(session.id, {
        startedAt: startedAtDirty
          ? fromBuenosAiresInput(startedAt)
          : session.startedAt,
        endedAt: endedAtDirty
          ? endedAt
            ? fromBuenosAiresInput(endedAt)
            : null
          : session.endedAt,
        reason: reason.trim(),
      });
      await onSaved(corrected);
      toast.success("Jornada corregida correctamente.");
      onClose();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo corregir la jornada.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const employeeName = `${session.employee.firstName} ${session.employee.lastName}`;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary">
            <Clock3 className="size-5" />
          </span>
          <DialogTitle>Corregir jornada</DialogTitle>
          <DialogDescription>
            Ajustá los horarios de {employeeName}. El motivo quedará guardado en el historial de auditoría.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Entrada corregida
              <Input
                type="datetime-local"
                value={startedAt}
                onChange={(event) => {
                  setStartedAt(event.target.value);
                  setStartedAtDirty(true);
                }}
                className="h-10 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white"
                required
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Salida corregida
              <Input
                type="datetime-local"
                value={endedAt}
                onChange={(event) => {
                  setEndedAt(event.target.value);
                  setEndedAtDirty(true);
                }}
                className="h-10 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white"
              />
            </label>
          </div>
          <label className="mt-4 block space-y-1.5 text-sm font-medium">
            Motivo de la corrección
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-24 w-full resize-y rounded-xl border border-black/10 bg-[#f7f6f3] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-white focus:ring-3 focus:ring-ring/50"
              placeholder="Ej.: el empleado informó un olvido al marcar la entrada"
              required
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
            <Button type="button" variant="outline" className="rounded-xl" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-xl" disabled={saving}>
              {saving ? "Guardando..." : "Guardar corrección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
