/**
 * Community people — the public directory.
 *
 * A Community profile is the *public* face of an account. It is written in the
 * Individual Workspace and only ever read here, and nothing is visible until
 * the owner switches listing on. Anonymous and signed-in discovery both go
 * through security-definer functions, never the table, so unlisted rows and
 * private fields (a student's location, anybody's date of birth) cannot leak.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * The directory functions ship with this feature, so they are newer than the
 * generated database types. One narrow escape hatch keeps the rest typed.
 */
const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    name,
    args,
  );

export type CommunityRoleKind = "teacher" | "school" | "student" | "parent";

export const COMMUNITY_ROLES: { kind: CommunityRoleKind; label: string; plural: string }[] = [
  { kind: "teacher", label: "Teacher", plural: "Teachers" },
  { kind: "school", label: "School", plural: "Schools" },
  { kind: "student", label: "Student", plural: "Students" },
  { kind: "parent", label: "Parent", plural: "Parents" },
];

export const ROLE_PLURAL: Record<CommunityRoleKind, string> = {
  teacher: "Teachers",
  school: "Schools",
  student: "Students",
  parent: "Parents",
};

/**
 * Everything professional lives in one open bag: a profile is never required to
 * be complete, and a role that does not use a field simply leaves it out.
 */
export type ProfessionalDetails = {
  qualifications?: string[];
  degrees?: string[];
  institutions?: string[];
  subjects?: string[];
  levels?: string[];
  curricula?: string[];
  expertise?: string[];
  skills?: string[];
  certifications?: string[];
  currentRole?: string;
  previousRoles?: string[];
  /** Professional history, one entry per line: "Role — School (2019–2023)". */
  experience?: string[];
  languages?: string[];
  /** Portfolio and external professional links. */
  links?: string[];
  /** "Available for online teaching", "Weekends only", … */
  onlineAvailability?: string;
  ageGroups?: string[];
  /** Schools. */
  schoolType?: string;
  programmes?: string[];
  ageRange?: string;
  studentCount?: string;
  approach?: string;
  website?: string;
  staff?: string[];
  opportunities?: string[];
  /** Students. */
  interests?: string[];
  achievements?: string[];
  yearGroup?: string;
  goals?: string[];
};

export type CommunityPerson = {
  userId: string;
  username: string;
  roleKind: CommunityRoleKind | null;
  displayName: string;
  headline: string | null;
  location: string | null;
  country: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverKind: "image" | "video";
  introVideoUrl: string | null;
  bio: string | null;
  bioLong?: string | null;
  professional: ProfessionalDetails;
  yearsExperience: number | null;
  viewCount: number;
  acceptsRequests: boolean;
  /** Ranking inputs, computed server side. */
  metrics: CommunityMetrics;
  prominence: number;
};

/** The proof points a discovery card shows, and the ranking inputs. */
export type CommunityMetrics = {
  shared: number;
  students: number;
  likes: number;
  posts: number;
  live: number;
};

export const EMPTY_METRICS: CommunityMetrics = { shared: 0, students: 0, likes: 0, posts: 0, live: 0 };

type DirectoryRow = {
  user_id: string;
  username: string;
  role_kind: string | null;
  display_name: string | null;
  headline: string | null;
  location: string | null;
  country: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  cover_kind?: string | null;
  intro_video_url?: string | null;
  bio: string | null;
  bio_long?: string | null;
  professional: ProfessionalDetails | null;
  years_experience: number | null;
  view_count: number | null;
  accepts_requests: boolean | null;
  shared_count?: number | null;
  student_count?: number | null;
  like_count?: number | null;
  post_count?: number | null;
  live_count?: number | null;
  prominence?: number | null;
};

const toPerson = (row: DirectoryRow): CommunityPerson => ({
  userId: row.user_id,
  username: row.username,
  roleKind: (row.role_kind as CommunityRoleKind | null) ?? null,
  displayName: row.display_name || row.username,
  headline: row.headline,
  location: row.location,
  country: row.country,
  avatarUrl: row.avatar_url,
  coverUrl: row.cover_url ?? null,
  coverKind: row.cover_kind === "video" ? "video" : "image",
  introVideoUrl: row.intro_video_url ?? null,
  bio: row.bio,
  bioLong: row.bio_long ?? null,
  professional: row.professional ?? {},
  yearsExperience: row.years_experience,
  viewCount: Number(row.view_count ?? 0),
  acceptsRequests: row.accepts_requests !== false,
  metrics: {
    shared: Number(row.shared_count ?? 0),
    students: Number(row.student_count ?? 0),
    likes: Number(row.like_count ?? 0),
    posts: Number(row.post_count ?? 0),
    live: Number(row.live_count ?? 0),
  },
  prominence: Number(row.prominence ?? 0),
});


export type DirectoryFilters = {
  subject?: string;
  level?: string;
  location?: string;
  qualification?: string;
  minYears?: number;
  interest?: string;
  schoolType?: string;
};

