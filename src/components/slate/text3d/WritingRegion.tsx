import { useCallback, useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { GameTestDisplay } from "@/lib/slate/types";
import type { RegionTextData, TextBounds, TextSettings } from "@/lib/slate/text3d";
import {
  PX_PER_UNIT,
  TEXT_INSIDE_TOLERANCE,
  containTextInSurface,
  surfaceInnerBox,
  textInsideSurface,
} from "@/lib/slate/layout";
import type { InscribedTextApi } from "./InscribedText";
import { InscribedText } from "./InscribedText";
import { TileText } from "./TileText";
import { DimensionalText } from "./DimensionalText";
import { visibleTestRenderer } from "./displayMode";
import type { GameMathLine } from "@/lib/slate/structuredMath";
import { StructuredMathText } from "./StructuredMathText";

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
  testDisplay?: GameTestDisplay;
  editable: boolean;
  active: boolean;
  placeholder?: string | undefined;
  onChange: (text: string) => void;
  onActivate: () => void;
  onMeasure: (bounds: TextBounds) => void;
  onReport?: (data: RegionTextData) => void;
  structuredMath?: GameMathLine;
  structuredNote?: string;
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
  testDisplay = "threeD",
  editable,
  active,
  placeholder,
  onChange,
  onActivate,
  onMeasure,
  onReport,
  structuredMath,
  structuredNote,
}: Props) {
  const api = useRef<InscribedTextApi>(null);
  // The selector changes visibility only: the same hidden input, text state,
  // caret, measurement and report path stay alive for both implementations.
  const visibleRenderer = visibleTestRenderer(testDisplay, settings.style);
  const surfaceTest = visibleRenderer === "surface";
  const RaisedRenderer = visibleRenderer === "tiles" ? TileText : DimensionalText;
  const input = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const dragging = useRef(false);
  const anchor = useRef(0);
  const measuredBounds = useRef<TextBounds>({
    left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0,
  });
  /** Live correction that keeps the text body inside its own surface. */
  const [shift, setShift] = useState({ x: 0, y: 0 });

  const top = height / 2 - pad;
  const left = -width / 2;

  // A fresh body (new question, new line, new text size, new surface) starts
  // from the surface's own geometry, never from an earlier correction.
  useEffect(() => {
    setShift({ x: 0, y: 0 });
  }, [slotId, text, settings.size, settings.align, surface.id, width, height]);

  const syncFromInput = useCallback(() => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    setCaret(end);
    setSelection(start === end ? null : [start, end]);
  }, []);

  // TYPING INTEGRITY.
  //
  // The 3D board is heavy, so a fully controlled field could be re-rendered
  // with a value from an earlier keystroke; the field then reverted and the
  // next key composed on top of stale text, silently dropping characters.
  // The field now owns the keystrokes and is only re-synced when the text
  // changes from outside (another line, a reset, Floating Numbers).
  const emitted = useRef(text);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    if (text === emitted.current) return;
    emitted.current = text;
    if (el.value !== text) el.value = text;
  }, [text]);


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
        ? api.current.indexAt(local.x - (left + shift.x), local.y - (top + shift.y))
        : text.length;
      if (!extend) anchor.current = index;
      const start = Math.min(anchor.current, index);
      const end = Math.max(anchor.current, index);
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, end);
      setCaret(index);
      setSelection(start === end ? null : [start, end]);
    },
    [left, shift.x, shift.y, top],
  );

  const report = useCallback(
    (bounds: TextBounds) => {
      const originX = settings.align === "left" ? 0 : settings.align === "right" ? width : width / 2;
      const placed = {
        left: left + originX + bounds.left + shift.x,
        right: left + originX + bounds.right + shift.x,
        top: top + bounds.top + shift.y,
        bottom: top + bounds.bottom + shift.y,
        width: bounds.width,
        height: bounds.height,
      };
      measuredBounds.current = placed;
      // TEXT-IN-SURFACE. The surface is the boundary: a body that reports
      // itself outside is corrected to the nearest valid place inside, every
      // time it is created, loaded, reopened or played.
      //
      // Raised letters stand above the typographic box (ascenders, bevel and
      // extrusion), so the body is inflated a little before it is compared
      // with the surface. That keeps the physical glyph inside the material.
      const relief = Math.max(0.02, placed.height * 0.2);
      const body = {
        left: placed.left,
        right: placed.right,
        top: placed.top + relief,
        bottom: placed.bottom,
      };
      const inner = surfaceInnerBox(width, height, pad);
      if (!textInsideSurface(body, inner)) {
        const { dx, dy } = containTextInSurface(body, inner);
        if (Math.abs(dx) > TEXT_INSIDE_TOLERANCE || Math.abs(dy) > TEXT_INSIDE_TOLERANCE) {
          setShift((previous) => ({ x: previous.x + dx, y: previous.y + dy }));
        }
      }
      onMeasure(placed);
      onReport?.({
        slotId,
        text,
        lines: text.split("\n"),
        cursorPosition: caret ?? 0,
        selection,
        position: { x: left + shift.x, y: top + shift.y, z },
        width,
        height: placed.height,
        material: surface.id,
        style: settings.style,
      });
    },
    [caret, height, left, onMeasure, onReport, pad, selection, settings.align, settings.style, shift.x, shift.y, slotId, surface.id, text, top, width, z],
  );

  const show = text || (!editable ? "" : "");

  return (
    <group>
      {/* the writing bed itself takes the click and resolves it to a caret */}
      <mesh
        position={[0, 0, z + 0.002]}
        onPointerDown={(event) => {
          if (!editable) {
            // Game Play: the surface is written by Floating Numbers, but
            // touching it still makes its own Game Line the active one.
            event.stopPropagation();
            onActivate();
            return;
          }
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
        <planeGeometry args={[width, Math.max(0.2, height - pad * 2)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group position={[left + shift.x, top + shift.y, z + 0.004]}>
        {!structuredMath ? (
          surfaceTest ? (
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
          ) : (
            <RaisedRenderer
              apiRef={api}
              text={show}
              width={width}
              surface={surface}
              settings={settings}
              caret={active ? caret : null}
              selection={active ? selection : null}
              onMeasure={report}
              responsive={active}
            />
          )
        ) : (
          <StructuredMathText
            math={structuredMath}
            note={structuredNote}
            width={width}
            surface={surface}
            settings={settings}
            onMeasure={report}
          />
        )}
        {!structuredMath && !text && placeholder ? (
          surfaceTest ? (
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
          ) : (
            <RaisedRenderer
              text={placeholder}
              width={width}
              surface={surface}
              settings={settings}
              caret={null}
              selection={null}
              onMeasure={() => {}}
              opacity={0.22}
            />
          )
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
            defaultValue={text}
            spellCheck={false}
            onChange={(e) => {
              emitted.current = e.target.value;
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
              fontSize: Math.min(64, settings.size),
              lineHeight: settings.lineSpacing,
            }}
          />
        </Html>
      ) : null}
    </group>
  );
}
