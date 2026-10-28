/**
 * CLONE A COMPLETE BUILDING PACKAGE.
 *
 * A building is not its shell: it is hallways, hallway connections, doors, room
 * shells, room locks, frames, windows and their pictures, room screens, plus the
 * environment (surfaces, lighting, effects). Selecting a gallery building, or
 * publishing one, copies ALL of it — otherwise the person would have to rebuild
 * the interior by hand.
 *
 * Learning content is only ever REFERENCED. Doors and frame links keep pointing
 * at the courses / adventures / assignments that already exist, so nothing is
 * ever duplicated or, when a copy is deleted, lost.
 *
 * Server-only: it runs with the admin client, because a template published by
 * somebody else is deliberately not readable through the caller's own policies.
 */
type Row = Record<string, unknown>;
type Db = { from: (table: string) => any };

const STRIP = ["id", "created_at", "updated_at"];

/** A copy of a row without its identity, with the given fields replaced. */
const remap = (row: Row, patch: Row): Row => {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (STRIP.includes(key)) continue;
    out[key] = value;
  }
  return { ...out, ...patch };
};

const rowsOf = async (db: Db, table: string, buildingId: string, order?: string): Promise<Row[]> => {
  let query = db.from(table).select("*").eq("building_id", buildingId);
  if (order) query = query.order(order);
  const { data } = await query;
  return (data ?? []) as Row[];
};

export interface CloneOptions {
  ownerId: string;
  orgId: string | null;
  name: string;
  isActive: boolean;
  /** Doors and frames keep their content references (never a copy of content). */
  keepContent?: boolean;
}

export interface CloneResult {
  buildingId: string;
}

/**
 * Copy `sourceBuildingId` into a brand-new building owned by `ownerId`.
 * Returns the new building id. Throws when the source cannot be read.
 */
export async function cloneBuildingPackage(
  db: Db,
  sourceBuildingId: string,
  options: CloneOptions,
): Promise<CloneResult> {
  const { data: sourceRow } = await db
    .from("buildings")
    .select("*")
    .eq("id", sourceBuildingId)
    .maybeSingle();
  const source = sourceRow as Row | null;
  if (!source) throw new Error("That building could not be read.");

  const keepContent = options.keepContent !== false;

  const { data: created, error } = await db
    .from("buildings")
    .insert({
      org_id: options.orgId,
      owner_id: options.ownerId,
      name: options.name,
      source_building_id: sourceBuildingId,
      environment: source.environment,
      is_active: options.isActive,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "The building copy was not created.");
  const buildingId = (created as { id: string }).id;

  // ── Hallways, parents first so a branch always has its road ──────────────
  const walkways = await rowsOf(db, "building_walkways", sourceBuildingId, "position");
  const walkwayMap = new Map<string, string>();
  let pending = walkways;
  while (pending.length > 0) {
    const later: Row[] = [];
    for (const w of pending) {
      const parent = w.parent_id as string | null;
      if (parent && !walkwayMap.has(parent)) {
        later.push(w);
        continue;
      }
      const { data } = await db
        .from("building_walkways")
        .insert(
          remap(w, {
            building_id: buildingId,
            parent_id: parent ? walkwayMap.get(parent) ?? null : null,
          }),
        )
        .select("id")
        .single();
      if (data) walkwayMap.set(w.id as string, (data as { id: string }).id);
    }
    if (later.length === pending.length) break; // orphaned rows: stop safely
    pending = later;
  }

  // ── Doors (design, position, and their content reference) ────────────────
  const doors = await rowsOf(db, "building_doors", sourceBuildingId);
  const doorMap = new Map<string, string>();
  for (const d of doors) {
    const walkwayId = walkwayMap.get(d.walkway_id as string);
    if (!walkwayId) continue;
    const { data } = await db
      .from("building_doors")
      .insert(
        remap(d, {
          building_id: buildingId,
          walkway_id: walkwayId,
          created_by: options.ownerId,
          content_kind: keepContent ? d.content_kind : null,
          content_id: keepContent ? d.content_id : null,
        }),
      )
      .select("id")
      .single();
    if (data) doorMap.set(d.id as string, (data as { id: string }).id);
  }

  // ── Room shells ─────────────────────────────────────────────────────────
  const rooms = await rowsOf(db, "building_classrooms", sourceBuildingId, "position");
  const roomMap = new Map<string, string>();
  for (const r of rooms) {
    const doorId = doorMap.get(r.door_id as string);
    if (!doorId) continue;
    const { data } = await db
      .from("building_classrooms")
      .insert(remap(r, { building_id: buildingId, door_id: doorId }))
      .select("id")
      .single();
    if (data) roomMap.set(r.id as string, (data as { id: string }).id);
  }

  // ── Hallway connections, including their physical corridor ──────────────
  const links = await rowsOf(db, "building_walkway_links", sourceBuildingId);
  for (const l of links) {
    const from = walkwayMap.get(l.from_walkway_id as string);
    const to = walkwayMap.get(l.to_walkway_id as string);
    if (!from || !to) continue;
    const corridor = l.corridor_walkway_id
      ? walkwayMap.get(l.corridor_walkway_id as string) ?? null
      : null;
    await db.from("building_walkway_links").insert(
      remap(l, {
        building_id: buildingId,
        from_walkway_id: from,
        to_walkway_id: to,
        corridor_walkway_id: corridor,
      }),
    );
  }

  // ── Room locks: the same code opens the copy ─────────────────────────────
  const locks = await rowsOf(db, "building_room_locks", sourceBuildingId);
  for (const lock of locks) {
    const roomId = roomMap.get(lock.classroom_id as string);
    if (!roomId) continue;
    await db.from("building_room_locks").insert(
      remap(lock, {
        building_id: buildingId,
        classroom_id: roomId,
        created_by: options.ownerId,
      }),
    );
  }

  // ── Frames and windows, with the picture placed inside them ─────────────
  const frames = await rowsOf(db, "building_frames", sourceBuildingId);
  const frameMap = new Map<string, string>();
  for (const f of frames) {
    const walkwayId = f.walkway_id ? walkwayMap.get(f.walkway_id as string) ?? null : null;
    const roomId = f.classroom_id ? roomMap.get(f.classroom_id as string) ?? null : null;
    if (!walkwayId && !roomId) continue;
    const { data } = await db
      .from("building_frames")
      .insert(
        remap(f, { building_id: buildingId, walkway_id: walkwayId, classroom_id: roomId }),
      )
      .select("id")
      .single();
    if (data) frameMap.set(f.id as string, (data as { id: string }).id);
  }

  if (keepContent && frameMap.size > 0) {
    const { data: linkRows } = await db
      .from("building_frame_links")
      .select("*")
      .in("frame_id", [...frameMap.keys()]);
    for (const fl of (linkRows ?? []) as Row[]) {
      const frameId = frameMap.get(fl.frame_id as string);
      if (!frameId) continue;
      await db.from("building_frame_links").insert(remap(fl, { frame_id: frameId }));
    }
  }

  // ── Smart Screens (the uploaded video stays with the room) ───────────────
  const screens = await rowsOf(db, "building_room_screens", sourceBuildingId);
  for (const s of screens) {
    const roomId = roomMap.get(s.classroom_id as string);
    if (!roomId) continue;
    await db
      .from("building_room_screens")
      .insert(remap(s, { building_id: buildingId, classroom_id: roomId }));
  }

  return { buildingId };
}
