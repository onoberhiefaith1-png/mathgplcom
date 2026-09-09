/**
 * SMART SCREEN — the teaching display built into every room.
 *
 * A room is the physical environment; the smart screen is the teaching portal
 * inside it. Every classroom, teaching hall and auditorium has exactly one, so
 * there is no "add board" action anywhere: the screen is part of the shell.
 *
 * This module owns the DATA and the MOUNTING GEOMETRY, so the 3D renderer and
 * the controls can never disagree about where the screen is or what is on it.
 */
import { supabase } from "@/integrations/supabase/client";
import { GAME_ASSETS_BUCKET } from "@/lib/games/types";
import { getSignedUrl } from "@/lib/games/urls";
import { classroomDimensions } from "./classroom";
import type { FrameWall } from "./frames";
import type { ClassroomKind } from "./types";

export const SCREEN_MIN_WIDTH = 0.8;
export const SCREEN_MAX_WIDTH = 9;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface RoomScreen {
  id: string;
  building_id: string;
  classroom_id: string;
  video_path: string | null;
  video_mime: string | null;
  video_name: string | null;
  camera_active: boolean;
  camera_host_id: string | null;
  /** The wall the screen belongs to; it can slide along it but never leave it. */
  wall: FrameWall;
  /** 0–1 along that wall (null until the teacher moves it) */
  offset_along: number | null;
  /** centre height above the room floor (null until the teacher moves it) */
  offset_y: number | null;
  /** panel width in metres (null = the room's default size) */
  width: number | null;
  height_ratio: number;
  rotation: number;
  locked: boolean;
  updated_at: string;
}

/**
 * Where the display sits on the front (teaching) wall of a room, in the same
 * local space `ClassroomShell` uses: +z runs from the doorway into the room,
 * x across it, y up from corridor level.
 */
export interface ScreenMount {
  /** panel width, metres */
  width: number;
  /** panel height, metres */
  height: number;
  /** centre height above the room's lowest floor level */
  centreY: number;
  /** distance from the doorway to the teaching wall */
  wallZ: number;
  /** floor level at the teaching wall */
  floorY: number;
  /** the wall the screen is fixed to */
  wall: FrameWall;
  /** 0–1 along that wall */
  along: number;
  /** metres of wall available to slide along */
  alongLength: number;
  /** +1 when local +x increases `along` */
  alongSign: 1 | -1;
  /** local centre of the panel inside the room */
  position: [number, number, number];
  /** rotation about Y so the panel faces into the room */
  yaw: number;
  /** extra roll about its own axis, in radians */
  rotation: number;
  /** height ÷ width of the panel */
  heightRatio: number;
  /** highest centre height allowed on this wall */
  maxY: number;
  locked: boolean;
}

/**
 * Screen proportions per room type — a bigger room needs a bigger display, and
 * a stepped auditorium needs it raised so the back tiers can see it.
 *
 * Once a teacher has moved or resized the screen, the SAVED values win: the
 * formula below is only the starting point for a screen nobody has touched.
 */
export const screenMount = (kind: ClassroomKind, screen?: RoomScreen | null): ScreenMount => {
  const dims = classroomDimensions(kind);
  const floorY = Math.min(...dims.tiers.map((t) => t.y));
  const defaultWidth = Math.min(dims.width * 0.62, kind === "classroom" ? 4.2 : 7.2);
  const lift = kind === "auditorium" ? 1.5 : 1.15;

  const wall: FrameWall = (screen?.wall as FrameWall) ?? "endWall";
  const width = clamp(screen?.width ?? defaultWidth, SCREEN_MIN_WIDTH, SCREEN_MAX_WIDTH);
  const ratio = clamp(Number(screen?.height_ratio ?? 9 / 16) || 9 / 16, 0.3, 1.6);
  const height = width * ratio;
  const defaultY = floorY + lift + height / 2;
  const centreY = clamp(screen?.offset_y ?? defaultY, floorY + 0.6, dims.height - height / 2 - 0.1);
  const along = clamp(screen?.offset_along ?? 0.5, 0.04, 0.96);
  const nudge = 0.06;

  if (wall === "endWall") {
    return {
      width,
      height,
      centreY,
      wallZ: dims.length,
      floorY,
      wall,
      along,
      alongLength: dims.width,
      alongSign: -1,
      position: [(along - 0.5) * dims.width, centreY, dims.length - nudge],
      yaw: Math.PI,
      rotation: screen?.rotation ?? 0,
      heightRatio: ratio,
      maxY: dims.height - height / 2 - 0.1,
      locked: !!screen?.locked,
    };
  }
  const side = wall === "leftWall" ? -1 : 1;
  return {
    width,
    height,
    centreY,
    wallZ: dims.length,
    floorY,
    wall,
    along,
    alongLength: dims.length,
    alongSign: side === -1 ? -1 : 1,
    position: [side * (dims.width / 2 - nudge), centreY, along * dims.length],
    yaw: side === -1 ? Math.PI / 2 : -Math.PI / 2,
    rotation: screen?.rotation ?? 0,
    heightRatio: ratio,
    maxY: dims.height - height / 2 - 0.1,
    locked: !!screen?.locked,
  };
};

