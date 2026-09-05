/**
 * ACADEMY HALLWAY — the walkway environment inside the building.
 *
 * The corridor is generated from the academy rooms (add a room in the editor
 * and a new doorway appears, in its stored order) AND from the building's
 * walkway graph: the owner can extend the walkway forward, branch left/right,
 * and place content doors along any segment.
 *
 * NAVIGATION (path-based): movement is a small state machine — WALKING along a
 * segment, TURNING into a branch (smooth 90° corner sweep), RETRACING back to
 * the previous junction (180° turnaround + reverse glide + re-align), ZOOMING
 * onto a doorway before it opens, and IDLE at a junction. Every turn is
 * graph-valid: you can only turn where a walkway branch exists, and invalid
 * inputs surface a cue instead of rotating the camera. There is no free-fly.
 *
 * Walls, floor, roof, doors, lighting and effects all come from the building's
 * environment settings — never hard-coded. The player stops at walls and
 * walkway ends (collision); branches are the only way to change direction.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AcademyRoom, AcademyProduct } from "@/lib/academy/types";
import { mergeEnvironment, lightBudget, DEFAULT_ENDPOINT_NAME } from "@/lib/building/env";
import { CLASSROOM_KIND_LABEL, DEFAULT_ENVIRONMENT, DIRECTION_LABEL } from "@/lib/building/types";
import type {
  BuildingClassroom,
  BuildingData,
  BuildingDoor,
  BuildingWalkway,
  BuildingWalkwayLink,
  EnvironmentSettings,
} from "@/lib/building/types";
import { doorTitle } from "@/lib/building/api";
import { doorStyle } from "@/lib/building/doors";
import DoorLockPanel from "./DoorLockPanel";
import type { LockState } from "./DoorLockPanel";
import { indexLocksByRoom, retryLabel } from "@/lib/building/lock";
import type { RoomLock } from "@/lib/building/lock";
import { verifyRoomLock } from "@/lib/building/lock.functions";
import { presetMaterial } from "@/lib/building/presets";

import {
  branchHeading,
  connectorEndDistances,
  connectedWalkwayIds,
  connectorMeeting,
  firstRoadMeeting,
  fitObjectsToLength,
  insertGeometricMouth,
  easeInOut,
  forwardFromYaw,
  layoutHallwayObjects,
  hallwayLength,
  JUNCTION_CLEAR,
  mouthSpanFor,
  openingRevealLayout,
  HALL_WIDTH,
  HALLWAY_ENTRY_RUN,
  HALLWAY_PAD,
  OBJECT_SPACING,
  NavigationHistory,
  openingFootprint,
  junctionGeometry,
  corridorCrossing,
  WALL_THICKNESS,
  resolveJunctionCandidates,
  reverseHeading,
  segYaw,
  turnHeading,
  wallRuns,
} from "@/lib/building/navigation";

import type { HallwayObject } from "@/lib/building/navigation";

const SPACING = OBJECT_SPACING; // fixed distance between objects along a hallway

const HALL_HEIGHT = 5.4;
const WALK_SPEED = 4; // units per second while holding forward
/** How close (metres) a junction must be, AHEAD of the walker, to be enterable. */
const ENTER_RANGE = 6;

/**
 * A junction the walker is currently approaching. Resolved every frame from the
 * connected hallway graph and the direction of travel — never from a
 * visited/unvisited rule, so any junction can be entered any number of times.
 */
interface JunctionAction {
  key: string;
  kind: "branch" | "link" | "forward" | "parent";
  label: string;
  /** -1 = opening on the left wall, 1 = right wall, 0 = straight ahead */
  side: -1 | 0 | 1;
  /** child walkway id (branch), link id (link), else "" */
  targetId: string;
  targetWalkwayId?: string;
  /** metres ahead of the walker */
  distance: number;
}



// ── Hallway geometry ──────────────────────────────────────────────────────
// One hallway is a finite, enclosed corridor with a name. Doors and
// sub-hallway openings are objects attached to its walls, laid out by the
// shared layoutHallwayObjects() so the 3D view and the map can never disagree.

interface Segment {
  walkway: BuildingWalkway | null;
  start: [number, number];
  heading: [number, number];
  length: number;
  depth: number;
  children: Segment[];
}

interface DoorObjectInput {
  id: string;
  name: string;
  order: number;
}

interface HallwayLayout {
  segments: Segment[];
  layouts: Map<string, HallwayObject[]>;
  /**
   * Corridor hallways built by Connect Hallway, keyed by the corridor's own
   * walkway id: each one STOPS at `targetWalkwayId`, where an open junction is
   * created, so the walker can carry on into that hallway.
   */
  connectors: Map<string, ConnectorInfo>;
  /**
   * THE MOUTH OF EVERY MERGE, keyed by the mouth object's id. A road that
   * arrives at another road cuts a STRAIGHT opening in the wall it meets, whose
   * width follows the angle the two roads actually make. Branch openings are not
   * listed here: they leave at the fixed branch angle and carry their own throat.
   */
  mouths: Map<string, MergeMouth>;
}

const MIN_RENDERABLE_CORRIDOR = 0.5;

interface CorridorEndDistances {
  deck: { left: number; right: number };
  walls: { left: number; right: number };
}

/** A straight junction opening cut where one hallway arrives at another. */
export interface MergeMouth {
  /** width of the hole along the wall it is cut in */
  span: number;
  /** sine of the angle between the two hallways (1 = square crossing) */
  sinAngle: number;
}

export interface ConnectorInfo {
  linkId: string;
  targetWalkwayId: string;
  /** distance along the target hallway where the corridor arrives */
  alongTarget: number;
  targetSide: -1 | 1;
}

const buildHallways = (
  walkways: BuildingWalkway[],
  doorObjects: (walkwayId: string) => DoorObjectInput[],
  rootRoomObjects: DoorObjectInput[],
  rootLen: number,
  links: BuildingWalkwayLink[] = [],
): HallwayLayout => {
  const segments: Segment[] = [];
  const layouts = new Map<string, HallwayObject[]>();
  const connectors = new Map<string, ConnectorInfo>();
  const mouths = new Map<string, MergeMouth>();
  /** The straight opening one road cuts in the wall of the road it arrives at. */
  const registerMouth = (id: string, a: Segment, b: Segment) => {
    const sinAngle = Math.abs(a.heading[0] * b.heading[1] - a.heading[1] * b.heading[0]);
    mouths.set(id, { span: mouthSpanFor(HALL_WIDTH, sinAngle), sinAngle });
  };
  // A connection with a corridor is a real road (already a child hallway); only
  // legacy connections without one are still drawn as a plain mouth pair.
  const lineLinks = links.filter((l) => !l.corridor_walkway_id);
  const nameOf = (id: string) => walkways.find((w) => w.id === id)?.name ?? "Hallway";

  /** Connections that surface on this hallway, from either end of the link. */
  const linkObjects = (walkwayId: string) =>
    lineLinks
      .filter((l) => l.from_walkway_id === walkwayId || l.to_walkway_id === walkwayId)
      .map((l) => {
        const outgoing = l.from_walkway_id === walkwayId;
        const target = outgoing ? l.to_walkway_id : l.from_walkway_id;
        return {
          id: l.id,
          name: nameOf(target),
          targetWalkwayId: target,
          order: 5 + (outgoing ? l.from_position : l.to_position) * 100,
        };
      });

  const walk = (
    w: BuildingWalkway,
    start: [number, number],
    heading: [number, number],
    depth: number,
  ): Segment => {
    const kids = walkways.filter((x) => x.parent_id === w.id).sort((a, b) => a.position - b.position);
    // A hallway is a road with FIXED slots: the layout decides where every
    // object sits, and the road's physical length is derived from those slots,
    // so adding a door or a hallway extends the road automatically.
    const objs = layoutHallwayObjects({
      doors: [...(w.parent_id ? [] : rootRoomObjects), ...doorObjects(w.id)],
      openings: kids.map((k) => ({
        id: k.id,
        name: k.name,
        direction: k.direction,
        // Junctions and doors interleave along the road by their stored order.
        order: 5 + (k.junction_at ?? 0.5) * 100,
      })),
      links: linkObjects(w.id),
      spacing: SPACING,
      // A hallway you walk INTO keeps an entry run, so its first door cannot be
      // seen from the hallway you came from.
      pad: w.parent_id ? HALLWAY_ENTRY_RUN : HALLWAY_PAD,
    });
    layouts.set(w.id, objs);

    const auto = hallwayLength(objs, w.parent_id ? HALLWAY_ENTRY_RUN : HALLWAY_PAD, SPACING);
    const length = w.parent_id ? auto : Math.max(auto, rootLen);
    const seg: Segment = { walkway: w, start, heading, length, depth, children: [] };
    segments.push(seg);

    const end: [number, number] = [start[0] + heading[0] * length, start[1] + heading[1] * length];
    for (const k of kids) {
      if (k.direction === "forward") {
        seg.children.push(walk(k, end, heading, depth + 1));
        continue;
      }
      const mouth = objs.find((o) => o.kind === "opening" && o.id === k.id);
      const along = mouth?.along ?? length;
      seg.children.push(
        walk(
          k,
          [start[0] + heading[0] * along, start[1] + heading[1] * along],
          branchHeading(heading, k.direction),
          depth + 1,
        ),
      );
    }
    return seg;
  };

  walkways
    .filter((w) => !w.parent_id)
    .sort((a, b) => a.position - b.position)
    .forEach((w) => walk(w, [0, 0], [0, -1], 0));

  // ── Connector corridors: trim each one at the hallway it connects to, and
  // open a real junction there. A corridor never passes through a hallway.
  for (const l of links) {
    if (!l.corridor_walkway_id) continue;
    const corridor = findSegment(segments, l.corridor_walkway_id);
    if (!corridor || !corridor.walkway) continue;
    // A road must stop at the FIRST road it reaches. Checking only the declared
    // target allows it to pass through an intervening hallway on both the map
    // and in 3D. The parent is excluded because the corridor begins in its mouth.
    const hits = segments
      .filter(
        (candidate) =>
          candidate !== corridor &&
          candidate.walkway?.id !== corridor.walkway?.parent_id,
      )
      .map((candidate) => ({
        candidate,
        meet: connectorMeeting(
          { start: corridor.start, heading: corridor.heading },
          { start: candidate.start, heading: candidate.heading, length: candidate.length },
          HALL_WIDTH,
        ),
      }))
      .filter(
        (hit): hit is { candidate: Segment; meet: NonNullable<typeof hit.meet> } =>
          Boolean(hit.meet),
      )
      .sort((a, b) => a.meet.length - b.meet.length);
    const hit = hits[0];
    if (!hit) {
      // An unreachable connection must never inherit an arbitrary object-based
      // length and slice across the plan. Leave a short, capped corridor that
      // clearly stops instead of fabricating a crossing with no wall opening.
      corridor.length = Math.max(HALL_WIDTH, junctionGeometry(HALL_WIDTH).branchTrim + 0.5);
      layouts.set(corridor.walkway.id, []);
      continue;
    }
    const target = hit.candidate;
    const meet = hit.meet;
    corridor.length = meet.length;
    // Anything that would have sat beyond the trimmed end is dropped, so no
    // door hangs outside the corridor or at the junction it opens into.
    layouts.set(
      corridor.walkway.id,
      (layouts.get(corridor.walkway.id) ?? []).filter((o) => o.along < meet.length - SPACING * 0.6),
    );
    const targetId = target.walkway?.id ?? "";
    layouts.set(
      targetId,
      insertGeometricMouth(
        layouts.get(targetId) ?? [],
        {
          kind: "link",
          id: l.id,
          name: corridor.walkway.name,
          side: meet.targetSide,
          along: meet.alongTarget,
          targetWalkwayId: corridor.walkway.id,
        },
        SPACING,
      ),
    );
    registerMouth(l.id, corridor, target);
    connectors.set(corridor.walkway.id, {
      linkId: l.id,
      targetWalkwayId: targetId,
      alongTarget: meet.alongTarget,
      targetSide: meet.targetSide,
    });
  }

  // ── NO TUNNELLING, NO CROSSINGS. Every OTHER road (branches and forward
  // continuations, not just Connect-Hallway corridors) is solved against every
  // road already in the plan. When a road would run into one, it stops at that
  // road's wall and a real OPEN junction mouth is cut there: the two roads
  // become one connected walkway system, never two layers sharing ground.
  const subtreeIds = (seg: Segment): string[] => [
    seg.walkway?.id ?? "",
    ...seg.children.flatMap(subtreeIds),
  ];
  const shiftSubtree = (seg: Segment, dx: number, dz: number) => {
    seg.start = [seg.start[0] + dx, seg.start[1] + dz];
    for (const c of seg.children) shiftSubtree(c, dx, dz);
  };

  /**
   * Stop one road at another and open a real junction between them: the arriving
   * road is trimmed, anything hanging past the boundary is pulled back inside,
   * the road it met loses that run of wall (a `link` mouth), and the connection
   * is registered so the walker can pass through in either direction.
   */
  const mergeRoadInto = (
    seg: Segment,
    target: Segment,
    stopLength: number,
    alongTarget: number,
    targetSide: -1 | 1,
  ) => {
    const w = seg.walkway;
    const targetId = target.walkway?.id;
    if (!w || !targetId) return;
    // The road is exactly as long as the space it had: it can be 2 units, 1
    // unit or a fraction of one, and it ends flush at the junction it makes.
    seg.length = Math.max(0.02, stopLength);
    // Nothing is dropped: the objects on the road are squeezed into the run that
    // is left, so a shortened hallway keeps every door and mouth it was given.
    layouts.set(
      w.id,
      fitObjectsToLength(layouts.get(w.id) ?? [], seg.length, HALLWAY_PAD, SPACING),
    );
    // Any branch anchored inside the crossing is pulled back out of it, so a
    // trimmed hallway never leaves a child hanging in the junction or beyond it.
    const limit = Math.max(HALLWAY_ENTRY_RUN, seg.length - JUNCTION_CLEAR);
    for (const child of seg.children) {
      const along =
        (child.start[0] - seg.start[0]) * seg.heading[0] +
        (child.start[1] - seg.start[1]) * seg.heading[1];
      if (along <= limit) continue;
      const back = along - limit;
      shiftSubtree(child, -seg.heading[0] * back, -seg.heading[1] * back);
    }
    layouts.set(
      targetId,
      insertGeometricMouth(
        layouts.get(targetId) ?? [],
        {
          kind: "link",
          id: `merge:${w.id}`,
          name: w.name,
          side: targetSide,
          along: alongTarget,
          targetWalkwayId: w.id,
        },
        SPACING,
      ),
    );
    registerMouth(`merge:${w.id}`, seg, target);
    // The merge is a two-way junction: the arriving road continues into the road
    // it met, and that road can be walked back into this one through the mouth.
    connectors.set(w.id, {
      linkId: `merge:${w.id}`,
      targetWalkwayId: targetId,
      alongTarget,
      targetSide,
    });
  };

  const roadLines = () =>
    segments
      .filter((s) => s.walkway)
      .map((s) => ({
        id: s.walkway!.id,
        start: s.start,
        heading: s.heading,
        length: s.length,
      }));

  // Shallow roads win: a hallway nearer the entrance is the established one, and
  // the newer road arriving at it is the one that stops. A trim can expose a
  // later collision, so iterate to stability. The graph-sized bound prevents a
  // malformed layout from looping forever without assuming three passes suffice.
  const settleLimit = Math.max(1, segments.length * segments.length);
  for (let pass = 0; pass < settleLimit; pass += 1) {
    let merged = false;
    for (const seg of [...segments].sort((a, b) => a.depth - b.depth)) {
      const w = seg.walkway;
      if (!w) continue;
      if (connectors.has(w.id)) continue; // already merged into another road
      const own = new Set(subtreeIds(seg));
      if (w.parent_id) own.add(w.parent_id);
      const meet = firstRoadMeeting(
        { id: w.id, start: seg.start, heading: seg.heading, length: seg.length },
        roadLines(),
        HALL_WIDTH,
        own,
      );
      if (!meet || meet.length >= seg.length - 0.05) continue;
      const target = findSegment(segments, meet.targetId);
      if (!target?.walkway) continue;
      mergeRoadInto(seg, target, meet.length, meet.alongTarget, meet.targetSide);
      merged = true;
    }
    if (!merged) break;
  }

  // ── ASSERTION PASS. After merging, no two roads may still share ground. A
  // remaining plan overlap means a merge was missed, so the deeper road is cut
  // back to that boundary and merged there. Crossings are therefore structurally
  // impossible instead of being hidden by removing a floor slab.
  const related = (a: Segment, b: Segment) =>
    a.walkway?.parent_id === b.walkway?.id ||
    b.walkway?.parent_id === a.walkway?.id ||
    connectors.get(a.walkway?.id ?? "")?.targetWalkwayId === b.walkway?.id ||
    connectors.get(b.walkway?.id ?? "")?.targetWalkwayId === a.walkway?.id;

  for (let pass = 0; pass < settleLimit; pass += 1) {
    let cut = false;
    const ordered = [...segments].filter((s) => s.walkway).sort((a, b) => a.depth - b.depth);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const upper = ordered[i];
        const lower = ordered[j];
        if (related(upper, lower)) continue;
        const hit = corridorCrossing(
          { start: upper.start, heading: upper.heading, length: upper.length },
          { start: lower.start, heading: lower.heading, length: lower.length },
          HALL_WIDTH,
          0,
        );
        if (!hit) continue;
        const stop = hit.b[0];
        if (stop >= lower.length - 0.05) continue; // the overlap is past its end
        const alongTarget = Math.min(
          Math.max((hit.a[0] + hit.a[1]) / 2, HALL_WIDTH / 2),
          Math.max(HALL_WIDTH / 2, upper.length - HALL_WIDTH / 2),
        );
        const cross =
          upper.heading[0] * -lower.heading[1] - upper.heading[1] * -lower.heading[0];
        mergeRoadInto(lower, upper, stop, alongTarget, cross >= 0 ? 1 : -1);
        cut = true;
      }
    }
    if (!cut) break;
  }

  return { segments, layouts, connectors, mouths };

};



const findSegment = (segs: Segment[], id: string): Segment | null => {
  for (const s of segs) {
    if (s.walkway?.id === id) return s;
    const hit = findSegment(s.children, id);
    if (hit) return hit;
  }
  return null;
};

