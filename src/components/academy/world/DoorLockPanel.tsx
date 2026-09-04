/**
 * DOOR LOCK PANEL — a wall-mounted digital access panel, built as a component
 * of its own. It knows nothing about doors, rooms or navigation: it draws a real
 * security panel, reports the keys that are pressed, and shows the four states
 * a lock can be in (locked, checking, unlocked, refused).
 *
 * Because it is a plain 3D group, whoever mounts it decides where it hangs. As a
 * child of a door group it inherits that door's wall position and facing, so it
 * keeps its place and perspective while the camera moves, turns or zooms.
 *
 * EVERY LEGEND IS PAINTED, NOT TYPESET. The digits, title, caption and padlock
 * are drawn onto small canvases in code and used as textures. There is no font
 * download, no worker and no asynchronous step, so the keypad can never appear
 * as a set of blank tiles.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { keypadRows } from "@/lib/building/lock";
import type { LockCharset } from "@/lib/building/lock";

/** Decoration never takes a press. */
const NO_PICK = () => {};

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

/** What the two non-digit keys do, printed small beneath their symbol. */
const KEY_CAPTION: Record<string, string> = { "*": "CLEAR", "#": "ENTER" };

const FONT_STACK =
  '"Inter", "Segoe UI", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

/** Canvas pixels per world unit — sharp at reading distance, cheap in memory. */
const PPU = 1400;

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

interface LabelSpec {
  text: string;
  /** World size of the plane the label fills. */
  w: number;
  h: number;
  color: string;
  /** Font size as a fraction of the plane height. */
  size?: number;
  weight?: number | string;
  letterSpacing?: number;
  /** A second, smaller line under the main text (the CLEAR / ENTER captions). */
  sub?: string;
  subColor?: string;
  /** Never wrap; shrink to fit instead (titles). */
  oneLine?: boolean;
}

/** Word-wrap `text` to `maxWidth` pixels with the context's current font. */
const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** Paint a label onto a canvas and hand back a texture ready for a plane. */
const paintLabel = (spec: LabelSpec): THREE.CanvasTexture | null => {
  if (typeof document === "undefined") return null;
  const pw = Math.max(8, Math.round(spec.w * PPU));
  const ph = Math.max(8, Math.round(spec.h * PPU));
  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, pw, ph);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.color;
  const px = ph * (spec.size ?? 0.6);
  const weight = spec.weight ?? 600;
  ctx.font = `${weight} ${px}px ${FONT_STACK}`;
  // Canvas has no cross-browser letter-spacing, so it is applied by hand.
  const spacing = (spec.letterSpacing ?? 0) * px;
  const drawSpaced = (text: string, cx: number, cy: number) => {
    if (!spacing) {
      ctx.fillText(text, cx, cy);
      return;
    }
    const chars = Array.from(text);
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let x = cx - total / 2;
    ctx.textAlign = "left";
    chars.forEach((c, i) => {
      ctx.fillText(c, x, cy);
      x += widths[i] + spacing;
    });
    ctx.textAlign = "center";
  };

  if (spec.sub) {
    // Symbol on top, its purpose printed small underneath.
    drawSpaced(spec.text, pw / 2, ph * 0.4);
    const subPx = ph * 0.2;
    ctx.font = `600 ${subPx}px ${FONT_STACK}`;
    ctx.fillStyle = spec.subColor ?? spec.color;
    ctx.fillText(spec.sub, pw / 2, ph * 0.8);
  } else if (spec.oneLine) {
    // Headings never wrap: shrink the type until the line fits the plane.
    let fontPx = px;
    while (fontPx > 4 && ctx.measureText(spec.text).width + spacing * (spec.text.length - 1) > pw * 0.96) {
      fontPx *= 0.94;
      ctx.font = `${weight} ${fontPx}px ${FONT_STACK}`;
    }
    drawSpaced(spec.text, pw / 2, ph / 2);
  } else {
    const lines = wrapLines(ctx, spec.text, pw * 0.96);
    const lineH = px * 1.25;
    const startY = ph / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => drawSpaced(line, pw / 2, startY + i * lineH));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
};

