/**
 * GOING THROUGH A DOOR — the one and only rule.
 *
 * A door is strictly a room entrance. Entering is therefore a single decision,
 * taken the instant the door is clicked: which room, where the walker stands
 * inside it, and which way they face. Nothing that happens afterwards — a
 * camera glide, a re-render, a rebuilt hallway graph, a timer — may change or
 * cancel that decision. Keeping the decision here, as plain data with no
 * timers, refs or camera state, is what stops "the door opened somewhere else"
 * from ever coming back.
 */
import { classroomDimensions, roomForDoor } from "./classroom";
import type { BuildingClassroom, ClassroomKind } from "./types";

/** Where the walker stands the moment they are inside a room. */
export interface RoomStance {
  /** across the room, 0 = on the doorway's centre line */
  x: number;
  /** into the room from the doorway */
  z: number;
  /** facing, 0 = looking straight into the room */
  yaw: number;
}

export interface RoomEntry {
  room: BuildingClassroom;
  /** World position of the doorway walked through. */
  doorWorld: [number, number];
  /** Unit heading pointing from the doorway INTO the room. */
  into: [number, number];
  stance: RoomStance;
}

/** A door with no room of its own opens nothing at all — and says so. */
export type EntryResult =
  | { ok: true; entry: RoomEntry }
  | { ok: false; reason: "no-room" };

/**
 * A comfortable first standing spot: a short step in from the doorway, scaled
 * to the room so a compact classroom does not put the walker against the far
 * wall and an auditorium does not leave them in the doorway.
 */
export const initialStance = (kind: ClassroomKind): RoomStance => ({
  x: 0,
  z: Math.min(3, classroomDimensions(kind).length * 0.28),
  yaw: 0,
});

/**
 * Resolve one door click. `front` is the direction the door FACES (out of its
 * wall, into the corridor), so the room lies along the opposite heading.
 *
 * The match is strict: the room's own `door_id` must be this exact door. There
 * is no positional guess and no fallback to another room, so a stale page can
 * only ever produce `no-room`, never the wrong place.
 */
export const resolveEntry = ({
  doorId,
  rooms,
  doorWorld,
  front,
}: {
  doorId: string;
  rooms: readonly BuildingClassroom[] | Map<string, BuildingClassroom> | null | undefined;
  doorWorld: [number, number];
  front: [number, number];
}): EntryResult => {
  const room = roomForDoor(rooms, doorId);
  if (!room || room.door_id !== doorId) return { ok: false, reason: "no-room" };
  return {
    ok: true,
    entry: {
      room,
      doorWorld,
      into: [-front[0], -front[1]],
      stance: initialStance(room.kind),
    },
  };
};
