// Label collision avoidance.
//
// Every Label3D registers its live world position with a shared store. Once a
// frame (throttled) the runner projects them all to screen space, sorts them
// front-to-back and gives each overlapping label a small perpendicular nudge.
// Labels ease toward their nudge, so the layout settles without jitter and the
// label never detaches from its element.

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export interface LabelEntry {
  /** World position, written by the label each frame. */
  world: THREE.Vector3;
  /** Approximate on-screen half-size in pixels. */
  halfW: number;
  halfH: number;
  /** Perpendicular push distance (world units) resolved by the runner. */
  nudge: number;
  active: boolean;
}

export interface LabelStore {
  entries: Map<string, LabelEntry>;
}

export const LabelLayoutContext = createContext<LabelStore | null>(null);

export function useLabelStore(): LabelStore | null {
  return useContext(LabelLayoutContext);
}

/** Register one label; returns the mutable entry to read/write each frame. */
export function useLabelSlot(id: string, halfW: number, halfH: number): LabelEntry {
  const store = useLabelStore();
  const entry = useMemo<LabelEntry>(
    () => ({ world: new THREE.Vector3(), halfW, halfH, nudge: 0, active: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  entry.halfW = halfW;
  entry.halfH = halfH;

  useEffect(() => {
    if (!store) return;
    store.entries.set(id, entry);
    return () => { store.entries.delete(id); };
  }, [store, id, entry]);

  return entry;
}

const NUDGE_STEP = 0.22;
const MAX_NUDGE = 0.9;

/** Runs inside the Canvas; resolves overlaps ~20× a second. */
export function useLabelLayoutRunner(store: LabelStore) {
  const { camera, size } = useThree();
  const last = useRef(0);
  const tmp = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (t - last.current < 0.05) return;
    last.current = t;

    const list: { e: LabelEntry; x: number; y: number; d: number }[] = [];
    for (const e of store.entries.values()) {
      if (!e.active) { e.nudge = 0; continue; }
      const p = tmp.current.copy(e.world);
      const d = camera.position.distanceTo(p);
      p.project(camera);
      if (p.z > 1) { e.nudge = 0; continue; }
      list.push({
        e,
        x: (p.x * 0.5 + 0.5) * size.width,
        y: (-p.y * 0.5 + 0.5) * size.height,
        d,
      });
    }
    // Nearest labels keep their place; farther ones move out of the way.
    list.sort((a, b) => a.d - b.d);
    for (let i = 0; i < list.length; i++) {
      let overlaps = 0;
      for (let j = 0; j < i; j++) {
        const a = list[i];
        const b = list[j];
        if (
          Math.abs(a.x - b.x) < a.e.halfW + b.e.halfW &&
          Math.abs(a.y - b.y) < a.e.halfH + b.e.halfH
        ) overlaps++;
      }
      list[i].e.nudge = Math.min(MAX_NUDGE, overlaps * NUDGE_STEP);
    }
  });
}
