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
import { GAME_ASSETS_BUCKET } from "@/lib/games/types";
import type { AcademyProductKind } from "@/lib/academy/types";
import { classroomDimensions } from "./classroom";
import { frameProfile, type FrameKind } from "./frameStyles";
import type { ClassroomKind } from "./types";

/** The wall surfaces a frame may hang on. */
export type FrameWall = "leftWall" | "rightWall" | "endWall";

export const FRAME_WALL_LABEL: Record<FrameWall, string> = {
  leftWall: "Left wall",
  rightWall: "Right wall",
  endWall: "End wall",
};

export interface BuildingFrame {
  id: string;
  building_id: string;
  /** Set when the frame hangs in a hallway. */
  walkway_id: string | null;
  /** Set when the frame hangs inside a room. */
  classroom_id: string | null;
  wall: FrameWall;
  /** A content frame, or a purely architectural window. */
  kind: FrameKind;
  /** which 3D profile the Building system builds (see frameStyles.ts) */
  design: string;
  name: string;
  /** the picture placed INSIDE the object — never part of the frame itself */
  content_path: string | null;
  /** 0–1 along the chosen wall */
  offset_along: number;
  /** centre height above the wall's floor level, metres */
  offset_y: number;
  /** board width, metres */
  width: number;
  /** height ÷ width of the object */
  height_ratio: number;
  /** frozen in place, so it can never be nudged by accident */
  locked: boolean;
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
export const MAX_FRAME_IMAGE_BYTES = 12 * 1024 * 1024;


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
  kind: FrameKind;
  design: string;
  name: string;
  contentPath?: string | null;
}

export async function createFrame(input: NewFrame): Promise<BuildingFrame> {
  const profile = frameProfile(input.design, input.kind);
  const { data, error } = await supabase
    .from("building_frames")
    .insert({
      building_id: input.buildingId,
      walkway_id: input.walkwayId ?? null,
      classroom_id: input.classroomId ?? null,
      wall: input.wall,
      kind: input.kind,
      design: profile.key,
      name: input.name || profile.label,
      content_path: input.contentPath ?? null,
      height_ratio: profile.ratio,
      width: input.kind === "window" ? 1.6 : 1.4,
    })
    .select("*")
    .maybeSingle();
  fail(error);
  if (!data) throw new Error("It was not created — you may not have permission to edit this building.");
  return data as unknown as BuildingFrame;
}

export async function updateFrame(
  id: string,
  patch: Partial<
    Pick<
      BuildingFrame,
      | "name"
      | "design"
      | "wall"
      | "offset_along"
      | "offset_y"
      | "width"
      | "height_ratio"
      | "content_path"
      | "locked"
    >
  >,
): Promise<void> {
  const { error } = await supabase.from("building_frames").update(patch).eq("id", id);
  fail(error);
}

/**
 * Upload the picture that goes INSIDE a frame or window. The stored path is
 * content only: replacing it never changes the 3D object around it.
 */
export async function uploadFrameImage(frameId: string, file: File): Promise<string> {
  if (file.size > MAX_FRAME_IMAGE_BYTES) {
    throw new Error("That image is larger than 12 MB. Please choose a smaller one.");
  }
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `building-frames/${frameId}/${Date.now()}.${ext || "png"}`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (error) throw new Error(error.message);
  await updateFrame(frameId, { content_path: path });
  return path;
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
  const ratio = clamp(frame.height_ratio || frameProfile(frame.design, frame.kind).ratio, 0.35, 1.6);
  return { width, height: width * ratio };
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
