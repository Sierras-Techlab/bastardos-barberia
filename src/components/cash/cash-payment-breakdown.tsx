import { CreditCard, WalletCards } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { CashPaymentTotal } from "@/types/cash";

type CashPaymentBreakdownProps = { payments: CashPaymentTotal[] };

export const CashPaymentBreakdown = ({
  payments,
}: CashPaymentBreakdownProps) => (
  <Card className="rounded-[1.6rem] bg-white shadow-sm">
    <CardHeader className="border-b border-black/5 pb-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <WalletCards className="size-4" />
        </span>
        <div>
          <CardTitle>Medios de pago</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Distribución dinámica de la caja seleccionada
          </p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-1">
      {payments.length > 0 ? (
        <ul className="divide-y divide-black/5">
          {payments.map((payment) => (
            <li
              key={`${payment.paymentMethodId}-${payment.name}`}
              className="flex items-center justify-between gap-4 py-3.5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <CreditCard className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{payment.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold">
                  {formatArs(payment.netAmount)}
                </span>
                {payment.adjustmentAmount !== 0 && (
                  <span className="text-xs text-primary">
                    Ajuste {formatArs(payment.adjustmentAmount)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center text-center">
          <CreditCard className="size-5 text-muted-foreground/55" />
          <p className="mt-3 text-sm font-medium">Sin cobros registrados</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los medios aparecerán con el primer ingreso del día.
          </p>
        </div>
      )}
    </CardContent>
  </Card>
);
