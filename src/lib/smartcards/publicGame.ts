// Public Adventure play for Smart Cards published as a Game Challenge.
//
// The classroom pipeline (class membership, realtime mirroring, group bars,
// gallery rewards) is deliberately absent: a public visitor has no class, so
// the stage runs on their own progress alone, served by a public endpoint.

import { supabase } from "@/integrations/supabase/client";
import { primeSignedUrls } from "@/lib/games/urls";
import type { GameBoard } from "@/lib/games/gameQuestions";
import type { GameRow } from "@/lib/games/types";

export interface PublicGameBundle {
  card: { id: string; slug: string; title: string };
  game: GameRow;
  boards: GameBoard[];
}

export async function fetchPublicGameBundle(slug: string): Promise<PublicGameBundle | null> {
  const { data, error } = await supabase.functions.invoke("smart-card-game", {
    body: { action: "bundle", slug },
  });
  if (error || !data || (data as any).error) return null;
  const payload = data as any;
  // Seed the shared signed-URL cache so <SignedMedia> renders without auth.
  primeSignedUrls(payload.urls ?? {});
  return {
    card: payload.card,
    game: payload.game as GameRow,
    boards: (payload.boards ?? []) as GameBoard[],
  };
}

export async function fetchPublicGameProgress(
  slug: string,
  participantKey: string,
): Promise<{ scores: Record<string, number>; solved: Record<string, Record<string, number>> }> {
  const { data, error } = await supabase.functions.invoke("smart-card-game", {
    body: { action: "progress", slug, participantKey },
  });
  if (error || !data || (data as any).error) return { scores: {}, solved: {} };
  const payload = data as any;
  return { scores: payload.scores ?? {}, solved: payload.solved ?? {} };
}
