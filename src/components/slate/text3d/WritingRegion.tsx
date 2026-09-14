import { useCallback, useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { RegionTextData, TextSettings } from "@/lib/slate/text3d";
import { PX_PER_UNIT } from "@/lib/slate/layout";
import { InscribedText } from "./InscribedText";
import type { InscribedTextApi } from "./InscribedText";

interface Props {
  slotId: string;
  text: string;
  /** Writable width in world units. */
  width: number;
  /** Current region height in world units. */
  height: number;
  /** Top inset of the writing bed. */
  pad: number;
  /** Z of the writing bed inside the carved recess. */
  z: number;
  surface: SurfaceDef;
  settings: TextSettings;
  editable: boolean;
  active: boolean;
  placeholder?: string | undefined;
  onChange: (text: string) => void;
  onActivate: () => void;
  onMeasure: (height: number) => void;
  onReport?: (data: RegionTextData) => void;
}

/**
 * One independent writing area.
 *
 * The visible mathematics is 3D inscription on the material. A fully
 * transparent textarea, sitting behind the scene's pointer handling, exists
 * only so the operating system gives us reliable keys, IME, selection,
 * undo/redo and paste. Clicks are resolved by raycasting the surface and
 * converting the hit point into a character index.
 */
export function WritingRegion({
  slotId,
  text,
  width,
  height,
  pad,
  z,
  surface,
  settings,
  editable,
  active,
  placeholder,
  onChange,
  onActivate,
  onMeasure,
  onReport,
}: Props) {
  const api = useRef<InscribedTextApi>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const dragging = useRef(false);
  const anchor = useRef(0);
  const measuredHeight = useRef(0);

  const top = height / 2 - pad;
  const left = -width / 2;

  const syncFromInput = useCallback(() => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    setCaret(end);
    setSelection(start === end ? null : [start, end]);
  }, []);

  useEffect(() => {
    if (!active) {
      setCaret(null);
      setSelection(null);
      return;
    }
    // the browser hands focus back to the canvas after a click, so claim it
    // again on the next frames
    let frames = 0;
    const claim = () => {
      const el = input.current;
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
      if (++frames < 4) raf = requestAnimationFrame(claim);
    };
    let raf = requestAnimationFrame(claim);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const place = useCallback(
    (event: ThreeEvent<PointerEvent>, extend: boolean) => {
      const el = input.current;
      if (!el) return;
      // screen -> camera -> surface -> local text space -> character index
      const local = event.object.worldToLocal(event.point.clone());
      const index = api.current
        ? api.current.indexAt(local.x - left, local.y - top)
        : text.length;
      if (!extend) anchor.current = index;
      const start = Math.min(anchor.current, index);
      const end = Math.max(anchor.current, index);
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, end);
      setCaret(index);
      setSelection(start === end ? null : [start, end]);
    },
    [left, top],
  );

  const report = useCallback(
    (h: number) => {
      measuredHeight.current = h;
      onMeasure(h);
      onReport?.({
        slotId,
        text,
        lines: text.split("\n"),
        cursorPosition: caret ?? 0,
        selection,
        position: { x: left, y: top, z },
        width,
        height: h,
        material: surface.id,
        style: settings.style,
      });
    },
    [caret, height, left, onMeasure, onReport, selection, settings.style, slotId, surface.id, text, top, width, z],
  );

  const show = text || (!editable ? "" : "");

  return (
    <group>
      {/* the writing bed itself takes the click and resolves it to a caret */}
      <mesh
        position={[0, 0, z + 0.002]}
        onPointerDown={(event) => {
          if (!editable) return;
          event.stopPropagation();
          dragging.current = true;
          onActivate();
          place(event, false);
        }}
        onPointerMove={(event) => {
          if (!editable || !dragging.current) return;
          place(event, true);
        }}
        onPointerUp={() => {
          dragging.current = false;
          const el = input.current;
          if (editable && el) requestAnimationFrame(() => el.focus({ preventScroll: true }));
        }}
        onPointerOver={() => {
          if (editable) document.body.style.cursor = "text";
        }}
        onPointerOut={() => {
          if (editable) document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[width, Math.max(0.2, height - pad)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group position={[left, top, z + 0.004]}>
        <InscribedText
          apiRef={api}
          text={show}
          width={width}
          surface={surface}
          settings={settings}
          caret={active ? caret : null}
          selection={active ? selection : null}
          onMeasure={report}
        />
        {!text && placeholder ? (
          <InscribedText
            text={placeholder}
            width={width}
            surface={surface}
            settings={settings}
            caret={null}
            selection={null}
            onMeasure={() => {}}
            opacity={0.22}
          />
        ) : null}
      </group>

      {/* invisible keyboard surface — never seen, never clicked directly */}
      {editable ? (
        <Html
          transform
          position={[left, top, z + 0.001]}
          scale={40 / PX_PER_UNIT}
          zIndexRange={[4, 0]}
          pointerEvents="none"
          style={{ pointerEvents: "none" }}
        >
          <textarea
            ref={input}
            value={text}
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
              requestAnimationFrame(syncFromInput);
            }}
            onKeyUp={syncFromInput}
            onSelect={syncFromInput}
            onFocus={syncFromInput}
            onBlur={() => setSelection(null)}
            style={{
              width: Math.round(width * PX_PER_UNIT),
              height: Math.round(Math.max(0.3, height) * PX_PER_UNIT),
              opacity: 0,
              pointerEvents: "none",
              resize: "none",
              border: 0,
              outline: "none",
              background: "transparent",
              color: "transparent",
              caretColor: "transparent",
              fontSize: settings.size,
              lineHeight: settings.lineSpacing,
            }}
          />
        </Html>
      ) : null}
    </group>
  );
}
