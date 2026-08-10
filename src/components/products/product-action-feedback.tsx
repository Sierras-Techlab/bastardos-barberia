"use client";

import { CircleCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ProductActionFeedbackProps = {
  message: string;
  onClose: () => void;
};

export const ProductActionFeedback = ({
  message,
  onClose,
}: ProductActionFeedbackProps) => (
  <div
    role="status"
    aria-live="polite"
    aria-label={message}
    className="fixed inset-x-4 bottom-5 z-60 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-xl ring-1 ring-black/8 sm:right-5 sm:left-auto sm:mx-0"
  >
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
      <CircleCheck className="size-5" />
    </span>
    <p className="text-sm font-medium text-zinc-900">{message}</p>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Cerrar notificación"
      onClick={onClose}
      className="rounded-xl text-zinc-500"
    >
      <X />
    </Button>
  </div>
);
