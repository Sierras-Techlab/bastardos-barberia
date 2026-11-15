"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import { getBrowserThemeStorage, toggleTheme } from "@/lib/theme-preference";

const subscribeToTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};

const getThemeSnapshot = () => document.documentElement.classList.contains("dark") ? "dark" : "light";
const getServerThemeSnapshot = () => "light";

export const ThemeToggle = () => {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  const changeTheme = () => {
    toggleTheme(getThemeSnapshot(), document.documentElement, getBrowserThemeStorage());
  };

  return (
    <SidebarMenuButton
      type="button"
      onClick={changeTheme}
      aria-label="Cambiar tema"
      aria-pressed={theme === "dark"}
      tooltip={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
      className="min-h-11 rounded-xl px-3 text-sidebar-foreground/75"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      <span className="group-data-[collapsible=icon]:hidden">{theme === "dark" ? "Tema claro" : "Tema oscuro"}</span>
    </SidebarMenuButton>
  );
};
