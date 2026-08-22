// PropertyComposer — the teacher's visual builder for one geometry property.
//
// The teacher never types object labels. Clicking a part of the SAME diagram
// drops a chip bound to that object's stable id; the keypad drops real
// mathematical operators between the chips. The result is one relationship
// statement plus its reason, linked to every object it mentions.

import { useEffect, useRef, useState } from "react";
import { Check, Hand, RotateCcw, Trash2 } from "lucide-react";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import { objectChipLabel } from "@/lib/geometry/map/model";

/** One piece of the statement: a diagram-bound chip, or a typed symbol. */
export interface ComposerToken {
  key: string;
  text: string;
  objectId?: GeoId;
}

const OPERATORS = [
  "=", "+", "−", "×", "÷", "(", ")", "/",
  "∠", "°", "√", "²", "π", "∥", "⊥", "≅", "~", "≠", "<", ">", "½",
  "x", "y", "θ", "r", "sin", "cos", "tan", "180°", "90°", "360°",
];

let seq = 0;
const nextKey = () => `t${++seq}_${Math.random().toString(36).slice(2, 6)}`;

export function PropertyComposer({
  scene, targetId, onHighlight, onAdd,
}: {
  scene: GeometryScene;
  /** Currently selected diagram object — becomes a chip while picking. */
  targetId: GeoId | null;
  onHighlight: (ids: GeoId[]) => void;
  onAdd: (draft: { statement: string; reason: string; objectIds: GeoId[] }) => void;
}) {
  const [tokens, setTokens] = useState<ComposerToken[]>([]);
  const [reason, setReason] = useState("");
  const [picking, setPicking] = useState(true);
  const lastPicked = useRef<GeoId | null>(null);

  // Pick mode: every part clicked on the diagram becomes a chip.
  useEffect(() => {
    if (!picking || !targetId) return;
    if (lastPicked.current === targetId) return;
    lastPicked.current = targetId;
    setTokens((t) => [
      ...t,
      { key: nextKey(), text: objectChipLabel(scene, targetId), objectId: targetId },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, picking]);

  // Live highlight of everything the statement references.
  const objectIds = [...new Set(tokens.map((t) => t.objectId).filter(Boolean))] as GeoId[];
  useEffect(() => {
    onHighlight(objectIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectIds.join(",")]);

  const statement = tokens.map((t) => t.text).join(" ").replace(/\s+([)°²])/g, "$1").trim();

  const add = () => {
    if (!statement) return;
    onAdd({ statement, reason: reason.trim(), objectIds });
    setTokens([]);
    setReason("");
    lastPicked.current = null;
  };

  return (
    <div className="rounded-md border border-primary/40 bg-primary/[0.04] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">
          Teacher edit · build a property
        </p>
        <button
          type="button"
          onClick={() => { setPicking((p) => !p); lastPicked.current = null; }}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] ${
            picking ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25"
          }`}
        >
          <Hand className="h-3 w-3" /> {picking ? "Picking from diagram" : "Pick from diagram"}
        </button>
      </div>

      {/* The statement being built */}
      <div className="mt-1.5 min-h-[34px] flex flex-wrap items-center gap-1 rounded border border-foreground/20 bg-background px-1.5 py-1">
        {tokens.length === 0 && (
          <span className="text-[11px] text-foreground/45">
            Click a point, line, angle or area on the diagram, then add an operator.
          </span>
        )}
        {tokens.map((t) => (
          <button
            key={t.key}
            type="button"
            title="Remove"
            onClick={() => setTokens((list) => list.filter((x) => x.key !== t.key))}
            className={`rounded px-1.5 py-[1px] text-[12px] ${
              t.objectId
                ? "border border-primary/45 bg-primary/10 font-medium"
                : "text-foreground/85"
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>

      {/* Operator / symbol keypad */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {OPERATORS.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => setTokens((t) => [...t, { key: nextKey(), text: op }])}
            className="rounded border border-foreground/20 bg-background px-1.5 py-[2px] text-[11.5px] hover:bg-foreground/[0.06]"
          >
            {op}
          </button>
        ))}
      </div>

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
          onClick={() => setTokens((t) => t.slice(0, -1))}
          className="inline-flex items-center gap-1 rounded border border-foreground/20 px-2 py-1 text-[11px]"
        >
          <RotateCcw className="h-3 w-3" /> Undo
        </button>
        <button
          type="button"
          onClick={() => { setTokens([]); setReason(""); lastPicked.current = null; onHighlight([]); }}
          className="inline-flex items-center gap-1 rounded border border-foreground/20 px-2 py-1 text-[11px]"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>
    </div>
  );
}

export default PropertyComposer;
