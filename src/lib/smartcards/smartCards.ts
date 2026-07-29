// Smart Card publishing — MathGPL Life only.
//
// A Smart Card is NOT a new question type. It is a publishing format for a
// Lesson Note question that already has a Solution. Publishing snapshots the
// question's presentation so later Lesson Note edits never mutate a card that
// is already in the wild.

import { supabase } from "@/integrations/supabase/client";
import { compileSectionQuestions, type AssessmentKind } from "@/lib/assessments/createAssessment";
import type { GeometryScene } from "@/lib/geometry/scene";

export interface CardPresentation {
  questionText: string;
  fontScale: number;      // 1 = lesson-note size
  emojiScale: number;     // multiplies emoji size only
  mathScale: number;      // multiplies rendered maths only
  diagramScale: number;
  diagramOffsetX: number;
  diagramOffsetY: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  align: "left" | "center" | "right";
  zoom: number;           // preview zoom only, not published
}

export const DEFAULT_PRESENTATION: CardPresentation = {
  questionText: "",
  fontScale: 1,
  emojiScale: 1,
  mathScale: 1,
  diagramScale: 1,
  diagramOffsetX: 0,
  diagramOffsetY: 0,
  bold: false,
  italic: false,
  underline: false,
  color: "#101828",
  align: "left",
  zoom: 1,
};

export const hydratePresentation = (raw: unknown): CardPresentation => ({
  ...DEFAULT_PRESENTATION,
  ...((raw && typeof raw === "object" ? raw : {}) as Partial<CardPresentation>),
});

export interface SmartCardRow {
  id: string;
  owner_id: string;
  notebook_id: string | null;
  section_id: string | null;
  subsection_id: string | null;
  class_id: string | null;
  assessment_id: string | null;
  slug: string;
  title: string;
  presentation: CardPresentation;
  geometry: { scenes: GeometryScene[] } | null;
  total_marks: number;
  published: boolean;
  published_at: string | null;
  publish_mode: "challenge" | "game";
  game_id: string | null;
  topic: string | null;
  subtopic: string | null;
  difficulty: string | null;
}

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const generateSlug = () =>
  Array.from({ length: 8 }, () => SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]).join("");

export const cardUrl = (slug: string) => `${window.location.origin}/c/${slug}`;

/** Share link that server-renders per-card social previews before landing on
 *  the same card. Static SPA heads can't do this, so shares go through the
 *  public preview endpoint. */
export const shareUrl = (slug: string) => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return cardUrl(slug);
  return `${base}/functions/v1/smart-card-preview?slug=${encodeURIComponent(slug)}&origin=${encodeURIComponent(window.location.origin)}`;
};


export const hydrateCard = (row: Record<string, unknown>): SmartCardRow => ({
  ...(row as unknown as SmartCardRow),
  presentation: hydratePresentation((row as any).presentation),
  geometry: ((row as any).geometry ?? null) as SmartCardRow["geometry"],
});

