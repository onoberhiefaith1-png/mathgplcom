import { createServerFn } from "@tanstack/react-start";
import type {
  SiteContent,
  SiteMediaRef,
  SiteMediaResolved,
  SiteSection,
  SiteSectionResolved,
} from "./types";

const BUCKET = "game-assets";
const SIGN_TTL = 60 * 60;

/**
 * Public homepage content. Read with the privileged client so anonymous
 * visitors can see published sections and signed media without any session,
 * and so the page renders complete on the server (no media pop-in).
 */
export const getSiteContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteContent> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [sectionsRes, testimonialsRes, statsRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from("site_sections")
        .select("*")
        .not("published_at", "is", null)
        .eq("visible", true)
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("site_testimonials")
        .select("id, author_name, author_role, organisation, quote, approved, position")
        .eq("approved", true)
        .order("position", { ascending: true }),
      supabaseAdmin.rpc("get_site_stats"),
      supabaseAdmin.from("site_stats_settings").select("*").limit(1).maybeSingle(),
    ]);

    const rows = (sectionsRes.data ?? []) as unknown as SiteSection[];

    // Collect every storage path once, then sign in a single batch.
    const paths = new Set<string>();
    const collect = (ref?: SiteMediaRef | Record<string, never> | null) => {
      const media = ref as SiteMediaRef | null;
      if (!media?.path) return;
      if (media.source === "storage") paths.add(media.path);
      if (media.poster?.source === "storage" && media.poster.path) paths.add(media.poster.path);
    };
    for (const row of rows) {
      collect(row.media);
      for (const item of row.items ?? []) collect(item.media);
    }

    const signed: Record<string, string> = {};
    await Promise.all(
      [...paths].map(async (path) => {
        const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
        if (data?.signedUrl) signed[path] = data.signedUrl;
      }),
    );

    const resolve = (ref?: SiteMediaRef | Record<string, never> | null): SiteMediaResolved | null => {
      const media = ref as SiteMediaRef | null;
      if (!media?.path) return null;
      const url = media.source === "url" ? media.path : signed[media.path];
      if (!url) return null;
      const posterUrl = media.poster?.path
        ? media.poster.source === "url"
          ? media.poster.path
          : signed[media.poster.path] ?? null
        : null;
      return { url, mediaType: media.mediaType ?? "image", posterUrl };
    };

    const sections: SiteSectionResolved[] = rows.map((row) => ({
      key: row.key,
      kind: row.kind,
      position: row.position,
      eyebrow: row.eyebrow,
      headline: row.headline,
      subline: row.subline,
      ctaLabel: row.cta_label,
      ctaHref: row.cta_href,
      media: resolve(row.media),
      items: (row.items ?? []).map((item) => ({ ...item, media: resolve(item.media) })),
    }));

    const stats = (statsRes.data ?? {}) as Partial<SiteContent["stats"]>;

    return {
      sections,
      testimonials: (testimonialsRes.data ?? []) as SiteContent["testimonials"],
      stats: {
        learners: stats.learners ?? 0,
        teachers: stats.teachers ?? 0,
        schools: stats.schools ?? 0,
        questions: stats.questions ?? 0,
        adventures: stats.adventures ?? 0,
      },
      statsSettings: {
        show_learners: settingsRes.data?.show_learners ?? false,
        show_teachers: settingsRes.data?.show_teachers ?? false,
        show_schools: settingsRes.data?.show_schools ?? false,
        show_questions: settingsRes.data?.show_questions ?? false,
        show_adventures: settingsRes.data?.show_adventures ?? false,
      },
    };
  },
);
