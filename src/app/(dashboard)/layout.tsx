import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { WorkSessionControl } from "@/components/work-sessions/work-session-control";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePageUser } from "@/lib/auth/authorization";
import { getCurrentWorkSession } from "@/lib/work-sessions/service";

type DashboardLayoutProps = {
  children: ReactNode;
};

const DashboardLayout = async ({ children }: DashboardLayoutProps) => {
  const { user } = await requirePageUser();
  const currentWorkSession =
    user.role.name === "employee"
      ? await getCurrentWorkSession(user)
      : null;

  return (
    <TooltipProvider>
      <SidebarProvider className="xl:h-svh xl:overflow-hidden">
        <AppSidebar user={user} />
        <SidebarInset className="min-h-svh bg-[#f1f0ed] xl:my-3 xl:mr-3 xl:h-[calc(100svh-1.5rem)] xl:min-h-0 xl:overflow-auto xl:rounded-[2rem]">
          {user.role.name === "employee" && (
            <WorkSessionControl initialSession={currentWorkSession} />
          )}
          {children}
        </SidebarInset>
        <DashboardToaster />
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default DashboardLayout;
