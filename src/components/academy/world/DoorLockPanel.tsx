/**
 * DOOR LOCK PANEL — a wall-mounted digital access panel, built as a component
 * of its own. It knows nothing about doors, rooms or navigation: it draws a real
 * security panel, reports the keys that are pressed, and shows the four states
 * a lock can be in (locked, checking, unlocked, refused).
 *
 * Because it is a plain 3D group, whoever mounts it decides where it hangs. As a
 * child of a door group it inherits that door's wall position and facing, so it
 * keeps its place and perspective while the camera moves, turns or zooms.
 */
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { keypadRows } from "@/lib/building/lock";
import type { LockCharset } from "@/lib/building/lock";

export type LockState = "locked" | "checking" | "unlocked" | "error" | "blocked";

const BEZEL = "#141821";
const FACE = "#0a1220";
const GLOW: Record<LockState, string> = {
  locked: "#3fd0ff",
  checking: "#7dd3ff",
  unlocked: "#3ef2a0",
  error: "#ff5a6a",
  blocked: "#ff5a6a",
};
const CAPTION: Record<LockState, string> = {
  locked: "Please enter the code to unlock",
  checking: "Checking…",
  unlocked: "Access granted",
  error: "Try the code again",
  blocked: "Maximum attempts reached",
};
const TITLE: Record<LockState, string> = {
  locked: "ENTER ACCESS CODE",
  checking: "ENTER ACCESS CODE",
  unlocked: "UNLOCKED",
  error: "WRONG CODE",
  blocked: "LOCKED OUT",
};


