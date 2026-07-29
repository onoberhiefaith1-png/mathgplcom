/**
 * Broadcast platforms for a Live Session.
 *
 * MathGPL Live does NOT integrate with any of these services — it only stores
 * and displays whatever link/code the teacher typed, so participants know where
 * the live class actually happens.
 */

export type BroadcastPlatformId =
  | "zoom"
  | "google-meet"
  | "teams"
  | "whatsapp"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "other";

export type BroadcastField = "link" | "code" | "password" | "note";

export type BroadcastPlatform = {
  id: BroadcastPlatformId;
  label: string;
  /** Field labels tuned per platform (e.g. Zoom uses "Meeting ID"). */
  labels?: Partial<Record<BroadcastField, string>>;
};

export const BROADCAST_PLATFORMS: BroadcastPlatform[] = [
  { id: "zoom", label: "Zoom", labels: { link: "Meeting Link", code: "Meeting ID", password: "Password" } },
  { id: "google-meet", label: "Google Meet", labels: { link: "Meeting Link", code: "Meeting Code" } },
  { id: "teams", label: "Microsoft Teams", labels: { link: "Meeting Link", code: "Meeting ID" } },
  { id: "whatsapp", label: "WhatsApp", labels: { link: "Call / Group Link" } },
  { id: "youtube", label: "YouTube Live", labels: { link: "Live URL" } },
  { id: "tiktok", label: "TikTok Live", labels: { link: "Live URL" } },
  { id: "instagram", label: "Instagram Live", labels: { link: "Profile / Live Link" } },
  { id: "facebook", label: "Facebook Live", labels: { link: "Live URL" } },
  { id: "other", label: "Other", labels: { link: "Link" } },
];

export type BroadcastEntry = {
  id: string;
  platform: BroadcastPlatformId;
  /** Used when platform is "other". */
  customName?: string;
  link?: string;
  code?: string;
  password?: string;
  note?: string;
};

export const platformOf = (id: BroadcastPlatformId): BroadcastPlatform =>
  BROADCAST_PLATFORMS.find((p) => p.id === id) ?? BROADCAST_PLATFORMS[BROADCAST_PLATFORMS.length - 1];

export const fieldLabel = (platform: BroadcastPlatformId, field: BroadcastField): string => {
  const fallback: Record<BroadcastField, string> = {
    link: "Link",
    code: "Code / Meeting ID",
    password: "Password",
    note: "Note",
  };
  return platformOf(platform).labels?.[field] ?? fallback[field];
};

export const displayName = (entry: BroadcastEntry): string =>
  entry.platform === "other" ? entry.customName?.trim() || "Other platform" : platformOf(entry.platform).label;

export const newBroadcastEntry = (platform: BroadcastPlatformId = "zoom"): BroadcastEntry => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `b-${Math.random().toString(36).slice(2)}`,
  platform,
});

const trimmed = (v?: string) => {
  const s = (v ?? "").trim();
  return s ? s : undefined;
};

/** Drops empty rows and blank fields so we never persist noise. */
export const normalizeBroadcasts = (entries: BroadcastEntry[]): BroadcastEntry[] =>
  entries
    .map((e) => ({
      id: e.id,
      platform: e.platform,
      customName: trimmed(e.customName),
      link: trimmed(e.link),
      code: trimmed(e.code),
      password: trimmed(e.password),
      note: trimmed(e.note),
    }))
    .filter((e) => e.link || e.code || e.password || e.note || (e.platform === "other" && e.customName));

/** Tolerant parse of the jsonb column. */
export const parseBroadcasts = (value: unknown): BroadcastEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v, i) => ({
      id: typeof v.id === "string" ? v.id : `b-${i}`,
      platform: (BROADCAST_PLATFORMS.some((p) => p.id === v.platform)
        ? v.platform
        : "other") as BroadcastPlatformId,
      customName: typeof v.customName === "string" ? v.customName : undefined,
      link: typeof v.link === "string" ? v.link : undefined,
      code: typeof v.code === "string" ? v.code : undefined,
      password: typeof v.password === "string" ? v.password : undefined,
      note: typeof v.note === "string" ? v.note : undefined,
    }));
};

/** Best-effort absolute URL so the anchor opens correctly in a new tab. */
export const toHref = (link?: string): string | null => {
  const s = (link ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return null;
};
