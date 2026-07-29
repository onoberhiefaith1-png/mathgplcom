// Smart Card publishing — MathGPL Life only.
//
// A Smart Card is NOT a new question type. It is a publishing format for a
// Lesson Note question that already has a Solution. Publishing snapshots the
// question's presentation so later Lesson Note edits never mutate a card that
// is already in the wild.

import { supabase } from "@/integrations/supabase/client";
import { compileSectionQuestions, type AssessmentKind } from "@/lib/assessments/createAssessment";
import type { GeometryScene } from "@/lib/geometry/scene";
import { normalizeCanvas } from "@/lib/games/types";

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
  /** Game Challenge: the progress bar that carries THIS card's question. */
  game_progress_element_id: string | null;
  /** Game Challenge: percentage of the question's marks needed to qualify. */
  pass_mark_pct: number;
  topic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  /** Storage path of the shared social snapshot (regenerated on republish). */
  preview_image_path?: string | null;
}



const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
/** Short, human-typeable public code, e.g. mathgpl.live/c/8gj2 */
export const generateSlug = () =>
  Array.from({ length: 4 }, () => SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]).join("");

/** The public site — never a development/preview host. */
export const PUBLIC_SITE = "https://golden-hour-academy.lovable.app";

/**
 * Hosts that are private by design. A link copied from any of these would show
 * "Access denied" to a member of the public, so we never hand one out.
 */
const isPrivateHost = (host: string) =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host === "127.0.0.1" ||
  host.endsWith(".lovableproject.com") ||
  host.endsWith(".lovable.dev") ||
  host.endsWith(".sandbox.lovable.dev") ||
  host.includes("preview--") ||
  host.includes("id-preview");

export const publicOrigin = () => {
  if (typeof window === "undefined") return PUBLIC_SITE;
  const { origin, hostname } = window.location;
  return isPrivateHost(hostname) ? PUBLIC_SITE : origin;
};

/** Clean, one-line public link for the card. */
export const cardUrl = (slug: string) => `${publicOrigin()}/c/${slug}`;

/** What Copy / Share put on the clipboard — the short public URL only. */
export const shareUrl = (slug: string) => cardUrl(slug);

/** Social preview image for a card, served by the public preview endpoint. */
export const previewImageUrl = (slug: string) => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return "";
  return `${base}/functions/v1/smart-card-preview?slug=${encodeURIComponent(slug)}&image=1`;
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

  // Short slugs are only safe with a collision check — try a few candidates.
  let slug = generateSlug();
  for (let i = 0; i < 8; i += 1) {
    const { data: clash } = await supabase
      .from("smart_cards")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = generateSlug();
  }

  const { data: created, error } = await supabase
    .from("smart_cards")
    .insert({
      owner_id: uid,
      notebook_id: input.notebookId,
      subsection_id: input.subsectionId,
      section_id: (sub as any)?.section_id ?? null,
      slug,
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
    game_progress_element_id?: string | null;
    pass_mark_pct?: number;
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

/* ───────────── Game Challenge mapping (MathGPL Live only) ───────────── */

export interface GameBarSlot {
  id: string;
  label: string;
  index: number;
  /** Bar 1 is always reserved for the event countdown. */
  isTimeBar: boolean;
  /** Title of the Smart Card already using this bar (if any). */
  takenBy: string | null;
  takenByCardId: string | null;
}

/** Every progress bar in a game, in canvas order, with its current purpose. */
export async function listGameProgressBars(
  gameId: string,
  cardId?: string,
): Promise<GameBarSlot[]> {
  const [{ data: game }, { data: cards }] = await Promise.all([
    supabase.from("games").select("canvas").eq("id", gameId).maybeSingle(),
    supabase
      .from("smart_cards")
      .select("id, title, game_progress_element_id")
      .eq("game_id", gameId)
      .eq("publish_mode", "game"),
  ]);
  const taken = new Map<string, { id: string; title: string }>();
  for (const c of (cards ?? []) as any[]) {
    if (c.game_progress_element_id && c.id !== cardId) {
      taken.set(c.game_progress_element_id, { id: c.id, title: c.title });
    }
  }
  const canvas = normalizeCanvas((game as any)?.canvas);
  const bars: GameBarSlot[] = [];
  for (const scene of canvas.scenes) {
    for (const el of scene.elements) {
      if (el.kind !== "progress_bar") continue;
      const owner = taken.get(el.id) ?? null;
      bars.push({
        id: el.id,
        label: (el as any).label || `Progress Bar ${bars.length + 1}`,
        index: bars.length,
        isTimeBar: bars.length === 0,
        takenBy: owner?.title ?? null,
        takenByCardId: owner?.id ?? null,
      });
    }
  }
  return bars.map((b, i) => ({ ...b, index: i, isTimeBar: i === 0 }));
}

/** Marks a player must reach to qualify. */
export const requiredMarksFor = (totalMarks: number, passPct: number) =>
  Math.max(1, Math.round((Math.max(0, totalMarks) * Math.max(1, Math.min(100, passPct))) / 100));

/** Game Challenge: attach the card's game to the hidden holder class and point
 *  ONLY the teacher-chosen progress bar at this card's assessment. Bar 1 is
 *  reserved as the event Time Bar and never carries a question. */
async function linkGameChallenge(input: {
  gameId: string;
  classId: string;
  assessmentId: string;
  notebookId: string | null;
  sectionId: string | null;
  totalMarks: number;
  passMarkPct: number;
  progressElementId: string | null;
}): Promise<void> {
  const { gameId, classId, assessmentId } = input;

  await supabase.from("class_games").upsert(
    { class_id: classId, game_id: gameId } as never,
    { onConflict: "class_id,game_id" },
  );

  const bars = await listGameProgressBars(gameId);
  if (bars.length === 0) throw new Error("game_has_no_progress_bar");
  if (bars.length < 2) throw new Error("game_has_no_question_bar");

  const timeBar = bars[0];
  const questionBars = bars.slice(1);
  const chosen = questionBars.find((b) => b.id === input.progressElementId);
  if (!chosen) throw new Error("no_progress_bar_selected");

  // Bar 1 is the countdown: make sure a Time Bar row exists on it.
  const { data: tb } = await supabase
    .from("game_time_bars" as never)
    .select("game_id, progress_element_id")
    .eq("game_id", gameId)
    .maybeSingle();
  if (!tb) {
    await supabase.from("game_time_bars" as never).insert({
      game_id: gameId,
      progress_element_id: timeBar.id,
      duration_seconds: 600,
      default_duration_seconds: 600,
    } as never);
  } else if ((tb as any).progress_element_id !== timeBar.id) {
    await supabase
      .from("game_time_bars" as never)
      .update({ progress_element_id: timeBar.id } as never)
      .eq("game_id", gameId);
  }

  // This card owns exactly one bar; other cards keep theirs.
  await supabase
    .from("class_game_boards")
    .delete()
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("assessment_id", assessmentId);
  await supabase
    .from("class_game_boards")
    .delete()
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("progress_element_id", timeBar.id);
  await supabase.from("class_game_boards").upsert(
    {
      class_id: classId,
      game_id: gameId,
      progress_element_id: chosen.id,
      assessment_id: assessmentId,
      notebook_id: input.notebookId,
      section_id: input.sectionId,
      required_marks: requiredMarksFor(input.totalMarks, input.passMarkPct),
      question_keys: [],
    } as never,
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
      passMarkPct: card.pass_mark_pct ?? 100,
      progressElementId: card.game_progress_element_id ?? null,

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
  /** Card owner — used to auto-detect the creator on the public page. */
  ownerId?: string | null;
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
