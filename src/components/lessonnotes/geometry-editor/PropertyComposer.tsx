// PropertyComposer — the teacher's builder for one geometry property.
//
// There is NO on-screen mathematical keyboard. The teacher types with the
// keyboard of the device, inside the SAME live mathematics editor the lesson
// note lines and Smart Table cells use, so every established shortcut applies
// (`/` fraction, `#` power, `##` index, auto-pairing brackets, `@` assets).
//
// Two extra ways to land content at the caret:
//   • Pick from diagram — clicking a part of the SAME diagram inserts that
//     object's reference and records its stable id.
//   • Add function     — inserts a mathematical structure (root, fraction,
//     power, index, brackets, sin/cos/tan, angle, degree) at the caret.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Hand, RotateCcw, Trash2 } from "lucide-react";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import { objectChipLabel, OBJECT_COLORS } from "@/lib/geometry/map/model";
import { onGeoPick } from "@/lib/geometry/pickBus";
import { MathInlineCanvas } from "@/components/lessonnotes/extensions/MathInlineCanvas";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import {
  mkBracket, mkFrac, mkSqrt, mkSub, mkSup,
  type Node as MathNode, type Row as MathRow,
} from "@/lib/smartboard/mathTree";

/** Add-function menu: structures land at the caret, text lands as characters. */
const FUNCTIONS: { label: string; node?: () => MathNode; text?: string }[] = [
  { label: "Square root  √", node: () => mkSqrt() },
  { label: "nth root  ⁿ√", node: () => mkSqrt(true) },
  { label: "Fraction  a/b", node: () => mkFrac() },
  { label: "Power  x²", node: () => mkSup() },
  { label: "Index  x₁", node: () => mkSub() },
  { label: "Parentheses ( )", node: () => mkBracket("(", ")") },
  { label: "Absolute | |", node: () => mkBracket("|", "|") },
  { label: "Angle  ∠", text: "∠" },
  { label: "Degree  °", text: "°" },
  { label: "sin", text: "sin" },
  { label: "cos", text: "cos" },
  { label: "tan", text: "tan" },
];

export interface ComposedProperty {
  statement: string;
  reason: string;
  objectIds: GeoId[];
  /** Text → object id bindings: the link lives on the id, not the wording. */
  tokens: { token: string; objectId: GeoId }[];
  /** Optional wording to show on the Smartboard instead of the relation. */
  boardText?: string;
}

