export type ThemePreference = "light" | "dark";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export const getBrowserThemeStorage = (): ThemeStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const THEME_STORAGE_KEY = "bastardos-theme";

export const resolveThemePreference = (saved: string | null, prefersDark: boolean): ThemePreference =>
  saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light";

export const createThemeInitializationScript = () =>
  `try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(p!=="light"&&p!=="dark")p=null;var d=p==="dark"||(!p&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.toggle("dark",matchMedia("(prefers-color-scheme: dark)").matches)}`;

export const getInitialTheme = (
  storage: ThemeStorage | null,
  prefersDark: boolean,
): ThemePreference => {
  try {
    return resolveThemePreference(storage?.getItem(THEME_STORAGE_KEY) ?? null, prefersDark);
  } catch {
    return resolveThemePreference(null, prefersDark);
  }
};

export const setTheme = (
  theme: ThemePreference,
  root: Pick<HTMLElement, "classList">,
  storage: ThemeStorage | null,
) => {
  root.classList.toggle("dark", theme === "dark");
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The in-memory class update still lets the preference work for this session.
  }
};

export const toggleTheme = (
  current: ThemePreference,
  root: Pick<HTMLElement, "classList">,
  storage: ThemeStorage | null,
): ThemePreference => {
  const next = current === "dark" ? "light" : "dark";
  setTheme(next, root, storage);
  return next;
};