/** A rounded rectangle path, used for the bezel and every key. */
const roundedPath = (w: number, h: number, r: number) => {
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

const PADLOCK_LOCKED = "\u{1F512}";
const PADLOCK_OPEN = "\u{1F513}";

export interface DoorLockPanelProps {
  state: LockState;
  /** How many characters of the code have been entered so far. */
  filled: number;
  /** How many characters the code has in total (drives the indicator dots). */
  length: number;
  charset: LockCharset;
  /** Overall panel height in world units; the width follows from it. */
  height?: number;
  /** Attempts left when the teacher set a limit; null when there is no limit. */
  remaining?: number | null;
  /** How long the learner must wait once the attempts ran out, e.g. "24 hours". */
  retryIn?: string | null;
  onKey?: (key: string) => void;
  onClear?: () => void;
  onSubmit?: () => void;
  /** Clicking the panel body — used to focus the lock before typing. */
  onFocus?: () => void;
}

const DoorLockPanel = ({
  state,
  filled,
  length,
  charset,
  height = 1.15,
  remaining = null,
  retryIn = null,
  onKey,
  onClear,
  onSubmit,
  onFocus,
}: DoorLockPanelProps) => {
  const rows = useMemo(() => keypadRows(charset), [charset]);
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 3);
  const blocked = state === "blocked";
  const caption = blocked
    ? `Maximum attempts reached. Try again in ${retryIn ?? "a while"}.`
    : state === "error" && remaining !== null
      ? `WRONG CODE — ${remaining} attempt${remaining === 1 ? "" : "s"} left`
      : CAPTION[state];


  const h = height;
  const w = h * 0.52 * (cols / 3);
  const glow = GLOW[state];

  const bezelGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(roundedPath(w, h, Math.min(0.08, h * 0.09)), {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 8,
      }),
    [w, h],
  );
  const faceW = w - h * 0.075;
  const faceH = h - h * 0.075;
  const faceGeo = useMemo(
    () => new THREE.ExtrudeGeometry(roundedPath(faceW, faceH, Math.min(0.06, h * 0.07)), { depth: 0.012, bevelEnabled: false, curveSegments: 8 }),
    [faceW, faceH, h],
  );

  const keyW = (faceW - h * 0.12) / cols;
  const keyH = Math.min(keyW * 0.78, h * 0.11);
  const keyGap = keyH * 0.22;
  const keypadH = rows.length * keyH + (rows.length - 1) * keyGap;

  const topY = faceH / 2;
  const iconY = topY - h * 0.08;
  const titleY = topY - h * 0.19;
  const capY = topY - h * 0.28;
  const dotsY = topY - h * 0.37;
  const keypadTop = dotsY - h * 0.08;
  const z = 0.062;

  const dots = Array.from({ length: Math.max(1, length) });
  const dotStep = Math.min(faceW / (dots.length + 1), h * 0.09);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "auto";
      }}
    >
      {/* Bezel — the housing bolted to the wall */}
      <mesh geometry={bezelGeo} castShadow receiveShadow>
        <meshStandardMaterial color={BEZEL} roughness={0.42} metalness={0.55} />
      </mesh>
      {/* Face — dark glass carrying its own soft light */}
      <mesh geometry={faceGeo} position={[0, 0, 0.045]}>
        <meshStandardMaterial color={FACE} emissive={FACE} emissiveIntensity={0.5} roughness={0.25} metalness={0.2} />
      </mesh>
      {/* Inner edge glow: the state of the lock, read at a glance */}
      <lineSegments position={[0, 0, z]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(faceW - 0.02, faceH - 0.02)]} />
        <lineBasicMaterial color={glow} toneMapped={false} transparent opacity={0.9} />
      </lineSegments>

      <Suspense fallback={null}>
        <Text
          position={[0, iconY, z]}
          fontSize={h * 0.09}
          anchorX="center"
          anchorY="middle"
          color={glow}
          material-toneMapped={false}
        >
          {state === "unlocked" ? PADLOCK_OPEN : PADLOCK_LOCKED}
        </Text>
        <Text
          position={[0, titleY, z]}
          fontSize={h * 0.045}
          letterSpacing={0.06}
          lineHeight={1.25}
          maxWidth={faceW * 0.92}
          anchorX="center"
          anchorY="middle"
          color={state === "error" ? GLOW.error : "#dbeafe"}
          material-toneMapped={false}
        >
          {TITLE[state]}
        </Text>
        <Text
          position={[0, capY, z]}
          fontSize={h * 0.03}
          lineHeight={1.25}
          maxWidth={faceW * 0.92}
          anchorX="center"
          anchorY="middle"
          color={state === "error" || blocked ? "#ffb4bc" : "#8fb3d9"}
          material-toneMapped={false}
        >
          {caption}
        </Text>
      </Suspense>

      {/* Secure code indicators — filled as characters are entered, never the
          characters themselves. */}
      {dots.map((_, i) => (
        <mesh key={i} position={[(i - (dots.length - 1) / 2) * dotStep, dotsY, z]}>
          <circleGeometry args={[h * 0.017, 18]} />
          <meshBasicMaterial
            color={i < filled ? glow : "#2a3648"}
            toneMapped={false}
            transparent
            opacity={i < filled ? 1 : 0.75}
          />
        </mesh>
      ))}

      {/* Keypad */}
      {rows.map((row, r) =>
        row.map((key, c) => {
          const x = (c - (row.length - 1) / 2) * (keyW + keyGap * 0.5);
          const y = keypadTop - keyH / 2 - r * (keyH + keyGap);
          return (
            <group key={`${r}-${c}`} position={[x, y, z]}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  // A locked-out panel takes no input until the wait is over.
                  if (blocked) return;
                  if (key === "*") onClear?.();
                  else if (key === "#") onSubmit?.();
                  else onKey?.(key);
                }}

                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = "auto";
                }}
              >
                <planeGeometry args={[keyW * 0.86, keyH]} />
                <meshBasicMaterial color="#132030" toneMapped={false} transparent opacity={0.95} />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(keyW * 0.86, keyH)]} />
                <lineBasicMaterial color={glow} toneMapped={false} transparent opacity={0.55} />
              </lineSegments>
              <Suspense fallback={null}>
                <Text
                  position={[0, 0, 0.004]}
                  fontSize={keyH * 0.5}
                  anchorX="center"
                  anchorY="middle"
                  color="#e6f2ff"
                  material-toneMapped={false}
                >
                  {key}
                </Text>
              </Suspense>
            </group>
          );
        }),
      )}

      {/* Light bar at the base — the panel's heartbeat */}
      <mesh position={[0, -faceH / 2 + h * 0.05, z]}>
        <planeGeometry args={[faceW * 0.42, h * 0.012]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* Just enough spill light that the panel reads as a lit device on a wall */}
      <pointLight position={[0, 0, 0.35]} intensity={0.35} distance={1.6} decay={2} color={glow} />

      {/* A hint of the keys' purpose, kept small and clinical */}
      <Suspense fallback={null}>
        <Text
          position={[0, keypadTop - keypadH - h * 0.045, z]}
          fontSize={h * 0.028}
          letterSpacing={0.06}
          anchorX="center"
          anchorY="middle"
          color="#6f8dad"
          material-toneMapped={false}
        >
          {"\u2731 CLEAR    # ENTER"}
        </Text>
      </Suspense>
    </group>
  );
};

export default DoorLockPanel;