import { Surface, useLoadedTexture } from "./surface";
import ClassroomShell from "./ClassroomShell";
import type { RoomDoorVisual } from "./RoomDoor";

import SmartScreenControls from "./SmartScreenControls";
import { useRoomScreen } from "@/hooks/useRoomScreen";
import { useAutoHide } from "@/hooks/useAutoHide";

import { classroomDimensions, indexRoomsByDoor, roomForDoor } from "@/lib/building/classroom";
import { fetchRoomForDoor } from "@/lib/building/api";
import { toast } from "sonner";

import type { ClassroomKind } from "@/lib/building/types";
import { resolveSurfaces } from "@/lib/building/resolve";



// ── Corridor pieces ───────────────────────────────────────────────────────

const SegmentCorridor = ({
  start,
  yaw,
  length,
  env,
  textures,
  gaps = [],
  startTrim = 0,
  deckHoles = [],
  deckLift = 0,
  endDistances,
  frontPad = 0,
  capEnd = true,
  capStart = false,
  name,
  endName,
}: {
  start: [number, number];
  yaw: number;
  length: number;
  env: EnvironmentSettings;
  textures: Record<string, string>;
  /**
   * Cut-throughs in this hallway's walls. `center` is where the hole's centre
   * sits relative to the junction point (a branch leaves diagonally, so its
   * mouth is offset forward; a hallway arriving square-on is not) and `width`
   * is the hole's true width along this wall.
   */
  gaps?: { side: -1 | 1; along: number; center: number; width: number }[];
  /** Distance from this hallway's start where its own shell may begin — a
      branch begins at the mouth in its parent's wall, never inside it. */
  startTrim?: number;
  /**
   * Where this corridor's floor/ceiling are CUT because another corridor's
   * slab passes through the crossing there. Only the portion inside the
   * crossing is removed; the runs before and after stay continuous.
   */
  deckHoles?: { along: number; width: number }[];
  /**
   * Real structural offset of this corridor's slabs, so no two corridors ever
   * share a plane at exactly the same depth.
   */
  deckLift?: number;
  /** Angled far-end cut when this corridor merges into another corridor. */
  endDistances?: CorridorEndDistances;
  /**
   * How far this corridor's FLOOR AND CEILING may run past its own far end. It
   * is 0 by default: a junction throat is floored and ceiled by the junction
   * itself, so no two slabs ever overlap at the same height.
   */
  frontPad?: number;
  /** Solid wall at the far end (no forward continuation). */
  capEnd?: boolean;
  /** Solid wall behind the entrance. */
  capStart?: boolean;
  name?: string;
  /** Name of this hallway's ENDPOINT, shown on the capped far wall. */
  endName?: string;
}) => {
  // A branch hallway starts AT the cut in its parent's wall. Its shell starts at
  // the far edge of the dedicated throat mesh; it must never extend backwards
  // beneath the parent's deck or three coplanar surfaces occupy the junction.
  const backPad = capStart ? 3 : -startTrim;
  const span = length + frontPad + backPad;
  /** Local z of the wall runs' centre inside the group offset by -length / 2. */
  const shellZ = length / 2 - (length + frontPad - backPad) / 2;
  const deckStart = capStart ? -3 : startTrim;
  /** The deck, minus every crossing another corridor's slab carries through. */
  const deckSpans = wallRuns(deckStart, length + frontPad, deckHoles);

  return (
  <group position={[start[0], 0, start[1]]} rotation-y={yaw}>
    {/* END WALL — the hallway's fifth surface, edited like the others. A
        hallway is finite, so it always terminates in a designed wall. */}
    {capEnd && (
      <Surface
        position={[0, HALL_HEIGHT / 2, -length]}
        url={env.endWall.texture ? textures[env.endWall.texture.path] : undefined}
        presetKey={env.endWall.preset}
        color={env.endWall.color}
        scale={env.endWall.scale}
        offsetX={env.endWall.offsetX}
        offsetY={env.endWall.offsetY}
        repeat={env.endWall.repeat}
        fit={env.endWall.fit}
        brightness={env.endWall.brightness}
        facing={THREE.FrontSide}
        planeW={HALL_WIDTH}
        planeH={HALL_HEIGHT}
      >
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
      </Surface>
    )}
    {/* THE END-WALL SIGN — this hallway's own identity, mounted flat on the wall
        that caps it, at eye level and centred on the wall. Never on the ceiling,
        never floating in the corridor. */}
    {capEnd && (name || endName) && (
      <Nameplate
        text={name || endName || ""}
        caption={name && endName ? endName : undefined}
        position={[0, 2.15, -length + 0.09]}
        fontSize={0.3}
        maxWidth={HALL_WIDTH - 1.2}
      />
    )}
    {/* START POINT — the entrance wall behind you, a designed structural
        component of its own (never the left wall's colour, never the terminal
        wall's design). It faces back down the corridor so it is what you see
        when you turn around at the entrance. */}
    {capStart && (
      <Surface
        position={[0, HALL_HEIGHT / 2, 1.6]}
        rotation-y={Math.PI}
        url={env.startWall.texture ? textures[env.startWall.texture.path] : undefined}
        presetKey={env.startWall.preset}
        color={env.startWall.color}
        scale={env.startWall.scale}
        offsetX={env.startWall.offsetX}
        offsetY={env.startWall.offsetY}
        repeat={env.startWall.repeat}
        fit={env.startWall.fit}
        brightness={env.startWall.brightness}
        facing={THREE.FrontSide}
        planeW={HALL_WIDTH}
        planeH={HALL_HEIGHT}
      >
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
      </Surface>
    )}

    {/* Recessed ceiling light panels + floor light pools, as in the reference */}
    {Array.from({ length: Math.max(1, Math.round(length / 6)) }, (_, i) => {
      const z = -(3 + i * 6);
      if (-z > length) return null;
      return (
        <group key={`lit-${i}`}>
          <mesh position={[0, HALL_HEIGHT - 0.03, z]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[1.5, 0.85]} />
            <meshStandardMaterial color="#fff6e2" emissive="#fff2d6" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
          {([-1, 1] as const).map((s) => (
            <mesh
              key={s}
              position={[s * (HALL_WIDTH / 2 - 0.06), 0.55, z + 3]}
              rotation-y={(-s * Math.PI) / 2}
            >
              <circleGeometry args={[0.12, 16]} />
              <meshStandardMaterial color="#ffe9bd" emissive="#ffd9a0" emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
          ))}
        </group>
      );
    })}
    <group position={[0, 0, -length / 2]}>

      {/* FLOOR & CEILING — segmented decks. Each run is its own slab, cut where
          another corridor's slab carries the crossing, so two decks never share
          a plane at the same depth. `deckLift` gives this corridor its own real
          slab depth, which is what removes the z-fighting for good. */}
      {deckSpans.map(([a, b], i) => {
        const clippedEnd = endDistances && Math.abs(b - (length + frontPad)) < 1e-4;
        const leftEnd = clippedEnd ? endDistances.deck.left : b;
        const rightEnd = clippedEnd ? endDistances.deck.right : b;
        const centerAlong = (a + Math.max(leftEnd, rightEnd)) / 2;
        const runLen = b - a;
        const zc = length / 2 - centerAlong;
        const deckGeometry = clippedEnd ? (
          <planeGeometry />
        ) : (
          <planeGeometry args={[HALL_WIDTH, runLen]} />
        );
        return (
          <group key={`deck-${i}`}>
            <Surface
              rotation-x={-Math.PI / 2}
              position={[0, deckLift, zc]}
              url={env.floor.texture ? textures[env.floor.texture.path] : undefined}
              presetKey={env.floor.preset}
              color={env.floor.color}
              scale={env.floor.scale}
              offsetX={env.floor.offsetX}
              offsetY={env.floor.offsetY}
              repeat={env.floor.repeat}
              fit={env.floor.fit}
              brightness={env.floor.brightness}
              facing={THREE.FrontSide}
              planeW={HALL_WIDTH}
              planeH={runLen}
            >
              {clippedEnd ? (
                <shapeGeometry
                  args={[
                    new THREE.Shape([
                      new THREE.Vector2(-HALL_WIDTH / 2, a - centerAlong),
                      new THREE.Vector2(HALL_WIDTH / 2, a - centerAlong),
                      new THREE.Vector2(HALL_WIDTH / 2, rightEnd - centerAlong),
                      new THREE.Vector2(-HALL_WIDTH / 2, leftEnd - centerAlong),
                    ]),
                  ]}
                />
              ) : deckGeometry}
            </Surface>
            <Surface
              rotation-x={Math.PI / 2}
              position={[0, HALL_HEIGHT - deckLift, zc]}
              url={env.roof.texture ? textures[env.roof.texture.path] : undefined}
              presetKey={env.roof.preset}
              color={env.roof.color}
              scale={env.roof.scale}
              offsetX={env.roof.offsetX}
              offsetY={env.roof.offsetY}
              repeat={env.roof.repeat}
              fit={env.roof.fit}
              brightness={env.roof.brightness}
              facing={THREE.FrontSide}
              planeW={HALL_WIDTH}
              planeH={runLen}
            >
              {clippedEnd ? (
                <shapeGeometry
                  args={[
                    new THREE.Shape([
                      new THREE.Vector2(-HALL_WIDTH / 2, centerAlong - leftEnd),
                      new THREE.Vector2(HALL_WIDTH / 2, centerAlong - rightEnd),
                      new THREE.Vector2(HALL_WIDTH / 2, centerAlong - a),
                      new THREE.Vector2(-HALL_WIDTH / 2, centerAlong - a),
                    ]),
                  ]}
                />
              ) : deckGeometry}
            </Surface>
          </group>
        );
      })}
      {/* LEFT / RIGHT WALLS — each solid run is drawn as its designed surface
          facing INTO the hallway, with a blockwork reveal closing each cut edge
          so the wall still reads with real thickness at a junction. Nothing is
          drawn on the outside of the shell, so looking through a junction mouth
          shows the far hallway's own wallpaper instead of the unlit back of a
          wall. The wall genuinely stops at a junction. */}
      {([-1, 1] as const).map((side) => {
        const wall = side === -1 ? env.leftWall : env.rightWall;
        // Each hole carries its own centre and width: a diagonal branch's mouth
        // is offset forward of its junction point, a hallway arriving square-on
        // is centred on it, and the width follows the real crossing angle.
        const holes = gaps
          .filter((g) => g.side === side)
          .map((g) => ({ along: g.along + g.center, width: g.width }));
        // WALLS STOP AT THE HALLWAY'S OWN END. Only the floor and ceiling run
        // past it (into a junction throat); a wall that overran would poke into
        // the next hallway and fight its wall for the same plane.
        const wallEnd = endDistances
          ? side === -1
            ? endDistances.walls.left
            : endDistances.walls.right
          : length;
        const runs = wallRuns(-backPad, wallEnd, holes);
        return runs.map(([a, b], i) => {
          const runLen = b - a;
          const center = (a + b) / 2;
          const x = side * (HALL_WIDTH / 2);
          return (
            <group key={`${side}-${i}`}>
              <Surface
                position={[x, HALL_HEIGHT / 2, length / 2 - center]}
                rotation-y={(-side * Math.PI) / 2}
                url={wall.texture ? textures[wall.texture.path] : undefined}
                presetKey={wall.preset}
                color={wall.color}
                scale={wall.scale}
                offsetX={wall.offsetX}
                offsetY={wall.offsetY}
                repeat={wall.repeat}
                fit={wall.fit}
                brightness={wall.brightness}
                facing={THREE.FrontSide}
                planeW={runLen}
                planeH={HALL_HEIGHT}
                receiveShadow
              >
                <planeGeometry args={[runLen, HALL_HEIGHT]} />
              </Surface>
              {/* Blockwork reveals: only where this run was cut by a junction,
                  never at the hallway's own ends, so an edge shows depth
                  without any piece overlapping a neighbouring surface. */}
              {([a, b] as const).map((edge, k) => {
                const cut = holes.some(
                  (h) =>
                    Math.abs(edge - (h.along - h.width / 2)) < 1e-4 ||
                    Math.abs(edge - (h.along + h.width / 2)) < 1e-4,
                );
                if (!cut) return null;
                const dir = k === 0 ? 1 : -1;
                return (
                  <mesh
                    key={`reveal-${k}`}
                    position={[
                      side * (HALL_WIDTH / 2 - WALL_THICKNESS / 2),
                      HALL_HEIGHT / 2,
                      length / 2 - (edge + (dir * WALL_THICKNESS) / 2),
                    ]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, WALL_THICKNESS]} />
                    <meshStandardMaterial color={wall.color} roughness={0.85} metalness={0.05} />
                  </mesh>
                );
              })}
            </group>
          );
        });
      })}

    </group>
  </group>
  );
};

// ── Architectural signage ─────────────────────────────────────────────────

/**
 * THE NAMEPLATE — the building's one signage object. A navy plaque with real
 * thickness, rounded corners and a lighter bevel edge, carrying white uppercase
 * text. It is a plain mesh group, so it inherits the transform of whatever it
 * is mounted on (a door frame, a wall) and can never drift, face the screen or
 * lose its depth. Every sign in the building is this component; only the text
 * and the mounting differ.
 */
const PLATE_FACE = "#1d2c55";
const PLATE_EDGE = "#4d72ad";
const PLATE_TEXT = "#f7fafe";
const PLATE_CAPTION = "#a9bcdd";

const platePath = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

/** Split a name into at most `maxLines` lines of at most `maxChars` each. */
const wrapLabel = (text: string, maxChars: number, maxLines: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= maxChars || !cur) {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (!lines.length) return [text.slice(0, maxChars)];
  // Anything that still does not fit is trimmed on the last line, so text can
  // never spill outside the plaque.
  return lines.slice(0, maxLines).map((l) => (l.length > maxChars + 2 ? `${l.slice(0, maxChars)}…` : l));
};

const Nameplate = ({
  text,
  caption,
  position,
  rotationY = 0,
  fontSize = 0.2,
  minWidth = 0,
  maxWidth = 4.4,
  maxLines = 2,
}: {
  text: string;
  caption?: string;
  position: [number, number, number];
  rotationY?: number;
  fontSize?: number;
  /** Floor on the plaque width, so short names still read as a real sign. */
  minWidth?: number;
  maxWidth?: number;
  maxLines?: number;
}) => {
  const label = (text || "").trim().toUpperCase();
  const cap = (caption || "").trim().toUpperCase();
  const padX = fontSize * 1.4;
  const padY = fontSize * 0.75;
  const lineH = fontSize * 1.35;
  const capH = cap ? fontSize * 0.9 : 0;
  const per = fontSize * 0.62;

  const lines = useMemo(
    () => wrapLabel(label, Math.max(6, Math.floor((maxWidth - padX * 2) / per)), maxLines),
    [label, maxWidth, padX, per, maxLines],
  );

  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = Math.min(maxWidth, Math.max(minWidth, fontSize * 5, longest * per + padX * 2));
  const h = lines.length * lineH + capH + padY * 2;
  const depth = Math.max(0.05, fontSize * 0.3);

  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(platePath(w, h, Math.min(0.09, h * 0.22)), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 6,
    });
    return g;
  }, [w, h, depth]);
  useEffect(() => () => geo.dispose(), [geo]);

  // Text baseline: the name block sits above the caption inside the plaque.
  const textTop = h / 2 - padY - lineH / 2;

  return (
    <group position={position} rotation-y={rotationY}>
      {/* Bevel edge, a hair larger and lighter, so the plaque catches the light */}
      <mesh position={[0, 0, depth * 0.2]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.045, h + 0.045, depth * 0.6]} />
        <meshStandardMaterial color={PLATE_EDGE} roughness={0.45} metalness={0.3} />
      </mesh>
      {/* The face carries a little of its own light, so the sign stays readable
          in a corridor whose lighting the teacher may have dimmed. */}
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial
          color={PLATE_FACE}
          emissive={PLATE_FACE}
          emissiveIntensity={0.85}
          roughness={0.5}
          metalness={0.15}
        />
      </mesh>
      <Suspense fallback={null}>
        {lines.map((line, i) => (
          <Text
            key={`${line}-${i}`}
            renderOrder={10}
            material-depthTest={true}
            material-depthWrite={false}
            material-toneMapped={false}
            position={[0, textTop - i * lineH, depth + 0.035]}
            fontSize={fontSize}
            fontWeight={700}
            letterSpacing={0.04}
            anchorX="center"
            anchorY="middle"
            color={PLATE_TEXT}
          >
            {line}
          </Text>
        ))}
        {cap && (
          <Text
            renderOrder={10}
            material-depthTest={true}
            material-depthWrite={false}
            material-toneMapped={false}
            position={[0, -h / 2 + padY + capH * 0.35, depth + 0.035]}
            fontSize={fontSize * 0.5}
            letterSpacing={0.09}
            maxWidth={w - padX}
            anchorX="center"
            anchorY="middle"
            color={PLATE_CAPTION}
          >
            {cap}
          </Text>
        )}
      </Suspense>
    </group>
  );
};

/**
 * A hallway's own name, mounted flat on a wall as a real sign board — never
 * floating, never on the ceiling. The caller supplies the wall position and the
 * facing, so placement always comes from that hallway's own geometry.
 */
const HallwayNameFrame = ({
  name,
  position,
  rotationY = 0,
}: {
  name: string;
  position: [number, number, number];
  rotationY?: number;
}) => <Nameplate text={name} position={position} rotationY={rotationY} fontSize={0.3} maxWidth={5} />;


/**
 * A real door asset fitted into the wall: reveal (jambs + lintel + threshold),
 * then the door leaf itself — a transparent-cutout door image on a plane that
 * is always PARALLEL to the wall it belongs to, so it can never look slanted or
 * detached. The cutout stays transparent, so the hallway wall shows around it.
 *
 * Clicking behaves exactly as before (the caller runs the door zoom and then
 * opens the existing product/room page).
 */
const DOOR_HEIGHT = 3.4;
/**
 * Closest distance (metres) at which anything in the scene can be clicked.
 * Geometry nearer than this is behind the camera's near plane — invisible —
 * so it must never swallow a click meant for the door you are looking at.
 */
const MIN_PICK_DISTANCE = 0.6;

const _doorNormal = new THREE.Vector3();
const _doorPos = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
/**
 * A door can only be used from the side you can SEE it from. The ray must hit
 * the door's face (never its back through a wall) from a visible distance.
 * This is what stops the entrance door — which sits centimetres in front of the
 * eye while you stand in the lobby, and behind you once you walk in — from
 * swallowing clicks meant for a classroom door further down the hallway.
 */
