import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { getCaretAtPoint, getSelectionRects } from "troika-three-text";
import type { SelectionRect, TroikaTextRenderInfo } from "troika-three-text";
import * as THREE from "three";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextSettings } from "@/lib/slate/text3d";
import { integrationFactor, textRecipe } from "@/lib/slate/text3d";
import { PX_PER_UNIT } from "@/lib/slate/layout";

export interface InscribedTextApi {
  /** Local surface coordinates -> character index. */
  indexAt: (x: number, y: number) => number;
}

interface Props {
  text: string;
  /** Writable width in world units. */
  width: number;
  surface: SurfaceDef;
  settings: TextSettings;
  /** Caret character index, or null when this region is not being written in. */
  caret: number | null;
  selection: [number, number] | null;
  /** Reports the rendered block height in world units. */
  onMeasure: (height: number) => void;
  apiRef?: Ref<InscribedTextApi>;
  /** Dimming for concealed pre-authored content. */
  opacity?: number;
}

type TroikaText = THREE.Object3D & { textRenderInfo?: TroikaTextRenderInfo | null };

/**
 * The mathematics itself: live SDF glyphs inscribed into the material.
 *
 * Depth comes from stacked passes rather than one extruded mesh — a dark pass
 * sunk into the cut, the lit lip on the opposite edge, and the body on top.
 * Short lines get extra stacked passes so raising Text Depth reads as real
 * thickness without paying for extruded geometry on a long document.
 */
