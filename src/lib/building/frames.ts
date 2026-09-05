/**
 * BUILDING FRAME — a physical shortcut board hung on a wall.
 *
 * A frame is a building object, exactly like a door or a lock, but its purpose
 * is access: it holds REFERENCES to learning content that already exists
 * (courses, assignment cards, adventures, games) and never a copy of it.
 * Removing a link, or the whole frame, can therefore never delete anything a
 * teacher built.
 *
 * This module owns the DATA and the MOUNTING GEOMETRY, so the editor, the 3D
 * renderer and the map can never disagree about where a frame is.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AcademyProductKind } from "@/lib/academy/types";
import { classroomDimensions } from "./classroom";
import type { ClassroomKind } from "./types";

import assignmentArt from "@/assets/frames/frame-assignment.png.asset.json";
import adventureArt from "@/assets/frames/frame-adventure.png.asset.json";
import coursesArt from "@/assets/frames/frame-courses.png.asset.json";

/** The wall surfaces a frame may hang on. */
export type FrameWall = "leftWall" | "rightWall" | "endWall";

export const FRAME_WALL_LABEL: Record<FrameWall, string> = {
  leftWall: "Left wall",
  rightWall: "Right wall",
  endWall: "End wall",
};

/** The three supplied artworks — used exactly as delivered, never restyled. */
export type FrameDesignKey = "assignment" | "adventure" | "courses";

export interface FrameDesign {
  key: FrameDesignKey;
  label: string;
  url: string;
  /** height ÷ width of the artwork, so the board is never distorted */
  ratio: number;
}

export const FRAME_DESIGNS: FrameDesign[] = [
  { key: "assignment", label: "Assignment", url: assignmentArt.url, ratio: 1.1 },
  { key: "adventure", label: "Adventure", url: adventureArt.url, ratio: 1.08 },
  { key: "courses", label: "Courses", url: coursesArt.url, ratio: 1 },
];

export const frameDesign = (key: string): FrameDesign =>
  FRAME_DESIGNS.find((d) => d.key === key) ?? FRAME_DESIGNS[2];

export interface BuildingFrame {
  id: string;
  building_id: string;
  /** Set when the frame hangs in a hallway. */
  walkway_id: string | null;
  /** Set when the frame hangs inside a room. */
  classroom_id: string | null;
  wall: FrameWall;
  design: FrameDesignKey;
  name: string;
  /** 0–1 along the chosen wall */
  offset_along: number;
  /** centre height above the wall's floor level, metres */
  offset_y: number;
  /** board width, metres */
  width: number;
  created_at: string;
  updated_at: string;
}

/** One shortcut stored on a frame. The content itself lives where it always did. */
export interface FrameLink {
  id: string;
  frame_id: string;
  content_kind: AcademyProductKind;
  content_id: string;
  position: number;
}

export const FRAME_MIN_WIDTH = 0.6;
export const FRAME_MAX_WIDTH = 4;

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ── Data access ───────────────────────────────────────────────────────────

export async function listFrames(buildingId: string): Promise<BuildingFrame[]> {
  const { data, error } = await supabase
    .from("building_frames")
    .select("*")
    .eq("building_id", buildingId)
    .order("created_at");
  fail(error);
  return (data ?? []) as unknown as BuildingFrame[];
}

export async function listFrameLinks(buildingId: string): Promise<FrameLink[]> {
  const frames = await listFrames(buildingId);
  if (frames.length === 0) return [];
  const { data, error } = await supabase
    .from("building_frame_links")
    .select("id, frame_id, content_kind, content_id, position")
    .in("frame_id", frames.map((f) => f.id))
    .order("position");
  fail(error);
  return (data ?? []) as unknown as FrameLink[];
}

export interface NewFrame {
  buildingId: string;
  walkwayId?: string | null;
  classroomId?: string | null;
  wall: FrameWall;
  design: FrameDesignKey;
  name: string;
}

