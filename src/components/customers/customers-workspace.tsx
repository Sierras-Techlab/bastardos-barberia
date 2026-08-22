"use client";

import { useState } from "react";
import { CustomersPaymentDialog } from "@/components/customers/customers-payment-dialog";
import { CustomersView, type CustomerEditorProfessional } from "@/components/customers/customers-view";
import type { Customer, CustomerCatalogData } from "@/types/customer";
import type { FixedCustomerMonth } from "@/types/fixed-customer-payment";
import type { PaymentMethod } from "@/types/payment-method";

export type CustomersWorkspaceProps = {
  data: CustomerCatalogData;
  canDelete: boolean;
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "employee";
  professionals: CustomerEditorProfessional[];
  paymentMethods: PaymentMethod[];
};

export const CustomersWorkspace = ({
  data,
  canDelete,
  currentUserId,
  currentUserRole,
  professionals,
  paymentMethods,
}: CustomersWorkspaceProps) => {
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [paidMarker, setPaidMarker] = useState<{ customerId: string; period: string } | null>(null);

  const handlePaid = (_updated: FixedCustomerMonth) => {
    if (!payingCustomer || !_updated.incomeId) return;
    setPaidMarker({ customerId: payingCustomer.id, period: _updated.period });
  };

  return <>
    <CustomersView
      data={data}
      canDelete={canDelete}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      availableProfessionals={professionals}
      onOpenFixedPayment={setPayingCustomer}
    />
    {payingCustomer && (
      <CustomersPaymentDialog
        customer={payingCustomer}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        paymentMethods={paymentMethods}
        period={paidMarker?.customerId === payingCustomer.id ? paidMarker.period : undefined}
        onClose={() => setPayingCustomer(null)}
        onPaid={handlePaid}
      />
    )}
  </>;
};