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
export const ensureGuestLink = async (input: {
  kind: GuestLinkKind;
  resourceId: string;
  classId?: string | null;
  title?: string | null;
}): Promise<GuestLink> => {
  const classId = input.classId ?? null;
  const existing = await findGuestLink(input.kind, input.resourceId, classId);
  if (existing) return existing;

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be signed in to create a guest link.");

  const { data, error } = await db
    .from("guest_links")
    .insert({
      owner_id: uid,
      kind: input.kind,
      resource_id: input.resourceId,
      class_id: classId,
      code: newCode(input.kind === "course" ? "K" : "A"),
      title: input.title ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the guest link");
  return data as GuestLink;
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
