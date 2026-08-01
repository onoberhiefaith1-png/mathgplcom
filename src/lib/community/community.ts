/**
 * MathGPL Community — data access.
 *
 * Ownership and moderation rights are enforced by row level security, so the
 * client talks to the tables directly: a member can only publish under their
 * own id, and only the Administrator can touch someone else's resource.
 */
import { supabase } from "@/integrations/supabase/client";
import { duplicateNotebook } from "@/lib/lessonnotes/notebookCopy";
import type {
  CommunityCard,
  CommunityKind,
  CommunityProfile,
  PublishInput,
} from "./types";

/* ---------------------------------------------------------------- identity */

export const getMyCommunityProfile = async (): Promise<CommunityProfile | null> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("community_profiles")
    .select("user_id, username, bio")
    .eq("user_id", uid)
    .maybeSingle();
  return (data as CommunityProfile | null) ?? null;
};

export const claimUsername = async (username: string): Promise<CommunityProfile> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("community_profiles")
    .upsert({ user_id: uid, username: username.trim() }, { onConflict: "user_id" })
    .select("user_id, username, bio")
    .single();
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      throw new Error("That username is already taken.");
    }
    throw error;
  }
  return data as CommunityProfile;
};

/* ---------------------------------------------------------------- browsing */

export interface FeedFilter {
  kind?: CommunityKind;
  search?: string;
  ownerId?: string;
  includeUnpublished?: boolean;
}

/** Hashtag matches rank first, then title, then description. */
const rank = (card: CommunityCard, needle: string): number => {
  const q = needle.toLowerCase();
  if (card.hashtags.some((t) => t.toLowerCase().includes(q))) return 0;
  if ((card.title ?? "").toLowerCase().includes(q)) return 1;
  if ((card.description ?? "").toLowerCase().includes(q)) return 2;
  if ((card.username ?? "").toLowerCase().includes(q)) return 3;
  return 99;
};

export const listCommunity = async (filter: FeedFilter = {}): Promise<CommunityCard[]> => {
  let query = supabase
    .from("community_resource_cards")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(200);
  if (filter.kind) query = query.eq("kind", filter.kind);
  if (filter.ownerId) query = query.eq("owner_id", filter.ownerId);
  if (!filter.includeUnpublished) query = query.eq("status", "published");

  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as CommunityCard[]).map((r) => ({
    ...r,
    hashtags: r.hashtags ?? [],
    like_count: Number(r.like_count ?? 0),
    active_downloads: Number(r.active_downloads ?? 0),
  }));

  const needle = filter.search?.trim();
  if (!needle) return rows;
  return rows
    .map((card) => ({ card, r: rank(card, needle) }))
    .filter((x) => x.r < 99)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.card);
};

export const listMyLikes = async (): Promise<Set<string>> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return new Set();
  const { data } = await supabase.from("community_likes").select("resource_id").eq("user_id", uid);
  return new Set(((data ?? []) as { resource_id: string }[]).map((r) => r.resource_id));
};

export const toggleLike = async (resourceId: string, liked: boolean) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (liked) {
    const { error } = await supabase
      .from("community_likes")
      .delete()
      .eq("resource_id", resourceId)
      .eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("community_likes")
      .insert({ resource_id: resourceId, user_id: uid });
    if (error) throw error;
  }
};

/* -------------------------------------------------------------- publishing */

export const publishResource = async (input: PublishInput): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const profile = await getMyCommunityProfile();
  if (!profile) throw new Error("Pick a community username first.");

  const row = {
    kind: input.kind,
    owner_id: uid,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    hashtags: input.hashtags,
    payload: (input.payload ?? {}) as never,
    source_id: input.sourceId,
    status: "published",
    published_at: new Date().toISOString(),
  };

  // Re-publishing the same source refreshes the existing card rather than
  // creating a duplicate listing.
  if (input.sourceId) {
    const { data: existing } = await supabase
      .from("community_resources")
      .select("id")
      .eq("kind", input.kind)
      .eq("source_id", input.sourceId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("community_resources")
        .update(row as never)
        .eq("id", existing.id);
      if (error) throw error;
      return existing.id as string;
    }
  }

  const { data, error } = await supabase
    .from("community_resources")
    .insert(row as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
};

export const setResourceStatus = async (id: string, status: "published" | "unpublished" | "removed") => {
  const { error } = await supabase.from("community_resources").update({ status }).eq("id", id);
  if (error) throw error;
};

export const deleteResource = async (id: string) => {
  const { error } = await supabase.from("community_resources").delete().eq("id", id);
  if (error) throw error;
};

export const updateResourceMeta = async (
  id: string,
  patch: { title?: string; description?: string | null; hashtags?: string[] },
) => {
  const { error } = await supabase.from("community_resources").update(patch).eq("id", id);
  if (error) throw error;
};

