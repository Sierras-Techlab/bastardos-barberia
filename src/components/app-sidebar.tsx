"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Scissors,
  Store,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";

import type { SafeUser } from "@/lib/auth/types";

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
const operationNavigation = [
  { label: "Inicio", icon: LayoutDashboard, href: "/" },
  { label: "Ingresos", icon: ReceiptText, href: "/incomes" },
  { label: "Clientes", icon: Users, href: "/customers" },
  { label: "Servicios", icon: Scissors, href: "/services" },
  { label: "Productos", icon: Package, href: "/products" },
];

const administrationNavigation = [
  { label: "Usuarios", icon: UserCog, href: "/users" },
  { label: "Caja", icon: WalletCards },
  { label: "Gastos", icon: ReceiptText },
  { label: "Reportes", icon: BarChart3 },
  { label: "Medios de pago", icon: CreditCard },
  { label: "Negocio", icon: Store },
];

type AppSidebarProps = {
  activeItem?: string;
  user: SafeUser;
};

export const AppSidebar = ({
  activeItem,
  user,
}: AppSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const name = `${user.firstName} ${user.lastName}`;
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const canManage = user.role.name === "owner" || user.role.name === "admin";
  const roleLabels = { owner: "Due\u00f1o", admin: "Administrador", employee: "Empleado" } as const;
  const isItemActive = (label: string, href?: string) => {
    if (activeItem) return activeItem === label;
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const logOut = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

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
                      isActive={isItemActive(item.label, item.href)}
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

        {canManage && (
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="text-sidebar-foreground/40">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {administrationNavigation.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.href ? (
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isItemActive(item.label, item.href)}
                        tooltip={item.label}
                        className="h-9 rounded-xl px-3 data-active:bg-primary data-active:text-primary-foreground"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        tooltip={item.label}
                        className="h-9 rounded-xl px-3"
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
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 pb-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              className="rounded-2xl bg-sidebar-accent px-3"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs font-normal text-sidebar-foreground/45">
                  {roleLabels[user.role.name]}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={"Cerrar sesi\u00f3n"}
              onClick={logOut}
              disabled={isLoggingOut}
              className="rounded-xl px-3 text-sidebar-foreground/65"
            >
              <LogOut />
              <span>{isLoggingOut ? "Saliendo..." : "Cerrar sesi\u00f3n"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
