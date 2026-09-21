import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { getCaretAtPoint, getSelectionRects } from "troika-three-text";
import type { SelectionRect, TroikaTextRenderInfo } from "troika-three-text";
import * as THREE from "three";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextBounds, TextSettings } from "@/lib/slate/text3d";
import { FONTS, TILE_PALETTE, classifyGlyph, textRecipe } from "@/lib/slate/text3d";
import { PX_PER_UNIT } from "@/lib/slate/layout";
import { glyphBoxes, glyphBoxesInsideWidth } from "./glyphLayout";
import type { GlyphBox } from "./glyphLayout";
import type { InscribedTextApi } from "./InscribedText";

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
  /** Keep live entry lightweight; physical tiles catch up after input settles. */
  responsive?: boolean;
}

type TroikaText = THREE.Object3D & { textRenderInfo?: TroikaTextRenderInfo | null };

const SPRING = 12;

/** One mathematical object as a physical game tile. */
function Tile({
  box,
  depth,
  font,
  fade,
  bounds,
}: {
  box: GlyphBox;
  depth: number;
  font: string;
  fade: number;
  bounds: { w: number; h: number };
}) {
  const group = useRef<THREE.Group>(null);
  const palette = TILE_PALETTE[classifyGlyph(box.char)];
  const target = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const grabbed = useRef(false);
  const grabStart = useRef(new THREE.Vector3());
  const offsetStart = useRef(new THREE.Vector3());
  const born = useRef(0);
  const [pressed, setPressed] = useState(false);

  const size = Math.max(box.w, box.h * 0.72) * 1.02;
  const tileH = box.h * 0.94;

  useFrame((_, raw) => {
    const node = group.current;
    if (!node) return;
    const dt = Math.min(raw, 0.05);
    // appear with a small bounce, then settle
    born.current = Math.min(1, born.current + dt * 3.4);
    const t = born.current;
    const pop = 1 + Math.sin(t * Math.PI) * 0.22 * (1 - t * 0.35);
    const press = pressed ? 0.9 : 1;
    const scale = t < 1 ? t * pop * press : press;
    node.scale.setScalar(THREE.MathUtils.damp(node.scale.x, scale, 14, dt));

    if (!grabbed.current) {
      // spring home when let go outside the writing area
      offset.current.lerp(target.current, 1 - Math.exp(-SPRING * dt));
    }
    node.position.set(
      box.x + offset.current.x,
      box.y + offset.current.y,
      depth / 2 + offset.current.z,
    );
    node.rotation.z = THREE.MathUtils.damp(node.rotation.z, grabbed.current ? 0.05 : 0, 10, dt);
  });

  const onDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
    grabbed.current = true;
    setPressed(true);
    grabStart.current.copy(event.point);
    offsetStart.current.copy(offset.current);
  };

  const onMove = (event: ThreeEvent<PointerEvent>) => {
    if (!grabbed.current) return;
    event.stopPropagation();
    const delta = event.point.clone().sub(grabStart.current);
    offset.current.set(
      offsetStart.current.x + delta.x,
      offsetStart.current.y + delta.y,
      0.04,
    );
  };

  const onUp = (event: ThreeEvent<PointerEvent>) => {
    if (!grabbed.current) return;
    event.stopPropagation();
    grabbed.current = false;
    setPressed(false);
    const x = box.x + offset.current.x;
    const y = box.y + offset.current.y;
    const inside = x > -0.2 && x < bounds.w + 0.2 && y < 0.2 && y > -bounds.h - 0.2;
    // dropped outside the writing area: it returns to its place in the line
    target.current.set(inside ? offset.current.x : 0, inside ? offset.current.y : 0, 0);
    if (!inside) offset.current.z = 0;
  };

  return (
    <group
      ref={group}
      position={[box.x, box.y, depth / 2]}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOut={onUp}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
      }}
    >
      <RoundedBox args={[size, tileH, depth]} radius={Math.min(size, tileH) * 0.22} smoothness={3}>
        <meshStandardMaterial
          color={palette.face}
          roughness={0.28}
          metalness={0.08}
          transparent={fade < 1}
          opacity={fade}
        />
      </RoundedBox>
      {/* darker bevel ring so the tile reads as a physical piece */}
      <mesh position={[0, -tileH * 0.02, depth / 2 + 0.001]}>
        <planeGeometry args={[size * 0.96, tileH * 0.9]} />
        <meshBasicMaterial color={palette.edge} transparent opacity={0.18 * fade} depthWrite={false} />
      </mesh>
      {/* glossy highlight */}
      <mesh position={[0, tileH * 0.22, depth / 2 + 0.002]}>
        <planeGeometry args={[size * 0.82, tileH * 0.3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16 * fade} depthWrite={false} />
      </mesh>
      <Text
        font={font}
        fontSize={tileH * 0.64}
        color={palette.symbol}
        anchorX="center"
        anchorY="middle"
        position={[0, 0, depth / 2 + 0.004]}
        fillOpacity={fade}
        sdfGlyphSize={64}
      >
        {box.char}
      </Text>
      {/* soft contact shadow under the tile */}
      <mesh position={[0, -tileH * 0.06, -depth / 2 - 0.002]}>
        <planeGeometry args={[size * 1.1, tileH * 1.1]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28 * fade} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Mathematical Game Tiles: every typed character becomes its own physical
 * tile. Layout, caret and selection still come from the same troika pass the
 * inscription renderer uses, so typing, wrapping and growth are unchanged.
 */
export function TileText({
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
  const recipe = textRecipe(surface, settings);
  const [info, setInfo] = useState<TroikaTextRenderInfo | null>(null);
  const measured = useRef({ width: 0, height: 0 });
  const caretMesh = useRef<THREE.Mesh>(null);
  const [settledText, setSettledText] = useState(text);

  const fontSize = settings.size / PX_PER_UNIT;
  const fade = opacity * Math.max(0, Math.min(1, settings.opacity));
  const depth = Math.max(0.012, fontSize * 0.22 * Math.max(0.3, settings.depth));

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

  useFrame(({ clock }) => {
    const node = caretMesh.current;
    if (node) node.visible = caret !== null && Math.floor(clock.elapsedTime * 1.6) % 2 === 0;
  });

  // Tiles are decoration scheduled on idle time; the readable text underneath
  // is drawn immediately and never removed.
  useEffect(() => {
    if (!responsive) {
      setSettledText(text);
      return;
    }
    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    });
    if (idle.requestIdleCallback) {
      const handle = idle.requestIdleCallback(() => setSettledText(text), { timeout: 400 });
      return () => idle.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setSettledText(text), 180);
    return () => window.clearTimeout(timer);
  }, [responsive, text]);

  const boxes = useMemo(() => glyphBoxes(text, info), [text, info]);
  const tilesSettled = !responsive || settledText === text;
  const drawTiles = tilesSettled && glyphBoxesInsideWidth(boxes, width, settings.align);


  const anchorX: "left" | "right" | "center" =
    settings.align === "left" ? "left" : settings.align === "right" ? "right" : "center";
  const originX = settings.align === "left" ? 0 : settings.align === "right" ? width : width / 2;

  const rects: SelectionRect[] =
    selection && info && selection[0] !== selection[1]
      ? (getSelectionRects(info, Math.min(...selection), Math.max(...selection)) ?? [])
      : [];

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

  const blockH = info ? Math.abs(info.blockBounds[3] - info.blockBounds[1]) : fontSize;

  return (
    <group position={[originX, 0, 0]}>
      {/* readable text first; the physical tiles are laid on top of it */}
      <Text
        font={FONTS.tiles}
        fontSize={fontSize}
        maxWidth={width}
        lineHeight={settings.lineSpacing}
        letterSpacing={settings.letterSpacing}
        textAlign={settings.align}
        anchorX={anchorX}
        anchorY="top"
        whiteSpace="normal"
        overflowWrap="break-word"
        sdfGlyphSize={64}
        color={recipe.ink}
        fillOpacity={fade}

        onSync={onSync}
      >
        {text}
      </Text>

      {rects.map((r, i) => (
        <mesh key={i} position={[(r.left + r.right) / 2, (r.top + r.bottom) / 2, depth + 0.006]}>
          <planeGeometry args={[Math.max(0.004, r.right - r.left), Math.abs(r.top - r.bottom)]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {drawTiles ? boxes.map((box) => (
        <Tile
          key={box.index}
          box={box}
          depth={depth}
          font={FONTS.tiles}
          fade={fade}
          bounds={{ w: width, h: blockH }}
        />
      )) : null}

      {caretRect ? (
        <mesh ref={caretMesh} position={[caretRect.x, caretRect.y, depth + 0.01]}>
          <planeGeometry args={[Math.max(0.006, fontSize * 0.07), caretRect.h]} />
          <meshBasicMaterial color={recipe.lip} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