/** A padlock, drawn with strokes so it needs no emoji font. */
const paintPadlock = (size: number, color: string, open: boolean): THREE.CanvasTexture | null => {
  if (typeof document === "undefined") return null;
  const p = Math.max(32, Math.round(size * PPU));
  const canvas = document.createElement("canvas");
  canvas.width = p;
  canvas.height = p;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, p, p);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = p * 0.09;
  ctx.lineCap = "round";
  // Body
  const bw = p * 0.58;
  const bh = p * 0.44;
  const bx = (p - bw) / 2;
  const by = p * 0.5;
  const r = p * 0.08;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();
  // Keyhole
  ctx.fillStyle = "#0a1220";
  ctx.beginPath();
  ctx.arc(p / 2, by + bh * 0.42, p * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(p / 2 - p * 0.025, by + bh * 0.42, p * 0.05, bh * 0.3);
  // Shackle — swung to the side when open
  const sr = p * 0.19;
  const scx = open ? p / 2 + p * 0.2 : p / 2;
  ctx.beginPath();
  ctx.arc(scx, by - p * 0.02, sr, Math.PI, 0);
  ctx.moveTo(scx - sr, by - p * 0.02);
  ctx.lineTo(scx - sr, open ? by - p * 0.12 : by + p * 0.02);
  ctx.moveTo(scx + sr, by - p * 0.02);
  ctx.lineTo(scx + sr, by + p * 0.02);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

/** A plane carrying a painted label. Disposes its texture when it changes. */
const Label = ({
  position,
  spec,
}: {
  position: [number, number, number];
  spec: LabelSpec;
}) => {
  const tex = useMemo(
    () => paintLabel(spec),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.text, spec.w, spec.h, spec.color, spec.size, spec.weight, spec.letterSpacing, spec.sub, spec.subColor, spec.oneLine],
  );
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  return (
    <mesh position={position} raycast={NO_PICK}>
      <planeGeometry args={[spec.w, spec.h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

const Padlock = ({
  position,
  size,
  color,
  open,
}: {
  position: [number, number, number];
  size: number;
  color: string;
  open: boolean;
}) => {
  const tex = useMemo(() => paintPadlock(size, color, open), [size, color, open]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  return (
    <mesh position={position} raycast={NO_PICK}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

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
      {/* Outlines are decoration only. Three.js gives lines a fat pick radius,
          so an un-picked outline would swallow presses meant for the keys. */}
      <lineSegments position={[0, 0, z]} raycast={NO_PICK}>
        <edgesGeometry args={[new THREE.PlaneGeometry(faceW - 0.02, faceH - 0.02)]} />
        <lineBasicMaterial color={glow} toneMapped={false} transparent opacity={0.9} />
      </lineSegments>

      <Padlock position={[0, iconY, z]} size={h * 0.11} color={glow} open={state === "unlocked"} />
      <Label
        position={[0, titleY, z]}
        spec={{
          text: TITLE[state],
          w: faceW * 0.96,
          h: h * 0.06,
          size: 0.62,
          weight: 700,
          letterSpacing: 0.08,
          oneLine: true,
          color: state === "error" || blocked ? GLOW.error : "#dbeafe",
        }}
      />
      <Label
        position={[0, capY, z]}
        spec={{
          text: caption,
          w: faceW * 0.96,
          h: h * 0.075,
          size: 0.4,
          weight: 500,
          color: state === "error" || blocked ? "#ffb4bc" : "#8fb3d9",
        }}
      />

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

      {/* Keypad: 1 2 3 / 4 5 6 / 7 8 9 / * 0 # — a real door panel's layout */}
      {rows.map((row, r) =>
        row.map((key, c) => {
          const x = (c - (row.length - 1) / 2) * (keyW + keyGap * 0.5);
          const y = keypadTop - keyH / 2 - r * (keyH + keyGap);
          const sub = KEY_CAPTION[key];
          return (
            <group
              key={`${r}-${c}`}
              position={[x, y, z]}
              // THE WHOLE KEY IS THE BUTTON. The press lives on the group, so a
              // press that lands on the key's outline or its number still counts
              // as a press of that key — never a click that falls through.
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
              <mesh>
                <planeGeometry args={[keyW * 0.86, keyH]} />
                <meshBasicMaterial color="#132030" toneMapped={false} transparent opacity={0.95} />
              </mesh>
              <lineSegments raycast={NO_PICK}>
                <edgesGeometry args={[new THREE.PlaneGeometry(keyW * 0.86, keyH)]} />
                <lineBasicMaterial color={glow} toneMapped={false} transparent opacity={0.55} />
              </lineSegments>
              <Label
                position={[0, 0, 0.004]}
                spec={
                  sub
                    ? {
                        text: key,
                        w: keyW * 0.86,
                        h: keyH,
                        size: 0.5,
                        weight: 700,
                        color: glow,
                        sub,
                        subColor: "#8fb3d9",
                      }
                    : { text: key, w: keyW * 0.86, h: keyH, size: 0.6, weight: 700, color: "#e6f2ff" }
                }
              />
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

    </group>
  );
};

export default DoorLockPanel;