export const findMyPublication = async (
  kind: CommunityKind,
  sourceId: string,
): Promise<{ id: string; status: string } | null> => {
  const { data } = await supabase
    .from("community_resources")
    .select("id, status")
    .eq("kind", kind)
    .eq("source_id", sourceId)
    .maybeSingle();
  return (data as { id: string; status: string } | null) ?? null;
};

/* --------------------------------------------------------------- downloads */

const recordDownload = async (resourceId: string, copyId: string | null) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase
    .from("community_downloads")
    .insert({ resource_id: resourceId, user_id: uid, copy_id: copyId });
  if (error) throw error;
};

/**
 * A copy that no longer exists in the member's workspace stops counting
 * towards "active downloads".
 */
export const revokeDownloadForCopy = async (copyId: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await supabase
    .from("community_downloads")
    .update({ revoked_at: new Date().toISOString() })
    .eq("copy_id", copyId)
    .eq("user_id", uid)
    .is("revoked_at", null);
};

export type DownloadResult =
  | { kind: "lesson_note"; notebookId: string }
  | { kind: "lesson_asset" }
  | { kind: "adventure"; gameId: string }
  | { kind: "gallery" }
  | { kind: "other" };

const GALLERY_KINDS: CommunityKind[] = [
  "background",
  "building",
  "asset",
  "decoration",
  "effect",
  "reward",
];

/**
 * Copy never touches the device: it copies the resource straight into the
 * matching place in the member's own workspace, where it becomes an
 * independent, fully editable resource. The original is never modified.
 */
export const downloadResource = async (card: CommunityCard): Promise<DownloadResult> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  if (card.kind === "lesson_note") {
    const sourceNotebook = (card.payload?.notebook_id as string | undefined) ?? card.source_id;
    if (!sourceNotebook) throw new Error("This lesson note is no longer available.");
    const copyId = await duplicateNotebook(sourceNotebook, {
      scope: "workspace",
      titleSuffix: "",
    });
    await recordDownload(card.id, copyId);
    return { kind: "lesson_note", notebookId: copyId };
  }

  if (card.kind === "adventure") {
    const sourceGame = (card.payload?.game_id as string | undefined) ?? card.source_id;
    if (!sourceGame) throw new Error("This adventure is no longer available.");
    const { data: source, error: readError } = await supabase
      .from("games")
      .select("title, canvas, cover_url")
      .eq("id", sourceGame)
      .single();
    if (readError) throw readError;
    const { data: copy, error } = await supabase
      .from("games")
      .insert({
        owner_id: uid,
        title: (source as { title?: string }).title ?? card.title,
        canvas: (source as { canvas?: unknown }).canvas as never,
        cover_url: (source as { cover_url?: string | null }).cover_url ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    await recordDownload(card.id, copy.id as string);
    return { kind: "adventure", gameId: copy.id as string };
  }

  // A lesson-note asset is a saved editor object: it lands in the member's own
  // Asset Library, in the same section the creator filed it under.
  if (card.kind === "lesson_asset") {
    const node = card.payload?.node ?? null;
    if (!node) throw new Error("This asset is no longer available.");
    const shortCode = String(card.payload?.short_code ?? "").toUpperCase() || "AS";
    const { data: item, error } = await supabase
      .from("custom_assets")
      .insert({
        owner_id: uid,
        name: card.title,
        short_code: shortCode,
        section: String(card.payload?.section ?? "diagrams"),
        source: String(card.payload?.source ?? "other"),
        payload: { node } as never,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    await recordDownload(card.id, item.id as string);
    return { kind: "lesson_asset" };
  }

  if (GALLERY_KINDS.includes(card.kind)) {
    const { data: item, error } = await supabase
      .from("member_gallery_items")
      .insert({
        owner_id: uid,
        kind: card.kind,
        title: card.title,
        media_url: (card.payload?.media_url as string | undefined) ??
          (card.payload?.preview_url as string | undefined) ??
          null,
        storage_path: (card.payload?.storage_path as string | undefined) ?? null,
        media_type: (card.payload?.media_type as string | undefined) ?? null,
        source: (card.payload?.source as string | undefined) ?? null,
        source_resource_id: card.id,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    await recordDownload(card.id, item.id as string);
    return { kind: "gallery" };
  }

  await recordDownload(card.id, null);
  return { kind: "other" };
};

/* ----------------------------------------------------------------- classes */

export const requestClassAccess = async (card: CommunityCard) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const classId = (card.payload?.class_id as string | undefined) ?? card.source_id;
  if (!classId) throw new Error("This class is no longer available.");

  const { data: member } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("class_id", classId)
    .eq("user_id", uid)
    .maybeSingle();
  if (member) return { already: true as const, classId };

  const { data: existing } = await supabase
    .from("class_join_requests")
    .select("id")
    .eq("class_id", classId)
    .eq("requester_id", uid)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return { pending: true as const, classId };

  const { error } = await supabase
    .from("class_join_requests")
    .insert({ class_id: classId, requester_id: uid, status: "pending" });
  if (error) throw error;
  return { requested: true as const, classId };
};
