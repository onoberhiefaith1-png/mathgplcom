import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { getCaretAtPoint, getSelectionRects } from "troika-three-text";
import type { SelectionRect, TroikaTextRenderInfo } from "troika-three-text";
import * as THREE from "three";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextBounds, TextSettings } from "@/lib/slate/text3d";
import { FONTS, getSubstyle } from "@/lib/slate/text3d";
import { resolveTextStyle } from "@/lib/slate/textPresets";
import { PX_PER_UNIT } from "@/lib/slate/layout";
import type { InscribedTextApi } from "./InscribedText";
import { glyphBoxes } from "./glyphLayout";
import { ExtrudedExpression } from "./ExtrudedExpression";

interface Props {
  text: string;
  width: number;
  surface: SurfaceDef;
  settings: TextSettings;
  caret: number | null;
  selection: [number, number] | null;
  onMeasure: (bounds: TextBounds) => void;
  apiRef?: Ref<InscribedTextApi>;
  opacity?: number;
  /** Keep live entry lightweight; physical extrusion catches up after input settles. */
  responsive?: boolean;
}

type TroikaText = THREE.Object3D & { textRenderInfo?: TroikaTextRenderInfo | null };

/**
 * 3D Mathematical Text: Troika owns wrapping/editing while parsed font
 * outlines provide the physical bevel and extrusion behind the exact SDF face.
 */
