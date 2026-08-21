"use client";

import { Clock3, LogIn, LogOut, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  workSessionClient as defaultWorkSessionClient,
  type WorkSessionClient,
} from "@/lib/work-sessions/client";
import type { EmployeeWorkSession } from "@/types/work-session";

type WorkSessionControlProps = {
  initialSession: EmployeeWorkSession | null;
  workSessionClient?: Pick<WorkSessionClient, "start" | "end">;
};

const formatElapsed = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
};

const elapsedSince = (startedAt: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000));

const WorkSessionControlState = ({
  initialSession,
  workSessionClient,
}: Required<WorkSessionControlProps>) => {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [session]);

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (session) {
        await workSessionClient.end();
        setSession(null);
        toast.success("Salida registrada correctamente.");
        router.refresh();
      } else {
        const started = await workSessionClient.start();
        setSession(started);
        setNow(Date.now());
        toast.success("Entrada registrada correctamente.");
        router.refresh();
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar la jornada.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      aria-label="Control de jornada"
      className="fixed bottom-20 left-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-[1.4rem] border border-black/8 bg-[#202023] p-3 text-white shadow-2xl shadow-black/20 md:left-[calc(var(--sidebar-width)+1rem)] xl:bottom-6 xl:left-[calc(var(--sidebar-width)+1.5rem)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-red-300">
          <Clock3 className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/55">Control de jornada</p>
          <p className="truncate text-sm font-semibold">
            {session ? "Jornada en curso" : "Sin jornada abierta"}
          </p>
          {session && (
            <p aria-live="polite" className="mt-0.5 text-xs text-white/65">
              {formatElapsed(elapsedSince(session.startedAt, now))}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={session ? "outline" : "default"}
          className={
            session
              ? "h-9 rounded-xl border-white/15 bg-white/8 px-3 text-white hover:bg-white/15 hover:text-white"
              : "h-9 rounded-xl px-3"
          }
          disabled={saving}
          onClick={() => void toggle()}
        >
          {session ? <LogOut /> : <LogIn />}
          {saving
            ? "Guardando..."
            : session
              ? "Marcar salida"
              : "Marcar entrada"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-100">
          <TriangleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </aside>
  );
};

export const WorkSessionControl = ({
  initialSession,
  workSessionClient = defaultWorkSessionClient,
}: WorkSessionControlProps) => {
  const serverSessionKey = initialSession
    ? [
        initialSession.id,
        initialSession.state,
        initialSession.startedAt,
        initialSession.endedAt ?? "open",
      ].join(":")
    : "none";

  return (
    <WorkSessionControlState
      key={serverSessionKey}
      initialSession={initialSession}
      workSessionClient={workSessionClient}
    />
  );
};
