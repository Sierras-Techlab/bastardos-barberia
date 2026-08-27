import { Skeleton } from "@/components/ui/skeleton";
export default function ReportsLoading() { return <main className="space-y-5 p-6" aria-label="Cargando reportes"><Skeleton className="h-40 rounded-[1.75rem]" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Skeleton className="h-96 rounded-xl" /></main>; }