/** Find (or create) the draft Smart Card for a question, then return its id. */
export async function openSmartCardDraft(input: {
  notebookId: string;
  subsectionId: string;
  questionText: string;
  scenes: GeometryScene[];
  title: string;
}): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data: existing } = await supabase
    .from("smart_cards")
    .select("id, presentation")
    .eq("owner_id", uid)
    .eq("subsection_id", input.subsectionId)
    .order("created_at", { ascending: true })
    .limit(1);

  const found = (existing ?? [])[0] as { id: string; presentation: unknown } | undefined;
  if (found) {
    // Keep the teacher's Smart Card styling; only refresh the geometry
    // snapshot when the card has never been edited/published.
    return found.id;
  }

  const { data: sub } = await supabase
    .from("notebook_subsections")
    .select("section_id")
    .eq("id", input.subsectionId)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("smart_cards")
    .insert({
      owner_id: uid,
      notebook_id: input.notebookId,
      subsection_id: input.subsectionId,
      section_id: (sub as any)?.section_id ?? null,
      slug: generateSlug(),
      title: input.title || "Smart Card",
      presentation: { ...DEFAULT_PRESENTATION, questionText: input.questionText } as any,
      geometry: input.scenes.length ? ({ scenes: input.scenes } as any) : null,
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id as string;
}

export async function loadSmartCard(id: string): Promise<SmartCardRow | null> {
  const { data } = await supabase.from("smart_cards").select("*").eq("id", id).maybeSingle();
  return data ? hydrateCard(data as Record<string, unknown>) : null;
}

export async function saveSmartCard(
  id: string,
  patch: {
    title?: string;
    presentation?: CardPresentation;
    geometry?: { scenes: GeometryScene[] } | null;
    publish_mode?: "challenge" | "game";
    game_id?: string | null;
  },
): Promise<void> {
  await supabase.from("smart_cards").update(patch as any).eq("id", id);
}

/** Hidden holder class so a Smart Card challenge can reuse the assessment
 *  engine without belonging to a real classroom. */
async function ensureSmartCardClass(ownerId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("classes")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("workspace", "live")
    .eq("name", "Smart Cards")
    .limit(1);
  const found = (existing ?? [])[0] as { id: string } | undefined;
  if (found) return found.id;

  const { data: created } = await supabase
    .from("classes")
    .insert({
      owner_id: ownerId,
      name: "Smart Cards",
      class_code: `SC-${Math.floor(1000 + Math.random() * 9000)}`,
      workspace: "live",
      description: "Internal holder for published Smart Cards.",
    })
    .select("id")
    .single();
  return (created as any)?.id ?? null;
}

/** Games the teacher can publish a Smart Card inside. */
export async function listPublishableGames(): Promise<{ id: string; title: string }[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from("games")
    .select("id, title")
    .eq("owner_id", uid)
    .order("updated_at", { ascending: false });
  return (data ?? []) as { id: string; title: string }[];
}

/** Game Challenge: attach the card's game to the hidden holder class and point
 *  every progress bar in that game at this card's assessment, so a public
 *  visitor fills the bars by solving the card. */
async function linkGameChallenge(input: {
  gameId: string;
  classId: string;
  assessmentId: string;
  notebookId: string | null;
  sectionId: string | null;
  totalMarks: number;
}): Promise<void> {
  const { gameId, classId, assessmentId } = input;

  await supabase.from("class_games").upsert(
    { class_id: classId, game_id: gameId } as never,
    { onConflict: "class_id,game_id" },
  );

  const { data: game } = await supabase
    .from("games")
    .select("canvas")
    .eq("id", gameId)
    .maybeSingle();
  const canvas = normalizeCanvas((game as any)?.canvas);
  const barIds: string[] = [];
  for (const scene of canvas.scenes) {
    for (const el of scene.elements) if (el.kind === "progress_bar") barIds.push(el.id);
  }
  if (barIds.length === 0) throw new Error("game_has_no_progress_bar");

  // A Smart Card is a single challenge: every bar is fed by the same board.
  await supabase.from("class_game_boards").delete().eq("class_id", classId).eq("game_id", gameId);
  await supabase.from("class_game_boards").insert(
    barIds.map((barId) => ({
      class_id: classId,
      game_id: gameId,
      progress_element_id: barId,
      assessment_id: assessmentId,
      notebook_id: input.notebookId,
      section_id: input.sectionId,
      required_marks: input.totalMarks,
      question_keys: [],
    })) as never,
  );
}

/** Publish: build the public challenge and mark the card live. */
export async function publishSmartCard(card: SmartCardRow): Promise<SmartCardRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid || !card.subsection_id || !card.notebook_id || !card.section_id) {
    throw new Error("missing_question");
  }

  const classId = card.class_id ?? (await ensureSmartCardClass(uid));
  if (!classId) throw new Error("class_failed");

  // Compile the whole section with the normal engine, then keep ONLY the
  // published question — a Smart Card is one challenge, never a worksheet.
  const compiled = await compileSectionQuestions(card.section_id);
  const questions = compiled.questions.filter((q) => q.id === card.subsection_id);
  if (questions.length === 0) throw new Error("no_floating_lines");
  const answerKey = compiled.answerKey.filter((k) => k.questionId === card.subsection_id);
  const total = questions[0].lines.reduce((sum, l) => sum + Math.max(0, Number(l.marks ?? 0)), 0);

  let assessmentId = card.assessment_id;
  if (assessmentId) {
    await supabase
      .from("assessments")
      .update({
        title: card.title || "Smart Card",
        total_marks: total,
        questions: questions as any,
      } as never)
      .eq("id", assessmentId);
    await supabase.from("assessment_answer_keys").delete().eq("assessment_id", assessmentId);
    await supabase
      .from("assessment_answer_keys")
      .insert({ assessment_id: assessmentId, lines: answerKey as any });
  } else {
    const { data: created, error } = await supabase
      .from("assessments")
      .insert({
        class_id: classId,
        owner_id: uid,
        notebook_id: card.notebook_id,
        section_id: card.section_id,
        kind: "practice" as AssessmentKind,
        title: card.title || "Smart Card",
        score_label: "Marks",
        total_marks: total,
        questions: questions as any,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "create_failed");
    assessmentId = created.id as string;
    await supabase
      .from("assessment_answer_keys")
      .insert({ assessment_id: assessmentId, lines: answerKey as any });
  }

  if (card.publish_mode === "game") {
    if (!card.game_id) throw new Error("no_game_selected");
    await linkGameChallenge({
      gameId: card.game_id,
      classId,
      assessmentId: assessmentId!,
      notebookId: card.notebook_id,
      sectionId: card.section_id,
      totalMarks: total,
    });
  }

  const { data: updated } = await supabase
    .from("smart_cards")
    .update({
      class_id: classId,
      assessment_id: assessmentId,
      total_marks: total,
      published: true,
      published_at: new Date().toISOString(),
    } as any)
    .eq("id", card.id)
    .select("*")
    .single();

  return updated ? hydrateCard(updated as Record<string, unknown>) : null;
}


