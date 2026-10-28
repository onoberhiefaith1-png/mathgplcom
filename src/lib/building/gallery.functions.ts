/**
 * BUILDING GALLERY — the trusted operations.
 *
 * Publishing, previewing and using a gallery building all cross ownership
 * boundaries (a template belongs to its publisher, not to the person using it),
 * so every one of them is decided on the server:
 *
 *   official publishing  → platform owner / co-admin / asset manager only
 *   community publishing → only the owner of the building being shared
 *   using an entry       → anyone who may edit their own building
 *
 * Nothing here ever writes to the published template: using an entry clones it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { cloneBuildingPackage } from "./clone.server";

const asAny = (client: unknown) => client as unknown as { from: (t: string) => any };

/** May this account publish into the OFFICIAL gallery? */
async function canPublishOfficial(supabase: any, userId: string): Promise<boolean> {
  const [owner, coAdmin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "platform_owner" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "co_admin" }),
    supabase.rpc("can_manage_gpl_assets"),
  ]);
  return Boolean(owner.data) || Boolean(coAdmin.data) || Boolean(manager.data);
}

/** Does this account own / may it edit the given building? */
async function assertCanEdit(supabase: any, buildingId: string): Promise<void> {
  const { data } = await supabase.rpc("can_edit_building", { _building_id: buildingId });
  if (!data) throw new Error("You cannot change that building.");
}

export const canPublishToGallery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    official: await canPublishOfficial(context.supabase, context.userId),
  }));

/**
 * Everything the gallery needs to render ONE building live in 3D. Lock secrets
 * never travel: only the shape of a lock is returned, exactly as the walkable
 * building does it.
 */
export const loadGalleryBuilding = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ entryId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: entry } = await asAny(context.supabase)
      .from("building_gallery_entries")
      .select("id, name, template_building_id, published, publisher_id, exterior_config, exterior_thumbnail")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) throw new Error("That building is no longer in the gallery.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAny(supabaseAdmin);
    const id = (entry as { template_building_id: string }).template_building_id;

    const [building, walkways, doors, classrooms, links, frames, locks] = await Promise.all([
      db.from("buildings").select("*").eq("id", id).maybeSingle(),
      db.from("building_walkways").select("*").eq("building_id", id).order("position"),
      db.from("building_doors").select("*").eq("building_id", id).order("position_along"),
      db.from("building_classrooms").select("*").eq("building_id", id).order("position"),
      db.from("building_walkway_links").select("*").eq("building_id", id),
      db.from("building_frames").select("*").eq("building_id", id),
      db
        .from("building_room_locks")
        .select("id, building_id, classroom_id, charset, code_length, max_attempts, retry_after_minutes")
        .eq("building_id", id),
    ]);

    const frameRows = (frames.data ?? []) as { id: string }[];
    const frameLinks = frameRows.length
      ? (
          await db
            .from("building_frame_links")
            .select("*")
            .in("frame_id", frameRows.map((f) => f.id))
        ).data ?? []
      : [];

    return {
      building: building.data,
      walkways: walkways.data ?? [],
      doors: doors.data ?? [],
      classrooms: classrooms.data ?? [],
      links: links.data ?? [],
      frames: frameRows,
      frameLinks,
      locks: locks.data ?? [],
      // The building's face — the rotating exterior saved with this entry.
      exterior: ((entry as { exterior_config?: Json | null }).exterior_config ?? null) as Json | null,
      exteriorThumbnail: (entry as { exterior_thumbnail?: string | null }).exterior_thumbnail ?? null,
    };
  });

/**
 * Save the current building into a gallery as a NEW complete building:
 * its rotating exterior plus its whole interior. The entry points at a frozen
 * CLONE, so the publisher keeps working on their own building without changing
 * what anybody else sees, and an earlier saved building is never overwritten.
 *
 * Learning links do not travel: doors and frames arrive without their Course /
 * Adventure / Assignment connections, because those belong to one particular
 * use of a building, not to the building itself.
 */