const doorFacesCamera = (
  e: {
    distance: number;
    eventObject: THREE.Object3D;
    camera: THREE.Camera;
  },
  minDistance = MIN_PICK_DISTANCE,
): boolean => {
  if (e.distance < minDistance) return false;
  e.eventObject.getWorldDirection(_doorNormal); // the leaf's front (+z local)
  e.eventObject.getWorldPosition(_doorPos);
  _toCamera.copy(e.camera.position).sub(_doorPos);
  return _doorNormal.dot(_toCamera) > 0;
};

const DoorMesh = ({
  side,
  z,
  label,
  sublabel,
  accent,
  color,
  emissiveIntensity,
  styleKey,
  textureUrl,
  aspect,
  atStart = false,
  lock,
  onEnter,
}: {
  side: number;
  z: number;
  label: string;
  sublabel: string;
  accent: string;
  color: string;
  emissiveIntensity: number;
  styleKey?: string;
  /** custom uploaded door image; falls back to the built-in style asset */
  textureUrl?: string;
  aspect?: number;
  /**
   * ENTRANCE mode: the door sits in the wall that CAPS the start of the
   * hallway, facing back down the corridor, instead of in a side wall.
   */
  atStart?: boolean;
  /**
   * OPTIONAL ACCESS LOCK. A door has one only when a teacher added it; without
   * it the door behaves exactly as an unlocked door always has. The panel is a
   * child of this door group, so it holds its place beside the leaf whatever
   * the camera does.
   */
  lock?: {
    charset: RoomLock["charset"];
    length: number;
    state: LockState;
    filled: number;
    remaining?: number | null;
    retryIn?: string | null;
    onKey: (key: string) => void;
    onClear: () => void;
    onSubmit: () => void;
    onFocus: () => void;
  } | null;

  onEnter: () => void;
}) => {

  const style = doorStyle(styleKey);
  const url = textureUrl || style.url;
  const tex = useLoadedTexture(url);
  const ratio = aspect ?? style.aspect;
  const leafH = DOOR_HEIGHT;
  const leafW = Math.min(3.0, leafH * ratio);

  // The FRAME and the DOOR PANEL are independent layers. Hover feedback lives
  // on the frame only — the panel must always show the imported door artwork
  // with its own colour, glass and lighting, never a frame-coloured wash.
  const frames = useRef<THREE.MeshStandardMaterial[]>([]);
  const addFrame = (m: THREE.MeshStandardMaterial | null) => {
    if (m && !frames.current.includes(m)) frames.current.push(m);
  };
  const [hovered, setHovered] = useState(false);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    const ft = hovered ? 0.9 : 0;
    for (const m of frames.current) {
      m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity ?? 0, ft, k);
    }
  });


  const jambW = 0.16;
  const openW = leafW + jambW * 2;
  const openH = leafH + jambW;

  return (
    // Flush against the wall plane and rotated to the wall's own orientation:
    // the door face is parallel to the wall and looks into the corridor.
    //
    // THE WHOLE DOORWAY IS THE DOOR. Frame, jambs, threshold, nameplate and the
    // pick plane below all enter the same room, and the click stops here, so a
    // click a few centimetres off the leaf can never fall through to a corridor
    // mouth or the exit door behind it.
    <group
      position={atStart ? [0, 0, z - 0.06] : [side * (HALL_WIDTH / 2 - 0.06), 0, z]}
      rotation-y={atStart ? Math.PI : -side * (Math.PI / 2)}
      onClick={(e) => {
        // THE ENTRANCE DOOR is the one you can stand inside (before walking in,
        // or with your back to it), so it only answers from a visible distance.
        // A CLASSROOM DOOR answers from any distance — it only has to be hit on
        // its face, never through the wall from the corridor behind it.
        if (!doorFacesCamera(e, atStart ? MIN_PICK_DISTANCE : 0)) {
          if (!atStart) toast.message("Step back into the hallway to open this door.");
          return;
        }
        e.stopPropagation();
        onEnter();
      }}
      onPointerOver={(e) => {
        if (!doorFacesCamera(e, atStart ? MIN_PICK_DISTANCE : 0)) return;
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "auto";
        setHovered(false);
      }}
    >
      {/* Invisible pick surface covering the full opening, inside the door group
          so it can never drift away from the leaf. */}
      <mesh position={[0, openH / 2, 0.12]}>
        <planeGeometry args={[openW + 0.5, openH + 0.9]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>



      {/* Reveal / frame — jambs, lintel and threshold read as one structure */}
      <group>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (openW / 2 - jambW / 2), openH / 2, 0.09]} castShadow>
            <boxGeometry args={[jambW, openH, 0.18]} />
            <meshStandardMaterial ref={addFrame} color={accent} emissive={accent} emissiveIntensity={0} roughness={0.55} metalness={0.15} />
          </mesh>
        ))}
        <mesh position={[0, openH - jambW / 2, 0.09]} castShadow>
          <boxGeometry args={[openW, jambW, 0.18]} />
          <meshStandardMaterial ref={addFrame} color={accent} emissive={accent} emissiveIntensity={0} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.03, 0.09]}>
          <boxGeometry args={[openW, 0.06, 0.18]} />
          <meshStandardMaterial ref={addFrame} color={accent} emissive={accent} emissiveIntensity={0} roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Recess behind the leaf so the doorway reads as depth, not a sticker.
            Neutral shadow tone — never the door design colour, so the panel is
            the only surface that carries the door's own look. */}
        <mesh position={[0, openH / 2, -0.04]}>
          <planeGeometry args={[openW, openH]} />
          <meshStandardMaterial color="#0b0f18" roughness={0.95} metalness={0} />
        </mesh>
      </group>

      {/* The DOOR PANEL: the imported/built-in door artwork, rendered exactly as
          provided. Independent of the frame — no accent tint, no frame-coloured
          emissive wash, so changing the frame never repaints the door. */}
      <mesh position={[0, leafH / 2 + 0.03, 0.07]} castShadow>

        <planeGeometry args={[leafW, leafH]} />
        <meshStandardMaterial
          key={tex ? url : "flat"}
          map={tex ?? null}
          transparent
          alphaTest={0.5}
          depthWrite
          color={tex ? "#ffffff" : color}
          emissive={tex ? "#ffffff" : color}
          emissiveMap={tex ?? null}
          emissiveIntensity={tex ? Math.min(0.35, emissiveIntensity * 0.6) : emissiveIntensity * 0.5}
          roughness={0.7}
          metalness={0.05}
          side={THREE.FrontSide}
        />
      </mesh>



      {/* THE ACCESS PANEL — mounted on the wall immediately to the right of the
          leaf, at hand height. Independent of the door's own materials: adding
          or removing it never changes how the door looks. */}
      {lock && (
        <group position={[leafW / 2 + 0.52, 1.32, 0.1]}>
          <DoorLockPanel
            state={lock.state}
            filled={lock.filled}
            length={lock.length}
            charset={lock.charset}
            remaining={lock.remaining ?? null}
            retryIn={lock.retryIn ?? null}

            onKey={lock.onKey}
            onClear={lock.onClear}
            onSubmit={lock.onSubmit}
            onFocus={lock.onFocus}
          />
        </group>
      )}

      {/* The door's nameplate: a real navy plaque mounted on the wall just above
          the lintel. It is a CHILD of the door group, so it keeps its position
          and perspective whatever the door or camera does. Clearance to the
          ceiling is guaranteed by clamping its centre height. */}
      <Nameplate
        text={label}
        caption={sublabel}
        position={[0, Math.min(openH + 0.46, HALL_HEIGHT - 0.6), 0.13]}
        fontSize={0.24}
        minWidth={openW * 0.85}
        maxWidth={openW + 1.2}
      />
    </group>
  );
};

/** A flat triangle at height `y`, from plan points in the corridor's own frame. */
const PlanTriangle = ({
  pts,
  y,
  color,
  up = true,
  roughness = 0.9,
}: {
  pts: [number, number][];
  y: number;
  color: string;
  up?: boolean;
  roughness?: number;
}) => {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const order = up ? [0, 1, 2] : [2, 1, 0];
    const verts = new Float32Array(
      order.flatMap((i) => [pts[i][0], y, pts[i][1]]),
    );
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [pts, y, up]);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} side={THREE.DoubleSide} />
    </mesh>
  );
};

/**
 * THE HALLWAY JUNCTION — where two real corridor VOLUMES meet at 60°.
 *
 * Nothing here is a hole punched through a plane. The parent's wall runs stop
 * either side of the mouth (see wallRuns), jamb blocks show the blockwork
 * thickness at each cut edge, a soffit beam carries the ceiling across, the
 * branch's own upstream wall returns out into the branch, and the throat
 * between the wall plane and the branch's shell is floored and ceiled so the
 * two corridors genuinely intersect. Because the branch leaves diagonally its
 * mouth is wider than the corridor and offset forward of the junction point —
 * that is what lets you see the main hallway ahead AND deep into the branch
 * from one standing position. Clicking the mouth enters that hallway.
 */
