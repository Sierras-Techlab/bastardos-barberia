import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePageUser } from "@/lib/auth/authorization";

type DashboardLayoutProps = {
  children: ReactNode;
};

const DashboardLayout = async ({ children }: DashboardLayoutProps) => {
  const { user } = await requirePageUser();

  return (
    <TooltipProvider>
      <SidebarProvider className="xl:h-svh xl:overflow-hidden">
        <AppSidebar user={user} />
        <SidebarInset className="min-h-svh bg-[#f1f0ed] xl:my-3 xl:mr-3 xl:h-[calc(100svh-1.5rem)] xl:min-h-0 xl:overflow-auto xl:rounded-[2rem]">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default DashboardLayout;
