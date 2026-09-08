import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DashboardBackground = {
  id: string;
  label: string;
  css: string;
};

/** Curated, contrast-safe canvases. Cards stay opaque so text never suffers. */
export const DASHBOARD_BACKGROUNDS: DashboardBackground[] = [
  {
    id: "navy",
    label: "Premium Navy",
    css: "var(--gradient-dash-canvas)",
  },
  {
    id: "slate",
    label: "Soft Slate",
    css: "linear-gradient(160deg, hsl(214 32% 91%) 0%, hsl(216 28% 84%) 55%, hsl(220 24% 78%) 100%)",
  },
  {
    id: "gold",
    label: "Navy & Gold",
    css: "radial-gradient(900px 480px at 88% -12%, hsl(39 94% 56% / 0.35), transparent 62%), linear-gradient(160deg, hsl(224 54% 12%) 0%, hsl(228 44% 18%) 100%)",
  },
  {
    id: "teal",
    label: "Deep Teal",
    css: "linear-gradient(160deg, hsl(192 60% 12%) 0%, hsl(196 48% 20%) 60%, hsl(204 40% 16%) 100%)",
  },
  {
    id: "porcelain",
    label: "Porcelain",
    css: "linear-gradient(180deg, hsl(0 0% 99%) 0%, hsl(220 26% 95%) 100%)",
  },
];

const STORAGE_KEY = "mathgpl.dashboard.background";

export function backgroundCss(id: string | null): string {
  return (DASHBOARD_BACKGROUNDS.find((b) => b.id === id) ?? DASHBOARD_BACKGROUNDS[0]).css;
}

/**
 * Per-account dashboard background: instant locally, persisted to the profile.
 * The local copy is keyed by account so the next person to sign in on this
 * browser never inherits the previous person's canvas.
 */
export function useDashboardBackground() {
  const [id, setId] = useState<string>("navy");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    setId("navy");
    // Retire the old shared key, which leaked between accounts.
    window.localStorage.removeItem(STORAGE_KEY);
    if (!userId) return;
    const key = `${STORAGE_KEY}:${userId}`;
    const local = window.localStorage.getItem(key);
    if (local) setId(local);
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("dashboard_background")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.dashboard_background) {
        setId(data.dashboard_background);
        window.localStorage.setItem(key, data.dashboard_background);
      }
    })();
  }, [userId]);

  const choose = useCallback(
    async (next: string) => {
      setId(next);
      if (!userId) return;
      window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, next);
      await supabase.from("profiles").update({ dashboard_background: next }).eq("user_id", userId);
    },
    [userId],
  );

  return { id, css: backgroundCss(id), choose };
}