export async function createFrame(input: NewFrame): Promise<BuildingFrame> {
  const { data, error } = await supabase
    .from("building_frames")
    .insert({
      building_id: input.buildingId,
      walkway_id: input.walkwayId ?? null,
      classroom_id: input.classroomId ?? null,
      wall: input.wall,
      design: input.design,
      name: input.name || "New frame",
    })
    .select("*")
    .maybeSingle();
  fail(error);
  if (!data) throw new Error("The frame was not created — you may not have permission to edit this building.");
  return data as unknown as BuildingFrame;
}

export async function updateFrame(
  id: string,
  patch: Partial<Pick<BuildingFrame, "name" | "design" | "wall" | "offset_along" | "offset_y" | "width">>,
): Promise<void> {
  const { error } = await supabase.from("building_frames").update(patch).eq("id", id);
  fail(error);
}

/** Deleting a frame removes only the shortcut board and its links. */
export async function deleteFrame(id: string): Promise<void> {
  const { error } = await supabase.from("building_frames").delete().eq("id", id);
  fail(error);
}

export async function addFrameLink(
  frameId: string,
  kind: AcademyProductKind,
  contentId: string,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from("building_frame_links")
    .insert({ frame_id: frameId, content_kind: kind, content_id: contentId, position });
  // A duplicate is not an error for the teacher: the item is already on the frame.
  if (error && !/duplicate key/i.test(error.message)) fail(error);
}

/** Unlinks content from a frame. The original item is never touched. */
export async function removeFrameLink(linkId: string): Promise<void> {
  const { error } = await supabase.from("building_frame_links").delete().eq("id", linkId);
  fail(error);
}

// ── Mounting geometry ─────────────────────────────────────────────────────

export interface FrameMount {
  /** local position of the board's centre */
  position: [number, number, number];
  /** rotation about Y so the board faces into the space */
  yaw: number;
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const frameSize = (frame: BuildingFrame): { width: number; height: number } => {
  const width = clamp(frame.width, FRAME_MIN_WIDTH, FRAME_MAX_WIDTH);
  return { width, height: width * frameDesign(frame.design).ratio };
};

/**
 * Where a frame sits inside a ROOM, in `ClassroomShell` local space: +z runs
 * from the doorway into the room, x across it, y up from corridor level.
 */
export const roomFrameMount = (frame: BuildingFrame, kind: ClassroomKind): FrameMount => {
  const dims = classroomDimensions(kind);
  const { width, height } = frameSize(frame);
  const half = dims.width / 2;
  const along = clamp(frame.offset_along, 0.04, 0.96);
  const y = clamp(frame.offset_y, 0.6, dims.height - height / 2 - 0.1);
  const lift = 0.05;
  if (frame.wall === "endWall") {
    return {
      position: [(along - 0.5) * dims.width, y, dims.length - lift],
      yaw: Math.PI,
      width,
      height,
    };
  }
  const side = frame.wall === "leftWall" ? -1 : 1;
  return {
    position: [side * (half - lift), y, along * dims.length],
    yaw: side === -1 ? Math.PI / 2 : -Math.PI / 2,
    width,
    height,
  };
};

/**
 * Where a frame sits inside a HALLWAY, in corridor local space: the group sits
 * at the hallway's start and the corridor runs toward -z.
 */
export const hallFrameMount = (
  frame: BuildingFrame,
  length: number,
  hallWidth: number,
  hallHeight: number,
): FrameMount => {
  const { width, height } = frameSize(frame);
  const along = clamp(frame.offset_along, 0.04, 0.96);
  const y = clamp(frame.offset_y, 0.6, hallHeight - height / 2 - 0.1);
  const lift = 0.05;
  if (frame.wall === "endWall") {
    return { position: [(along - 0.5) * hallWidth, y, -length + lift], yaw: 0, width, height };
  }
  const side = frame.wall === "leftWall" ? -1 : 1;
  return {
    position: [side * (hallWidth / 2 - lift), y, -along * length],
    yaw: side === -1 ? Math.PI / 2 : -Math.PI / 2,
    width,
    height,
  };
};
