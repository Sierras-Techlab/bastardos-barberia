import { beforeEach, describe, expect, it } from "vitest";

import { createThemeInitializationScript, getInitialTheme, resolveThemePreference, setTheme } from "@/lib/theme-preference";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("theme preference", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("uses the saved choice before the system preference", () => {
    expect(getInitialTheme(storage(), true)).toBe("dark");
    expect(getInitialTheme(storage(), false)).toBe("light");
    const saved = storage();
    saved.setItem("bastardos-theme", "light");
    expect(getInitialTheme(saved, true)).toBe("light");
  });

  it("uses the validated bootstrap implementation so invalid storage falls back to the system", () => {
    expect(resolveThemePreference("invalid", true)).toBe("dark");
    expect(resolveThemePreference("invalid", false)).toBe("light");
    expect(getInitialTheme({ getItem: () => "invalid", setItem: () => undefined }, true)).toBe("dark");
    expect(createThemeInitializationScript()).toContain('if(p!=="light"&&p!=="dark")p=null;');
  });

  it("persists a manual choice and toggles the root class", () => {
    const saved = storage();
    setTheme("dark", document.documentElement, saved);
    expect(document.documentElement).toHaveClass("dark");
    expect(saved.getItem("bastardos-theme")).toBe("dark");
    setTheme("light", document.documentElement, saved);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(saved.getItem("bastardos-theme")).toBe("light");
  });

  it("keeps theme changes working when browser storage throws", () => {
    const blockedStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(getInitialTheme(blockedStorage, true)).toBe("dark");
    expect(getInitialTheme(blockedStorage, false)).toBe("light");
    expect(() => setTheme("dark", document.documentElement, blockedStorage)).not.toThrow();
    expect(document.documentElement).toHaveClass("dark");
  });
});
