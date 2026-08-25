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
  today: string;
  initialFixedCustomerMonths: FixedCustomerMonth[];
};

export const CustomersWorkspace = ({
  data,
  canDelete,
  currentUserId,
  currentUserRole,
  professionals,
  paymentMethods,
  today,
  initialFixedCustomerMonths,
}: CustomersWorkspaceProps) => {
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [fixedCustomerMonths, setFixedCustomerMonths] = useState(initialFixedCustomerMonths);

  const handlePaid = (updated: FixedCustomerMonth) => {
    setFixedCustomerMonths((current) => [
      ...current.filter((month) => month.customer.id !== updated.customer.id),
      updated,
    ]);
  };

  return <>
    <CustomersView
      data={data}
      canDelete={canDelete}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      availableProfessionals={professionals}
      onOpenFixedPayment={setPayingCustomer}
      fixedCustomerMonths={fixedCustomerMonths}
      today={today}
    />
    {payingCustomer && (
      <CustomersPaymentDialog
        customer={payingCustomer}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        paymentMethods={paymentMethods}
        period={fixedCustomerMonths.find((month) => month.customer.id === payingCustomer.id)?.period}
        onClose={() => setPayingCustomer(null)}
        onPaid={handlePaid}
      />
    )}
  </>;
};