export function DimensionalText({
  text,
  width,
  surface,
  settings,
  caret,
  selection,
  onMeasure,
  apiRef,
  opacity = 1,
  responsive = false,
}: Props) {
  const r = resolveTextStyle(surface, settings);
  const sub = getSubstyle(settings.substyle);
  const [info, setInfo] = useState<TroikaTextRenderInfo | null>(null);
  const measured = useRef({ width: 0, height: 0 });
  const caretMesh = useRef<THREE.Mesh>(null);
  const livingGroup = useRef<THREE.Group>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [settledText, setSettledText] = useState(text);

  const fontSize = settings.size / PX_PER_UNIT;
  const fade = opacity * Math.max(0, Math.min(1, settings.opacity));
  const dimensional = settings.style === "dimensional";
  // the writing style chooses the letterforms, the preset chooses the material
  const font = dimensional ? sub.font : FONTS[settings.style];
  // how far the letters stand off the surface
  const extrude = r.extrude * fontSize * (dimensional ? sub.extrude : 1);

  const onSync = useCallback(
    (obj: unknown) => {
      const render = (obj as TroikaText).textRenderInfo;
      if (!render) return;
      setInfo(render);
      const bounds = render.blockBounds;
      const width = Math.abs(bounds[2] - bounds[0]);
      const height = Math.abs(bounds[3] - bounds[1]);
      if (
        Math.abs(height - measured.current.height) > 0.004 ||
        Math.abs(width - measured.current.width) > 0.004
      ) {
        measured.current = { width, height };
        onMeasure({
          left: bounds[0],
          right: bounds[2],
          bottom: bounds[1],
          top: bounds[3],
          width,
          height,
        });
      }
    },
    [onMeasure],
  );

  useImperativeHandle(
    apiRef,
    () => ({
      indexAt: (x: number, y: number) => {
        if (!info) return text.length;
        const hit = getCaretAtPoint(info, x, y);
        return hit ? hit.charIndex : text.length;
      },
    }),
    [info, text.length],
  );

  useFrame(({ clock }, rawDelta) => {
    const node = caretMesh.current;
    if (node) node.visible = caret !== null && Math.floor(clock.elapsedTime * 1.6) % 2 === 0;
    const living = livingGroup.current;
    if (!living) return;
    const dt = Math.min(rawDelta, 0.05);
    const enabled = Boolean(settings.animate) && !reduceMotion;
    const duration = Math.max(4, settings.livingDuration ?? 7.5);
    const phase = (clock.elapsedTime * Math.PI * 2) / duration;
    const sizeGuard = THREE.MathUtils.clamp(140 / Math.max(140, settings.size), 0.45, 1);
    const angle = THREE.MathUtils.degToRad((settings.livingAngle ?? 4) * sizeGuard);
    const turn = enabled ? Math.sin(phase) * angle : 0;
    const drift = enabled ? Math.sin(phase) * (settings.livingDrift ?? 0.012) : 0;
    const lift = enabled ? (Math.cos(phase * 2) - 1) * (settings.livingLift ?? 0.008) * 0.5 : 0;
    const targetScale = enabled ? 1 + Math.sin(phase * 2) * (settings.livingScale ?? 0.008) : 1;
    living.rotation.y = THREE.MathUtils.damp(living.rotation.y, turn, 5, dt);
    living.position.x = THREE.MathUtils.damp(living.position.x, drift, 5, dt);
    living.position.y = THREE.MathUtils.damp(living.position.y, lift, 5, dt);
    const nextScale = THREE.MathUtils.damp(living.scale.x, targetScale, 5, dt);
    living.scale.setScalar(nextScale);
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!text) {
      measured.current = { width: 0, height: 0 };
      onMeasure({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
    }
  }, [text, onMeasure]);

  useEffect(() => {
    if (!responsive) {
      setSettledText(text);
      return;
    }
    const timer = window.setTimeout(() => setSettledText(text), 220);
    return () => window.clearTimeout(timer);
  }, [responsive, text]);

  const anchorX: "left" | "right" | "center" =
    settings.align === "left" ? "left" : settings.align === "right" ? "right" : "center";
  const originX = settings.align === "left" ? 0 : settings.align === "right" ? width : width / 2;

  const shared = {
    font,
    fontSize,
    maxWidth: width,
    lineHeight: settings.lineSpacing,
    letterSpacing: settings.letterSpacing,
    textAlign: settings.align,
    anchorX,
    anchorY: "top" as const,
    whiteSpace: "normal" as const,
    overflowWrap: "break-word" as const,
    sdfGlyphSize: settings.size > 120 ? 128 : 64,
  };

  const caretRect = (() => {
    if (caret === null || !info) return null;
    const c = info.caretPositions;
    if (!c || c.length === 0) return { x: 0, y: 0, h: fontSize };
    const i = Math.max(0, Math.min(caret, c.length / 4));
    const last = i >= c.length / 4;
    const base = last ? (c.length / 4 - 1) * 4 : i * 4;
    const x = last ? (c[base + 1] ?? 0) : (c[base] ?? 0);
    const bottom = c[base + 2] ?? 0;
    const top = c[base + 3] ?? fontSize;
    return { x, y: (bottom + top) / 2, h: Math.abs(top - bottom) };
  })();

  const rects: SelectionRect[] =
    selection && info && selection[0] !== selection[1]
      ? (getSelectionRects(info, Math.min(...selection), Math.max(...selection)) ?? [])
      : [];
  const boxes = useMemo(() => glyphBoxes(text, info), [text, info]);
  const extrusionSettled = !responsive || settledText === text;
  const bounds = info?.blockBounds;
  const pivotX = bounds ? (bounds[0] + bounds[2]) / 2 : width / 2;
  const pivotY = bounds ? (bounds[1] + bounds[3]) / 2 : -fontSize / 2;

  return (
    <group position={[originX, 0, 0]}>
      {/* Invisible layout authority: wrapping, measurement, caret and selection. */}
      <Text
        {...shared}
        color={r.face}
        fillOpacity={extrusionSettled ? 0 : fade}
        outlineOpacity={0}
        onSync={onSync}
      >
        {text}
      </Text>

      <group ref={livingGroup} position={[0, 0, 0]}>
      <group position={[pivotX, pivotY, 0]}>
      <group position={[-pivotX, -pivotY, 0]}>
      {extrusionSettled ? (
        <ExtrudedExpression boxes={boxes} fontUrl={font} fontSize={fontSize} style={r} opacity={fade} />
      ) : null}
      </group>
      </group>
      </group>

      {rects.map((rect, i) => (
        <mesh
          key={i}
          position={[
            (rect.left + rect.right) / 2,
            (rect.top + rect.bottom) / 2,
            extrude + 0.008,
          ]}
        >
          <planeGeometry
            args={[Math.max(0.004, rect.right - rect.left), Math.abs(rect.top - rect.bottom)]}
          />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {caretRect ? (
        <mesh ref={caretMesh} position={[caretRect.x, caretRect.y, extrude + 0.012]}>
          <planeGeometry args={[Math.max(0.006, fontSize * 0.07), caretRect.h]} />
          <meshBasicMaterial
            color={r.bevelHighlight}
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}
