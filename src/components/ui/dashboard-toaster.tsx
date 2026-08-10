"use client";

import { Toaster } from "sonner";

export const DashboardToaster = () => (
  <Toaster
    position="bottom-right"
    duration={3000}
    closeButton
    richColors
    theme="light"
    containerAriaLabel="Notificaciones"
    offset={20}
    mobileOffset={16}
    toastOptions={{
      closeButtonAriaLabel: "Cerrar notificación",
      classNames: {
        toast: "!rounded-2xl !border-black/8 !bg-white !text-zinc-900 !shadow-xl",
        title: "!text-sm !font-medium",
        closeButton: "!border-black/8 !bg-white !text-zinc-500",
        success: "[&_[data-icon]]:!text-emerald-700",
        error: "[&_[data-icon]]:!text-red-700",
        warning: "[&_[data-icon]]:!text-orange-700",
        info: "[&_[data-icon]]:!text-zinc-700",
      },
    }}
  />
);