export function PropertyComposer({
  scene, targetId, onHighlight, onAdd, colorOf, onColor, onAutoColor,
}: {
  scene: GeometryScene;
  /** Currently selected diagram object — inserted while picking. */
  targetId: GeoId | null;
  onHighlight: (ids: GeoId[]) => void;
  onAdd: (draft: ComposedProperty) => void;
  /** Review colour currently stored for a diagram object. */
  colorOf?: (id: GeoId) => string | undefined;
  /** Paint the selected diagram object (colour belongs to the object). */
  onColor?: (id: GeoId, color: string | null) => void;
  /**
   * A newly referenced object takes the next colour of the automatic sequence
   * (Red → Blue → Yellow → …). Objects already coloured keep their colour, and
   * a manual choice never resets the sequence.
   */
  onAutoColor?: (id: GeoId) => void;
}) {
  const [root, setRoot] = useState<MathRow>([]);
  const [reason, setReason] = useState("");
  const [boardText, setBoardText] = useState("");
  const [picking, setPicking] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [insertRequest, setInsertRequest] =
    useState<{ nonce: number; node?: MathNode; text?: string } | null>(null);
  const nonce = useRef(0);

  const request = (req: { node?: MathNode; text?: string }) => {
    nonce.current += 1;
    setInsertRequest({ nonce: nonce.current, ...req });
  };

  // Pick mode: EVERY click on the diagram inserts a geometry-reference BOX at
  // the caret — including a repeat click on the part that is already selected,
  // so the sensor never goes quiet. The box carries the object's id; the text
  // it shows is only a label the teacher may freely edit.
  useEffect(() => {
    if (!picking) return;
    return onGeoPick((id) => {
      onAutoColor?.(id);
      request({ node: mkGeoRef(id, objectChipLabel(scene, id)) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking, scene]);

  const statement = useMemo(() => {
    try { return normalizeMathSource(treeToLatex(root)).trim(); } catch { return ""; }
  }, [root]);

  /** Links come from the boxes still present in the tree — not from wording. */
  const tokens = useMemo(
    () =>
      collectGeoRefs(root).map((r) => ({
        token: r.label,
        objectId: r.objectId as GeoId,
      })),
    [root],
  );
  const objectIds = useMemo(
    () => [...new Set(tokens.map((t) => t.objectId))],
    [tokens],
  );

  // Live highlight of everything the statement references.
  useEffect(() => {
    onHighlight(objectIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectIds.join(",")]);


  const reset = () => {
    setRoot([]);
    setRefs([]);
    setReason("");
    setBoardText("");
  };

  const add = () => {
    if (!statement) return;
    onAdd({
      statement,
      reason: reason.trim(),
      objectIds,
      tokens,
      ...(boardText.trim() ? { boardText: boardText.trim() } : {}),
    });
    reset();
  };

  return (
    <div className="rounded-md border border-primary/40 bg-primary/[0.04] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">
          Teacher edit · build a property
        </p>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] ${
            picking ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25"
          }`}
        >
          <Hand className="h-3 w-3" /> {picking ? "Picking from diagram" : "Pick from diagram"}
        </button>
      </div>

      {/* The live mathematics editor — device keyboard + platform shortcuts */}
      <div
        className="mt-1.5 min-h-[34px] rounded border border-foreground/25 bg-background px-1.5 py-1 text-[14px] text-foreground"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MathInlineCanvas
          root={root}
          onChange={setRoot}
          onBlur={() => { /* stay open; Add property commits */ }}
          focused
          onFocus={() => { /* already focused */ }}
          insertRequest={insertRequest}
        />
      </div>
      {root.length === 0 && (
        <p className="mt-1 text-[11px] text-foreground/50">
          Type with your keyboard: <span className="font-medium">/</span> fraction,{" "}
          <span className="font-medium">#</span> power, <span className="font-medium">##</span> index.
          Click a part of the diagram to insert it.
        </p>
      )}

      {/* Add function */}
      <div className="relative mt-1.5">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded border border-foreground/25 bg-background px-2 py-1 text-[11.5px]"
        >
          Add function <ChevronDown className="h-3 w-3" />
        </button>
        {menuOpen && (
          <div className="absolute z-30 mt-1 max-h-56 w-48 overflow-auto rounded-md border border-foreground/20 bg-background p-1 shadow-lg">
            {FUNCTIONS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  request(f.node ? { node: f.node() } : { text: f.text });
                  setMenuOpen(false);
                }}
                className="block w-full rounded px-2 py-1 text-left text-[12px] hover:bg-foreground/[0.07]"
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {targetId && onColor && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            Colour {objectChipLabel(scene, targetId)}
          </span>
          {OBJECT_COLORS.map((c) => {
            const on = colorOf?.(targetId) === c.value;
            return (
              <button
                key={c.value}
                type="button"
                title={c.name}
                aria-label={`Colour ${c.name}`}
                onClick={() => onColor(targetId, on ? null : c.value)}
                className={`h-4 w-4 rounded-full border ${on ? "ring-2 ring-primary ring-offset-1" : "border-foreground/25"}`}
                style={{ background: c.value }}
              />
            );
          })}
        </div>
      )}

      <label className="mt-1.5 block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Text on the Smartboard (optional)
        </span>
        <input
          value={boardText}
          onChange={(e) => setBoardText(e.target.value)}
          placeholder="Wording students should read"
          className="mt-0.5 w-full rounded border border-foreground/20 bg-background px-1.5 py-1 text-[12px]"
        />
      </label>

      <label className="mt-1.5 block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Reason / name
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Angles in the same segment are equal"
          className="mt-0.5 w-full rounded border border-foreground/20 bg-background px-1.5 py-1 text-[12px]"
        />
      </label>

      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={add}
          disabled={!statement}
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> Add property
        </button>
        <button
          type="button"
          onClick={() => setRoot((r) => r.slice(0, -1))}
          className="inline-flex items-center gap-1 rounded border border-foreground/20 px-2 py-1 text-[11px]"
        >
          <RotateCcw className="h-3 w-3" /> Undo
        </button>
        <button
          type="button"
          onClick={() => { reset(); onHighlight([]); }}
          className="inline-flex items-center gap-1 rounded border border-foreground/20 px-2 py-1 text-[11px]"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>
    </div>
  );
}

export default PropertyComposer;
