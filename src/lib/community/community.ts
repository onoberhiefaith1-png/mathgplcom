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
  | { kind: "other" };

/**
 * Download never touches the device: it copies the resource straight into the
 * matching place in the member's own workspace.
 */
export const downloadResource = async (card: CommunityCard): Promise<DownloadResult> => {
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

  // Backgrounds, buildings, assets and adventures land in their own galleries
  // once those galleries exist per member (next phase). The download is still
  // recorded so creators see accurate active-download counts.
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