/* ───────────── Public (no-account) side ───────────── */

export interface PublicCard {
  id: string;
  publishMode?: "challenge" | "game";
  topic?: string | null;
  subtopic?: string | null;
  difficulty?: string | null;
  publishedBy?: string;
  slug: string;
  title: string;
  presentation: CardPresentation;
  geometry: { scenes: GeometryScene[] } | null;
  totalMarks: number;
}

export interface LeaderboardEntry {
  displayName: string;
  durationMs: number;
  completedAt: string;
}

export interface CardStatsPublic {
  visitors: number;
  totalPlayers: number;
  perfectScores: number;
  currentlySolving: number;
}

export interface PublicCardPayload {
  card: PublicCard;
  assessment: { id: string; title: string; questions: any[]; total_marks: number } | null;
  leaderboard: LeaderboardEntry[];
}

export async function fetchPublicCard(slug: string): Promise<PublicCardPayload | null> {
  const { data, error } = await supabase.functions.invoke("smart-card", {
    body: { action: "get", slug },
  });
  if (error || !data || (data as any).error) return null;
  const payload = data as any;
  return {
    ...payload,
    card: { ...payload.card, presentation: hydratePresentation(payload.card?.presentation) },
  } as PublicCardPayload;
}

/** Challenge Dashboard payload — the public replacement for the classroom
 *  Assignment Dashboard. */
export async function fetchChallengeDashboard(
  slug: string,
): Promise<(PublicCardPayload & { stats: CardStatsPublic }) | null> {
  const { data, error } = await supabase.functions.invoke("smart-card", {
    body: { action: "dashboard", slug },
  });
  if (error || !data || (data as any).error) return null;
  const payload = data as any;
  return {
    ...payload,
    card: { ...payload.card, presentation: hydratePresentation(payload.card?.presentation) },
  };
}

/** Heartbeat so the dashboard can show visitors / people solving right now.
 *  Teacher previews are flagged and never counted. */
export async function pingPresence(input: {
  slug: string;
  participantKey: string;
  displayName?: string;
  state: "visitor" | "solving";
  preview?: boolean;
}): Promise<CardStatsPublic | null> {
  const { data, error } = await supabase.functions.invoke("smart-card", {
    body: { action: "presence", ...input },
  });
  if (error || !data || (data as any).error) return null;
  return data as CardStatsPublic;
}

export async function reportProgress(input: {
  slug: string;
  participantKey: string;
  displayName: string;
  durationMs: number;
  preview?: boolean;
}): Promise<{ percent: number; qualified: boolean; leaderboard: LeaderboardEntry[] } | null> {
  const { data, error } = await supabase.functions.invoke("smart-card", {
    body: { action: "progress", ...input },
  });
  if (error || !data || (data as any).error) return null;
  return data as any;
}

/* ───────────── Participant identity ───────────── */

const IDENTITY_KEY = "smartcard:identity";

export interface CardIdentity {
  participantKey: string;
  displayName: string;
  remembered: boolean;
}

export const loadRememberedIdentity = (): CardIdentity | null => {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.participantKey && parsed?.displayName) return { ...parsed, remembered: true };
  } catch { /* noop */ }
  return null;
};

export const rememberIdentity = (identity: CardIdentity) => {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({
      participantKey: identity.participantKey,
      displayName: identity.displayName,
    }));
  } catch { /* noop */ }
};

export const newParticipantKey = (): string =>
  (globalThis.crypto?.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }));

export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/* ───────────── Teacher-side per-card stats (Phase 2) ───────────── */

export interface CardStats {
  attempts: number;
  players: number;
  bestMs: number | null;
  medianMs: number | null;
  lastAt: string | null;
  leaderboard: LeaderboardEntry[];
}

export async function fetchCardStats(cardId: string): Promise<CardStats> {
  const { data } = await supabase
    .from("smart_card_attempts")
    .select("display_name, participant_key, duration_ms, completed_at")
    .eq("card_id", cardId)
    .order("duration_ms", { ascending: true })
    .limit(200);

  const rows = data ?? [];
  const durations = rows.map((r) => Number(r.duration_ms ?? 0)).filter((n) => n > 0).sort((a, b) => a - b);
  const players = new Set(rows.map((r) => r.participant_key)).size;
  const lastAt = rows
    .map((r) => r.completed_at as string)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] ?? null;

  return {
    attempts: rows.length,
    players,
    bestMs: durations[0] ?? null,
    medianMs: durations.length ? durations[Math.floor(durations.length / 2)] : null,
    lastAt,
    leaderboard: rows.slice(0, 10).map((r) => ({
      displayName: r.display_name as string,
      durationMs: Number(r.duration_ms ?? 0),
      completedAt: r.completed_at as string,
    })),
  };
}

export const forgetIdentity = () => {
  try { localStorage.removeItem(IDENTITY_KEY); } catch { /* noop */ }
};
