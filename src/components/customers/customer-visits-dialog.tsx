"use client";

import { CalendarDays, Package, Scissors } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { customerClient, type CustomerClient } from "@/lib/customers/client";
import type { Customer, PaginatedCustomerVisits } from "@/types/customer";

type Props = {
  customer: Customer;
  onClose(): void;
  client?: Pick<CustomerClient, "listVisits">;
};

const pageSize = 20;
const formatVisitDate = (value: string) => new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date(value));

export const CustomerVisitsDialog = ({ customer, onClose, client = customerClient }: Props) => {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<PaginatedCustomerVisits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    client.listVisits(customer.id, { page, pageSize }, controller.signal)
      .then((result) => setData(result))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "No se pudieron cargar las visitas.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [client, customer.id, page, retry]);

  const changePage = (nextPage: number) => {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  };
  const retryLoad = () => {
    setLoading(true);
    setError(null);
    setRetry((value) => value + 1);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Visitas de {customer.firstName} {customer.lastName}</DialogTitle>
          <DialogDescription>Servicios y productos registrados en ventas activas.</DialogDescription>
        </DialogHeader>

        {loading && <p role="status" className="py-10 text-center text-sm text-muted-foreground">Cargando visitas...</p>}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retryLoad}>Reintentar</Button>
          </div>
        )}
        {!loading && !error && data?.items.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No hay visitas registradas.</p>
        )}
        {!loading && !error && data && data.items.length > 0 && (
          <ol className="space-y-3">
            {data.items.map((visit) => (
              <li key={visit.id} className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-4">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  {formatVisitDate(visit.occurredAt)}
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {visit.items.map((item, index) => (
                    <li key={`${visit.id}-${index}`} className="flex items-center gap-2">
                      {item.type === "service" ? <Scissors className="size-4 text-primary" /> : <Package className="size-4 text-primary" />}
                      {item.quantity > 1 ? `${item.quantity} × ` : ""}{item.name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {data ? `Página ${data.pagination.page} de ${Math.max(data.pagination.totalPages, 1)}` : ""}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => changePage(page - 1)}>Anterior</Button>
            <Button type="button" variant="outline" disabled={loading || !data || page >= data.pagination.totalPages} onClick={() => changePage(page + 1)}>Siguiente</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
