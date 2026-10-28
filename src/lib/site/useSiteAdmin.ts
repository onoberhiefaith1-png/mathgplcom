// Owner-side website content: read every section (published or not), stage
// edits as a draft, then publish. Reads/writes go through the normal client so
// the database policies decide who may change anything.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/games/urls";
import type {
  SiteContent,
  SiteMediaRef,
  SiteMediaResolved,
  SiteSection,
  SiteSectionKind,
  SiteSectionResolved,
  SiteStats,
  SiteStatsSettings,
  SiteTestimonial,
} from "./types";
import { templateOf } from "./types";

export type SectionPatch = Partial<
  Pick<
    SiteSection,
    | "eyebrow"
    | "headline"
    | "subline"
    | "cta_label"
    | "cta_href"
    | "media"
    | "items"
    | "visible"
    | "position"
  >
>;

/** A section merged with its staged draft — what the editor and preview show. */
export const mergeDraft = (row: SiteSection): SiteSection => ({
  ...row,
  ...(row.draft ?? {}),
  id: row.id,
  key: row.key,
  kind: row.kind,
});

export function useSiteAdmin() {
  const [rows, setRows] = useState<SiteSection[]>([]);
  const [testimonials, setTestimonials] = useState<SiteTestimonial[]>([]);
  const [statsSettings, setStatsSettings] = useState<SiteStatsSettings | null>(null);
  const [statsSettingsId, setStatsSettingsId] = useState<string | null>(null);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [sectionsRes, testimonialsRes, settingsRes, statsRes] = await Promise.all([
      supabase.from("site_sections").select("*").order("position", { ascending: true }),
      supabase.from("site_testimonials").select("*").order("position", { ascending: true }),
      supabase.from("site_stats_settings").select("*").limit(1).maybeSingle(),
      supabase.rpc("get_site_stats"),
    ]);
    setRows((sectionsRes.data ?? []) as unknown as SiteSection[]);
    setTestimonials((testimonialsRes.data ?? []) as unknown as SiteTestimonial[]);
    if (settingsRes.data) {
      const { id, ...flags } = settingsRes.data as { id: string } & SiteStatsSettings;
      setStatsSettingsId(id);
      setStatsSettings(flags);
    }
    setStats((statsRes.data ?? null) as SiteStats | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Stage an edit without touching the live site. */
  const saveDraft = useCallback(async (row: SiteSection, patch: SectionPatch) => {
    const draft = { ...(row.draft ?? {}), ...patch };
    const { error } = await supabase.from("site_sections").update({ draft: draft as never }).eq("id", row.id);
    if (error) throw error;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, draft } : r)));
  }, []);

  /** Push the staged draft live and clear it. */
  const publish = useCallback(async (row: SiteSection) => {
    const merged = mergeDraft(row);
    const { error } = await supabase
      .from("site_sections")
      .update({
        eyebrow: merged.eyebrow,
        headline: merged.headline,
        subline: merged.subline,
        cta_label: merged.cta_label,
        cta_href: merged.cta_href,
        media: (merged.media ?? {}) as never,
        items: (merged.items ?? []) as never,
        visible: merged.visible,
        position: merged.position,
        draft: null,
        published_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw error;
    await reload();
  }, [reload]);

  const publishAll = useCallback(async (list: SiteSection[]) => {
    for (const row of list) await publish(row);
  }, [publish]);

  /** Add a new section from the library: hidden, empty, at the end. */
  const createSection = useCallback(
    async ({ kind, title }: { kind: SiteSectionKind; title: string }) => {
      const template = templateOf(kind);
      const slugBase =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || kind;
      const existing = new Set(rows.map((r) => r.key));
      let key = slugBase;
      let n = 2;
      while (existing.has(key)) key = `${slugBase}-${n++}`;

      const maxPosition = rows.reduce((max, r) => Math.max(max, r.position), 0);
      const items = Array.from({ length: template?.defaultItems ?? 0 }, (_, i) => ({
        id: `item-${Date.now()}-${i}`,
        label: "",
        headline: "",
      }));

      const { error } = await supabase.from("site_sections").insert({
        key,
        kind,
        title: title.trim() || null,
        position: maxPosition + 1,
        visible: false,
        items: items as never,
        media: {} as never,
      } as never);
      if (error) throw error;
      await reload();
      return key;
    },
    [rows, reload],
  );

  /** Remove a section from the homepage for good. */
  const deleteSection = useCallback(
    async (row: SiteSection) => {
      const { error } = await supabase.from("site_sections").delete().eq("id", row.id);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const move = useCallback(
    async (row: SiteSection, direction: -1 | 1) => {
      const ordered = [...rows].sort((a, b) => a.position - b.position);
      const index = ordered.findIndex((r) => r.id === row.id);
      const target = ordered[index + direction];
      if (!target) return;
      await Promise.all([
        supabase.from("site_sections").update({ position: target.position }).eq("id", row.id),
        supabase.from("site_sections").update({ position: row.position }).eq("id", target.id),
      ]);
      await reload();
    },
    [rows, reload],
  );

  const setVisible = useCallback(
    async (row: SiteSection, visible: boolean) => {
      const { error } = await supabase.from("site_sections").update({ visible }).eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, visible } : r)));
    },
    [],
  );

  const updateStatsSettings = useCallback(
    async (patch: Partial<SiteStatsSettings>) => {
      if (!statsSettingsId) return;
      const next = { ...(statsSettings as SiteStatsSettings), ...patch };
      setStatsSettings(next);
      const { error } = await supabase
        .from("site_stats_settings")
        .update(patch)
        .eq("id", statsSettingsId);
      if (error) throw error;
    },
    [statsSettings, statsSettingsId],
  );

  const saveTestimonial = useCallback(
    async (value: Partial<SiteTestimonial> & { id?: string }) => {
      if (value.id) {
        const { error } = await supabase
          .from("site_testimonials")
          .update(value as never)
          .eq("id", value.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_testimonials").insert(value as never);
        if (error) throw error;
      }
      await reload();
    },
    [reload],
  );

  const deleteTestimonial = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("site_testimonials").delete().eq("id", id);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  return {
    rows,
    testimonials,
    statsSettings,
    stats,
    loading,
    reload,
    saveDraft,
    publish,
    createSection,
    deleteSection,
    publishAll,
    move,
    setVisible,
    updateStatsSettings,
    saveTestimonial,
    deleteTestimonial,
  };
}

