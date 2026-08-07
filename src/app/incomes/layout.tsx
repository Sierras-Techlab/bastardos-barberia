import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import incomeFormMock from "@/data/income-form.mock.json";
import type { IncomeFormData } from "@/types/income";

type IncomesLayoutProps = {
  children: ReactNode;
};

const currentUser = (incomeFormMock as IncomeFormData).currentUser;

const IncomesLayout = ({ children }: IncomesLayoutProps) => (
  <TooltipProvider>
    <SidebarProvider>
      <AppSidebar activeItem="Ingresos" user={currentUser} />
      <SidebarInset className="min-h-svh bg-[#f1f0ed] xl:my-3 xl:mr-3 xl:min-h-[calc(100svh-1.5rem)] xl:rounded-[2rem]">
        {children}
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>
);

export default IncomesLayout;
