// Where the floating Quick Action lightning button sits.
//
// The platform owner drags it once; the spot is stored as a single global row
// and read by every teacher on every device, so it always appears where it was
// left and never covers a page's own controls. Values are percentages of the
// viewport, so the same spot lands correctly on a phone and on a laptop.

import { supabase } from "@/integrations/supabase/client";

export interface QuickActionPlacement {
  xPct: number;
  yPct: number;
}

/** Bottom-left, clear of most page controls — the spot used until one is saved. */
export const DEFAULT_QUICK_PLACEMENT: QuickActionPlacement = { xPct: 4, yPct: 92 };

const clampPct = (value: number, fallback: number) =>
  Math.min(96, Math.max(4, Number.isFinite(value) ? value : fallback));

export const clampQuickPlacement = (value: QuickActionPlacement): QuickActionPlacement => ({
  xPct: clampPct(value.xPct, DEFAULT_QUICK_PLACEMENT.xPct),
  yPct: clampPct(value.yPct, DEFAULT_QUICK_PLACEMENT.yPct),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("quick_action_placement");

/** The saved global spot, or null when it has never been moved. */
export const loadQuickPlacement = async (): Promise<QuickActionPlacement | null> => {
  try {
    const { data, error } = await table().select("x_pct, y_pct").eq("key", "global").maybeSingle();
    if (error || !data) return null;
    return clampQuickPlacement({ xPct: Number(data.x_pct), yPct: Number(data.y_pct) });
  } catch {
    return null;
  }
};

/** Saves the global spot. Only the platform owner is allowed to (RLS). */
export const saveQuickPlacement = async (value: QuickActionPlacement): Promise<void> => {
  const safe = clampQuickPlacement(value);
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await table().upsert(
    {
      key: "global",
      x_pct: safe.xPct,
      y_pct: safe.yPct,
      updated_by: userData.user?.id ?? null,
    },
    { onConflict: "key" },
  );
  if (error) throw error;
};