const BranchOpening = ({
  side,
  along,
  name,
  accent,
  floorColor,
  roofColor,
  onEnter,
}: {
  side: -1 | 1;
  along: number;
  name: string;
  accent: string;
  floorColor: string;
  roofColor: string;
  onEnter: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const geo = junctionGeometry(HALL_WIDTH);
  const openH = HALL_HEIGHT - geo.soffit;
  // Plan points in this corridor's frame: x across (mirrored by side), z back
  // down the corridor (forward is -z), measured from the junction point.
  const P = (p: [number, number]): [number, number] => [side * p[0], -p[1]];
  const near = P(geo.mouthNear);
  const far = P(geo.mouthFar);
  const corner = P(geo.throatCorner);
  const mouthMid = -geo.mouthCenterOffset;
  const wallX = side * (HALL_WIDTH / 2);
  const centroid: [number, number] = [
    (near[0] + far[0] + corner[0]) / 3,
    (near[1] + far[1] + corner[1]) / 3,
  ];

  return (
    <group position={[0, 0, -along]}>
      {/* This triangle alone owns the throat between the parent's side edge and
          the branch shell. The parent owns its interior and the branch deck now
          starts at `branchTrim`, so these faces meet only along shared edges. */}
      <PlanTriangle pts={[near, far, corner]} y={0} color={floorColor} roughness={0.85} />
      <PlanTriangle pts={[near, far, corner]} y={HALL_HEIGHT} color={roofColor} up={false} />

      {/* Jamb blocks: the blockwork thickness shown at both cut edges */}
      {[
        { z: near[1] + geo.jambWidth / 2 },
        { z: far[1] - geo.jambWidth / 2 },
      ].map((j, i) => (
        <mesh
          key={`jamb-${i}`}
          position={[wallX + (side * WALL_THICKNESS) / 2, openH / 2, j.z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[WALL_THICKNESS * 1.02, openH, geo.jambWidth]} />
          <meshStandardMaterial color={accent} roughness={0.9} metalness={0.05} />
        </mesh>
      ))}

      {/* Soffit beam carrying the ceiling over the mouth, full wall thickness */}
      <mesh
        position={[wallX + (side * WALL_THICKNESS) / 2, openH + geo.soffit / 2, mouthMid]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[WALL_THICKNESS * 1.02, geo.soffit, geo.mouthSpan]} />
        <meshStandardMaterial color={roofColor} roughness={0.92} metalness={0.04} />
      </mesh>

      {/* Light in the throat, so the thickness and depth are legible */}
      <pointLight
        position={[centroid[0], HALL_HEIGHT - 0.9, centroid[1]]}
        intensity={hovered ? 2.4 : 1.9}
        distance={20}
        color="#dbeafe"
      />


      {/* Pick target filling the mouth: click to enter that hallway */}
      <mesh
        position={[wallX, openH / 2, mouthMid]}
        rotation-y={(-side * Math.PI) / 2}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <planeGeometry args={[geo.mouthSpan, openH]} />
        <meshBasicMaterial
          transparent
          opacity={hovered ? 0.07 : 0}
          color="#e0f2fe"
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* THE HALLWAY NAME FRAME — mounted on the wall directly ACROSS from this
          mouth, facing it, so walking up to the junction you read the name of
          the hallway you are about to enter. Derived entirely from this mouth's
          own geometry (side + position along the corridor), never a fixed spot. */}
      <HallwayNameFrame
        name={name}
        position={[-side * (HALL_WIDTH / 2 - 0.1), 2.15, mouthMid]}
        rotationY={(side * Math.PI) / 2}
      />
    </group>
  );
};

/**
 * THE MERGE JUNCTION — where a hallway ARRIVES at this one and stops.
 *
 * This is not a branch: the arriving hallway is not leaving at the branch angle,
 * so its opening is cut STRAIGHT and centred exactly on the junction point, with
 * a width that follows the angle the two hallways make. It is built like real
 * construction: full-thickness jamb reveals at both cut edges, a lintel/soffit
 * beam carrying the ceiling over the opening, and a floor and ceiling patch
 * bridging the wall's own thickness so there is never a black seam under it.
 * Nothing returns into the corridor, so no wall panel appears to stand in the
 * road, and the arriving hallway's name is read off the facing wall.
 */
const MergeOpening = ({
  side,
  along,
  span,
  name,
  accent,
  floorColor,
  roofColor,
  onEnter,
}: {
  side: -1 | 1;
  along: number;
  /** true width of the hole along this hallway's wall */
  span: number;
  name: string;
  accent: string;
  floorColor: string;
  roofColor: string;
  onEnter: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const geo = junctionGeometry(HALL_WIDTH);
  const openH = HALL_HEIGHT - geo.soffit;
  const wallX = side * (HALL_WIDTH / 2);
  const revealLayout = openingRevealLayout(span, geo.jambWidth);
  // The arriving deck stops at the wall's outside face, so the throat carries
  // the FULL wall thickness — exactly the span the jambs and lintel occupy. A
  // half-thickness reveal left an unfloored, unceiled sliver that read as a
  // dark line through the opening.
  const reveal = WALL_THICKNESS;

  return (
    <group position={[0, 0, -along]}>
      {/* Floor + ceiling through the wall thickness. Plane dimensions are
          [across-wall depth, along-wall span]; reversing these axes used to lay
          a large coplanar rectangle over the target deck and caused flicker. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[wallX + (side * reveal) / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[reveal, span]} />
        <meshStandardMaterial color={floorColor} roughness={0.86} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[wallX + (side * reveal) / 2, HALL_HEIGHT, 0]}>
        <planeGeometry args={[reveal, span]} />
        <meshStandardMaterial color={roofColor} roughness={0.92} />
      </mesh>

      {/* Jamb reveals: the blockwork thickness shown at both cut edges, so the
          cut wall is never a paper-thin sheet when seen from an angle. */}
      {revealLayout.jambCenters.map((center, edge) => (
        <mesh
          key={`jamb-${edge}`}
          position={[
            wallX + (side * WALL_THICKNESS) / 2,
            openH / 2,
            center,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[WALL_THICKNESS, openH, revealLayout.jambWidth]} />
          <meshStandardMaterial color={accent} roughness={0.9} metalness={0.05} />
        </mesh>
      ))}

      {/* Lintel carrying the ceiling straight across the opening */}
      <mesh
        position={[wallX + (side * WALL_THICKNESS) / 2, openH + geo.soffit / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[WALL_THICKNESS, geo.soffit, revealLayout.lintelWidth]} />
        <meshStandardMaterial color={roofColor} roughness={0.92} metalness={0.04} />
      </mesh>

      <pointLight
        position={[wallX + side * 1.2, HALL_HEIGHT - 0.9, 0]}
        intensity={hovered ? 2.2 : 1.7}
        distance={18}
        color="#dbeafe"
      />

      {/* Pick target filling the opening: click to walk into that hallway */}
      <mesh
        position={[wallX, openH / 2, 0]}
        rotation-y={(-side * Math.PI) / 2}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <planeGeometry args={[span, openH]} />
        <meshBasicMaterial
          transparent
          opacity={hovered ? 0.07 : 0}
          color="#e0f2fe"
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The arriving hallway's name, mounted flat on the wall opposite its
          opening — on a wall, at eye level, never floating in the corridor. */}
      <HallwayNameFrame
        name={name}
        position={[-side * (HALL_WIDTH / 2 - 0.1), 2.15, 0]}
        rotationY={(side * Math.PI) / 2}
      />
    </group>
  );
};



// ── Navigation machine ────────────────────────────────────────────────────

/**
 * Ease a yaw toward a target by the SHORT way round, so a heading change at a
 * junction never spins the camera the long way through the walls.
 */
const shortestYaw = (current: number, target: number, k: number): number => {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * k;
};

export type NavPhase = "browse" | "walking" | "turning" | "zooming" | "idle" | "inside" | "keypad";

/**
 * STANDING AT A KEYPAD. Reading a wall panel is a place you STAY, not a glance:
 * the camera holds this spot until the code opens the door or the walker moves
 * off, so the view never springs back to the middle of the hallway.
 */
interface KeypadStance {
  to: [number, number, number];
  look: [number, number, number];
  /** The phase the walk returns to once the panel is left. */
  restorePhase: NavPhase;
}


interface TurnSpec {
  pivot: [number, number];
  fromYaw: number;
  toYaw: number;
  radius: number;
  duration: number;
  elapsed: number;
  onDone: () => void;
}

interface ZoomSpec {
  from: [number, number, number];
  to: [number, number, number];
  look: [number, number, number];
  duration: number;
  elapsed: number;
  started: boolean;
  restorePhase: NavPhase;
  onDone: () => void;
}

interface Machine {
  phase: NavPhase;
  seg: Segment;
  dist: number;
  moving: boolean;
  /**
   * The user's INPUT INTENT: 0 = nothing held, 1 = Forward held, -1 = Backward
   * held. The camera never travels on its own — movement is the direct result
   * of this value, and it returns to 0 the instant the control is released.
   */
  hold: -1 | 0 | 1;
  /**
   * Which way the walker faces along the hallway: 1 = along the road's heading,
   * -1 = back the way they came. Pressing Backward turns the camera around
   * (a real about-face) and then walks in that direction.
   */
  dir: 1 | -1;
  /** current walking speed, ramped so the walk never starts or stops dead */
  speed: number;
  /**
   * Distances along the current hallway where a perpendicular junction opens.
   * Kept for the map / turn availability — they no longer brake the walk.
   */
  stops: number[];

  yaw: number;
  turn: TurnSpec | null;
  zoom: ZoomSpec | null;
  /** Held position in front of a door's access keypad, while a code is typed. */
  keypad: KeypadStance | null;

  /**
   * Standing INSIDE a classroom shell. The walker's hallway position is left
   * untouched, so leaving the room continues the walk exactly where it stopped.
   * Inside the room the camera is a free first-person walker in the room's own
   * local space: +z runs from the doorway into the room, x across it.
   */
  inside: RoomWalker | null;
}

/**
 * FREE MOVEMENT INSIDE A ROOM.
 *
 * Local space matches `ClassroomShell`: the group sits at the doorway and is
 * rotated so local +z points into the room. The walker owns its own position
 * and facing there, so it can walk, strafe and turn all the way round.
 */
export interface RoomWalker {
  /** World position of the doorway the room hangs off. */
  door: [number, number];
  /** Unit heading pointing from the doorway INTO the room. */
  heading: [number, number];
  kind: ClassroomKind;
  /** local across-the-room position, 0 = centre line */
  x: number;
  /** local distance from the doorway into the room */
  z: number;
  /** local facing, 0 = looking straight into the room */
  yaw: number;
  /** walk intent: 1 = forward held, -1 = backward held */
  hold: -1 | 0 | 1;
  /** sideways-step intent: -1 = left, 1 = right */
  strafe: -1 | 0 | 1;
  /** turn intent: -1 = turn left, 1 = turn right */
  turning: -1 | 0 | 1;
  speed: number;
  strafeSpeed: number;
}

/** Metres per second walking inside a room — calmer than corridor walking. */
const ROOM_WALK_SPEED = 2.6;
/** Radians per second while a turn control is held. */
const ROOM_TURN_SPEED = 1.5;
/** How close the walker may get to a room wall. */
const ROOM_WALL_MARGIN = 0.55;
/** How close you may stand to the teaching wall, so the screen can fill the view. */
const ROOM_SCREEN_MARGIN = 0.22;

/** Half-width of the walkable doorway back to the hallway. */
const ROOM_DOOR_HALF = 1.1;
/** Local z at or below which the walker steps back out through the door. */
const ROOM_EXIT_Z = 0.35;

/** Room-local (x, z) to world (x, z), matching the shell's own transform. */
const roomLocalToWorld = (
  w: RoomWalker,
  x: number,
  z: number,
): [number, number] => {
  const [hx, hz] = w.heading;
  return [w.door[0] + x * hz + z * hx, w.door[1] - x * hx + z * hz];
};

/** Floor height of the tier the walker is standing on. */
const roomFloorAt = (kind: ClassroomKind, z: number): number => {
  const tiers = classroomDimensions(kind).tiers;
  const t = tiers.find((tier) => z >= tier.from && z <= tier.to);
  return (t ?? tiers[tiers.length - 1]).y;
};



// ── Camera rig ────────────────────────────────────────────────────────────

interface NavState {
  seg: Segment;
  mode: "browse" | "walk";
}

const CameraRig = ({
  focus,
  rooms,
  m,
  rootLen,
  onWalkEnd,
  onJunctionReach,
  onBoundary,
  onLeaveRoom,
  setPhase,
}: {

  focus: number;
  rooms: AcademyRoom[];
  m: React.RefObject<Machine>;
  rootLen: number;
  onWalkEnd: () => void;
  /** Arrived alongside a junction opening mid-hallway. */
  onJunctionReach: () => void;
  /**
   * Walked off one end of the current hallway. Returns TRUE when the walker was
   * handed over to a connected hallway (movement continues), FALSE when this end
   * is a real boundary and the walk must stop there.
   */
  onBoundary: (sign: 1 | -1) => boolean;
  /** The room walker stepped back out through the doorway. */
  onLeaveRoom: () => void;
  setPhase: (p: NavPhase) => void;

}) => {
  useFrame(({ camera }, rawDelta) => {
    const st = m.current;
    if (!st) return;
    const dt = Math.min(rawDelta, 0.05);
    const k = 1 - Math.exp(-6 * dt);

    if (st.phase === "browse") {
      // Standing in the hallway looking straight down it — never angled at a
      // wall, so entering walk mode is seamless.
      const targetZ = -Math.min(focus * SPACING, Math.max(0, rootLen - 6));
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, k);
      camera.position.y = 1.75;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, k);
      st.yaw = 0;
      camera.lookAt(0, 1.7, camera.position.z - 8);
      return;
    }

if (st.phase === "walking" || st.phase === "idle") {
      let seg = st.seg;
      // FIRST-PERSON HOLD-TO-WALK: the camera travels only while Forward or
      // Backward is held. Speed ramps up and down with frame-rate-independent
      // damping, so starting and stopping is smooth, and the position is never
      // reset — releasing and holding again continues from exactly where it
      // stopped. Reaching the end of a hallway that CONTINUES hands the walker
      // over to the connected hallway without stopping or teleporting.
      const wanted = st.hold !== 0 ? WALK_SPEED : 0;
      st.speed = THREE.MathUtils.lerp(st.speed, wanted, 1 - Math.exp(-9 * dt));
      if (st.speed > 0.001) {
        st.dist += dt * st.speed * st.dir;
        if (st.dist > seg.length) {
          if (onBoundary(1)) seg = st.seg;
          else st.dist = seg.length;
        } else if (st.dist < 0) {
          if (onBoundary(-1)) seg = st.seg;
          else st.dist = 0;
        }
      }
      seg = st.seg;
      const limit = seg.length;
      const d = st.dist;
      const px = seg.start[0] + seg.heading[0] * d;
      const pz = seg.start[1] + seg.heading[1] * d;
      const facing = st.dir === 1 ? seg.heading : reverseHeading(seg.heading);
      st.yaw = shortestYaw(st.yaw, segYaw(facing), k);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, px, k);
      camera.position.y = 1.75;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, pz, k);
      const dir = forwardFromYaw(st.yaw);
      camera.lookAt(camera.position.x + dir[0] * 6, 1.75, camera.position.z + dir[1] * 6);
      // Junction proximity only decides which turns are offered; it no longer
      // brakes the walk. The terminal wall still stops the walker.
      const atOpening = st.stops.some((s) => Math.abs(s - d) < 2.5);
      if (atOpening) onJunctionReach();
      if (st.dir === 1 && d >= limit - 0.05) onWalkEnd();
      return;

    }


    if (st.phase === "turning") {
      const t = st.turn;
      if (!t) {
        setPhase("walking");
        st.phase = "walking";
        return;
      }
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      const eased = easeInOut(p);
      const yaw = t.fromYaw + (t.toYaw - t.fromYaw) * eased;
      st.yaw = yaw;
      const f = forwardFromYaw(yaw);
      const cx = t.pivot[0] + f[0] * t.radius;
      const cz = t.pivot[1] + f[1] * t.radius;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cx, k);
      camera.position.y = 1.75;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, cz, k);
      camera.lookAt(camera.position.x + f[0] * 6, 1.75, camera.position.z + f[1] * 6);
      if (p >= 1) {
        st.turn = null;
        t.onDone();
      }
      return;
    }

    if (st.phase === "inside") {
      const w = st.inside;
      if (!w) {
        setPhase("idle");
        st.phase = "idle";
        return;
      }
      // FREE FIRST-PERSON WALKER. Turning, walking and side-stepping are all
      // direct results of held intent, integrated with delta time and clamped
      // to the room's own footprint, so the walls are solid.
      const dims = classroomDimensions(w.kind);
// Increasing yaw swings the view toward room-local +x, which is the
      // screen's LEFT when looking into the room, so turning right must
      // DECREASE yaw (the drag-look handler below uses the same sign).
      if (w.turning !== 0) w.yaw -= w.turning * ROOM_TURN_SPEED * dt;
      const wantWalk = w.hold !== 0 ? ROOM_WALK_SPEED : 0;
      const wantSide = w.strafe !== 0 ? ROOM_WALK_SPEED * 0.7 : 0;
      const ramp = 1 - Math.exp(-9 * dt);
      w.speed = THREE.MathUtils.lerp(w.speed, wantWalk, ramp);
      w.strafeSpeed = THREE.MathUtils.lerp(w.strafeSpeed, wantSide, ramp);

      const sin = Math.sin(w.yaw);
      const cos = Math.cos(w.yaw);
      // Local forward = (sin, cos); local right = (cos, -sin).
      let nx = w.x;
      let nz = w.z;
      if (w.speed > 0.001) {
        nx += sin * w.speed * w.hold * dt;
        nz += cos * w.speed * w.hold * dt;
      }
if (w.strafeSpeed > 0.001) {
        // The view's right vector is (-cos, sin), so strafe +1 steps right.
        nx += -cos * w.strafeSpeed * w.strafe * dt;
        nz += sin * w.strafeSpeed * w.strafe * dt;
      }

      // Stepping back through the doorway leaves the room.
      if (nz <= ROOM_EXIT_Z && Math.abs(nx) <= ROOM_DOOR_HALF) {
        onLeaveRoom();
        return;
      }
      const halfX = dims.width / 2 - ROOM_WALL_MARGIN;
      w.x = THREE.MathUtils.clamp(nx, -halfX, halfX);
      // The teaching wall carries the smart screen, so a student may stand very
      // close to it — close enough for the picture to fill the view.
      w.z = THREE.MathUtils.clamp(nz, ROOM_WALL_MARGIN, dims.length - ROOM_SCREEN_MARGIN);


      const [wx, wz] = roomLocalToWorld(w, w.x, w.z);
      const eye = roomFloorAt(w.kind, w.z) + 1.75;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, wx, k);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, eye, k);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, wz, k);
      const [lx, lz] = roomLocalToWorld(w, w.x + sin * 6, w.z + cos * 6);
      camera.lookAt(lx, eye, lz);
      return;
    }

    /**
     * AT THE KEYPAD. The walker is standing in front of a wall panel, so the
     * camera simply stays there and keeps facing it. It is held, not animated:
     * nothing drags it back into the hallway while the code is being typed.
     */
    if (st.phase === "keypad") {
      const f = st.keypad;
      if (!f) {
        setPhase(st.moving ? "walking" : "idle");
        st.phase = st.moving ? "walking" : "idle";
        return;
      }
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, f.to[0], k);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, f.to[1], k);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, f.to[2], k);
      camera.lookAt(f.look[0], f.look[1], f.look[2]);
      return;
    }


    if (st.phase === "zooming") {
      const z = st.zoom;
      if (!z) {
        setPhase(st.moving ? "walking" : "idle");
        st.phase = st.moving ? "walking" : "idle";
        return;
      }
      if (!z.started) {
        z.from = [camera.position.x, camera.position.y, camera.position.z];
        z.started = true;
      }
      z.elapsed += dt;
      const p = Math.min(1, z.elapsed / z.duration);
      const eased = easeInOut(p);
      camera.position.x = THREE.MathUtils.lerp(z.from[0], z.to[0], eased);
      camera.position.y = THREE.MathUtils.lerp(z.from[1], z.to[1], eased);
      camera.position.z = THREE.MathUtils.lerp(z.from[2], z.to[2], eased);
      camera.lookAt(z.look[0], z.look[1], z.look[2]);
      if (p >= 1) {
        st.zoom = null;
        z.onDone();
      }
      return;
    }
  });
  void rooms;
  return null;
};

// ── Walk controls overlay ─────────────────────────────────────────────────

/**
 * TWO PERMANENT CONTROLS.
 *
 * Right = MOVE FORWARD, always. Hold to walk in the direction currently faced,
 * release to stop. Its meaning never changes.
 * Left = TURN AROUND, unless a junction is close enough AHEAD, in which case it
 * temporarily becomes ENTER <hallway>. Nothing ever moves on its own.
 */
const WalkControls = ({
  action,
  moving,
  onForwardStart,
  onForwardEnd,
  onTurnAround,
  onJunction,
  ended,
}: {
  action: JunctionAction | null;
  moving: boolean;
  onForwardStart: () => void;
  onForwardEnd: () => void;
  onTurnAround: () => void;
  onJunction: (a: JunctionAction) => void;
  ended: boolean;
}) => (

  <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
    {ended && !action && (
      <p className="rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
        End of the hallway — tap Turn around, then hold Move forward
      </p>
    )}
    <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 p-1.5 backdrop-blur">
      {action ? (
        <button
          type="button"
          aria-label={`Enter ${action.label}`}
          onClick={() => onJunction(action)}
          className="min-h-[56px] select-none rounded-full bg-sky-500/25 px-5 text-sm font-semibold text-sky-100"
        >
          {action.side === -1 ? "◀ " : ""}
          Enter {action.label}
          {action.side === 1 ? " ▶" : ""}
        </button>
      ) : (
        <button
          type="button"
          aria-label="Turn around"
          onClick={onTurnAround}
          className="min-h-[56px] select-none rounded-full px-5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          ↻ Turn around
        </button>
      )}
      <button
        type="button"
        aria-label="Hold to move forward"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          onForwardStart();
        }}
        onPointerUp={onForwardEnd}
        onPointerCancel={onForwardEnd}
        onLostPointerCapture={onForwardEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={`inline-flex h-14 w-14 select-none touch-none items-center justify-center rounded-full text-lg ${moving ? "bg-primary text-primary-foreground scale-105" : "bg-primary/80 text-primary-foreground"}`}
      >
        ▲
      </button>


    </div>
  </div>
);

// ── Room controls overlay ─────────────────────────────────────────────────

/**
 * INSIDE A ROOM the navigation changes: hold to walk forward or back, hold to
 * turn left or right (all the way round), and hold the side buttons to step
 * sideways. Nothing moves on its own. Walking back out through the doorway is
 * the natural way out; the Leave button stays as a fallback.
 */
const RoomControls = ({
  onWalk,
  onTurn,
  onStrafe,
  onLeave,
}: {
  onWalk: (v: -1 | 0 | 1) => void;
  onTurn: (v: -1 | 0 | 1) => void;
  onStrafe: (v: -1 | 0 | 1) => void;
  onLeave: () => void;
}) => {
  const hold = (start: () => void, end: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const btn =
    "inline-flex h-14 w-14 select-none touch-none items-center justify-center rounded-full bg-primary/80 text-lg text-primary-foreground active:scale-105 active:bg-primary";

  return (
    <div className="absolute inset-x-0 bottom-4 z-30 flex flex-col items-center gap-2 px-4">
      <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 p-1.5 backdrop-blur">
        <button type="button" aria-label="Turn left" className={btn} {...hold(() => onTurn(-1), () => onTurn(0))}>
          ↰
        </button>
        <button type="button" aria-label="Step left" className={btn} {...hold(() => onStrafe(-1), () => onStrafe(0))}>
          ◀
        </button>
        <div className="flex flex-col gap-1.5">
          <button type="button" aria-label="Walk forward" className={btn} {...hold(() => onWalk(1), () => onWalk(0))}>
            ▲
          </button>
          <button type="button" aria-label="Walk backward" className={btn} {...hold(() => onWalk(-1), () => onWalk(0))}>
            ▼
          </button>
        </div>
        <button type="button" aria-label="Step right" className={btn} {...hold(() => onStrafe(1), () => onStrafe(0))}>
          ▶
        </button>
        <button type="button" aria-label="Turn right" className={btn} {...hold(() => onTurn(1), () => onTurn(0))}>
          ↱
        </button>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur hover:text-foreground"
      >
        Leave through the door
      </button>
    </div>
  );
};


// ── Live navigation minimap (fixed top-right HUD) ─────────────────────────

/** Animation frame tick, so the player marker travels smoothly, never jumps. */
const useMapFrames = (active: boolean) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 100000);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [active]);
};

/**
 * Pixels per metre on the map at 1x zoom. The plan never rescales itself as the
 * building grows — the window follows the walker, and the user zooms instead.
 */
const MAP_METRE = 2.6;

/** Google-Maps style zoom range, in exponential steps. The PANEL never resizes. */
const MAP_ZOOM_MIN = 0.35;
const MAP_ZOOM_MAX = 3;
const MAP_ZOOM_STEP = 1.35;

