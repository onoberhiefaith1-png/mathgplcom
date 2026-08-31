/**
 * EDITABLE 3D BUILDING — data access.
 *
 * Every read and write goes through the signed-in Supabase client, so the
 * database RLS policies (can_edit_building / can_view_building) are the single
 * security boundary: students and parents physically cannot write, whatever
 * the UI renders.
 *
 * Products are referenced by doors, never duplicated. Duplicating a building
 * copies the environment frame (surface designs, walkway structure, door
 * designs, lighting, effects) but NOT the content — the copy starts with
 * empty doors.
 */
import { supabase } from "@/integrations/supabase/client";
import { GAME_ASSETS_BUCKET } from "@/lib/games/types";
import type {
  Building,
  BuildingData,
  BuildingDoor,
  BuildingWalkway,
  BuildingWalkwayLink,
  DoorContentKind,
  EnvironmentSettings,
  WalkwayDirection,
} from "./types";
import { productRoute } from "@/lib/academy/types";
import { isBuiltinTexturePath } from "./gallery";

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

const ownedQuery = (orgId: string | null) =>
  orgId
    ? supabase
        .from("buildings")
        .select("*")
        .eq("org_id", orgId)
        .order("is_active", { ascending: false })
        .order("created_at")
    : supabase
        .from("buildings")
        .select("*")
        .is("org_id", null)
        .order("is_active", { ascending: false })
        .order("created_at");

/** All buildings the signed-in account may see for this workspace. */
export async function listBuildings(orgId: string | null): Promise<Building[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
const { data, error } = await ownedQuery(orgId);
  fail(error);
  return (data ?? []) as unknown as Building[];
}

/**
 * The workspace's active building, created on first visit by whoever may own
 * it. One building per workspace (org), or per account when there is no org.
 */
export async function ensureBuilding(orgId: string | null): Promise<Building | null> {
  const existing = await listBuildings(orgId);
  const active = existing.find((b) => b.is_active) ?? existing[0];
  if (active) return active;

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from("buildings")
    .insert({ org_id: orgId, owner_id: uid, name: "My Building", is_active: true })
    .select("*")
.maybeSingle();
  if (data) return data as unknown as Building;
  fail(error);

  // A teammate may have created it in the same moment — read it back.
  const retry = await listBuildings(orgId);
  return retry[0] ?? null;
}

export async function canEditBuilding(buildingId: string): Promise<boolean> {
  const { data } = await supabase.rpc("can_edit_building", { _building_id: buildingId });
  return Boolean(data);
}

/** The whole structure of one building: walkway graph + doors + connections. */
export async function loadBuildingData(building: Building): Promise<BuildingData> {
  const [walkRes, doorRes, linkRes, canEdit] = await Promise.all([
    supabase.from("building_walkways").select("*").eq("building_id", building.id).order("position"),
    supabase.from("building_doors").select("*").eq("building_id", building.id).order("position_along"),
    supabase
      .from("building_walkway_links")
      .select("*")
      .eq("building_id", building.id)
      .order("created_at"),
    canEditBuilding(building.id),
  ]);
fail(walkRes.error);
  fail(doorRes.error);
  fail(linkRes.error);
  return {
    building,
    walkways: (walkRes.data ?? []) as unknown as BuildingWalkway[],
    doors: (doorRes.data ?? []) as unknown as BuildingDoor[],
    links: (linkRes.data ?? []) as unknown as BuildingWalkwayLink[],
    canEdit,
  };
}

// ── Hallway-to-hallway connections (maze loops) ───────────────────────────

/**
 * Connect two hallways that already exist. The opening takes the next free slot
 * on BOTH roads, so neither connection lands on top of a door.
 */
export async function addWalkwayLink(
  buildingId: string,
  fromWalkwayId: string,
  toWalkwayId: string,
  positions: { from: number; to: number },
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("building_walkway_links")
    .insert({
      building_id: buildingId,
      from_walkway_id: fromWalkwayId,
      to_walkway_id: toWalkwayId,
      from_position: positions.from,
      to_position: positions.to,
      created_by: userData.user?.id ?? null,
    } as never)
    .select("*")
    .maybeSingle();
  fail(error);
  if (!data) {
    throw new Error(
      "The connection was not created — your account may not have permission to edit this building.",
    );
  }
  return (data as unknown as BuildingWalkwayLink).id;
}

