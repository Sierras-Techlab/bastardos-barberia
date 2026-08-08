import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePageUser } from "@/lib/auth/authorization";

type IncomesLayoutProps = {
  children: ReactNode;
};

const IncomesLayout = async ({ children }: IncomesLayoutProps) => {
  const { user } = await requirePageUser();

  return <TooltipProvider>
    <SidebarProvider>
      <AppSidebar activeItem="Ingresos" user={user} />
      <SidebarInset className="min-h-svh bg-[#f1f0ed] xl:my-3 xl:mr-3 xl:min-h-[calc(100svh-1.5rem)] xl:rounded-[2rem]">
        {children}
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>;
};

export default IncomesLayout;
