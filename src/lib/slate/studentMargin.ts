/* ── The student's own Content Margin ────────────────────────────────────
 *
 * The margin belongs to the writing surface, so a student may move it too —
 * but a student's margin is their own. It is stored against that student and
 * that Game and can never touch the teacher's saved design.
 *
 * The store is created when this draft is accepted, so until then these calls
 * fail quietly and the margin simply stays for the current sitting.
 */

import { supabase } from "@/integrations/supabase/client";

const TABLE = "slate_surface_margins";

type LooseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { content_margin?: number } | null }>;
        };
      };
    };
    upsert: (
      row: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => Promise<{ error: unknown }>;
  };
};

const client = () => supabase as unknown as LooseClient;

export const loadStudentContentMargin = async (
  gameId: string,
  userId: string,
): Promise<number | null> => {
  try {
    const { data } = await client()
      .from(TABLE)
      .select("content_margin")
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .maybeSingle();
    const value = data?.content_margin;
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
};

export const saveStudentContentMargin = async (
  gameId: string,
  userId: string,
  contentMargin: number,
): Promise<void> => {
  try {
    await client()
      .from(TABLE)
      .upsert(
        { game_id: gameId, user_id: userId, content_margin: contentMargin },
        { onConflict: "user_id,game_id" },
      );
  } catch {
    /* the student's view still holds the margin for this sitting */
  }
};
