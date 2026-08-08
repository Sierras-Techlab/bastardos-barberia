import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireManagerPage } from "@/lib/auth/authorization";

type UsersLayoutProps = {
  children: ReactNode;
};

const UsersLayout = async ({ children }: UsersLayoutProps) => {
  const { user } = await requireManagerPage();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar activeItem="Usuarios" user={user} />
        <SidebarInset className="min-h-svh bg-[#f1f0ed] xl:my-3 xl:mr-3 xl:min-h-[calc(100svh-1.5rem)] xl:rounded-[2rem]">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default UsersLayout;
