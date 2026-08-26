"use client";
import { Button } from "@/components/ui/button";
export default function ReportsError({ reset }: { error: Error; reset(): void }) { return <main className="p-6"><div role="alert" className="rounded-2xl bg-white p-6"><h2 className="font-semibold">No pudimos cargar Reportes</h2><p className="mt-2 text-sm text-muted-foreground">Intentá nuevamente.</p><Button className="mt-4" onClick={reset}>Reintentar</Button></div></main>; }