export function InscribedText({
  text,
  width,
  surface,
  settings,
  caret,
  selection,
  onMeasure,
  apiRef,
  opacity = 1,
}: Props) {
  const recipe = textRecipe(surface, settings);
  const main = useRef<TroikaText>(null);
  const caretMesh = useRef<THREE.Mesh>(null);
  const [info, setInfo] = useState<TroikaTextRenderInfo | null>(null);
  const measured = useRef(0);

  const fontSize = settings.size / PX_PER_UNIT;
  // how strongly the letters read as cut into the material
  const bind = integrationFactor(settings.integration);
  const cut = 0.055 * fontSize * Math.max(0.15, settings.depth) * bind;
  const lip = 0.05 * fontSize * Math.max(0.15, settings.bevel) * bind;
  const dir = recipe.sunk ? 1 : -1; // sunk letters catch light on the lower edge
  const short = text.length <= 90;
  const layers = short ? recipe.layers : Math.min(2, recipe.layers);
  const fade = opacity * Math.max(0, Math.min(1, settings.opacity));

  const onSync = useCallback(
    (obj: unknown) => {
      const render = (obj as TroikaText).textRenderInfo;
      if (!render) return;
      setInfo(render);
      const bounds = render.blockBounds;
      const height = Math.abs(bounds[3] - bounds[1]);
      if (Math.abs(height - measured.current) > 0.004) {
        measured.current = height;
        onMeasure(height);
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

  // blink, driven off the render loop so it stays in the 3D world
  useFrame(({ clock }) => {
    const node = caretMesh.current;
    if (node) node.visible = caret !== null && Math.floor(clock.elapsedTime * 1.6) % 2 === 0;
  });

  useEffect(() => {
    if (!text) {
      measured.current = 0;
      onMeasure(0);
    }
  }, [text, onMeasure]);

  const anchorX: "left" | "right" | "center" =
    settings.align === "left" ? "left" : settings.align === "right" ? "right" : "center";
  const originX = settings.align === "left" ? 0 : settings.align === "right" ? width : width / 2;

  const shared = {
    font: recipe.font,
    fontSize,
    maxWidth: width,
    lineHeight: settings.lineSpacing,
    letterSpacing: settings.letterSpacing,
    textAlign: settings.align,
    anchorX,
    anchorY: "top" as const,
    whiteSpace: "normal" as const,
    overflowWrap: "break-word" as const,
    sdfGlyphSize: 64,
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

  return (
    <group position={[originX, 0, 0]}>
      {/* selection band, physically sitting in the recess */}
      {rects.map((r, i) => (
        <mesh
          key={i}
          position={[(r.left + r.right) / 2, (r.top + r.bottom) / 2, -0.004]}
          renderOrder={2}
        >
          <planeGeometry args={[Math.max(0.004, r.right - r.left), Math.abs(r.top - r.bottom)]} />
          <meshBasicMaterial
            color={recipe.lip}
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* soft contact occlusion hugging every glyph, so the letters sit *in*
          the material instead of hovering over it */}
      <Text
        {...shared}
        position={[0, 0, -0.007]}
        color={recipe.shade}
        fillOpacity={0.34 * bind * fade}
        outlineWidth={fontSize * 0.035 * bind}
        outlineBlur={fontSize * 0.11}
        outlineColor={recipe.shade}
        outlineOpacity={0.5 * bind * fade}
        renderOrder={2}
      >
        {text}
      </Text>

      {/* shadow sunk into the cut */}
      {settings.shadow ? (
        <Text
          {...shared}
          position={[0, dir * cut * 1.4, -0.006]}
          color={recipe.shade}
          fillOpacity={Math.min(1, 0.85 * settings.shadowStrength) * fade}
          renderOrder={3}
        >
          {text}
        </Text>
      ) : null}

      {/* stacked passes give the cut its thickness */}
      {Array.from({ length: layers }, (_, i) => (
        <Text
          key={i}
          {...shared}
          position={[0, dir * cut * (0.3 + i * 0.22), -0.005 + i * 0.0004]}
          color={recipe.shade}
          fillOpacity={0.55 * fade}
          renderOrder={4 + i}
        >
          {text}
        </Text>
      ))}

      {/* lit lip on the opposite edge */}
      <Text
        {...shared}
        position={[0, -dir * lip, -0.0035]}
        color={recipe.lip}
        fillOpacity={Math.min(1, 0.7 * settings.highlight) * fade}
        renderOrder={12}
      >
        {text}
      </Text>

      {/* the letter body: the chosen colour exactly, unlit and untonemapped so
          #000000 is black and a picked red is that red */}
      <Text ref={main} {...shared} position={[0, 0, -0.002]} onSync={onSync} renderOrder={14}>
        {text}
        <meshBasicMaterial color={recipe.ink} transparent opacity={fade} toneMapped={false} />
      </Text>

      {/* a light touch of the real material on top, so the letters still react
          to the room without shifting the chosen colour */}
      <Text {...shared} position={[0, 0, -0.0018]} renderOrder={15}>
        {text}
        <meshStandardMaterial
          color={recipe.ink}
          roughness={recipe.roughness}
          metalness={recipe.metalness}
          emissive={new THREE.Color(recipe.emissive)}
          emissiveIntensity={recipe.emissiveIntensity}
          transparent
          opacity={0.28 * fade}
        />
      </Text>

      {/* restrained luminous edge for the magical style */}
      {recipe.glow && recipe.glowOpacity > 0 ? (
        <Text
          {...shared}
          position={[0, 0, -0.0012]}
          color={recipe.glow}
          fillOpacity={recipe.glowOpacity * fade}
          outlineWidth={fontSize * 0.05}
          outlineBlur={fontSize * 0.16}
          outlineColor={recipe.glow}
          outlineOpacity={recipe.glowOpacity * 0.8 * fade}
          renderOrder={16}
        >
          {text}
        </Text>
      ) : null}

      {/* the caret belongs to the surface, not to the browser */}
      {caretRect ? (
        <mesh
          ref={caretMesh}
          position={[caretRect.x, caretRect.y, 0.001]}
          renderOrder={17}
        >
          <planeGeometry args={[Math.max(0.006, fontSize * 0.06), caretRect.h]} />
          <meshBasicMaterial color={recipe.lip} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
