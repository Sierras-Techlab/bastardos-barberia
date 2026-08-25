"use client";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ExpensesError({ retry }: { error: Error & { digest?: string }; retry(): void }) { return <main className="flex min-h-svh items-center justify-center bg-[#f1f0ed] px-5"><div className="rounded-[1.75rem] bg-white px-8 py-10 text-center shadow-sm"><h1 className="text-xl font-semibold">No pudimos cargar los gastos</h1><p className="mt-2 text-sm text-muted-foreground">Puede ser un problema temporal. Volvé a intentarlo.</p><Button className="mt-5" onClick={retry}><RotateCcw /> Intentar de nuevo</Button></div></main>; }
