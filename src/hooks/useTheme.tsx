import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/profile.functions";

const STORAGE_KEY = "space-theme";

function readStoredTheme(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function resolveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const fetchTheme = useServerFn(getThemePreference);
  const persistTheme = useServerFn(setThemePreference);

  // Both start at SSR-safe defaults so the first client render matches the
  // server render exactly; the blocking script in <head> already applied
  // the correct .dark class before paint, so this settling phase never
  // touches the DOM until it has the real stored value (see the `ready`
  // guard below) — otherwise we'd flash to a wrong class for one frame.
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);
  const syncedFromServer = useRef(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, ready]);

  // Live-update if the OS theme changes while "system" is selected.
  useEffect(() => {
    if (!ready || theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = mql.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme, ready]);

  const { data: serverTheme } = useQuery({
    queryKey: ["theme-preference"],
    queryFn: () => fetchTheme(),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  // Adopt the DB value once per sign-in so it wins over whatever this
  // browser had cached locally (cross-device continuity), without
  // clobbering a change the user just made this session.
  useEffect(() => {
    if (!ready || !serverTheme || syncedFromServer.current) return;
    syncedFromServer.current = true;
    setThemeState(serverTheme.theme);
  }, [ready, serverTheme]);

  useEffect(() => {
    if (!isAuthenticated) syncedFromServer.current = false;
  }, [isAuthenticated]);

  const persistMutation = useMutation({
    mutationFn: (next: ThemePreference) => persistTheme({ data: { theme: next } }),
    onError: () => toast.error("Couldn't save your theme preference"),
  });

  function setTheme(next: ThemePreference) {
    setThemeState(next);
    if (isAuthenticated) {
      queryClient.setQueryData(["theme-preference"], { theme: next });
      persistMutation.mutate(next);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