export async function deleteWalkwayLink(id: string): Promise<void> {
  const { error } = await supabase.from("building_walkway_links").delete().eq("id", id);
  fail(error);
}

export async function updateEnvironment(
  buildingId: string,
  environment: EnvironmentSettings,
): Promise<void> {
  const { error } = await supabase
    .from("buildings")
    .update({ environment: environment as never })
    .eq("id", buildingId);
  fail(error);
}

export async function renameBuilding(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("buildings").update({ name }).eq("id", id);
  fail(error);
}

/** Make one building the active one for the workspace. */
export async function activateBuilding(id: string, orgId: string | null): Promise<void> {
  const others = await listBuildings(orgId);
  await Promise.all(
    others
      .filter((b) => b.id !== id && b.is_active)
      .map((b) => supabase.from("buildings").update({ is_active: false }).eq("id", b.id)),
  );
  const { error } = await supabase.from("buildings").update({ is_active: true }).eq("id", id);
  fail(error);
}

// ── Walkways ──────────────────────────────────────────────────────────────

export async function addWalkway(
  buildingId: string,
  parentId: string | null,
  direction: WalkwayDirection,
  name?: string,
  junctionAt = 0.5,
): Promise<string> {
  const hallwayName =
    name?.trim() || (parentId === null ? "Main Hallway" : direction === "left" ? "Left Hallway" : "Right Hallway");
  const { data, error } = await supabase
    .from("building_walkways")
    .insert({
      building_id: buildingId,
      parent_id: parentId,
      direction,
      name: hallwayName,
      junction_at: junctionAt,
    } as never)
    .select("*")
    .maybeSingle();
  fail(error);
  // A silent "nothing written" is impossible to debug from the UI, so it is an
  // explicit failure: the insert either returns its row or throws.
  if (!data) {
    throw new Error(
      "The hallway was not created — your account may not have permission to edit this building.",
    );
  }
  return (data as unknown as BuildingWalkway).id;
}

export async function updateWalkway(
  id: string,
  fields: Partial<
    Pick<BuildingWalkway, "length" | "position" | "name" | "end_label" | "junction_at">
  >,
): Promise<void> {
  const { error } = await supabase.from("building_walkways").update(fields as never).eq("id", id);
  fail(error);
}


export async function deleteWalkway(id: string): Promise<void> {
  const { error } = await supabase.from("building_walkways").delete().eq("id", id);
  fail(error);
}

// ── Doors ─────────────────────────────────────────────────────────────────

export async function addDoor(
  buildingId: string,
  walkwayId: string,
  fields: {
    position_along?: number;
    content_kind?: DoorContentKind | null;
    content_id?: string | null;
    title_override?: string | null;
  },
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("building_doors")
    .insert({
      building_id: buildingId,
      walkway_id: walkwayId,
      position_along: fields.position_along ?? 0.5,
      content_kind: fields.content_kind ?? null,
      content_id: fields.content_id ?? null,
      title_override: fields.title_override ?? null,
      created_by: userData.user?.id ?? null,
    })
    .select("*")
    .maybeSingle();
  fail(error);
  if (!data) {
    throw new Error(
      "The door was not created — your account may not have permission to edit this building.",
    );
  }
  return (data as unknown as BuildingDoor).id;
}

export async function updateDoor(
  id: string,
  fields: Partial<
    Pick<BuildingDoor, "position_along" | "content_kind" | "content_id" | "title_override" | "design">
  >,
): Promise<void> {
  const { error } = await supabase.from("building_doors").update(fields as never).eq("id", id);
  fail(error);
}

export async function deleteDoor(id: string): Promise<void> {
  const { error } = await supabase.from("building_doors").delete().eq("id", id);
  fail(error);
}

// ── Duplicate ─────────────────────────────────────────────────────────────

