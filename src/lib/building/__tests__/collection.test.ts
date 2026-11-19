import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BUILDING_COLLECTION,
  COLLECTION_HALLWAYS,
  COLLECTION_ROOMS,
  ERA_CATEGORY,
  collectionArtwork,
  collectionBlueprint,
} from "../collection";
import { compileNavGraph } from "../navigation";
import { CORE_SLOTS, RING_SLOTS } from "@/lib/homepage/buildingSlots";
import { DOOR_STYLES } from "../doors";
import { frameProfile } from "../frameStyles";
import { mergeEnvironment } from "../env";
import { tileFit } from "../imageFit";
import type { BuildingWalkway } from "../types";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const migration = readFileSync(`${root}supabase/migrations/20261118120000_ten_building_collection.sql`, "utf8");

describe("ten-building collection", () => {
  it("has ten independent themes spanning ancient, heritage, modern and future designs", () => {
    expect(BUILDING_COLLECTION).toHaveLength(10);
    expect(new Set(BUILDING_COLLECTION.map((t) => t.slug)).size).toBe(10);
    expect(new Set(BUILDING_COLLECTION.map((t) => t.era))).toEqual(new Set(["Ancient", "Heritage", "Modern", "Future"]));
    const doors = new Set(DOOR_STYLES.map((d) => d.key));
    for (const t of BUILDING_COLLECTION) expect(doors.has(t.door)).toBe(true);
  });

  it("connects seven hallways to one entrance, with a reachable exit", () => {
    const walks = COLLECTION_HALLWAYS.map((h, i) => ({
      id: h.key, parent_id: h.parent, direction: h.direction, length: h.length, junction_at: h.junction, position: i,
    })) as BuildingWalkway[];
    const graph = compileNavGraph(walks);
    expect(graph.rootId).toBe("entrance");
    expect(graph.nodes).toHaveLength(7);
    expect(graph.byId.get("finish")?.depth).toBe(2);
    for (const room of COLLECTION_ROOMS) expect(graph.byId.has(room.hallway)).toBe(true);
    for (const node of graph.nodes) expect(node.start.every(Number.isFinite)).toBe(true);
  });

  it("has eleven rooms and keeps door slots separate from branch openings", () => {
    expect(COLLECTION_ROOMS).toHaveLength(11);
    for (const hall of COLLECTION_HALLWAYS) {
      const slots = COLLECTION_ROOMS.filter((r) => r.hallway === hall.key).map((r) => r.offset);
      slots.push(...COLLECTION_HALLWAYS.filter((h) => h.parent === hall.key && h.direction !== "forward").map((h) => h.junction));
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it.each(BUILDING_COLLECTION.map((t) => [t.name, t] as const))("fills all 16 exterior slots and every interior surface for %s", (_n, theme) => {
    const b = collectionBlueprint(theme);
    const ids = [...RING_SLOTS, ...CORE_SLOTS].map((s) => s.id).sort();
    expect(Object.keys(b.exterior.slotOverrides).sort()).toEqual(ids);
    for (const s of RING_SLOTS) expect(b.exterior.slotOverrides[s.id].path).toBe(collectionArtwork(theme.slug).exterior);
    for (const s of CORE_SLOTS) expect(b.exterior.slotOverrides[s.id].path).toBe(collectionArtwork(theme.slug).core);
    for (const side of ["leftWall", "rightWall", "floor", "roof", "startWall", "endWall"] as const) {
      expect(b.environment[side].texture?.path).toMatch(new RegExp(`^builtin:${theme.slug}-(wall|floor|ceiling)$`));
      expect(b.environment[side].fit).toBe("tile");
    }
    // Survives the app's own environment parser unchanged (still editable).
    expect(mergeEnvironment(b.environment)).toEqual(b.environment);
    expect(frameProfile(b.frameDesign).key).toBe(b.frameDesign);
    expect(Object.values(ERA_CATEGORY)).toContain(b.category);
  });

  it("ships every exterior and interior picture the blueprints point at", () => {
    for (const t of BUILDING_COLLECTION) {
      const art = collectionArtwork(t.slug);
      expect(existsSync(`${root}public${art.exterior}`)).toBe(true);
      expect(existsSync(`${root}public${art.core}`)).toBe(true);
      for (const part of ["wall", "floor", "ceiling"]) {
        expect(existsSync(`${root}src/assets/surfaces/collection/${t.slug}-${part}.webp`)).toBe(true);
      }
    }
  });

  it("tiles long walls at the picture's own proportions instead of stretching", () => {
    // 32 m corridor wall, 5.4 m tall, square art: one copy floor-to-ceiling,
    // ~5.9 copies along — each copy is still square in world units.
    const f = tileFit(32, 5.4, 960, 1024, 1, "height");
    const tileW = 32 / f.repeat[0], tileH = 5.4 / f.repeat[1];
    expect(tileW / tileH).toBeCloseTo(960 / 1024, 5);
    const floor = tileFit(7, 32, 960, 960, 2, "width");
    expect(7 / floor.repeat[0]).toBeCloseTo(32 / floor.repeat[1], 5);
  });

  it("installs atomically, idempotently and only for administrators", () => {
    for (const slug of BUILDING_COLLECTION.map((t) => t.slug)) expect(migration).toContain(`'${slug}'`);
    expect(migration).toMatch(/pg_advisory_xact_lock/);
    expect(migration).toMatch(/has_role\(uid, 'platform_owner'\)/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.install_building_collection_for_owner\(uuid, jsonb\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.install_building_collection\(jsonb\) FROM PUBLIC, anon/);
    // Deterministic ids: a retry finds the same rows instead of adding more.
    expect(migration).toMatch(/md5\('building-collection-v1:'/);
    expect(migration).toMatch(/md5\('building-collection-v1-template:'/);
    expect(migration).toMatch(/md5\('building-collection-v1-entry:'/);
    // Never touches existing selections or defaults.
    expect(migration).not.toMatch(/UPDATE\s+public\.buildings/i);
    expect(migration).not.toMatch(/platform_building_default|homepage_config/i);
  });
});