const hay = (values: unknown): string =>
  Array.isArray(values) ? values.join(" ").toLowerCase() : String(values ?? "").toLowerCase();

/** Filters are applied here so every directory shares one behaviour. */
export const applyDirectoryFilters = (
  people: CommunityPerson[],
  filters: DirectoryFilters,
): CommunityPerson[] =>
  people.filter((person) => {
    const pro = person.professional ?? {};
    if (filters.subject && !hay(pro.subjects).includes(filters.subject.toLowerCase())) return false;
    if (filters.level && !hay([...(pro.levels ?? []), ...(pro.curricula ?? [])]).includes(filters.level.toLowerCase()))
      return false;
    if (
      filters.location &&
      !`${person.location ?? ""} ${person.country ?? ""}`.toLowerCase().includes(filters.location.toLowerCase())
    )
      return false;
    if (
      filters.qualification &&
      !hay([...(pro.qualifications ?? []), ...(pro.degrees ?? []), ...(pro.certifications ?? [])]).includes(
        filters.qualification.toLowerCase(),
      )
    )
      return false;
    if (filters.minYears && (person.yearsExperience ?? 0) < filters.minYears) return false;
    if (
      filters.interest &&
      !hay([...(pro.interests ?? []), ...(pro.expertise ?? []), ...(pro.subjects ?? [])]).includes(
        filters.interest.toLowerCase(),
      )
    )
      return false;
    if (filters.schoolType && !hay(pro.schoolType).includes(filters.schoolType.toLowerCase())) return false;
    return true;
  });

/**
 * People are ordered by prominence, never alphabetically: the most active and
 * most engaged-with members come first. The search bar and the sidebar fields
 * only ever *filter* this ranked list — they never change the order rule.
 */
export const listCommunityPeople = async (
  role?: CommunityRoleKind | null,
  query?: string,
  limit = 60,
): Promise<CommunityPerson[]> => {
  const args = { _role: role ?? null, _q: query?.trim() || null, _limit: limit };
  const ranked = await rpc("community_directory_ranked", args);
  if (!ranked.error) return ((ranked.data ?? []) as unknown as DirectoryRow[]).map(toPerson);

  // Ranking ships with this feature; fall back to the plain directory until it
  // reaches the live backend so discovery never goes dark.
  const { data, error } = await rpc("community_directory", args);
  if (error) throw error;
  return ((data ?? []) as unknown as DirectoryRow[]).map(toPerson);
};

export const getCommunityPerson = async (username: string): Promise<CommunityPerson | null> => {
  const { data, error } = await rpc("community_public_profile", { _username: username });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as DirectoryRow | undefined;
  if (!row) return null;
  const person = toPerson(row);
  const stats = await rpc("community_member_stats", { _username: username });
  const statRow = (Array.isArray(stats.data) ? stats.data[0] : stats.data) as DirectoryRow | undefined;
  if (!stats.error && statRow) {
    person.metrics = {
      shared: Number(statRow.shared_count ?? 0),
      students: Number(statRow.student_count ?? 0),
      likes: Number(statRow.like_count ?? 0),
      posts: Number(statRow.post_count ?? 0),
      live: Number(statRow.live_count ?? 0),
    };
  }
  return person;
};


/** One counted view per viewer per profile per day; the count is server-side. */
export const recordProfileView = async (username: string): Promise<number> => {
  const { data } = await rpc("community_profile_viewed", { _username: username });
  return Number(data ?? 0);
};

/* ------------------------------------------------------ my own public profile */

export type MyCommunityProfile = {
  userId: string;
  username: string | null;
  isListed: boolean;
  roleKind: CommunityRoleKind | null;
  displayName: string;
  headline: string;
  location: string;
  country: string;
  avatarUrl: string;
  coverUrl: string;
  coverKind: "image" | "video";
  introVideoUrl: string;
  bio: string;
  bioLong: string;
  yearsExperience: number | null;
  professional: ProfessionalDetails;
  moderationState: "pending" | "approved" | "rejected";
  moderationReason: string | null;
};

const EMPTY_EDITABLE = {
  displayName: "",
  headline: "",
  location: "",
  country: "",
  avatarUrl: "",
  coverUrl: "",
  coverKind: "image" as "image" | "video",
  introVideoUrl: "",
  bio: "",
  bioLong: "",
  yearsExperience: null as number | null,
  professional: {} as ProfessionalDetails,
};