/**
 * Duplicate a building: copies the environment frame (surface designs,
 * walkway structure, door designs, lighting, effects). Content associations
 * are NOT copied — the copy starts with empty doors so the owner adds their
 * own content.
 */
export async function duplicateBuilding(
  source: Building,
  orgId: string | null,
): Promise<Building | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data: inserted, error } = await supabase
    .from("buildings")
    .insert({
      org_id: orgId,
      owner_id: uid,
      name: `${source.name} (copy)`,
      source_building_id: source.id,
      environment: source.environment as never,
      is_active: false,
    })
    .select("*")
    .single();
  if (error || !inserted) {
fail(error);
    return null;
  }
  const copy = inserted as unknown as Building;

  // Copy the walkway graph in tree order (roots first, then children).
  const { data: walkRows } = await supabase
    .from("building_walkways")
    .select("*")
    .eq("building_id", source.id)
    .order("position");
  const rows = (walkRows ?? []) as BuildingWalkway[];
  const idMap = new Map<string, string>();
  let remaining = rows;
  while (remaining.length > 0) {
    const pending: BuildingWalkway[] = [];
    for (const w of remaining) {
      if (w.parent_id && !idMap.has(w.parent_id)) {
        pending.push(w);
        continue;
      }
      const { data: nw } = await supabase
        .from("building_walkways")
        .insert({
          building_id: copy.id,
          parent_id: w.parent_id ? (idMap.get(w.parent_id) ?? null) : null,
          direction: w.direction,
          length: w.length,
          position: w.position,
          junction_at: w.junction_at ?? 0.5,

        })
        .select("id")
        .single();
      if (nw) idMap.set(w.id, (nw as { id: string }).id);
    }
    if (pending.length === remaining.length) break; // safety net
    remaining = pending;
  }

  // Copy door FRAMES (design + position) without any content.
  const { data: doorRows } = await supabase
    .from("building_doors")
    .select("*")
    .eq("building_id", source.id);
for (const d of (doorRows ?? []) as unknown as BuildingDoor[]) {
    const walkId = idMap.get(d.walkway_id);
    if (!walkId) continue;
    await supabase.from("building_doors").insert({
      building_id: copy.id,
      walkway_id: walkId,
      position_along: d.position_along,
      design: d.design as never,
      content_kind: null,
      content_id: null,
      title_override: null,
    });
  }

  return copy;
}

// ── Textures ──────────────────────────────────────────────────────────────

/**
 * Upload a surface/door texture into the building's private storage.
 * Accepts an optimised blob (see optimizeImageForTexture) and, when the
 * surface already has a stored texture, removes the old object after the new
 * one is in place so the bucket does not accumulate replaced panels.
 */
export async function uploadBuildingTexture(
  buildingId: string,
  surfaceKey: string,
  blob: Blob,
  contentType?: string,
  previousPath?: string | null,
): Promise<{ path: string }> {
  const mime = contentType || blob.type || "image/png";
  const ext = (mime.split("/")[1] ?? "png").replace("jpeg", "jpg");
  const path = `building-textures/${buildingId}/${surfaceKey}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, blob, { upsert: true, contentType: mime });
  if (error) throw error;
  if (previousPath && !isBuiltinTexturePath(previousPath) && previousPath !== path) {
    await supabase.storage.from(GAME_ASSETS_BUCKET).remove([previousPath]);
  }
  return { path };
}

// ── Door display helpers ──────────────────────────────────────────────────

/** The display title for a door, from its override or the product catalogue. */
export const doorTitle = (
  door: BuildingDoor,
  titles: Record<string, string>,
): string => {
  if (door.title_override) return door.title_override;
  if (door.content_kind && door.content_id) {
    const key = `${door.content_kind}:${door.content_id}`;
    if (titles[key]) return titles[key];
  }
  return door.content_kind ? "Product" : "Empty door";
};

/** Where opening a door takes the learner (empty string = class-context only). */
export const doorRoute = (door: BuildingDoor): string => {
  if (!door.content_kind || !door.content_id) return "";
  return productRoute(door.content_kind as DoorContentKind, door.content_id);
};