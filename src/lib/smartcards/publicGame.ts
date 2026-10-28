// Public Adventure play for Smart Cards published as a Game Challenge.
//
// The classroom pipeline (class membership, realtime mirroring, group bars,
// gallery rewards) is deliberately absent: a public visitor has no class, so
// the stage runs on their own progress alone, served by a public endpoint.

import { supabase } from "@/integrations/supabase/client";
import { primeSignedUrls } from "@/lib/games/urls";
import type { GameBoard } from "@/lib/games/gameQuestions";
import type { GameRow } from "@/lib/games/types";

export interface PublicTimeBar {
  progressElementId: string;
  durationSeconds: number;
  startedAt: string | null;
  pausedAt: string | null;
  accumulatedPausedMs: number;
  expired: boolean;
}

export interface PublicGameBundle {
  card: {
    id: string;
    slug: string;
    title: string;
    assessmentId: string | null;
    passMarkPct: number;
    requiredMarks: number;
    totalMarks: number;
    questionElementId: string | null;
  };
  game: GameRow;
  timeBar: PublicTimeBar | null;
  boards: GameBoard[];
}

export interface PublicGameProgress {
  scores: Record<string, number>;
  solved: Record<string, Record<string, number>>;
  requiredMarks: number;
  passMarkPct: number;
  qualified: boolean;
  completionMs: number | null;
  timerExpired: boolean;
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
    timeBar: (payload.timeBar ?? null) as PublicTimeBar | null,
    boards: (payload.boards ?? []) as GameBoard[],
  };
}

export async function fetchPublicGameProgress(
  slug: string,
  participantKey: string,
  displayName?: string,
): Promise<PublicGameProgress> {
  const empty: PublicGameProgress = {
    scores: {},
    solved: {},
    requiredMarks: 0,
    passMarkPct: 100,
    qualified: false,
    completionMs: null,
    timerExpired: false,
  };
  const { data, error } = await supabase.functions.invoke("smart-card-game", {
    body: { action: "progress", slug, participantKey, displayName },
  });
  if (error || !data || (data as any).error) return empty;
  const payload = data as any;
  return {
    scores: payload.scores ?? {},
    solved: payload.solved ?? {},
    requiredMarks: Number(payload.requiredMarks ?? 0),
    passMarkPct: Number(payload.passMarkPct ?? 100),
    qualified: !!payload.qualified,
    completionMs: payload.completionMs ?? null,
    timerExpired: !!payload.timerExpired,
  };
}

/** Close the competition once the countdown has hit zero and award winners. */
export async function finalizePublicGame(slug: string): Promise<{
  finalized: boolean;
  winners: { participantKey: string; displayName: string | null; completionMs: number }[];
}> {
  const { data, error } = await supabase.functions.invoke("smart-card-game", {
    body: { action: "finalize", slug },
  });
  if (error || !data || (data as any).error) return { finalized: false, winners: [] };
  const payload = data as any;
  return { finalized: !!payload.finalized, winners: payload.winners ?? [] };
}