export const loadMyCommunityProfile = async (): Promise<MyCommunityProfile | null> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const [{ data: cp }, { data: p }] = await Promise.all([
    supabase.from("community_profiles").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("profiles").select("full_name, display_name, country, avatar_url").eq("user_id", uid).maybeSingle(),
  ]);

  const row = (cp ?? null) as (Record<string, unknown> & { username?: string }) | null;
  const base = (p ?? null) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  return {
    ...EMPTY_EDITABLE,
    userId: uid,
    username: row?.username ?? null,
    isListed: Boolean(row?.["is_listed"]),
    roleKind: (row?.["role_kind"] as CommunityRoleKind | null) ?? null,
    displayName: str(row?.["display_name"]) || str(base?.["full_name"]) || str(base?.["display_name"]),
    headline: str(row?.["headline"]),
    location: str(row?.["location"]),
    country: str(row?.["country"]) || str(base?.["country"]),
    avatarUrl: str(row?.["avatar_url"]) || str(base?.["avatar_url"]),
    coverUrl: str(row?.["cover_url"]),
    coverKind: str(row?.["cover_kind"]) === "video" ? "video" : "image",
    introVideoUrl: str(row?.["intro_video_url"]),
    bio: str(row?.["bio"]),
    bioLong: str(row?.["bio_long"]),

    yearsExperience: (row?.["years_experience"] as number | null) ?? null,
    professional: (row?.["professional"] as ProfessionalDetails | null) ?? {},
    moderationState: (row?.["moderation_state"] as MyCommunityProfile["moderationState"]) ?? "pending",
    moderationReason: (row?.["moderation_reason"] as string | null) ?? null,
  };
};

export type SaveCommunityProfileInput = Omit<MyCommunityProfile, "userId" | "moderationState" | "moderationReason">;

export const saveMyCommunityProfile = async (
  input: SaveCommunityProfileInput,
  moderation: { state: "approved" | "rejected" | "pending"; reason: string | null },
) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const payload = {
    user_id: uid,
    username: input.username?.trim() || undefined,
    is_listed: moderation.state === "rejected" ? false : input.isListed,
    role_kind: input.roleKind,
    display_name: input.displayName.trim() || null,
    headline: input.headline.trim() || null,
    location: input.location.trim() || null,
    country: input.country.trim() || null,
    avatar_url: input.avatarUrl.trim() || null,
    cover_url: input.coverUrl.trim() || null,
    cover_kind: input.coverKind,
    intro_video_url: input.introVideoUrl.trim() || null,
    bio: input.bio.trim() || null,
    bio_long: input.bioLong.trim() || null,

    years_experience: input.yearsExperience,
    professional: input.professional,
    moderation_state: moderation.state,
    moderation_reason: moderation.reason,
    moderated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("community_profiles")
    .upsert(payload as never, { onConflict: "user_id" });
  if (error) throw error;
};

/** How complete a profile is, as a percentage — never a requirement. */
export const profileCompleteness = (profile: SaveCommunityProfileInput): number => {
  const missing = missingProfilePieces(profile);
  return Math.round(((PROFILE_PIECES.length - missing.length) / PROFILE_PIECES.length) * 100);
};

/** Each named piece of a strong profile, and how to tell it is present. */
const PROFILE_PIECES: { label: string; done: (p: SaveCommunityProfileInput) => boolean }[] = [
  { label: "Community username", done: (p) => Boolean(p.username) },
  { label: "Display name", done: (p) => Boolean(p.displayName.trim()) },
  { label: "Professional headline", done: (p) => Boolean(p.headline.trim()) },
  { label: "Profile picture", done: (p) => Boolean(p.avatarUrl.trim()) },
  { label: "Cover image or video", done: (p) => Boolean(p.coverUrl.trim()) },
  { label: "Introduction video", done: (p) => Boolean(p.introVideoUrl.trim()) },
  { label: "Short summary", done: (p) => Boolean(p.bio.trim()) },
  { label: "About / biography", done: (p) => Boolean(p.bioLong.trim()) },
  { label: "Location", done: (p) => Boolean(p.location.trim() || p.country.trim()) },
  { label: "Subjects", done: (p) => (p.professional?.subjects ?? []).length > 0 },
  { label: "Levels or year groups", done: (p) => (p.professional?.levels ?? []).length > 0 },
  {
    label: "Qualifications",
    done: (p) =>
      (p.professional?.qualifications ?? []).length > 0 || (p.professional?.degrees ?? []).length > 0,
  },
  {
    label: "Experience",
    done: (p) => (p.professional?.experience ?? []).length > 0 || Boolean(p.professional?.currentRole),
  },
  {
    label: "Skills",
    done: (p) => (p.professional?.skills ?? []).length > 0 || (p.professional?.expertise ?? []).length > 0,
  },
];

/** What the owner still has to add, named so the dashboard can say it plainly. */
export const missingProfilePieces = (profile: SaveCommunityProfileInput): string[] =>
  PROFILE_PIECES.filter((piece) => !piece.done(profile)).map((piece) => piece.label);

/** The one-line summary a Community card shows — short, useful, discoverable. */
export const summaryLine = (person: CommunityPerson): string => {
  const pro = person.professional ?? {};
  const bits = [...(pro.subjects ?? []).slice(0, 2), ...(pro.levels ?? []).slice(0, 1), ...(pro.expertise ?? []).slice(0, 1)];
  return bits.join(" · ");
};


export const topQualification = (person: CommunityPerson): string | null => {
  const pro = person.professional ?? {};
  return pro.degrees?.[0] ?? pro.qualifications?.[0] ?? pro.certifications?.[0] ?? null;
};
