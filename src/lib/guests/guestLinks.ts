/**
 * Guest Links — teacher side.
 *
 * One link per Course / Assignment Card. It opens the ORIGINAL resource for
 * anyone, with no sign-in, no registration and no class joining. Guest work is
 * marked instantly and kept apart from every registered student record.
 */
import { supabase } from "@/integrations/supabase/client";
import { publicOrigin } from "@/lib/public/publicSite";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

export type GuestLinkKind = "course" | "assignment";

export interface GuestLink {
  id: string;
  kind: GuestLinkKind;
  resource_id: string;
  class_id: string | null;
  code: string;
  title: string | null;
  enabled: boolean;
  ask_name: boolean;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = (prefix: string) => {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}${out}`;
};

/** The one shareable address for a link. */
export const guestLinkUrl = (link: Pick<GuestLink, "kind" | "code">): string =>
  `${publicOrigin()}/${link.kind === "course" ? "k" : "a"}/${link.code}`;

export const findGuestLink = async (
  kind: GuestLinkKind,
  resourceId: string,
  classId: string | null = null,
): Promise<GuestLink | null> => {
  let q = db.from("guest_links").select("*").eq("kind", kind).eq("resource_id", resourceId);
  q = classId ? q.eq("class_id", classId) : q.is("class_id", null);
  const { data } = await q.maybeSingle();
  return (data as GuestLink | null) ?? null;
};

/** Create the link once and reuse it forever (never a new link per guest). */
/** Postgres unique-violation. */
const isDuplicate = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === "23505" || /duplicate key value|already exists/i.test(error?.message ?? "");

const isCodeClash = (error: { message?: string } | null | undefined) =>
  /guest_links_code_key/i.test(error?.message ?? "");

/** One shared promise per card, so two simultaneous opens never race. */
const inFlight = new Map<string, Promise<GuestLink>>();

const createGuestLink = async (input: {
  kind: GuestLinkKind;
  resourceId: string;
  classId: string | null;
  title?: string | null;
}): Promise<GuestLink> => {
  const existing = await findGuestLink(input.kind, input.resourceId, input.classId);
  if (existing) return existing;

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be signed in to create a guest link.");

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("guest_links")
      .insert({
        owner_id: uid,
        kind: input.kind,
        resource_id: input.resourceId,
        class_id: input.classId,
        code: newCode(input.kind === "course" ? "K" : "A"),
        title: input.title ?? null,
      })
      .select("*")
      .single();
    if (data) return data as GuestLink;

    if (isDuplicate(error)) {
      // A short-code clash: simply try another code.
      if (isCodeClash(error)) continue;
      // The link for this card already exists — reuse it.
      const found = await findGuestLink(input.kind, input.resourceId, input.classId);
      if (found) return found;
      throw new Error(
        "A guest link for this card already exists and belongs to another teacher, so it cannot be shown here.",
      );
    }
    throw new Error(error?.message ?? "Could not create the guest link");
  }
  throw new Error("Could not create the guest link. Please try again.");
};

export const ensureGuestLink = async (input: {
  kind: GuestLinkKind;
  resourceId: string;
  classId?: string | null;
  title?: string | null;
}): Promise<GuestLink> => {
  const classId = input.classId ?? null;
  const key = `${input.kind}:${input.resourceId}:${classId ?? "-"}`;
  const running = inFlight.get(key);
  if (running) return running;

  const task = createGuestLink({ ...input, classId }).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
};

export const updateGuestLink = async (
  id: string,
  patch: Partial<Pick<GuestLink, "enabled" | "ask_name" | "title">>,
): Promise<void> => {
  await db.from("guest_links").update(patch).eq("id", id);
};

export interface GuestPerformanceRow {
  guestName: string;
  score: number;
  totalMarks: number;
  status: string;
  updatedAt: string;
}

/** Guest / Audience Performance — kept entirely separate from students. */
export const loadGuestPerformance = async (linkId: string): Promise<GuestPerformanceRow[]> => {
  const { data } = await db
    .from("guest_attempts")
    .select("guest_token, guest_name, score, total_marks, status, updated_at")
    .eq("link_id", linkId)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as {
    guest_token: string;
    guest_name: string | null;
    score: number;
    total_marks: number;
    status: string;
    updated_at: string;
  }[];
  // One line per guest, summing the activities they completed.
  const byGuest = new Map<string, GuestPerformanceRow>();
  for (const r of rows) {
    const key = r.guest_token;
    const cur = byGuest.get(key);
    const name = r.guest_name?.trim() || `Guest ${key.slice(0, 4).toUpperCase()}`;
    if (cur) {
      cur.score += Number(r.score ?? 0);
      cur.totalMarks += Number(r.total_marks ?? 0);
      if (r.status !== "completed") cur.status = "in_progress";
    } else {
      byGuest.set(key, {
        guestName: name,
        score: Number(r.score ?? 0),
        totalMarks: Number(r.total_marks ?? 0),
        status: r.status,
        updatedAt: r.updated_at,
      });
    }
  }
  return Array.from(byGuest.values());
};

/* ─────────────── Live guests (the teacher's watch list) ─────────────── */

export interface LiveGuestRow {
  token: string;
  guestName: string;
  assessmentId: string | null;
  questionId: string | null;
  score: number;
  totalMarks: number;
  lastSeenAt: string;
  /** Seen within the last 90 seconds — working right now. */
  online: boolean;
  startedAt: string;
}

/** Who is on this guest link right now, most recent first. */
export const loadLiveGuests = async (linkId: string): Promise<LiveGuestRow[]> => {
  const { data } = await db
    .from("guest_presence")
    .select("guest_token, guest_name, assessment_id, question_id, score, total_marks, last_seen_at, started_at")
    .eq("link_id", linkId)
    .order("last_seen_at", { ascending: false })
    .limit(200);
  const now = Date.now();
  return ((data ?? []) as any[]).map((r) => ({
    token: r.guest_token as string,
    guestName: (r.guest_name as string | null)?.trim() || `Guest ${String(r.guest_token).slice(0, 4).toUpperCase()}`,
    assessmentId: (r.assessment_id as string | null) ?? null,
    questionId: (r.question_id as string | null) ?? null,
    score: Number(r.score ?? 0),
    totalMarks: Number(r.total_marks ?? 0),
    lastSeenAt: r.last_seen_at as string,
    startedAt: r.started_at as string,
    online: now - new Date(r.last_seen_at as string).getTime() < 90_000,
  }));
};

export interface GuestWorkRow {
  assessmentId: string;
  score: number;
  totalMarks: number;
  status: string;
  /** Every line the marking engine has awarded, `questionId:lineId` → marks. */
  solvedLines: Record<string, number>;
  updatedAt: string;
}

/** One guest's marked work — read-only, straight from their own attempt. */
export const loadGuestWork = async (linkId: string, token: string): Promise<GuestWorkRow[]> => {
  const { data } = await db
    .from("guest_attempts")
    .select("assessment_id, score, total_marks, status, solved_lines, updated_at")
    .eq("link_id", linkId)
    .eq("guest_token", token)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as any[]).map((r) => ({
    assessmentId: r.assessment_id as string,
    score: Number(r.score ?? 0),
    totalMarks: Number(r.total_marks ?? 0),
    status: String(r.status ?? "in_progress"),
    solvedLines: (r.solved_lines ?? {}) as Record<string, number>,
    updatedAt: r.updated_at as string,
  }));
};