// ── Data ──────────────────────────────────────────────────────────────────

/** The screen record of one room. Missing means "no content yet". */
export const fetchRoomScreen = async (classroomId: string): Promise<RoomScreen | null> => {
  const { data, error } = await supabase
    .from("building_room_screens")
    .select("*")
    .eq("classroom_id", classroomId)
    .maybeSingle();
  if (error) {
    console.warn("[smart-screen] load failed", error.message);
    return null;
  }
  return (data as unknown as RoomScreen) ?? null;
};

/** Create-or-update the screen row of one room. Editors only (enforced by RLS). */
const saveRoomScreen = async (
  buildingId: string,
  classroomId: string,
  fields: Partial<
    Pick<
      RoomScreen,
      | "video_path"
      | "video_mime"
      | "video_name"
      | "camera_active"
      | "camera_host_id"
      | "wall"
      | "offset_along"
      | "offset_y"
      | "width"
      | "height_ratio"
      | "rotation"
      | "locked"
    >
  >,
): Promise<RoomScreen> => {
  const { data, error } = await supabase
    .from("building_room_screens")
    .upsert(
      { building_id: buildingId, classroom_id: classroomId, ...fields } as never,
      { onConflict: "classroom_id" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("The smart screen was not updated — your account may not manage this building.");
  }
  return data as unknown as RoomScreen;
};

export const MAX_SCREEN_VIDEO_BYTES = 300 * 1024 * 1024;

/** Upload a teaching video and make it this room's screen content. */
export const uploadScreenVideo = async (
  buildingId: string,
  classroomId: string,
  file: File,
  previousPath?: string | null,
): Promise<RoomScreen> => {
  if (file.size > MAX_SCREEN_VIDEO_BYTES) {
    throw new Error("That video is larger than 300 MB. Please upload a smaller file.");
  }
  const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `room-screens/${classroomId}/${Date.now()}.${ext || "mp4"}`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "video/mp4" });
  if (error) throw error;
  const row = await saveRoomScreen(buildingId, classroomId, {
    video_path: path,
    video_mime: file.type || "video/mp4",
    video_name: file.name,
  });
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(GAME_ASSETS_BUCKET).remove([previousPath]).catch(() => undefined);
  }
  return row;
};

/** Take the video off this room's screen (and delete the stored file). */
export const removeScreenVideo = async (
  buildingId: string,
  classroomId: string,
  path?: string | null,
): Promise<RoomScreen> => {
  const row = await saveRoomScreen(buildingId, classroomId, {
    video_path: null,
    video_mime: null,
    video_name: null,
  });
  if (path) {
    await supabase.storage.from(GAME_ASSETS_BUCKET).remove([path]).catch(() => undefined);
  }
  return row;
};

/** Turn the live camera on/off for one room. The host is the publishing teacher. */
export const setScreenCamera = async (
  buildingId: string,
  classroomId: string,
  active: boolean,
  hostId: string | null,
): Promise<RoomScreen> =>
  saveRoomScreen(buildingId, classroomId, {
    camera_active: active,
    camera_host_id: active ? hostId : null,
  });

/**
 * Save where the teacher put the screen. Only the placement is written, so a
 * video that is playing is never disturbed by a move or a resize.
 */
export const saveScreenTransform = async (
  buildingId: string,
  classroomId: string,
  patch: Partial<Pick<RoomScreen, "wall" | "offset_along" | "offset_y" | "width" | "height_ratio" | "rotation" | "locked">>,
): Promise<RoomScreen> => saveRoomScreen(buildingId, classroomId, patch);

/** A playable URL for the room's stored video (short-lived signed link). */
export const screenVideoUrl = async (path?: string | null): Promise<string | null> =>
  path ? getSignedUrl(path) : null;

/** The realtime channel every occupant of one room shares. */
export const roomScreenChannel = (classroomId: string) => `room-screen-${classroomId}`;
