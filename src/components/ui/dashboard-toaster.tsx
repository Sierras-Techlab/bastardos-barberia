"use client";

import { Toaster } from "sonner";

export const DashboardToaster = () => (
  <Toaster
    position="bottom-right"
    duration={3000}
    closeButton
    richColors
    theme="system"
    containerAriaLabel="Notificaciones"
    offset={20}
    mobileOffset={16}
    toastOptions={{
      closeButtonAriaLabel: "Cerrar notificación",
      classNames: {
        toast: "!rounded-2xl !border-border !bg-card !text-card-foreground !shadow-xl",
        title: "!text-sm !font-medium",
        closeButton: "!border-border !bg-muted !text-muted-foreground",
        success: "[&_[data-icon]]:!text-success-foreground",
        error: "[&_[data-icon]]:!text-destructive",
        warning: "[&_[data-icon]]:!text-warning-foreground",
        info: "[&_[data-icon]]:!text-foreground",
      },
    }}
  />
);
