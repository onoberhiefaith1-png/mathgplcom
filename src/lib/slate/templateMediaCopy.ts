import { supabase } from "@/integrations/supabase/client";
import type { Game } from "@/lib/slate/types";
import { planTemplateMediaCopy, referencedTemplateAssets, rewriteAssetPaths } from "@/lib/slate/templateMedia";

/**
 * Copies a shared template's uploaded files into the new owner's folder, then
 * points the snapshot at those copies. A file that cannot be copied keeps the
 * source path so it still plays while the template stays shared. The database
 * allows that read only for an exact path on a library row, and never a write.
 */
export async function duplicateTemplateMedia<T extends Game>(
  game: T,
  source: { id: string; ownerId?: string },
  nextOwnerId: string,
): Promise<T> {
  const sourceOwnerId = source.ownerId ?? "";
  const paths = referencedTemplateAssets(game);
  const plan = planTemplateMediaCopy(paths, sourceOwnerId, nextOwnerId);
  if (plan.copies.length === 0) return game;

  const copied: { from: string; to: string }[] = [];
  const pending: string[] = [];
  for (const copy of plan.copies) {
    const { error } = await supabase.storage.from("game-assets").copy(copy.from, copy.to);
    if (error) pending.push(copy.from);
    else copied.push(copy);
  }

  const rewritten = rewriteAssetPaths(game, copied);
  return {
    ...rewritten,
    settings: {
      ...rewritten.settings,
      templateMedia: {
        sourceGameId: source.id,
        sourceOwnerId,
        copiedAt: new Date().toISOString(),
        files: copied,
        pending,
      },
    },
  };
}