const MiniMap = ({
  segments,
  layouts,
  connectors,
  m,
  show,
  ended = false,
  routeIds = [],
  rooms,
}: {
  segments: Segment[];
  layouts: Map<string, HallwayObject[]>;
  connectors: Map<string, ConnectorInfo>;
  m: React.RefObject<Machine>;
  show: boolean;
  /** door id → the room behind that door, so the plan shows real rooms. */
  rooms: Map<string, BuildingClassroom>;
  /** True when the walker is standing at the end of the current hallway. */
  ended?: boolean;
  /** Hallways actually travelled, in order — the route highlight. */
  routeIds?: string[];
}) => {
  const [zoom, setZoom] = useState(1);
  useMapFrames(show);

  const svg = useMemo(() => {
    const pts: number[] = [];
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number; name: string }[] = [];
    const doorDots: { x: number; z: number }[] = [];
    /**
     * ROOM FOOTPRINTS. A room is one unit with its door: the shape starts at the
     * doorway and runs away from the corridor, using the shell's real size.
     */
    const roomShapes: {
      id: string;
      points: string;
      front: string;
      labelX: number;
      labelZ: number;
      label: string;
    }[] = [];
    /** Terminal navigation nodes — the editable ENDPOINT of each route. */
    const ends: { id: string; x: number; z: number; name: string }[] = [];
    /** hallway id → its parent hallway id, so the active route can be traced. */
    const parentOf = new Map<string, string | null>();
    /** Both ends of every connection, so loops are drawn on the plan. */
    const linkEnds = new Map<string, { x: number; z: number }[]>();
    const walk = (s: Segment, parentId: string | null) => {
      const id = s.walkway?.id ?? "root";
      parentOf.set(id, parentId);
      const ex = s.start[0] + s.heading[0] * s.length;
      const ez = s.start[1] + s.heading[1] * s.length;
      lines.push({ id, x1: s.start[0], y1: s.start[1], x2: ex, y2: ez, name: s.walkway?.name ?? "Hallway" });
      pts.push(s.start[0], s.start[1], ex, ez);
      for (const o of layouts.get(s.walkway?.id ?? "") ?? []) {
        const at = {
          x: s.start[0] + s.heading[0] * o.along + o.side * 1.2 * -s.heading[1],
          z: s.start[1] + s.heading[1] * o.along + o.side * 1.2 * s.heading[0],
        };
        if (o.kind === "door") {
          doorDots.push(at);
          const room = rooms.get(o.id);
          if (room) {
            const dims = classroomDimensions(room.kind);
            // Outward normal — from the wall away from the corridor.
            const nx = o.side * -s.heading[1];
            const nz = o.side * s.heading[0];
            const hw = dims.width / 2;
            const corner = (a: number, b: number): [number, number] => [
              at.x + s.heading[0] * a + nx * b,
              at.z + s.heading[1] * a + nz * b,
            ];
            const cs: [number, number][] = [
              corner(-hw, 0),
              corner(hw, 0),
              corner(hw, dims.length),
              corner(-hw, dims.length),
            ];
            const mid = corner(0, dims.length / 2);
            // The presentation end of the room, marked on the plan.
            const f1 = corner(-hw, dims.length);
            const f2 = corner(hw, dims.length);
            roomShapes.push({
              id: o.id,
              points: cs.map((c) => `${c[0]},${c[1]}`).join(" "),
              front: `${f1[0]},${f1[1]} ${f2[0]},${f2[1]}`,
              labelX: mid[0],
              labelZ: mid[1],
              label: `${CLASSROOM_KIND_LABEL[room.kind].toUpperCase()} – ${room.name.toUpperCase()}`,
            });
            for (const c of cs) pts.push(c[0], c[1]);
          }
        }
        else if (o.kind === "link") linkEnds.set(o.id, [...(linkEnds.get(o.id) ?? []), at]);
      }
      if (
        !s.children.some((c) => c.walkway?.direction === "forward") &&
        !connectors.has(id)
      ) {
        ends.push({ id, x: ex, z: ez, name: s.walkway?.end_label ?? DEFAULT_ENDPOINT_NAME });
      }
      s.children.forEach((c) => walk(c, id));
    };
    segments.filter((s) => s.depth === 0).forEach((s) => walk(s, null));
    const linkLines = [...linkEnds.entries()]
      .filter(([, ends2]) => ends2.length === 2)
      .map(([id, [a, b]]) => ({ id, x1: a.x, y1: a.z, x2: b.x, y2: b.z }));
    if (pts.length === 0) pts.push(0, 0, 0, -10);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const zs = pts.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const W = 210;
    const H = 170;
    // GPS SCALE. The map never shrinks to fit the building: metres-per-pixel is
    // set by the ZOOM level only, and the viewport follows the walker. Zooming
    // out reveals more of the maze inside the same fixed panel.
    const sc = MAP_METRE * zoom;
    const px = (x: number) => (x - minX) * sc;
    // The entrance sits at the BOTTOM of the plan and travel reads upward, like
    // a floor plan on a wall. The map never rotates with the walker.
    const py = (z: number) => (z - minZ) * sc;

    return {
      W,
      H,
      px,
      py,
      lines,
      linkLines,
      doorDots,
      roomShapes,
      ends,
      parentOf,
      /** drawing extent in map pixels, used to pin the plan to the box edges */
      spanW: (maxX - minX) * sc,
      spanH: (maxZ - minZ) * sc,
    };
  }, [segments, layouts, connectors, rooms, zoom]);

  // ── live player position: eased toward the walker's real coordinates ──
  const marker = useRef({ x: 0, y: 0, dx: 0, dy: -1, ready: false });
  const st = m.current;
  const target: [number, number] = st
    ? [st.seg.start[0] + st.seg.heading[0] * st.dist, st.seg.start[1] + st.seg.heading[1] * st.dist]
    : [0, 0];
  const tx = svg.px(target[0]);
  const ty = svg.py(target[1]);
  const face = st ? forwardFromYaw(st.yaw) : ([0, -1] as [number, number]);
  // Changing zoom changes map-space coordinates, so snap instead of gliding.
  const lastZoom = useRef(zoom);
  if (lastZoom.current !== zoom) {
    lastZoom.current = zoom;
    marker.current.ready = false;
  }
  {
    const k = marker.current.ready ? 0.18 : 1;
    marker.current.x += (tx - marker.current.x) * k;
    marker.current.y += (ty - marker.current.y) * k;
    marker.current.dx += (face[0] - marker.current.dx) * (marker.current.ready ? 0.2 : 1);
    marker.current.dy += (face[1] - marker.current.dy) * (marker.current.ready ? 0.2 : 1);
    marker.current.ready = true;
  }
  if (!show) return null;

  // The endpoint is a terminal node: reached only when the walker is at the end
  // of a hallway that does not continue forward.
  const atEnd = ended && !(st?.seg.children ?? []).some((c) => c.walkway?.direction === "forward");
  const currentId = st?.seg.walkway?.id ?? "root";
  const reachedId = atEnd ? currentId : null;
  const reachedName = reachedId ? (svg.ends.find((e) => e.id === reachedId)?.name ?? null) : null;

  // Active route = the hallways actually walked (loops included). Falls back to
  // the parent chain before the first hand-off is recorded.
  const route = new Set<string>(routeIds);
  route.add(currentId);
  if (routeIds.length === 0) {
    for (let id: string | null | undefined = currentId; id; id = svg.parentOf.get(id) ?? null) route.add(id);
  }

  const ax = marker.current.x;
  const ay = marker.current.y;
  const hx = marker.current.dx;
  const hy = marker.current.dy;
  const len = Math.hypot(hx, hy) || 1;
  const ux = hx / len;
  // Map-space y uses the SAME mapping as the hallway lines (py grows with z), so
  // the facing chevron must not invert it — inverting made the arrow point back
  // down the plan while the walker travelled up it.
  const uy = hy / len;
  // GPS-style follow, PINNED TO THE BOX. The plan reads south → north from the
  // BOTTOM edge of the panel: the window follows the walker, but never scrolls
  // past the building's own extent, so no empty space appears below the
  // entrance (or beyond the outer walls) at any zoom level.
  const PAD = 12;
  const clampAxis = (follow: number, span: number, size: number) => {
    const lo = size - PAD - span; // drawing's far edge pinned to the panel end
    const hi = PAD; // drawing's near edge pinned to the panel start
    if (span + PAD * 2 >= size) return Math.min(hi, Math.max(lo, follow));
    return (size - span) / 2;
  };
  const viewX =
    svg.spanW + PAD * 2 >= svg.W
      ? clampAxis(svg.W / 2 - ax, svg.spanW, svg.W)
      : (svg.W - svg.spanW) / 2;
  // Vertical: when the whole building fits, pin its START to the bottom edge.
  const viewY =
    svg.spanH + PAD * 2 >= svg.H
      ? clampAxis(svg.H / 2 - ay, svg.spanH, svg.H)
      : svg.H - PAD - svg.spanH;
  const cx0 = ax + viewX;
  const cy0 = ay + viewY;
  const chevron = `${cx0 + ux * 8},${cy0 + uy * 8} ${cx0 - ux * 5 - uy * 5},${cy0 - uy * 5 + ux * 5} ${cx0 - ux * 2},${cy0 - uy * 2} ${cx0 - ux * 5 + uy * 5},${cy0 - uy * 5 - ux * 5}`;
  const zoomBy = (k: number) =>
    setZoom((z) => Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, z * k)));

  return (
    <div className="pointer-events-none absolute right-6 top-20 z-10 select-none">
      {/* ONE fixed panel size. Coverage changes with zoom, never the container. */}
      <div
        className="rounded-2xl border border-sky-400/25 bg-[#070d1b]/90 p-2 shadow-[0_10px_40px_rgba(2,8,23,0.65)] backdrop-blur"
        style={{ width: svg.W + 16 }}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">
            Building map
          </span>
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(1 / MAP_ZOOM_STEP)}
              disabled={zoom <= MAP_ZOOM_MIN + 1e-6}
              className="h-5 w-5 rounded-md text-[11px] font-bold leading-none text-sky-200 ring-1 ring-sky-400/40 transition hover:bg-sky-400/20 disabled:opacity-30"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(MAP_ZOOM_STEP)}
              disabled={zoom >= MAP_ZOOM_MAX - 1e-6}
              className="h-5 w-5 rounded-md text-[11px] font-bold leading-none text-sky-200 ring-1 ring-sky-400/40 transition hover:bg-sky-400/20 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
        <svg
          width={svg.W}
          height={svg.H}
          viewBox={`0 0 ${svg.W} ${svg.H}`}
          className="rounded-xl bg-gradient-to-b from-[#0b1428] to-[#060b17]"
        >
          <defs>
            <filter id="mapGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(${viewX} ${viewY})`}>
          {/* hallways: dark blue elsewhere, medium blue on the active route,
              bright blue for the hallway the student is standing in */}
          {svg.lines.map((l) => {
            const here = l.id === currentId;
            const onRoute = route.has(l.id);
            // Labels sit clear of the road: alongside a vertical hallway, and
            // beneath a perpendicular branch, so a new branch never collides
            // with its parent's name.
            const horizontal =
              Math.abs(svg.px(l.x2) - svg.px(l.x1)) > Math.abs(svg.py(l.y2) - svg.py(l.y1));
            const labelX = (svg.px(l.x1) + svg.px(l.x2)) / 2;
            const labelY = (svg.py(l.y1) + svg.py(l.y2)) / 2 + (horizontal ? 14 : -7);
            return (
              <g key={l.id}>
                {here && (
                  <line
                    x1={svg.px(l.x1)}
                    y1={svg.py(l.y1)}
                    x2={svg.px(l.x2)}
                    y2={svg.py(l.y2)}
                    stroke="#38bdf8"
                    strokeWidth={13}
                    strokeLinecap="round"
                    opacity={0.22}
                  />
                )}
                <line
                  x1={svg.px(l.x1)}
                  y1={svg.py(l.y1)}
                  x2={svg.px(l.x2)}
                  y2={svg.py(l.y2)}
                  stroke={here ? "#38bdf8" : onRoute ? "#3b82f6" : "#38598f"}
                  strokeWidth={here ? 7.5 : 6.5}
                  strokeLinecap="round"
                />
                {/* Every hallway is labelled — the map is the blueprint, so a new
                    branch must be readable the moment it is created. */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill={here ? "#bae6fd" : onRoute ? "#93c5fd" : "#7f9cc9"}
                >
                  {l.name}
                </text>
              </g>
            );
          })}
          {/* connections — hallway-to-hallway links that close the maze */}
          {svg.linkLines.map((l) => (
            <line
              key={l.id}
              x1={svg.px(l.x1)}
              y1={svg.py(l.y1)}
              x2={svg.px(l.x2)}
              y2={svg.py(l.y2)}
              stroke="#67e8f9"
              strokeWidth={1.6}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          ))}
          {/* rooms — each drawn as one unit with its own door */}
          {svg.roomShapes.map((r) => (
            <g key={`room-${r.id}`}>
              <polygon
                points={r.points
                  .split(" ")
                  .map((pt) => {
                    const [x, z] = pt.split(",").map(Number);
                    return `${svg.px(x)},${svg.py(z)}`;
                  })
                  .join(" ")}
                fill="#0ea5e9"
                fillOpacity={0.14}
                stroke="#7dd3fc"
                strokeWidth={1.2}
              />
              <polyline
                points={r.front
                  .split(" ")
                  .map((pt) => {
                    const [x, z] = pt.split(",").map(Number);
                    return `${svg.px(x)},${svg.py(z)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#fcd34d"
                strokeWidth={2}
              />
              <text
                x={svg.px(r.labelX)}
                y={svg.py(r.labelZ)}
                textAnchor="middle"
                fontSize={6}
                fill="#bae6fd"
              >
                {r.label}
              </text>
            </g>
          ))}
          {/* doors — destinations along the hallway walls */}
          {svg.doorDots.map((d, i) => (
            <rect
              key={i}
              x={svg.px(d.x) - 3}
              y={svg.py(d.z) - 3}
              width={6}
              height={6}
              rx={1.5}
              fill="#e0f2fe"
              stroke="#0ea5e9"
              strokeWidth={1}
            />
          ))}
          {/* end walls — where a route terminates */}
          {svg.ends.map((e) => {
            const here = reachedId === e.id;
            return (
              <g key={`end-${e.id}`}>
                <circle
                  cx={svg.px(e.x)}
                  cy={svg.py(e.z)}
                  r={here ? 5 : 3.5}
                  fill={here ? "#38bdf8" : "#0b1428"}
                  stroke="#38bdf8"
                  strokeWidth={1.4}
                />
                {here && (
                  <text
                    x={svg.px(e.x)}
                    y={svg.py(e.z) - 9}
                    textAnchor="middle"
                    fontSize={7}
                    fill="#bae6fd"
                  >
                    {e.name}
                  </text>
                )}
              </g>
            );
          })}
          </g>
          {/* the student: a glowing blue directional marker that moves live */}
          <circle cx={cx0} cy={cy0} r={7} fill="#38bdf8" opacity={0.18} filter="url(#mapGlow)">
            <animate attributeName="r" values="6;10;6" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <polygon points={chevron} fill="#7dd3fc" stroke="#0b1428" strokeWidth={0.8} filter="url(#mapGlow)" />
        </svg>
        {reachedName && (
          <span className="mt-1 block text-center text-[10px] font-semibold text-sky-300">
            {reachedName}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Scene ─────────────────────────────────────────────────────────────────

export interface HallwaySceneProps {
  /** Legacy academy rooms. The building is hallways + doors, so this is optional. */
  rooms?: AcademyRoom[];
  building: BuildingData | null;
  catalogue: AcademyProduct[];
  textures?: Record<string, string>;
  /** Live section counts per room id (from the database). */
  roomCounts?: Record<string, string>;
  focus: number;
  onFocusChange: (index: number) => void;
  /**
   * A door has no navigation of its own: it can only open the room attached to
   * it, resolved inside this scene. There are deliberately no `onEnterRoom` /
   * `onOpenDoor` escape hatches, so a door can never be re-pointed at a page,
   * a course, an adventure or another room.
   */

  onModeChange?: (mode: "browse" | "walk") => void;
  /** Walk to this hallway id (used by the editor after creating one). */
  navigateTo?: string | null;
  /**
   * Leave the building entirely — used by the ENTRANCE DOOR at the start of the
   * main hallway. Falls back to the in-scene browse view when not supplied.
   */
  onExitBuilding?: () => void;
  /** True in the building editor: unlocks Edit Mode surfaces such as the smart
   *  screen's content panel. View mode users only ever watch. */
  editing?: boolean;
}

const HallwayScene = ({
  rooms = [],
  building,
  catalogue,
  textures = {},
  roomCounts = {},
  focus,
  onFocusChange,
  onModeChange,
  onExitBuilding,
  navigateTo = null,
  editing = false,
}: HallwaySceneProps) => {
  const [eventSource, setEventSource] = useState<HTMLDivElement | null>(null);
  // Saved configuration is the source of truth: merge it field-by-field over
  // the defaults so a partial/legacy record never loses its custom materials.
  const env = useMemo(
    () => mergeEnvironment(building?.building.environment ?? null),
    [building],
  );
  const lights = useMemo(() => lightBudget(env.lighting), [env.lighting]);
  const walkways = building?.walkways ?? [];
  const doors = building?.doors ?? [];
  /** Hallway-to-hallway connections, so the building can loop back on itself. */
  const links = building?.links ?? [];

  const productTitles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of catalogue) out[`${p.kind}:${p.id}`] = p.title;
    return out;
  }, [catalogue]);

  const doorsByWalkway = useMemo(() => {
    const map = new Map<string, BuildingDoor[]>();
    for (const d of doors) {
      const arr = map.get(d.walkway_id) ?? [];
      arr.push(d);
      map.set(d.walkway_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position_along - b.position_along);
    return map;
  }, [doors]);

  // The root corridor only has to be long enough for the doors that actually
  // sit ON it — counting every door in the building stretched it out of scale
  // and squashed the rest of the maze on the map.
  const rootWalkwayId = walkways.find((w) => !w.parent_id)?.id ?? null;
  const rootLen = Math.max(
    walkways.find((w) => !w.parent_id)?.length ?? 12,
    (rootWalkwayId ? (doorsByWalkway.get(rootWalkwayId)?.length ?? 0) : doors.length) * SPACING + 12,
  );


  const { segments, layouts, connectors, mouths } = useMemo(
    () =>
      buildHallways(
        walkways,
        (walkwayId) =>
          (doorsByWalkway.get(walkwayId) ?? []).map((d) => ({
            id: d.id,
            name: doorTitle(d, productTitles),
            order: 5 + d.position_along * 100,
          })),
        [],
        rootLen,
        links,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walkways, doorsByWalkway, productTitles, rootLen, links],
  );

  // NO DECK PADDING AT ALL. Corridors never cross — a road that reaches another
  // one merges into it — and every hallway's floor and ceiling now stop exactly
  // at its own ends. A junction throat is floored and ceiled by the junction
  // piece itself, so no two slabs share a height and nothing can flicker.




  const rootSeg: Segment = useMemo(
    () =>
      segments.find((s) => s.depth === 0) ?? {
        walkway: null,
        start: [0, 0] as [number, number],
        heading: [0, -1] as [number, number],
        length: rootLen,
        depth: 0,
        children: [],
      },
    [segments, rootLen],
  );
  const rootEffective = rootSeg;

  const [phase, setPhase] = useState<NavPhase>("browse");
  const [nav, setNav] = useState<NavState>({ seg: rootEffective, mode: "browse" });
  const [moving, setMoving] = useState(false);
  /** The classroom the walker is standing in, with where its shell sits. */
  const [insideRoom, setInsideRoom] = useState<
    {
      room: BuildingClassroom;
      door: [number, number];
      into: [number, number];
      /** Look of the door walked through, so its inside face matches. */
      doorVisual?: RoomDoorVisual | null;
    } | null
  >(null);

  // Every room has a built-in smart screen; this drives the one you stand in.
  const roomScreen = useRoomScreen({
    buildingId: building?.building.id ?? null,
    classroomId: insideRoom?.room.id ?? null,
    canEdit: (building?.canEdit ?? false) && editing,
  });
  /** The smart screen's own panel — opened by clicking the screen itself. */
  const [screenPanelOpen, setScreenPanelOpen] = useState(false);
  /**
   * Room navigation is a separate control system from the lesson video: it
   * fades out after 10 seconds of stillness so it never covers the picture,
   * and returns on any touch, click or key.
   */
  const roomHud = useAutoHide(10000);
  const pingRoomHud = roomHud.ping;
  useEffect(() => {
    if (!insideRoom) return;
    const wake = () => pingRoomHud();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("wheel", wake);
    wake();
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("wheel", wake);
    };
  }, [insideRoom, pingRoomHud]);
  // A viewer entering a room that already has a lesson video gets the player
  // straight away — the video is already playing, so the controls must be there.
  const viewerVideo = !editing && roomScreen.mode === "video";
  useEffect(() => {
    if (insideRoom && viewerVideo) setScreenPanelOpen(true);
  }, [insideRoom, viewerVideo]);

  const [facing, setFacing] = useState<1 | -1>(1);
  const [endReached, setEndReached] = useState(false);
  /** Everything enterable ahead of the walker, nearest first. */
  const [candidates, setCandidates] = useState<JunctionAction[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<string[]>(["Entrance"]);
  /** Hallways the walker has actually travelled, for the map's route highlight. */
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [cue, setCue] = useState<string | null>(null);
  const [showMap] = useState(true);
  const machineRef = useRef<Machine>({
    phase: "browse",
    seg: rootEffective,
    dist: 0,
    moving: false,
    hold: 0,
    dir: 1,
    speed: 0,

    stops: [],

    yaw: 0,
    turn: null,
    zoom: null,
    keypad: null,

    inside: null,
  });
  const historyRef = useRef(new NavigationHistory());
  const cueTimer = useRef<number | null>(null);

  /** Junction stops of one hallway, from the shared object layout. */
  const stopsOf = useCallback(
    (seg: Segment): number[] =>
      (layouts.get(seg.walkway?.id ?? "") ?? [])
        .filter((o) => o.kind !== "door")
        .map((o) => o.along)
        .sort((a, b) => a - b),
    [layouts],
  );


  const setMachinePhase = useCallback((p: NavPhase) => {
    machineRef.current.phase = p;
    setPhase(p);
  }, []);

  const showCue = useCallback((msg: string) => {
    setCue(msg);
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => setCue(null), 1600);
  }, []);
  useEffect(() => () => {
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
  }, []);

  // Keep the machine's segment aligned with a rebuilt graph (editor adds a
  // walkway while the world is open and the live refresh reloads the building).
  useEffect(() => {
    if (machineRef.current.phase === "browse") {
      machineRef.current.seg = rootEffective;
    }
  }, [rootEffective]);

  // Junction stops of the hallway currently being walked.
  useEffect(() => {
    machineRef.current.stops = stopsOf(machineRef.current.seg);
  }, [nav.seg, stopsOf]);

  // WHAT IS AHEAD OF ME? Resolved every frame from the connected graph and the
  // direction of travel, so previously visited junctions stay enterable.
  useEffect(() => {
    if (phase === "browse") {
      setCandidates((prev) => (prev.length ? [] : prev));
      return;
    }
    let raf = 0;
    const loop = () => {
      const st = machineRef.current;
      const seg = st.seg;
      const id = seg.walkway?.id ?? "";
      const fwdChild = seg.children.find((c) => c.walkway?.direction === "forward");
      const connector = id ? connectors.get(id) : undefined;
      const connectorTarget = connector ? findSegment(segments, connector.targetWalkwayId) : null;
      const parentSeg = seg.walkway?.parent_id
        ? findSegment(segments, seg.walkway.parent_id)
        : null;
      const forward = fwdChild?.walkway
        ? { id: fwdChild.walkway.id, name: fwdChild.walkway.name || "the next hallway" }
        : connectorTarget?.walkway
          ? { id: connectorTarget.walkway.id, name: connectorTarget.walkway.name || "the next hallway" }
          : null;
      const parent = parentSeg?.walkway
        ? { id: parentSeg.walkway.id, name: parentSeg.walkway.name || "the main hallway" }
        : null;
      const found = resolveJunctionCandidates({
        objects: layouts.get(id) ?? [],
        length: seg.length,
        dist: st.dist,
        dir: st.dir,
        forward,
        parent,
        range: ENTER_RANGE,
      }).map((c) => ({
        ...c,
        targetWalkwayId:
          c.kind === "link"
            ? (layouts.get(id) ?? []).find((o) => o.id === c.targetId)?.targetWalkwayId
            : undefined,
      })) as JunctionAction[];
      setCandidates((prev) =>
        prev.map((p) => p.key).join("|") === found.map((p) => p.key).join("|") ? prev : found,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, layouts, connectors, segments, nav.seg]);





  const notifyMode = useCallback((m: "browse" | "walk") => onModeChange?.(m), [onModeChange]);

  const syncBreadcrumb = useCallback(() => {
    const path = historyRef.current.path;
    const labels: string[] = [];
    for (const id of path) {
      const seg = findSegment(segments, id);
      labels.push(
        seg?.walkway?.name ||
          (seg?.walkway?.direction ? DIRECTION_LABEL[seg.walkway.direction] : "Hallway"),
      );
    }
    setBreadcrumb(labels.length ? labels : ["Entrance"]);
    // The map highlights the route actually walked, so a loop reads correctly
    // instead of following the parent chain.
    setRouteIds([...path]);
  }, [segments]);

  const backToBrowse = useCallback(() => {
    const st = machineRef.current;
    st.phase = "browse";
    st.seg = rootEffective;
    st.dist = 0;
    st.moving = false;
    st.hold = 0;
    st.dir = 1;
    setFacing(1);
    st.speed = 0;
    st.yaw = 0;
    st.turn = null;
    st.zoom = null;
    historyRef.current.clear();
    setMoving(false);
    setEndReached(false);
    setNav({ seg: rootEffective, mode: "browse" });
    setPhase("browse");
    notifyMode("browse");
    syncBreadcrumb();
  }, [rootEffective, notifyMode, syncBreadcrumb]);

  /**
   * ENTRANCE / EXIT. Clicking the entrance door at the start of the main
   * hallway leaves the building, exactly like the Building button in the top
   * bar. Without a handler it simply returns to the browse view.
   */
  const exitBuilding = useCallback(() => {
    machineRef.current.hold = 0;
    machineRef.current.moving = false;
    setMoving(false);
    if (onExitBuilding) onExitBuilding();
    else backToBrowse();
  }, [backToBrowse, onExitBuilding]);

  /**
   * Press-and-hold to walk. `sign` is the user's intent: 1 = Forward,
   * -1 = Backward. Backward performs a real about-face first (the camera turns
   * 180° in place) and then keeps walking that way for as long as it is held.
   * Nothing ever moves without a held control.
   */
  /**
   * The walk controls are ALWAYS live. Standing in the entrance lobby counts as
   * being in the building, so the first press simply starts walking instead of
   * being ignored — no button ever appears inert.
   */
  const ensureWalking = useCallback(() => {
    const st = machineRef.current;
    if (st.phase !== "browse") return st.phase !== "zooming";
    const seg = st.seg ?? rootEffective;
    st.seg = seg;
    st.dist = 0;
    st.dir = 1;
    st.speed = 0;
    st.turn = null;
    st.yaw = segYaw(seg.heading);
    setFacing(1);
    historyRef.current.clear();
    historyRef.current.push(seg.walkway?.id ?? "entrance");
    setEndReached(false);
    setNav({ seg, mode: "walk" });
    setMachinePhase("walking");
    notifyMode("walk");
    syncBreadcrumb();
    return true;
  }, [rootEffective, setMachinePhase, notifyMode, syncBreadcrumb]);

  const startHold = useCallback(
    (sign: 1 | -1) => {
      const st = machineRef.current;
      // Standing at a keypad is a stance, not a lock on the controls: choosing
      // to walk simply steps away from the panel and carries on.
      if (st.phase === "keypad") {
        const back = st.keypad?.restorePhase ?? "idle";
        st.keypad = null;
        setMachinePhase(back === "keypad" || back === "zooming" ? "idle" : back);
      }
      if (!ensureWalking()) return;
      if (st.phase !== "walking" && st.phase !== "idle" && st.phase !== "turning") return;

      st.hold = sign;
      st.moving = true;
      setMoving(true);
      setEndReached(false);
      // Key-repeat and a second pointer event must never cancel an in-progress
      // turn. The held intent is retained and applied when the turn completes.
      if (st.phase === "turning") return;
      if (st.dir !== sign) {
        // About-face: turn on the spot, then carry on in the new direction.
        const seg = st.seg;
        const pos: [number, number] = [
          seg.start[0] + seg.heading[0] * st.dist,
          seg.start[1] + seg.heading[1] * st.dist,
        ];
        st.speed = 0;
        st.turn = {
          pivot: pos,
          fromYaw: st.yaw,
          toYaw: st.yaw + Math.PI,
          radius: 0.05,
          duration: 0.45,
          elapsed: 0,
          onDone: () => {
            const s2 = machineRef.current;
            s2.dir = sign;
            setFacing(sign);
            s2.phase = "walking";
            setMachinePhase("walking");
          },
        };
        setMachinePhase("turning");
        return;
      }
      setMachinePhase("walking");
    },
    [ensureWalking, setMachinePhase],
  );

  const endHold = useCallback(() => {
    const st = machineRef.current;
    st.hold = 0;
    st.moving = false;
    setMoving(false);
  }, []);

  const pointerIntent = useRef(false);
  const heldMoveKeys = useRef(new Set<1 | -1>());
  const startPointerHold = useCallback(() => {
    pointerIntent.current = true;
    startHold(machineRef.current.dir);
  }, [startHold]);
  const endPointerHold = useCallback(() => {
    pointerIntent.current = false;
    if (heldMoveKeys.current.has(1)) startHold(machineRef.current.dir);
    else endHold();
  }, [endHold, startHold]);

  const enterWalk = useCallback(
    (seg: Segment) => {
      const st = machineRef.current;
      st.seg = seg;
      st.dist = 0;
      st.moving = false;
      st.hold = 0;
      st.dir = 1;
      setFacing(1);
      st.speed = 0;
      st.yaw = segYaw(seg.heading);
      historyRef.current.clear();
      historyRef.current.push(seg.walkway?.id ?? "entrance");
      setMoving(false);
      setEndReached(false);
      setNav({ seg, mode: "walk" });
      setMachinePhase("walking");
      notifyMode("walk");
      syncBreadcrumb();
    },
    [setMachinePhase, notifyMode, syncBreadcrumb],
  );


  /**
   * Enter a connected hallway. Forward continuations simply carry on. A side
   * hallway is entered from where the walker actually stands: its distance is
   * seeded at the junction throat (`branchTrim`), so the camera glides through
   * the opening instead of teleporting to the branch's start point.
   */
  const pickBranch = useCallback(
    (child: Segment) => {
      const st = machineRef.current;
      if (st.phase === "turning" || st.phase === "zooming") return;

      const resume = (startDist: number) => {
        st.seg = child;
        st.dist = THREE.MathUtils.clamp(startDist, 0, child.length);
        st.yaw = segYaw(child.heading);
        historyRef.current.push(child.walkway?.id ?? child.heading.join(","));
        setNav({ seg: child, mode: "walk" });
        setEndReached(false);
        setMachinePhase("walking");
        syncBreadcrumb();
      };

      if (child.walkway?.direction === "forward") {
        if (st.dist < st.seg.length - ENTER_RANGE) {
          showCue("Keep walking to the end of the hallway");
          return;
        }
        resume(0);
        return;
      }

      // Turn at the opening before changing road. Keeping the pivot fixed avoids
      // cutting through the corner wall, while held movement resumes afterward.
      const pos: [number, number] = [
        st.seg.start[0] + st.seg.heading[0] * st.dist,
        st.seg.start[1] + st.seg.heading[1] * st.dist,
      ];
      st.speed = 0;
      st.turn = {
        pivot: pos,
        fromYaw: st.yaw,
        toYaw: segYaw(child.heading),
        radius: 0.05,
        duration: 0.38,
        elapsed: 0,
        onDone: () => resume(junctionGeometry(HALL_WIDTH).branchTrim),
      };
      setMachinePhase("turning");
    },

    [setMachinePhase, showCue, syncBreadcrumb],
  );

  /**
   * Step through a CONNECTION into a hallway that already exists elsewhere in
   * the building. This is what closes the tree into a maze: the walker arrives
   * inside the target hallway at the connection's own slot, facing along it, so
   * they can keep walking or turn around and come back.
   */
  const crossLink = useCallback(
    (linkId: string, targetWalkwayId: string) => {
      const st = machineRef.current;
      if (st.phase === "turning" || st.phase === "zooming") return;
      const target = findSegment(segments, targetWalkwayId);
      if (!target) return;
      const mouth = (layouts.get(targetWalkwayId) ?? []).find((o) => o.id === linkId);
      st.seg = target;
      const reverseConnector = connectors.get(targetWalkwayId);
      st.dist = reverseConnector
        ? target.length
        : THREE.MathUtils.clamp(mouth?.along ?? 0, 0, target.length);
      st.dir = reverseConnector ? -1 : 1;
      setFacing(st.dir);
      st.hold = 0;
      st.speed = 0;
      st.yaw = segYaw(reverseConnector ? reverseHeading(target.heading) : target.heading);
      historyRef.current.push(targetWalkwayId);
      setNav({ seg: target, mode: "walk" });
      setEndReached(false);
      setMachinePhase("walking");
      syncBreadcrumb();
    },
    [connectors, layouts, segments, setMachinePhase, syncBreadcrumb],
  );

  /** Paused camera zoom onto a doorway, then navigate. */
  const startDoorZoom = useCallback(
    (world: [number, number], front: [number, number], onDone: () => void) => {
      const st = machineRef.current;
      // A DOOR CLICK IS NEVER DROPPED. Whatever the walker is doing — finishing
      // a turn, mid-zoom, or standing at a keypad — that motion ends here and
      // the door takes over from wherever the camera is right now.
      let restore: NavPhase = st.phase;
      if (st.phase === "turning") {
        if (st.turn) st.yaw = st.turn.toYaw;
        st.turn = null;
        restore = "idle";
      } else if (st.phase === "zooming") {
        restore = st.zoom?.restorePhase ?? "idle";
      } else if (st.phase === "keypad") {
        restore = st.keypad?.restorePhase ?? "idle";
        st.keypad = null;
      }
      if (restore === "turning" || restore === "zooming" || restore === "keypad") restore = "idle";
      st.hold = 0;
      st.speed = 0;
      st.moving = false;
      setMoving(false);
      st.zoom = {
        from: [0, 0, 0],
        to: [world[0] + front[0] * 2.2, 1.7, world[1] + front[1] * 2.2],
        look: [world[0], 1.6, world[1]],
        duration: 0.8,
        elapsed: 0,
        started: false,
        restorePhase: restore,
        onDone: () => {
          const st2 = machineRef.current;
          setMachinePhase(st2.phase === "zooming" ? restore : st2.phase);
          onDone();
        },
      };
      setMachinePhase("zooming");
    },
    [setMachinePhase],
  );

  /**
   * LOCK FOCUS. Clicking a locked door does not open it: the camera walks up to
   * the keypad beside it, stops at a comfortable reading distance and faces the
   * panel, so the code can be typed. Nothing is entered and nothing moves on.
   */
  const focusLockPanel = useCallback(
    (world: [number, number], front: [number, number], lateral: [number, number]) => {
      // The panel sits just to one side of the leaf, on the same wall plane. The
      // side is the door's own, passed in from the doorway, so the camera always
      // ends up in front of the keypad and never nose-to-nose with the leaf.
      const panel: [number, number] = [
        world[0] + lateral[0] * 1.5,
        world[1] + lateral[1] * 1.5,
      ];

      const st = machineRef.current;
      // Never refused: a turn or zoom in progress ends here so the keypad wins.
      let restore: NavPhase = st.phase;
      if (st.phase === "turning") {
        if (st.turn) st.yaw = st.turn.toYaw;
        st.turn = null;
        restore = "idle";
      } else if (st.phase === "zooming") {
        restore = st.zoom?.restorePhase ?? "idle";
      } else if (st.phase === "keypad") {
        restore = st.keypad?.restorePhase ?? "idle";
      }
      if (restore === "turning" || restore === "zooming" || restore === "keypad") restore = "idle";
      const stance: KeypadStance = {
        to: [panel[0] + front[0] * 2.1, 1.42, panel[1] + front[1] * 2.1],
        look: [panel[0], 1.32, panel[1]],
        restorePhase: restore,
      };
      st.hold = 0;
      st.speed = 0;
      st.moving = false;
      setMoving(false);
      st.zoom = {
        from: [0, 0, 0],
        to: stance.to,
        look: stance.look,
        duration: 0.7,
        elapsed: 0,
        started: false,
        restorePhase: restore,
        onDone: () => {
          // The walk does NOT resume: the walker now stands at the panel and
          // stays there until the door opens or they move away themselves.
          const st2 = machineRef.current;
          st2.keypad = stance;
          setMachinePhase("keypad");
        },

      };
      setMachinePhase("zooming");
    },
    [setMachinePhase],
  );

  /**
   * LEAVE THE KEYPAD. Once the door is open — or the walker chooses to move —
   * the hallway walk resumes from exactly the spot they are standing on.
   */
  const releaseKeypad = useCallback(() => {
    const st = machineRef.current;
    if (st.phase !== "keypad") return;
    const back = st.keypad?.restorePhase ?? "idle";
    st.keypad = null;
    setMachinePhase(back === "keypad" || back === "zooming" ? "idle" : back);
  }, [setMachinePhase]);




  /**
   * ENTER A ROOM. The shell is a real space beyond its door, so entering it
   * is camera navigation inside the same scene — never a page swap. The hallway
   * position is preserved, so leaving resumes the walk exactly where it stopped.
   * Inside, the camera becomes a free walker in the room's own local space.
   */
  const enterClassroom = useCallback(
    (
      doorWorld: [number, number],
      into: [number, number],
      room: BuildingClassroom,
      doorVisual?: RoomDoorVisual | null,
    ) => {

      const st = machineRef.current;
      const dims = classroomDimensions(room.kind);
      st.inside = {
        door: doorWorld,
        heading: into,
        kind: room.kind,
        x: 0,
        z: Math.min(3, dims.length * 0.28),
        yaw: 0,
        hold: 0,
        strafe: 0,
        turning: 0,
        speed: 0,
        strafeSpeed: 0,
      };
      st.moving = false;
      setMoving(false);
      setInsideRoom({ room, door: doorWorld, into, doorVisual: doorVisual ?? null });
      setMachinePhase("inside");
    },
    [setMachinePhase],
  );

  const leaveClassroom = useCallback(() => {
    const st = machineRef.current;
    st.inside = null;
    setInsideRoom(null);
    setScreenPanelOpen(false);
    setMachinePhase("idle");
  }, [setMachinePhase]);

  /** Held intent inside a room — walking, turning and side-stepping. */
  const roomWalk = useCallback((v: -1 | 0 | 1) => {
    const w = machineRef.current.inside;
    if (w) w.hold = v;
  }, []);
  const roomTurn = useCallback((v: -1 | 0 | 1) => {
    const w = machineRef.current.inside;
    if (w) w.turning = v;
  }, []);
  const roomStrafe = useCallback((v: -1 | 0 | 1) => {
    const w = machineRef.current.inside;
    if (w) w.strafe = v;
  }, []);



  /**
   * Turn round on the spot. The walker keeps their exact position on the road —
   * only the facing flips — so they can then hold Forward (or ▼) to retrace the
   * way they came, hallway after hallway, with no scripted animation.
   */
  const goBack = useCallback(() => {
    const st = machineRef.current;
    if (st.phase === "turning" || st.phase === "zooming") return;
    if (!ensureWalking()) return;
    if (!st.seg.walkway?.parent_id && st.dist < 1.5 && st.dir === -1) {
      backToBrowse();
      return;
    }
    // Turning around only changes the facing: the walker stands still until
    // MOVE FORWARD is held again.
    st.hold = 0;
    st.moving = false;
    st.speed = 0;
    setMoving(false);
    const seg = st.seg;
    const next: 1 | -1 = st.dir === 1 ? -1 : 1;
    st.turn = {
      pivot: [seg.start[0] + seg.heading[0] * st.dist, seg.start[1] + seg.heading[1] * st.dist],
      fromYaw: st.yaw,
      toYaw: st.yaw + Math.PI,
      radius: 0.05,
      duration: 0.45,
      elapsed: 0,
      onDone: () => {
        const s2 = machineRef.current;
        s2.dir = next;
        setFacing(next);
        s2.phase = "walking";
        setMachinePhase("walking");
        setEndReached(false);
      },
    };
    setMachinePhase("turning");
  }, [backToBrowse, ensureWalking, setMachinePhase]);

  /**
   * Walked off an end of the current hallway. Hallways are CONTINUOUS ROADS: if
   * something connects at that end the walker is handed straight over to it and
   * keeps moving; only a true dead end stops them.
   */
  const handleBoundary = useCallback(
    (sign: 1 | -1): boolean => {
      const st = machineRef.current;
      const seg = st.seg;
      if (sign === 1) {
        const fwd = seg.children.find((c) => c.walkway?.direction === "forward");
        if (fwd) {
          st.seg = fwd;
          st.dist = 0;
          st.dir = 1;
          historyRef.current.push(fwd.walkway?.id ?? "");
          setNav({ seg: fwd, mode: "walk" });
          syncBreadcrumb();
          return true;
        }
        // A connector corridor ends AT the hallway it connects to: step into it.
        const info = seg.walkway ? connectors.get(seg.walkway.id) : undefined;
        const target = info ? findSegment(segments, info.targetWalkwayId) : null;
        if (info && target) {
          st.seg = target;
          st.dist = THREE.MathUtils.clamp(info.alongTarget, 0, target.length);
          st.dir = 1;
          historyRef.current.push(target.walkway?.id ?? "");
          setNav({ seg: target, mode: "walk" });
          syncBreadcrumb();
          return true;
        }
        return false;
      }
      // Walking back out of a hallway returns to the parent road at the exact
      // junction it left from, still facing the way the walker is travelling.
      const parent = seg.walkway?.parent_id ? findSegment(segments, seg.walkway.parent_id) : null;
      if (!parent) {
        if (seg === rootEffective || seg.walkway?.id === rootEffective.walkway?.id) {
          backToBrowse();
          return true;
        }
        return false;
      }
      const junction = (layouts.get(parent.walkway?.id ?? "") ?? []).find(
        (o) => o.kind === "opening" && o.id === seg.walkway?.id,
      );
      if (!junction) return false;
      st.seg = parent;
      st.dist = THREE.MathUtils.clamp(junction.along, 0, parent.length);
      // Preserve reverse travel across the handoff. Resetting this to +1 made a
      // held Back control immediately send the walker forwards again.
      st.dir = -1;
      setFacing(-1);
      st.yaw = segYaw(reverseHeading(parent.heading));
      historyRef.current.pop();
      setNav({ seg: parent, mode: "walk" });
      syncBreadcrumb();
      return true;
    },
    [backToBrowse, connectors, layouts, rootEffective, segments, syncBreadcrumb],
  );

  /**
   * The LEFT button's junction action. A junction is entered because it is
   * connected to this hallway and lies ahead — never because it has not been
   * visited, so the same junction can be entered again and again.
   */
  const runJunctionAction = useCallback(
    (a: JunctionAction) => {
      const st = machineRef.current;
      if (st.phase === "turning" || st.phase === "zooming") return;
      if (a.kind === "branch") {
        const child = st.seg.children.find((c) => c.walkway?.id === a.targetId);
        if (child) pickBranch(child);
        return;
      }
      if (a.kind === "link") {
        if (a.targetWalkwayId) crossLink(a.targetId, a.targetWalkwayId);
        return;
      }
      // A collinear continuation (forward road / connector arrival) or the
      // junction this hallway left from: walk on through the handoff.
      const sign: 1 | -1 = a.kind === "forward" ? 1 : -1;
      if (st.dir !== sign) {
        st.dir = sign;
        setFacing(sign);
        st.yaw = segYaw(sign === 1 ? st.seg.heading : reverseHeading(st.seg.heading));
      }
      st.dist = sign === 1 ? st.seg.length : 0;
      if (!handleBoundary(sign)) return;
      setEndReached(false);
      setMachinePhase("walking");
    },
    [crossLink, handleBoundary, pickBranch, setMachinePhase],
  );

  /** Reached the terminal wall of a hallway → stop and offer the next direction. */
  const handleWalkEnd = useCallback(() => {
    const st = machineRef.current;
    if (st.phase !== "walking") return;
    setEndReached(true);
    st.hold = 0;
    st.moving = false;
    st.speed = 0;
    setMoving(false);
    setMachinePhase("idle");
  }, [setMachinePhase]);

  /**
   * Standing alongside a mid-hallway junction. The walk is NOT interrupted —
   * this only makes the left/right turn buttons available while passing.
   */
  const handleJunctionReach = useCallback(() => {}, []);





  /**
   * The building is hallways + doors, so there is no room carousel to browse:
   * entering the building starts the walk immediately and keeps moving forward.
   */
  useEffect(() => {
    if (rooms.length > 0) return;
    if (machineRef.current.phase !== "browse") return;
    if (!rootEffective.walkway) return;
    enterWalk(rootEffective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.length, rootEffective, enterWalk, setMachinePhase]);

  /** The editor asks the walker to walk the freshly created hallway. */
  useEffect(() => {
    if (!navigateTo) return;
    const seg = findSegment(segments, navigateTo);
    if (!seg) return;
    enterWalk(seg);
    setEndReached(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateTo, segments]);



  // Keyboard: arrows + WASD, routed through the graph (no free-fly).
  useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
      const st = machineRef.current;
      const key = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) e.preventDefault();
      // INSIDE A ROOM the keys drive the free room walker, not the corridor.
      if (st.phase === "inside" && st.inside) {
        const w = st.inside;
        if (key === "ArrowUp" || key === "w" || key === "W") w.hold = 1;
        else if (key === "ArrowDown" || key === "s" || key === "S") w.hold = -1;
        else if (key === "ArrowLeft" || key === "a" || key === "A") w.turning = -1;
        else if (key === "ArrowRight" || key === "d" || key === "D") w.turning = 1;
        else if (key === "q" || key === "Q") w.strafe = -1;
        else if (key === "e" || key === "E") w.strafe = 1;
        return;
      }

      if (key === "ArrowUp" || key === "w" || key === "W") {
        if (e.repeat) return;
        heldMoveKeys.current.add(1);
        if (st.phase === "browse") {
          if (focus < rooms.length - 1) onFocusChange(focus + 1);
          else enterWalk(rootEffective);
        } else if (st.phase === "walking" || st.phase === "idle") {
          if (endReached) {
            const fwd = st.seg.children.find((c) => c.walkway?.direction === "forward");
            if (fwd) pickBranch(fwd);
            else if (st.seg.children.length === 0) showCue("End of walkway");
          } else {
            // Held key = held Forward button: movement lasts only while down.
            startHold(st.dir);
          }
        }
        return;
      }

      if (key === "ArrowDown" || key === "s" || key === "S") {
        if (e.repeat) return;
        if (st.phase === "browse") onFocusChange(Math.max(0, focus - 1));
        else if (st.phase === "walking" || st.phase === "idle") goBack();
        return;
      }
      if (key === "ArrowLeft" || key === "a" || key === "A") {
        if (st.phase === "browse") {
          onFocusChange(Math.max(0, focus - 1));
          return;
        }
        if (st.phase !== "walking" && st.phase !== "idle") return;
        const left = candidates.find((c) => c.side === -1);
        if (left) runJunctionAction(left);
        else showCue("No walkway to the left");
        return;
      }
      if (key === "ArrowRight" || key === "d" || key === "D") {
        if (st.phase === "browse") {
          onFocusChange(Math.min(rooms.length - 1, focus + 1));
          return;
        }
        if (st.phase !== "walking" && st.phase !== "idle") return;
        const right = candidates.find((c) => c.side === 1);
        if (right) runJunctionAction(right);
        else showCue("No walkway to the right");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      const w = machineRef.current.inside;
      if (w) {
        if (["ArrowUp", "w", "W", "ArrowDown", "s", "S"].includes(key)) w.hold = 0;
        else if (["ArrowLeft", "a", "A", "ArrowRight", "d", "D"].includes(key)) w.turning = 0;
        else if (["q", "Q", "e", "E"].includes(key)) w.strafe = 0;
        return;
      }
      if (["ArrowUp", "w", "W"].includes(key)) heldMoveKeys.current.delete(1);
      else return;
      if (pointerIntent.current || heldMoveKeys.current.has(1)) startHold(machineRef.current.dir);
      else endHold();
    };
    const onBlur = () => {
      const w = machineRef.current.inside;
      if (w) {
        w.hold = 0;
        w.turning = 0;
        w.strafe = 0;
      }
      heldMoveKeys.current.clear();
      pointerIntent.current = false;
      endHold();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    focus,
    rooms.length,
    onFocusChange,
    enterWalk,
    rootEffective,
    goBack,
    handleBoundary,
    endReached,
    pickBranch,
    showCue,
    startHold,
    endHold,
    candidates,
    runJunctionAction,
  ]);


  const dragStart = useRef<number | null>(null);
  /** Last pointer x while dragging to look around inside a room. */
  const lookDrag = useRef<number | null>(null);


  const inWalk = phase !== "browse";
  /** The junction the walker is approaching, if any — the LEFT button's action. */
  const junctionAction = (phase === "walking" || phase === "idle") ? (candidates[0] ?? null) : null;
  const atJunction = junctionAction !== null;
  // The two walk controls are permanent: they are never gated on a phase, so
  // they work the instant the building loads and never vanish at a door.



  const doorsById = useMemo(() => {
    const map = new Map<string, BuildingDoor>();
    for (const d of doors) map.set(d.id, d);
    return map;
  }, [doors]);

  /**
   * INDIVIDUAL SETTINGS. Each hallway renders the building's Default Settings
   * unless its owner customised it, so changing a default still updates every
   * element that is still inheriting.
   */
  const envForWalkway = useCallback(
    (walkwayId: string | null | undefined): EnvironmentSettings => {
      const w = walkways.find((x) => x.id === walkwayId);
      return resolveSurfaces(env, w?.surface_overrides);
    },
    [walkways, env],
  );

  /**
   * Classroom shells, keyed by the door they hang off. This map is only a render
   * cache: the door -> room rule itself lives in `roomForDoor`, and every door
   * click resolves through `openDoorRoom` below.
   */
  const classroomsByDoor = useMemo(
    () => indexRoomsByDoor<BuildingClassroom>(building?.classrooms ?? []),
    [building],
  );

  /**
   * ACCESS LOCKS. A lock belongs to one door and is entirely optional: doors
   * without one keep working exactly as before. What is entered lives here, so
   * the keypad on the wall is the only place a code is ever typed.
   */
  const locksByRoom = useMemo(() => indexLocksByRoom(building?.locks ?? []), [building]);
  /** The lock a door leads to: the lock of the ROOM behind that door. */
  const lockForDoor = useCallback(
    (doorId: string): RoomLock | null => {
      const room = roomForDoor(classroomsByDoor, doorId);
      return room ? locksByRoom.get(room.id) ?? null : null;
    },
    [classroomsByDoor, locksByRoom],
  );
  const [unlockedRooms, setUnlockedRooms] = useState<Set<string>>(new Set());
  const [lockEntry, setLockEntry] = useState<{
    roomId: string;
    code: string;
    state: LockState;
    /** Attempts left when the teacher set a limit; null when there is no limit. */
    remaining: number | null;
    /** How long the wait lasts once the attempts ran out. */
    retryIn: string | null;
  } | null>(null);
  const verifyLock = useServerFn(verifyRoomLock);

  const lockViewFor = useCallback(
    (doorId: string, focusLock: () => void, open: () => void) => {
      const lock = lockForDoor(doorId);
      if (!lock || unlockedRooms.has(lock.classroom_id)) return null;
      const roomId = lock.classroom_id;
      const active = lockEntry?.roomId === roomId ? lockEntry : null;
      const blank = { roomId, remaining: active?.remaining ?? null, retryIn: active?.retryIn ?? null };

      const submit = async (code: string) => {
        setLockEntry({ ...blank, code, state: "checking" });
        try {
          const res = await verifyLock({ data: { roomId, code } });
          if (res.ok) {
            // A CORRECT CODE OPENS THE DOOR. The panel shows UNLOCKED for a
            // moment, then the walker leaves the keypad and the door opens into
            // its room — the same zoom-and-enter an unlocked door uses. The room
            // stays unlocked for the rest of the visit.
            setUnlockedRooms((prev) => new Set(prev).add(roomId));
            setLockEntry({ ...blank, code, state: "unlocked", remaining: null, retryIn: null });
            setTimeout(() => {
              setLockEntry((prev) => (prev?.roomId === roomId ? null : prev));
              releaseKeypad();
              open();
            }, 900);

          } else {
            const retryIn = remainingWaitLabel(res.retryAt, res.retryAfterMinutes);
            setLockEntry({
              roomId,
              code: "",
              state: res.lockedOut ? "blocked" : "error",
              remaining: res.remaining,
              retryIn,
            });
          }
        } catch {
          setLockEntry({ ...blank, code: "", state: "error" });
        }
      };

      const blocked = active?.state === "blocked";

      return {
        charset: lock.charset,
        length: lock.code_length,
        state: (active?.state ?? "locked") as LockState,
        filled: active?.code.length ?? 0,
        remaining: active?.remaining ?? null,
        retryIn: active?.retryIn ?? null,
        onKey: (key: string) => {
          if (blocked) return;
          const base = active && active.state !== "error" ? active.code : "";
          if (base.length >= lock.code_length) return;
          const next = base + key;
          setLockEntry({ ...blank, code: next, state: "locked" });
          // A full code checks itself, exactly like a real access panel.
          if (next.length === lock.code_length) void submit(next);
        },
        onClear: () => {
          if (blocked) return;
          setLockEntry({ ...blank, code: "", state: "locked" });
        },
        onSubmit: () => {
          if (!blocked && active?.code) void submit(active.code);
        },
        onFocus: () => {
          if (!active) setLockEntry({ roomId, code: "", state: "locked", remaining: null, retryIn: null });
          focusLock();
        },
      };
    },
    [lockForDoor, unlockedRooms, lockEntry, verifyLock, releaseKeypad],
  );

  /**
   * The gate in front of every room entrance. A LOCKED door never opens on a
   * click: the camera moves up to its keypad, the door stays shut, and the code
   * is typed on the panel. An unlocked room enters exactly as it always has.
   */
  const guardedEnter = useCallback(
    (doorId: string, enter: () => void, focusLock?: () => void) => {
      const lock = lockForDoor(doorId);
      if (lock && !unlockedRooms.has(lock.classroom_id)) {
        const roomId = lock.classroom_id;
        setLockEntry((prev) =>
          prev?.roomId === roomId ? prev : { roomId, code: "", state: "locked", remaining: null, retryIn: null },
        );
        focusLock?.();
        return;
      }
      enter();
    },
    [lockForDoor, unlockedRooms],
  );


  /**
   * OPEN A DOOR. A door is strictly a room entrance, so this is the single path
   * from a doorway into a space: it resolves the room whose `door_id` is this
   * exact door, and nothing else. It never navigates to a page, never opens a
   * product, and never falls back to another room. If the loaded page is stale
   * the room is re-read from the database for this one door; if there is still
   * no room the door says so out loud instead of quietly doing nothing.
   */
  const openDoorRoom = useCallback(
    async (
      door: BuildingDoor,
      world: [number, number],
      front: [number, number],
      visual: RoomDoorVisual,
    ) => {
      let room = roomForDoor(classroomsByDoor, door.id);
      if (!room) room = await fetchRoomForDoor(door.id);
      if (!room || room.door_id !== door.id) {
        toast.error(`“${doorTitle(door, productTitles)}” has no room yet`, {
          description: "Open the building editor and give this door a room.",
        });
        return;
      }
      const attached = room;
      const into: [number, number] = [-front[0], -front[1]];
      startDoorZoom(world, front, () => enterClassroom(world, into, attached, visual));
    },
    [classroomsByDoor, enterClassroom, productTitles, startDoorZoom],
  );


  /** The hallway you are in, plus every corridor sharing a physical mouth. */
  const nearbyIds = useMemo(() => {
    // INSIDE A ROOM the hallway network is not visible at all: a room is a
    // separate space beyond its door, and the building's corridors would
    // otherwise cut straight through it and read as "the wrong place".
    if (insideRoom) return new Set<string>();
    const currentId = nav.seg.walkway?.id ?? "root";
    const connections: { a: string; b: string }[] = [];

    for (const seg of segments) {
      const id = seg.walkway?.id ?? "root";
      for (const child of seg.children) {
        connections.push({ a: id, b: child.walkway?.id ?? "root" });
      }
    }
    for (const [sourceId, connector] of connectors) {
      connections.push({ a: sourceId, b: connector.targetWalkwayId });
    }
    for (const [ownerId, objects] of layouts) {
      for (const object of objects) {
        if (object.kind === "link" && object.targetWalkwayId) {
          connections.push({ a: ownerId, b: object.targetWalkwayId });
        }
      }
    }
    return connectedWalkwayIds(currentId, connections);
  }, [nav.seg, segments, connectors, layouts, insideRoom]);


  /** Doors and sub-hallway openings of one hallway, from the shared layout. */
  const renderObjects = (seg: Segment) => {
    if (!seg.walkway) return null;
    if (connectors.has(seg.walkway.id) && seg.length < MIN_RENDERABLE_CORRIDOR) return null;
    const objs = layouts.get(seg.walkway.id) ?? [];
    const yaw = segYaw(seg.heading);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    return objs.map((o, i) => {
      if (o.kind === "opening") {
        const child = seg.children.find((c) => c.walkway?.id === o.id);
        if (!child) return null;
        const activeId = nav.seg.walkway?.id ?? "root";
        const destinationName = activeId === o.id
          ? (seg.walkway?.name ?? "Entrance Hall")
          : o.name;
        return (
          <BranchOpening
            key={o.id}
            side={o.side}
            along={o.along}
            name={destinationName}
            accent={o.side === -1 ? env.leftWall.color : env.rightWall.color}
            floorColor={env.floor.color}
            roofColor={env.roof.color}
            onEnter={() => pickBranch(child)}
          />
        );
      }

      // A connection to a hallway elsewhere in the building: it looks and works
      // exactly like a junction mouth, so the maze reads as one road network.
      if (o.kind === "link") {
        if (!o.targetWalkwayId) return null;
        const targetWalkwayId = o.targetWalkwayId;
        const activeId = nav.seg.walkway?.id ?? "root";
        const destinationName = activeId === targetWalkwayId
          ? (seg.walkway?.name ?? "Entrance Hall")
          : o.name;
        return (
          <MergeOpening
            key={o.id}
            side={o.side}
            along={o.along}
            span={mouths.get(o.id)?.span ?? HALL_WIDTH}
            name={destinationName}
            accent={o.side === -1 ? env.leftWall.color : env.rightWall.color}
            floorColor={env.floor.color}
            roofColor={env.roof.color}
            onEnter={() => crossLink(o.id, targetWalkwayId)}
          />
        );
      }


      const wx = seg.start[0] + seg.heading[0] * o.along + o.side * (HALL_WIDTH / 2 - 0.06) * cy;
      const wz = seg.start[1] + seg.heading[1] * o.along - o.side * (HALL_WIDTH / 2 - 0.06) * sy;
      // `front` is the direction the door FACES — out of its wall and into the
      // corridor. A left-wall door (side -1) sits at -x of the walk, so it faces
      // right of the walk; a right-wall door faces left. The room therefore lies
      // along -front, which is what the classroom camera walks into.
      const front: [number, number] = turnHeading(seg.heading, o.side === -1 ? "right" : "left");



      const d = doorsById.get(o.id);
      if (!d) return null;
      const design = d.design as Partial<typeof env.door> | null;
      // A DOOR IS ONLY A ROOM ENTRANCE. It never launches a course, adventure
      // or assessment — those live inside the room, behind this door.
      const attached = roomForDoor(classroomsByDoor, d.id);
      const sublabel = attached
        ? CLASSROOM_KIND_LABEL[attached.kind]
        : "Room missing — recreate it in the editor";
      const accent = attached
        ? ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4"][i % 4]
        : "#64748b";
      // The room carries the same door's look, so its inside face is the very
      // door that was walked through.
      const textureUrl = design?.texture?.path
        ? textures[design.texture.path]
        : env.door.texture
          ? textures[env.door.texture.path]
          : undefined;
      const visual: RoomDoorVisual = {
        color: design?.color || env.door.color,
        brightness: design?.brightness ?? env.door.brightness,
        styleKey: design?.style || env.door.style,
        textureUrl,
        accent,
      };
      const lateral: [number, number] = [-o.side * seg.heading[0], -o.side * seg.heading[1]];
      // ONE WAY IN. Every route to this room — a click on an unlocked door, or
      // the keypad accepting its code — ends in this same call.
      const openThisDoor = () => void openDoorRoom(d, [wx, wz], front, visual);
      const focusThisLock = () => focusLockPanel([wx, wz], front, lateral);
      return (
        <group key={o.id} position={[0, 0, -o.along]}>
          <DoorMesh
            side={o.side}
            z={0}
            label={attached ? attached.name : o.name}
            sublabel={sublabel}
            accent={accent}
            color={design?.color || env.door.color}
            emissiveIntensity={(design?.brightness ?? env.door.brightness) * 0.12}
            styleKey={design?.style || env.door.style}
            textureUrl={textureUrl}
            lock={lockViewFor(d.id, focusThisLock, openThisDoor)}
            onEnter={() => guardedEnter(d.id, openThisDoor, focusThisLock)}
          />
        </group>
      );

    });
  };

  const dirPill = atJunction ? (
    <div className="pointer-events-none absolute left-3 top-28 z-10 flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-foreground/90 backdrop-blur">
      {nav.seg.children.map((c) => (
        <span
          key={c.walkway!.id}
          className={c.walkway?.direction === "forward" ? "text-emerald-300" : "text-sky-300"}
        >
          {c.walkway?.direction === "left" ? "← " : ""}
          {c.walkway?.name}
          {c.walkway?.direction === "right" ? " →" : ""}
          {c.walkway?.direction === "forward" ? " ▶" : ""}
        </span>
      ))}
    </div>
  ) : null;

  // The endpoint is the final node of the walked route.
  const endpointName =
    endReached && !nav.seg.children.some((c) => c.walkway?.direction === "forward")
      ? (nav.seg.walkway?.end_label ?? DEFAULT_ENDPOINT_NAME)
      : null;
  const trail = endpointName ? [...breadcrumb, endpointName] : breadcrumb;

  return (
    <div
      className="absolute inset-0"

      onPointerDown={(e) => {

        dragStart.current = e.clientX;
        if (machineRef.current.inside) lookDrag.current = e.clientX;
      }}
      onPointerMove={(e) => {
        // DRAG TO LOOK AROUND inside a room, so turning is never button-only.
        const w = machineRef.current.inside;
        if (!w || lookDrag.current === null) return;
        const dx = e.clientX - lookDrag.current;
        lookDrag.current = e.clientX;
        w.yaw -= dx * 0.005;
      }}
      onPointerLeave={() => {
        lookDrag.current = null;
      }}
      onPointerUp={(e) => {
        lookDrag.current = null;
        if (phase !== "browse" || dragStart.current === null) return;
        const dx = e.clientX - dragStart.current;
        dragStart.current = null;
        if (Math.abs(dx) < 60) return;
        onFocusChange(
          dx < 0 ? Math.min(rooms.length - 1, focus + 1) : Math.max(0, focus - 1),
        );
      }}
    >
      {/* THE 3D WORLD'S OWN EVENT SURFACE. Only what is inside this layer feeds
          clicks to the scene, so pressing a navigation button can never also
          raycast into a doorway behind it. */}
      <div ref={setEventSource} className="absolute inset-0">
      {eventSource && <Canvas
        eventSource={eventSource}

        shadows
        camera={{ position: [0, 1.7, 6.5], fov: 62, near: 0.3 }}
        // Nothing closer than the near plane can be clicked. Standing in the
        // entrance lobby the exit door's frame is only centimetres in front of
        // the eye (outside the rendered view), and without this every click on
        // the canvas would land on it and leave the building.
        raycaster={{ near: MIN_PICK_DISTANCE }}
        dpr={[1, 2]}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      >
        <color attach="background" args={["#131a2b"]} />
        <fog attach="fog" args={["#131a2b", 16, env.lighting.atmosphere ? 56 : 50]} />
        <ambientLight intensity={lights.ambient} />
        <hemisphereLight args={["#cfe3ff", "#2a3042", lights.hemisphere]} />
        <directionalLight
          position={[3, 8, 4]}
          intensity={lights.directional}
          castShadow
        />
        {env.lighting.atmosphere && (
          <pointLight position={[0, HALL_HEIGHT - 1, -rootLen / 2]} intensity={lights.point * 1.4} distance={22} color="#cfe3ff" />
        )}
        {env.effects.enabled && env.effects.effect === "soft-particles" && (
          <Sparkles count={70} scale={[HALL_WIDTH, HALL_HEIGHT, rootLen + 10]} size={2.2} speed={0.35} color="#7dd3fc" />
        )}
        {env.effects.enabled && env.effects.effect === "sun-beams" && (
          <group>
            <Sparkles count={40} scale={[HALL_WIDTH, HALL_HEIGHT, rootLen + 10]} size={3.5} speed={0.15} color="#fde68a" />
            <pointLight position={[0, HALL_HEIGHT, -rootLen / 2]} intensity={lights.point * 1.2} distance={26} color="#fde68a" />
          </group>
        )}
        {/* Ceiling lights evenly along EVERY corridor — a branch you can see
            into through a junction must be lit, or the second hallway reads as
            a black void instead of a corridor. */}
        {segments.filter((seg) => nearbyIds.has(seg.walkway?.id ?? "root")).flatMap((seg) => {
          const yaw = segYaw(seg.heading);
          const fx = -Math.sin(yaw);
          const fz = -Math.cos(yaw);
          const count = Math.max(1, Math.ceil(seg.length / SPACING));
          return Array.from({ length: count + 1 }, (_, i) => {
            const d = Math.min(seg.length, i * SPACING);
            return (
              <pointLight
                key={`cl-${seg.walkway?.id ?? "root"}-${i}`}
                position={[seg.start[0] + fx * d, HALL_HEIGHT - 0.6, seg.start[1] + fz * d]}
                intensity={lights.point}
                distance={13}
                color="#cfe3ff"
              />
            );
          });
        })}

        {/* JUNCTION MOUTH LIGHTS — the throat just beyond an opening sits before
            the connected hallway's own row of ceiling lights begins, so without
            this the first metres you look at through a mouth read as a dark
            patch. One light per visible mouth, at corridor light level. */}
        {segments
          .filter((seg) => nearbyIds.has(seg.walkway?.id ?? "root"))
          .flatMap((seg) => {
            const yaw = segYaw(seg.heading);
            const cy = Math.cos(yaw);
            const sy = Math.sin(yaw);
            const fx = -Math.sin(yaw);
            const fz = -Math.cos(yaw);
            return (layouts.get(seg.walkway?.id ?? "") ?? [])
              .filter((o) => o.kind !== "door")
              .map((o) => {
                const lat = o.side * (HALL_WIDTH * 0.55);
                return (
                  <pointLight
                    key={`ml-${o.id}`}
                    position={[
                      seg.start[0] + fx * o.along + lat * cy,
                      HALL_HEIGHT - 0.7,
                      seg.start[1] + fz * o.along - lat * sy,
                    ]}
                    intensity={lights.point}
                    distance={14}
                    color="#cfe3ff"
                  />
                );
              });
          })}



        {/* The classroom shell — a real space beyond its door, mounted only while
            you are inside it so its walls never read through the corridor. */}
        {insideRoom && (
          <ClassroomShell
            door={insideRoom.door}
            heading={insideRoom.into}
            kind={insideRoom.room.kind}
            name={insideRoom.room.name}
            env={resolveSurfaces(env, insideRoom.room.surface_overrides)}
            textures={textures}
            screenVideo={roomScreen.video}
            screenHasContent={roomScreen.mode !== "idle"}
            doorVisual={insideRoom.doorVisual}
            onLeave={leaveClassroom}
            onScreenSelect={() => setScreenPanelOpen((o) => !o)}

          />
        )}

        <CameraRig
          focus={focus}
          rooms={rooms}
          m={machineRef}
          rootLen={rootLen}
          onWalkEnd={handleWalkEnd}
          onJunctionReach={handleJunctionReach}
          onBoundary={handleBoundary}
          onLeaveRoom={leaveClassroom}
          setPhase={setMachinePhase}

        />

{/* Enclosed hallways — each finite, named, walled at its far end. Only the
    connected hallways are signposted, so far-away names never read through walls. */}
        {!insideRoom && segments.map((seg) => {
          // A sub-half-metre merge is only a junction throat, not a corridor.
          // Rendering a complete shell here puts its walls across the target road.
          if (connectors.has(seg.walkway?.id ?? "") && seg.length < MIN_RENDERABLE_CORRIDOR) return null;

          const near = nearbyIds.has(seg.walkway?.id ?? "root");
          const connector = connectors.get(seg.walkway?.id ?? "");
          const connectorTarget = connector
            ? findSegment(segments, connector.targetWalkwayId)
            : null;
          const endDistances = connector && connectorTarget
            ? connectorEndDistances(
                { start: seg.start, heading: seg.heading, length: seg.length },
                {
                  start: connectorTarget.start,
                  heading: connectorTarget.heading,
                  length: connectorTarget.length,
                },
                connector.targetSide,
                HALL_WIDTH,
              )
            : undefined;
          // Every junction on this hallway removes a run of its wall, so the
          // connected hallway is seen through a real cut, not a flat plane. A
          // branch leaves at the branch angle (offset, wider mouth); a hallway
          // that ARRIVES here cuts a straight opening centred on the junction.
          const gaps = (layouts.get(seg.walkway?.id ?? "") ?? [])
            .filter((o) => o.kind !== "door")
            .map((o) => {
              const merge = mouths.get(o.id);
              if (merge) return { side: o.side, along: o.along, center: 0, width: merge.span };
              const g = junctionGeometry(HALL_WIDTH);
              return {
                side: o.side,
                along: o.along,
                center: g.mouthCenterOffset,
                width: g.mouthSpan,
              };
            });
          return (
            <SegmentCorridor
              key={seg.walkway?.id ?? "root"}
              start={seg.start}
              yaw={segYaw(seg.heading)}
              length={seg.length}
              env={envForWalkway(seg.walkway?.id)}
              textures={textures}
              gaps={gaps}
              startTrim={
                seg.depth > 0 && seg.walkway?.direction !== "forward"
                  ? junctionGeometry(HALL_WIDTH).branchTrim
                  : 0
              }
              frontPad={0}
              endDistances={endDistances}

              capEnd={
                !seg.children.some((c) => c.walkway?.direction === "forward") &&
                !(seg.walkway ? connectors.has(seg.walkway.id) : false)
              }
              capStart={seg.depth === 0}
              name={near ? seg.walkway?.name : undefined}
              endName={
                !near || seg.children.some((c) => c.walkway?.direction === "forward")
                  ? undefined
                  : (seg.walkway?.end_label ?? DEFAULT_ENDPOINT_NAME)
              }
            />
          );
        })}


        {/* Doors and sub-hallway openings — only for the hallway you are in and
            the ones it connects to, so distant labels never ghost through walls */}
        {segments
          .filter((seg) => nearbyIds.has(seg.walkway?.id ?? "root"))
          .map((seg) => (
            <group
              key={`objs-${seg.walkway?.id ?? "root"}`}
              position={[seg.start[0], 0, seg.start[1]]}
              rotation-y={segYaw(seg.heading)}
            >
              {renderObjects(seg)}
            </group>
          ))}

        {/* THE ENTRANCE DOOR — one fixture derived from the main hallway (never
            a stored door, so editing the building cannot duplicate it). It caps
            the start of the corridor, so turning around and walking back always
            ends at a real door instead of a blank wall. Clicking it leaves. */}
        {!insideRoom && (
        <group
          position={[rootEffective.start[0], 0, rootEffective.start[1]]}
          rotation-y={segYaw(rootEffective.heading)}
        >
          <DoorMesh
            atStart
            side={1}
            z={0}
            label="Building entrance"
            sublabel="Exit the building"
            accent="#7dd3fc"
            color={env.door.color}
            emissiveIntensity={env.door.brightness * 0.12}
            styleKey={env.door.style}
            textureUrl={env.door.texture ? textures[env.door.texture.path] : undefined}
            onEnter={exitBuilding}
          />
        </group>
        )}


      </Canvas>}
      </div>



      {/* Navigation HUD */}
      {/* Inside a room the navigation CHANGES: free walking, turning and
          side-stepping replace the corridor's forward/turn-around pair. */}
      {insideRoom && (
        <>
          {/* Room navigation — hidden while the student is still, so it never
              sits permanently over the lesson video. */}
          <div
            className={`transition-opacity duration-300 ${roomHud.visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
              {insideRoom.room.name}
            </div>
            <p className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-background/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
              Walk, turn and step around — go back through the door to leave
            </p>
            <RoomControls
              onWalk={roomWalk}
              onTurn={roomTurn}
              onStrafe={roomStrafe}
              onLeave={leaveClassroom}
            />
          </div>
          {/* The lesson video's own controls — a separate system from movement. */}
          <SmartScreenControls
            api={roomScreen}
            open={screenPanelOpen}
            onClose={() => setScreenPanelOpen(false)}
          />
        </>
      )}



      {inWalk && !insideRoom && (
        <>
          <div className="pointer-events-none absolute left-3 top-16 z-10 flex max-w-[60vw] items-center gap-1.5 overflow-hidden rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            {trail.map((b, i) => (
              <span key={`${b}-${i}`} className="flex items-center gap-1.5 whitespace-nowrap">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                <span className={i === trail.length - 1 ? "font-semibold text-foreground" : ""}>{b}</span>
              </span>
            ))}
          </div>
          {dirPill}
          {cue && (
            <div className="pointer-events-none absolute left-1/2 top-1/4 z-20 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-200 backdrop-blur">
              {cue}
            </div>
          )}
        </>
      )}

      {!insideRoom && <WalkControls
        action={junctionAction}
        moving={moving}
        ended={endReached}
        onForwardStart={startPointerHold}
        onForwardEnd={endPointerHold}
        onTurnAround={goBack}
        onJunction={runJunctionAction}
      />}


      {/* Fixed structural map — always on, top-right, like a racing minimap */}
      <MiniMap
        segments={segments}
        layouts={layouts}
        connectors={connectors}
        m={machineRef}
        show={showMap}
        ended={endReached}
        routeIds={routeIds}
        rooms={classroomsByDoor}
      />
    </div>
  );
};

export default HallwayScene;