"use client";

import { Clock3, LogIn, LogOut, Minimize2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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

const BUBBLE_SIZE = 56;
const BUBBLE_MARGIN = 16;
const MOBILE_ACTION_STRIP_HEIGHT = 80;
const WORK_SESSION_BUBBLE_STORAGE_KEY = "bastardos.work-session-bubble.v1";
const getBubbleMaxTop = () => Math.max(
  BUBBLE_MARGIN,
  window.innerHeight - MOBILE_ACTION_STRIP_HEIGHT - BUBBLE_SIZE - BUBBLE_MARGIN,
);

type BubblePosition = {
  side: "left" | "right";
  top: number | null;
};

const WorkSessionControlState = ({
  initialSession,
  workSessionClient,
}: Required<WorkSessionControlProps>) => {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [bubblePosition, setBubblePosition] = useState<BubblePosition>({
    side: "right",
    top: null,
  });
  const [storageLoaded, setStorageLoaded] = useState(false);
  const drag = useRef<{
    pointerId: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressBubbleClick = useRef(false);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (window.innerWidth >= 768) return;
    const restoreStorage = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(WORK_SESSION_BUBBLE_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<BubblePosition> & {
            minimized?: boolean;
          };
          const side = saved.side === "left" ? "left" : "right";
          const maxTop = getBubbleMaxTop();
          const top = typeof saved.top === "number" && Number.isFinite(saved.top)
            ? Math.min(Math.max(saved.top, BUBBLE_MARGIN), maxTop)
            : null;
          setBubblePosition({ side, top });
          setMinimized(saved.minimized === true);
        }
      } catch {
        try {
          window.localStorage.removeItem(WORK_SESSION_BUBBLE_STORAGE_KEY);
        } catch {
          // Storage may be unavailable in restricted browser contexts.
        }
      } finally {
        setStorageLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreStorage);
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      window.localStorage.setItem(
        WORK_SESSION_BUBBLE_STORAGE_KEY,
        JSON.stringify({ minimized, ...bubblePosition }),
      );
    } catch {
      // Keep the control usable when persistence is unavailable.
    }
  }, [bubblePosition, minimized, storageLoaded]);

  useEffect(() => {
    if (!minimized) return;
    const keepBubbleVisible = () => {
      const maxTop = getBubbleMaxTop();
      setBubblePosition((current) => {
        if (current.top === null) return current;
        const top = Math.min(Math.max(current.top, BUBBLE_MARGIN), maxTop);
        return top === current.top ? current : { ...current, top };
      });
    };
    window.addEventListener("resize", keepBubbleVisible);
    return () => window.removeEventListener("resize", keepBubbleVisible);
  }, [minimized]);

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

  const moveBubble = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const moved =
      Math.hypot(
        event.clientX - drag.current.startX,
        event.clientY - drag.current.startY,
      ) > 4;
    drag.current.moved ||= moved;
    const maxTop = getBubbleMaxTop();
    setBubblePosition({
      side: event.clientX >= window.innerWidth / 2 ? "right" : "left",
      top: Math.min(
        Math.max(event.clientY - drag.current.offsetY, BUBBLE_MARGIN),
        maxTop,
      ),
    });
  };

  const finishBubbleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    suppressBubbleClick.current = drag.current.moved;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    drag.current = null;
  };

  if (minimized) {
    return (
      <aside
        aria-label="Control de jornada"
        data-side={bubblePosition.side}
        className={`fixed z-40 md:hidden ${bubblePosition.top === null ? "bottom-20" : ""} ${bubblePosition.side === "right" ? "right-4" : "left-4"}`}
        style={bubblePosition.top === null ? undefined : { top: bubblePosition.top }}
      >
        <button
          type="button"
          aria-label="Abrir control de jornada"
          className="flex size-14 touch-none items-center justify-center rounded-full border border-white/10 bg-[#202023] text-red-300 shadow-2xl shadow-black/25 ring-1 ring-black/10 transition-transform active:scale-95"
          onPointerDown={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            drag.current = {
              pointerId: event.pointerId,
              offsetY: bounds.height > 0
                ? event.clientY - bounds.top
                : BUBBLE_SIZE / 2,
              startX: event.clientX,
              startY: event.clientY,
              moved: false,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={moveBubble}
          onPointerUp={finishBubbleDrag}
          onPointerCancel={finishBubbleDrag}
          onClick={() => {
            if (suppressBubbleClick.current) {
              suppressBubbleClick.current = false;
              return;
            }
            setMinimized(false);
          }}
        >
          <Clock3 className="size-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Control de jornada"
      className="fixed bottom-20 left-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-[1.4rem] border border-black/8 bg-[#202023] p-3 text-white shadow-2xl shadow-black/20 xl:bottom-6 xl:left-[calc(var(--sidebar-width)+1.5rem)]"
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
        <button
          type="button"
          aria-label="Minimizar control de jornada"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setMinimized(true)}
        >
          <Minimize2 className="size-4" />
        </button>
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
