import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Package,
  ReceiptText,
  Scissors,
  Store,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { CurrentUser } from "@/types/income";

const defaultUser: CurrentUser = {
  id: "employee-lautaro",
  firstName: "Lautaro",
  lastName: "Bastardos",
  role: "owner",
};

const operationNavigation = [
  { label: "Inicio", icon: LayoutDashboard, href: "/" },
  { label: "Ingresos", icon: ReceiptText, href: "/incomes" },
  { label: "Clientes", icon: Users },
  { label: "Servicios", icon: Scissors },
  { label: "Productos", icon: Package },
];

const administrationNavigation = [
  { label: "Empleados", icon: UserCog },
  { label: "Caja", icon: WalletCards },
  { label: "Gastos", icon: ReceiptText },
  { label: "Reportes", icon: BarChart3 },
  { label: "Medios de pago", icon: CreditCard },
  { label: "Negocio", icon: Store },
];

type AppSidebarProps = {
  activeItem?: string;
  user?: CurrentUser;
};

export const AppSidebar = ({
  activeItem = "Inicio",
  user = defaultUser,
}: AppSidebarProps) => {
  const initials = `${user.firstName[0]}${user.lastName[0]}`;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pt-6">
        <div className="flex h-16 items-center justify-center group-data-[collapsible=icon]:hidden">
          <Image
            src="/brand/bastardos-logo.png"
            alt="Bastardos Barbería"
            width={192}
            height={71}
            priority
            className="h-auto w-full max-w-44"
          />
        </div>
        <div className="hidden h-16 items-center justify-center group-data-[collapsible=icon]:flex">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Scissors className="size-4" />
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupLabel className="text-sidebar-foreground/40">
            Operación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationNavigation.map((item) => (
                <SidebarMenuItem key={item.label}>
                  {item.href ? (
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={activeItem === item.label}
                      tooltip={item.label}
                      className="h-10 rounded-xl px-3 data-active:bg-primary data-active:text-primary-foreground"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      tooltip={item.label}
                      className="h-10 rounded-xl px-3"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user.role === "owner" && (
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="text-sidebar-foreground/40">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {administrationNavigation.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      className="h-9 rounded-xl px-3"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 pb-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={user.firstName}
              className="rounded-2xl bg-sidebar-accent px-3"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="truncate font-medium">{user.firstName}</span>
                <span className="truncate text-xs font-normal text-sidebar-foreground/45">
                  {user.role === "owner" ? "Dueño" : "Empleado"}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
