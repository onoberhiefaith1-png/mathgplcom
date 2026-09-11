/**
 * BUILDING GALLERY — browsing contract.
 *
 * A gallery entry is a complete building: it points at a TEMPLATE building that
 * holds the whole package (hallways, rooms, doors, frames, windows, locks,
 * lighting, effects). Two sources share one browsing surface:
 *
 *   official   — published by the platform owner / co-admins / asset managers
 *   community  — shared voluntarily by an owner who modified a building
 *
 * Selecting an entry always CLONES its template, so a published building can
 * never be modified or overwritten by the people using it.
 */
import { supabase } from "@/integrations/supabase/client";

export type GalleryKind = "official" | "community";

export interface GalleryCategory {
  slug: string;
  name: string;
  position: number;
}

export interface GalleryEntry {
  id: string;
  kind: GalleryKind;
  name: string;
  description: string | null;
  category_slug: string;
  template_building_id: string;
  publisher_id: string;
  published: boolean;
  published_at: string;
}

/** Rows land through a staged migration, so they are not in the generated types. */
const table = (name: string) =>
  (supabase.from as unknown as (t: string) => any)(name);

export const GALLERY_PAGE_SIZE = 12;

export async function listGalleryCategories(): Promise<GalleryCategory[]> {
  const { data, error } = await table("building_gallery_categories")
    .select("slug, name, position")
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as GalleryCategory[];
}

/**
 * One page of buildings inside a category. Paging keeps a collection of
 * hundreds fast: only the entries actually being browsed are read.
 */
export async function listGalleryEntries(options: {
  kind: GalleryKind;
  categorySlug: string;
  offset?: number;
  limit?: number;
}): Promise<GalleryEntry[]> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? GALLERY_PAGE_SIZE;
  const { data, error } = await table("building_gallery_entries")
    .select(
      "id, kind, name, description, category_slug, template_building_id, publisher_id, published, published_at",
    )
    .eq("kind", options.kind)
    .eq("category_slug", options.categorySlug)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as GalleryEntry[];
}

/**
 * Every published building of one kind, with the exterior saved on the entry so
 * the selector can show the building's own face. Used by the Building Selector,
 * where the collection is browsed one complete building at a time.
 */
export async function listGalleryShelf(kind: GalleryKind): Promise<
  (GalleryEntry & { exterior_config: unknown; exterior_thumbnail: string | null })[]
> {
  const { data, error } = await table("building_gallery_entries")
    .select(
      "id, kind, name, description, category_slug, template_building_id, publisher_id, published, published_at, exterior_config, exterior_thumbnail",
    )
    .eq("kind", kind)
    .eq("published", true)
    .order("published_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as (GalleryEntry & {
    exterior_config: unknown;
    exterior_thumbnail: string | null;
  })[];
}

export const GALLERY_KIND_LABEL: Record<GalleryKind, string> = {
  official: "MathGPL Gallery",
  community: "Community",
};
