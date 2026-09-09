// Where the tutorial buttons sit on a page.
//
// The administrator drags the pair once; the spot is stored per page and read by
// EVERY visitor on every account, so the buttons always appear where they were
// left and never cover a page's own controls. Values are percentages of the
// viewport, so the same spot lands correctly on a phone and on a laptop.

import { supabase } from "@/integrations/supabase/client";

export interface GuidePlacement {
  xPct: number;
  yPct: number;
}

/** Top-right, clear of page headers — the spot used until one is saved. */
export const DEFAULT_PLACEMENT: GuidePlacement = { xPct: 95, yPct: 9 };

export const clampPlacement = (value: GuidePlacement): GuidePlacement => ({
  xPct: Math.min(100, Math.max(0, Number.isFinite(value.xPct) ? value.xPct : DEFAULT_PLACEMENT.xPct)),
  yPct: Math.min(100, Math.max(0, Number.isFinite(value.yPct) ? value.yPct : DEFAULT_PLACEMENT.yPct)),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("page_guide_placement");

/** The saved spot for one page, or null when it has never been moved. */
export const loadPlacement = async (pageKey: string): Promise<GuidePlacement | null> => {
  try {
    const { data, error } = await table().select("x_pct, y_pct").eq("page_key", pageKey).maybeSingle();
    if (error || !data) return null;
    return clampPlacement({ xPct: Number(data.x_pct), yPct: Number(data.y_pct) });
  } catch {
    return null;
  }
};

/** Saves the spot for one page. Only a tutorial manager is allowed to (RLS). */
export const savePlacement = async (pageKey: string, value: GuidePlacement): Promise<void> => {
  const safe = clampPlacement(value);
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await table().upsert(
    {
      page_key: pageKey,
      x_pct: safe.xPct,
      y_pct: safe.yPct,
      updated_by: userData.user?.id ?? null,
    },
    { onConflict: "page_key" },
  );
  if (error) throw error;
};
