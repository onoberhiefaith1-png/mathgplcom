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
  /** Owner-chosen display name for sections added from the section library. */
  title?: string | null;
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

/* ---------------------------------------------------------------- templates */

/** One ready-made block the owner can add from the section library. */
export interface SectionTemplate {
  kind: SiteSectionKind;
  label: string;
  description: string;
  /** How many panels/cards to create when the block uses them. */
  defaultItems: number;
  /** Fields the editor should offer for this block. */
  fields: {
    eyebrow?: boolean;
    headline?: boolean;
    subline?: boolean;
    cta?: boolean;
    media?: boolean;
    items?: boolean;
  };
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    kind: "hero",
    label: "Cinematic hero",
    description: "Full-screen image or video with an eyebrow, big headline, supporting line and button.",
    defaultItems: 0,
    fields: { eyebrow: true, headline: true, subline: true, cta: true, media: true },
  },
  {
    kind: "statement",
    label: "Statement",
    description: "A single large headline with a short supporting line. Quiet, confident, no media.",
    defaultItems: 0,
    fields: { headline: true, subline: true },
  },
  {
    kind: "video",
    label: "Product video",
    description: "Full-width video band with a headline above it. Upload a video or pick one from GPL Assets.",
    defaultItems: 0,
    fields: { headline: true, subline: true, media: true },
  },
  {
    kind: "panels",
    label: "Panel row",
    description: "Two to six panels side by side, each with a label, a short line and its own image.",
    defaultItems: 4,
    fields: { headline: true, subline: true, items: true },
  },
  {
    kind: "showcase",
    label: "Platform showcase",
    description: "Headline plus a row of media cards showing screens or features.",
    defaultItems: 3,
    fields: { headline: true, subline: true, items: true },
  },
  {
    kind: "cinematic",
    label: "Cinematic media band",
    description: "Full-bleed image or video with overlay text and an optional button.",
    defaultItems: 0,
    fields: { headline: true, subline: true, cta: true, media: true },
  },
  {
    kind: "compare",
    label: "Before / after",
    description: "Two panels side by side for a contrast — each with text and media.",
    defaultItems: 2,
    fields: { headline: true, subline: true, items: true },
  },
  {
    kind: "stats",
    label: "Numbers strip",
    description: "Headline with live platform counters. Choose which counters show under By the numbers.",
    defaultItems: 0,
    fields: { headline: true, subline: true },
  },
  {
    kind: "audience",
    label: "Audience cards",
    description: "One card per audience — schools, teachers, parents, students — with text and image.",
    defaultItems: 4,
    fields: { headline: true, subline: true, items: true },
  },
  {
    kind: "testimonials",
    label: "Testimonials",
    description: "Headline plus your approved testimonials. Stays hidden until one is approved.",
    defaultItems: 0,
    fields: { headline: true, subline: true },
  },
  {
    kind: "demo",
    label: "Interactive demo",
    description: "Invitation to try the product: headline, supporting line and a button.",
    defaultItems: 0,
    fields: { headline: true, subline: true, cta: true, media: true },
  },
  {
    kind: "cta",
    label: "Call to action",
    description: "Closing band with a headline, one line and a single button.",
    defaultItems: 0,
    fields: { headline: true, subline: true, cta: true },
  },
  {
    kind: "footer",
    label: "Footer",
    description: "Standard MathGPL footer with legal links. Only one is needed.",
    defaultItems: 0,
    fields: {},
  },
];

export const templateOf = (kind: SiteSectionKind): SectionTemplate | undefined =>
  SECTION_TEMPLATES.find((t) => t.kind === kind);

/** Editor heading for a section: owner title first, then the built-in name. */
export const sectionTitleOf = (row: { title?: string | null; key: string }): string =>
  row.title?.trim() || SECTION_TITLES[row.key] || row.key;
