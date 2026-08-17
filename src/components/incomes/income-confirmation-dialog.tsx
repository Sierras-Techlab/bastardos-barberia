"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";
import { IncomeSummary } from "./income-summary";
import { CommissionPreview } from "./commission-preview";

type IncomeConfirmationDialogProps = {
  open: boolean;
  values: IncomeFormValues;
  data: IncomeFormData;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export const IncomeConfirmationDialog = ({
  open,
  values,
  data,
  pending,
  onBack,
  onConfirm,
}: IncomeConfirmationDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={(nextOpen) => {
      if (!nextOpen && !pending) onBack();
    }}
  >
    <DialogContent
      showCloseButton={!pending}
      className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle className="text-xl">Confirmar ingreso</DialogTitle>
        <DialogDescription>
          Revisá el detalle antes de registrar este movimiento de caja.
        </DialogDescription>
      </DialogHeader>

      <IncomeSummary values={values} data={data} />
      <CommissionPreview values={values} data={data} />

      <DialogFooter className="-mx-5 -mb-5 p-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={onBack}
          className="h-11 rounded-xl"
        >
          Volver y editar
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={onConfirm}
          className="h-11 rounded-xl"
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Registrando ingreso
            </>
          ) : (
            "Confirmar ingreso"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
