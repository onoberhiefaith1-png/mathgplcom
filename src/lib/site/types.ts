// Public website content model (homepage sections, testimonials, statistics).
export type SiteMediaSource = "storage" | "url";
export type SiteMediaType = "image" | "video";

export interface SiteMediaRef {
  path: string;
  source: SiteMediaSource;
  mediaType: SiteMediaType;
  /** Poster still for videos — always an image. */
  poster?: { path: string; source: SiteMediaSource } | null;
}

export interface SiteMediaResolved {
  url: string;
  mediaType: SiteMediaType;
  posterUrl?: string | null;
}

/** One editable panel inside a section (used by panels/showcase/audience kinds). */
export interface SiteItem {
  id: string;
  label?: string;
  headline?: string;
  subline?: string;
  media?: SiteMediaRef | null;
}

export interface SiteItemResolved extends Omit<SiteItem, "media"> {
  media?: SiteMediaResolved | null;
}

export type SiteSectionKind =
  | "hero"
  | "statement"
  | "video"
  | "panels"
  | "showcase"
  | "cinematic"
  | "compare"
  | "stats"
  | "audience"
  | "testimonials"
  | "demo"
  | "cta"
  | "footer";

export interface SiteSection {
  id: string;
  key: string;
  kind: SiteSectionKind;
  position: number;
  visible: boolean;
  eyebrow: string | null;
  headline: string | null;
  subline: string | null;
  cta_label: string | null;
  cta_href: string | null;
  media: SiteMediaRef | Record<string, never> | null;
  items: SiteItem[];
  draft: Partial<SiteSection> | null;
  published_at: string | null;
}

/** A section after draft merge + media resolution — what the homepage renders. */
export interface SiteSectionResolved {
  key: string;
  kind: SiteSectionKind;
  position: number;
  eyebrow?: string | null;
  headline?: string | null;
  subline?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  media?: SiteMediaResolved | null;
  items: SiteItemResolved[];
}

export interface SiteTestimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  organisation: string | null;
  quote: string;
  approved: boolean;
  position: number;
}

export interface SiteStats {
  learners: number;
  teachers: number;
  schools: number;
  questions: number;
  adventures: number;
}

export interface SiteStatsSettings {
  show_learners: boolean;
  show_teachers: boolean;
  show_schools: boolean;
  show_questions: boolean;
  show_adventures: boolean;
}

export interface SiteContent {
  sections: SiteSectionResolved[];
  testimonials: SiteTestimonial[];
  stats: SiteStats;
  statsSettings: SiteStatsSettings;
}

export const SECTION_TITLES: Record<string, string> = {
  hook: "01 — Hook (cinematic hero)",
  curiosity: "02 — Curiosity statement",
  product: "03 — Product reveal video",
  what: "04 — What it is (Learn / Interact / Play / Measure)",
  platform: "05 — Platform showcase",
  world: "06 — The MathGPL world",
  transformation: "07 — Transformation",
  numbers: "08 — By the numbers",
  audience: "09 — Who it's for",
  proof: "10 — Social proof",
  experience: "11 — Experience",
  final: "12 — Final call to action",
  footer: "13 — Footer",
};

/** Safe stand-in when site content can't be loaded. */
export const EMPTY_SITE_CONTENT: SiteContent = {
  sections: [],
  testimonials: [],
  stats: { learners: 0, teachers: 0, schools: 0, questions: 0, adventures: 0 },
  statsSettings: {
    show_learners: false,
    show_teachers: false,
    show_schools: false,
    show_questions: false,
    show_adventures: false,
  },
};
