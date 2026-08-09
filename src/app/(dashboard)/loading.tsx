import { LoaderCircle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

const DashboardLoading = () => (
  <div
    role="status"
    aria-label="Cargando contenido"
    className="flex min-h-[calc(100svh-1.5rem)] flex-col gap-5 px-5 py-5 md:px-7 xl:px-8 xl:py-7"
  >
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
        <LoaderCircle className="size-4 animate-spin" />
      </span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-40" />
      </div>
    </div>
    <div className="grid flex-1 gap-4 lg:grid-cols-3">
      <Skeleton className="min-h-40 rounded-[1.75rem] lg:col-span-2" />
      <Skeleton className="min-h-40 rounded-[1.75rem]" />
      <Skeleton className="min-h-56 rounded-[1.75rem] lg:col-span-3" />
    </div>
    <span className="sr-only">Cargando la siguiente vista.</span>
  </div>
);

export default DashboardLoading;
