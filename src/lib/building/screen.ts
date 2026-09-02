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
import type { ClassroomKind } from "./types";

export interface RoomScreen {
  id: string;
  building_id: string;
  classroom_id: string;
  video_path: string | null;
  video_mime: string | null;
  video_name: string | null;
  camera_active: boolean;
  camera_host_id: string | null;
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
}

/**
 * Screen proportions per room type — a bigger room needs a bigger display, and
 * a stepped auditorium needs it raised so the back tiers can see it.
 */
export const screenMount = (kind: ClassroomKind): ScreenMount => {
  const dims = classroomDimensions(kind);
  const floorY = Math.min(...dims.tiers.map((t) => t.y));
  const width = Math.min(dims.width * 0.62, kind === "classroom" ? 4.2 : 7.2);
  const height = width * (9 / 16);
  const lift = kind === "auditorium" ? 1.5 : 1.15;
  const centreY = floorY + lift + height / 2;
  return { width, height, centreY, wallZ: dims.length, floorY };
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
  fields: Partial<Pick<RoomScreen, "video_path" | "video_mime" | "video_name" | "camera_active" | "camera_host_id">>,
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

/** A playable URL for the room's stored video (short-lived signed link). */
export const screenVideoUrl = async (path?: string | null): Promise<string | null> =>
  path ? getSignedUrl(path) : null;

/** The realtime channel every occupant of one room shares. */
export const roomScreenChannel = (classroomId: string) => `room-screen-${classroomId}`;
