/**
 * MathGPL Community — shared types.
 *
 * Community is a *workspace*, not a second application: a resource published
 * here is a snapshot plus creator identity. Downloading copies it into the
 * member's own workspace, and the copy is independent forever.
 */

export type CommunityKind =
  | "lesson_note"
  | "class"
  | "adventure"
  | "background"
  | "building"
  | "asset";

export const COMMUNITY_KINDS: { kind: CommunityKind; label: string; plural: string }[] = [
  { kind: "lesson_note", label: "Lesson Note", plural: "Lesson Notes" },
  { kind: "class", label: "Class", plural: "Classes" },
  { kind: "adventure", label: "Adventure", plural: "Adventures" },
  { kind: "background", label: "Background", plural: "Backgrounds" },
  { kind: "building", label: "Building", plural: "Buildings" },
  { kind: "asset", label: "Asset", plural: "Assets" },
];

export const KIND_LABEL: Record<CommunityKind, string> = COMMUNITY_KINDS.reduce(
  (acc, k) => ({ ...acc, [k.kind]: k.label }),
  {} as Record<CommunityKind, string>,
);

export const KIND_PLURAL: Record<CommunityKind, string> = COMMUNITY_KINDS.reduce(
  (acc, k) => ({ ...acc, [k.kind]: k.plural }),
  {} as Record<CommunityKind, string>,
);

export type CommunityStatus = "published" | "unpublished" | "removed";

export interface CommunityProfile {
  user_id: string;
  username: string;
  bio: string | null;
}

export interface CommunityCard {
  id: string;
  kind: CommunityKind;
  owner_id: string;
  title: string;
  description: string | null;
  hashtags: string[];
  payload: Record<string, unknown>;
  source_id: string | null;
  status: CommunityStatus;
  published_at: string;
  username: string | null;
  like_count: number;
  active_downloads: number;
}

export interface PublishInput {
  kind: CommunityKind;
  sourceId: string | null;
  title: string;
  description?: string;
  hashtags: string[];
  payload?: Record<string, unknown>;
}

/** `#Algebra, geometry  #JSS2` → ["#Algebra", "#geometry", "#JSS2"] */
export const parseHashtags = (raw: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[\s,]+/)) {
    const clean = piece.replace(/^#+/, "").trim();
    if (!clean) continue;
    const tag = `#${clean}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
};

export const USERNAME_RULES = "3–24 characters: letters, numbers, dot, dash or underscore.";

export const isValidUsername = (name: string) => /^[A-Za-z0-9._-]{3,24}$/.test(name.trim());