export const publishBuildingToGallery = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        buildingId: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        categorySlug: z.string().trim().min(1).max(60),
        description: z.string().trim().max(400).optional(),
        kind: z.enum(["official", "community"]),
        /** The rotating exterior exactly as it looks at the moment of saving. */
        exteriorConfig: z.any().nullable().optional(),
        exteriorThumbnail: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.buildingId);
    if (data.kind === "official" && !(await canPublishOfficial(context.supabase, context.userId))) {
      throw new Error("Only the platform owner and building managers publish official buildings.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAny(supabaseAdmin);

    const { buildingId: templateId } = await cloneBuildingPackage(db, data.buildingId, {
      ownerId: context.userId,
      orgId: null,
      name: `${data.name} (gallery template)`,
      isActive: false,
      keepContent: false,
    });

    const { data: entry, error } = await db
      .from("building_gallery_entries")
      .insert({
        kind: data.kind,
        name: data.name,
        description: data.description ?? null,
        category_slug: data.categorySlug,
        template_building_id: templateId,
        publisher_id: context.userId,
        published: true,
        exterior_config: data.exteriorConfig ?? null,
        exterior_thumbnail: data.exteriorThumbnail ?? null,
      })
      .select("id")
      .single();
    if (error || !entry) throw new Error(error?.message ?? "The building was not published.");
    return { entryId: (entry as { id: string }).id };
  });

/**
 * Use a gallery building: the complete package is copied into the caller's own
 * workspace and becomes their active building. The gallery original is untouched.
 */
export const useGalleryBuilding = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        entryId: z.string().uuid(),
        orgId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: entry } = await asAny(context.supabase)
      .from("building_gallery_entries")
      .select("id, name, template_building_id, published, exterior_config")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) throw new Error("That building is no longer in the gallery.");
    const row = entry as {
      name: string;
      template_building_id: string;
      published: boolean;
      exterior_config: Json | null;
    };
    if (!row.published) throw new Error("That building is not available.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAny(supabaseAdmin);
    const orgId = data.orgId ?? null;

    const { buildingId } = await cloneBuildingPackage(db, row.template_building_id, {
      ownerId: context.userId,
      orgId,
      name: row.name,
      isActive: true,
      // Links belong to a use of a building, never to the reusable building.
      keepContent: false,
    });

    // Exactly one active building per workspace.
    let others = db.from("buildings").update({ is_active: false }).neq("id", buildingId);
    others = orgId ? others.eq("org_id", orgId) : others.is("org_id", null).eq("owner_id", context.userId);
    await others;

    await db.from("building_gallery_uses").insert({
      entry_id: data.entryId,
      user_id: context.userId,
      building_id: buildingId,
    });

    // The caller applies this to their homepage building, so the exterior and
    // the interior arrive together.
    return { buildingId, exterior: row.exterior_config ?? null };
  });

/** Copy the caller's own building, complete, inside their workspace. */
export const cloneMyBuilding = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        buildingId: z.string().uuid(),
        orgId: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(80),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.buildingId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildingId } = await cloneBuildingPackage(asAny(supabaseAdmin), data.buildingId, {
      ownerId: context.userId,
      orgId: data.orgId ?? null,
      name: data.name,
      isActive: false,
    });
    return { buildingId };
  });

/**
 * Create a gallery category. Only the platform owner, co-admins and building
 * managers may add one, so the category list stays curated.
 */
export const createGalleryCategory = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ name: z.string().trim().min(2).max(60) }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (!(await canPublishOfficial(context.supabase, context.userId))) {
      throw new Error("Only the platform owner and building managers add categories.");
    }
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    if (!slug) throw new Error("Give the category a name using letters or numbers.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAny(supabaseAdmin);

    const { data: existing } = await db
      .from("building_gallery_categories")
      .select("slug, name, position")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) return existing as { slug: string; name: string; position: number };

    const { data: last } = await db
      .from("building_gallery_categories")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);
    const position = Number(((last ?? [])[0] as { position?: number } | undefined)?.position ?? 0) + 1;

    const { data: row, error } = await db
      .from("building_gallery_categories")
      .insert({ slug, name: data.name, position })
      .select("slug, name, position")
      .single();
    if (error || !row) throw new Error(error?.message ?? "The category was not created.");
    return row as { slug: string; name: string; position: number };
  });

/** The buildings this account has published, newest first — the "start from" list. */
export const listMyGalleryEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await asAny(context.supabase)
      .from("building_gallery_entries")
      .select("id, kind, name, category_slug, published, published_at")
      .eq("publisher_id", context.userId)
      .order("published_at", { ascending: false })
      .limit(8);
    return (data ?? []) as {
      id: string;
      kind: "official" | "community";
      name: string;
      category_slug: string;
      published: boolean;
      published_at: string;
    }[];
  });

/** Withdraw an entry. The template and every copy made from it stay untouched. */
export const unpublishGalleryEntry = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ entryId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await asAny(context.supabase)
      .from("building_gallery_entries")
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