/** Resolve draft media client-side so the owner can preview before publishing. */
export async function resolveSiteContentForPreview(
  rows: SiteSection[],
  testimonials: SiteTestimonial[],
  stats: SiteStats | null,
  statsSettings: SiteStatsSettings | null,
): Promise<SiteContent> {
  const resolveRef = async (ref?: SiteMediaRef | Record<string, never> | null) => {
    const media = ref as SiteMediaRef | null;
    if (!media?.path) return null;
    const url = media.source === "url" ? media.path : await getSignedUrl(media.path);
    if (!url) return null;
    const posterUrl = media.poster?.path
      ? media.poster.source === "url"
        ? media.poster.path
        : await getSignedUrl(media.poster.path)
      : null;
    return { url, mediaType: media.mediaType ?? "image", posterUrl } as SiteMediaResolved;
  };

  const sections: SiteSectionResolved[] = [];
  for (const raw of [...rows].sort((a, b) => a.position - b.position)) {
    const row = mergeDraft(raw);
    if (!row.visible) continue;
    const items = [];
    for (const item of row.items ?? []) {
      items.push({ ...item, media: await resolveRef(item.media) });
    }
    sections.push({
      key: row.key,
      kind: row.kind,
      position: row.position,
      eyebrow: row.eyebrow,
      headline: row.headline,
      subline: row.subline,
      ctaLabel: row.cta_label,
      ctaHref: row.cta_href,
      media: await resolveRef(row.media),
      items,
    });
  }

  return {
    sections,
    testimonials: testimonials.filter((t) => t.approved),
    stats: stats ?? { learners: 0, teachers: 0, schools: 0, questions: 0, adventures: 0 },
    statsSettings:
      statsSettings ?? {
        show_learners: false,
        show_teachers: false,
        show_schools: false,
        show_questions: false,
        show_adventures: false,
      },
  };
}
