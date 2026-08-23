// GeometryMapPanel — the teacher's authoring panel for the Geometry Map.
//
// The map is NOT an independent relationship generator: it is the theory
// pathway of the solution that was generated for this question. The teacher
// generates it from the solution, then curates it — reorder, hide, reword, and
// relink an item to the diagram by clicking the parts it applies to.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Eye, EyeOff, Link2, Loader2, Pencil, Plus,
  Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import {
  keepLiveIds, mapInventory, mapStatus, newMapItemId, objectChipLabel, pathway,
  removeMapItem, reorderMap, stripNumericAnswers, upsertMapItem,
  type GeometryMapDoc, type GeometryMapItem,
  autoColorObject,
  objectColor,
  setObjectColor,
  itemsForObject,
} from "@/lib/geometry/map/model";
import { onGeoPick } from "@/lib/geometry/pickBus";
import { generateGeometryMap } from "@/lib/geometry/map/geometryMap.functions";
import { MathText } from "@/lib/geometry/map/renderStatement";
import { ColoredMathText } from "@/lib/geometry/map/renderTokens";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { PropertyComposer, type ComposedProperty } from "./PropertyComposer";


interface Props {
  scene: GeometryScene;
  doc: GeometryMapDoc;
  onDocChange: (next: GeometryMapDoc) => void;
  /** Currently selected diagram object — the panel's relink target. */
  targetId: GeoId | null;
  onHighlight: (ids: GeoId[]) => void;
  /** The question and the solution this map is permanently bound to. */
  context: MapContext;
  /** Closes the workspace and puts the caret in this question's Solution. */
  onOpenSolution?: () => void;
  topic?: string;
}

export interface MapContext {
  questionId?: string | null;
  questionLabel?: string;
  question: string;
  solution: string;
  solutionHash?: string;
  hasSolution?: boolean;
}

export function GeometryMapPanel({
  scene, doc, onDocChange, targetId, onHighlight, context, onOpenSolution, topic,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [relinkId, setRelinkId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [onlyThisPart, setOnlyThisPart] = useState(true);
  const [showAi, setShowAi] = useState(false);

  const generate = useServerFn(generateGeometryMap);

  /** Teacher-authored property built by the visual composer. */
  const addComposed = (draft: ComposedProperty) => {
    const item: GeometryMapItem = {
      id: newMapItemId(),
      order: doc.items.length,
      principle: draft.reason || normalizeMathSource(draft.statement),
      relation: normalizeMathSource(draft.statement),
      explanation: draft.reason,
      usedTo: "",
      stepIndex: doc.items.length + 1,
      objectIds: keepLiveIds(scene, draft.objectIds),
      tokens: draft.tokens.filter((t) => keepLiveIds(scene, [t.objectId]).length > 0),
      ...(draft.boardText ? { boardText: draft.boardText } : {}),
      source: "teacher",
      enabled: true,
    };
    onDocChange(upsertMapItem(doc, item));
  };


  const items = useMemo(
    () => [...doc.items].sort((a, b) => a.order - b.order),
    [doc.items],
  );

  // Relink mode: every part the teacher clicks on the diagram is added to (or
  // removed from) the item being relinked. No typing of labels, ever.
  useEffect(() => {
    if (!relinkId) return;
    return onGeoPick((clicked) => {
      const item = doc.items.find((i) => i.id === relinkId);
      if (!item) return;
      const has = item.objectIds.includes(clicked);
      const nextIds = has
        ? item.objectIds.filter((x) => x !== clicked)
        : [...item.objectIds, clicked];
      onDocChange(upsertMapItem(doc, { ...item, objectIds: keepLiveIds(scene, nextIds) }));
      onHighlight(keepLiveIds(scene, nextIds));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relinkId, doc, scene]);

  const pick = (item: GeometryMapItem) => {
    const next = activeId === item.id ? null : item.id;
    setActiveId(next);
    onHighlight(next ? keepLiveIds(scene, item.objectIds) : []);
  };

  const runGenerate = async () => {
    // Pre-flight: say exactly what is missing rather than failing silently.
    if (scene.objects.length === 0) {
      toast.error("This diagram is empty — draw it in the lesson note first.");
      return;
    }
    if (!context.question.trim() && !context.questionId) {
      toast.error("This diagram is not under a question yet — give it a question heading first.");
      return;
    }
    if (!context.solution.trim()) {
      toast.error("This question has no saved solution yet — the map is derived from it.");
      return;
    }
    setBusy(true);
    try {
      const res = await generate({
        data: {
          question: context.question,
          solution: context.solution,
          topic: topic ?? "",
          objects: mapInventory(scene),
        },
      });
      const built: GeometryMapItem[] = (res.items ?? []).map((it, i) => ({
        id: newMapItemId(),
        order: i,
        principle: it.principle,
        relation: stripNumericAnswers(it.relation),
        explanation: stripNumericAnswers(it.explanation),
        usedTo: stripNumericAnswers(it.usedTo),
        stepIndex: it.stepIndex,
        ...(it.producesToken ? { producesToken: it.producesToken } : {}),
        ...(it.needsTokens?.length ? { needsTokens: it.needsTokens } : {}),
        objectIds: keepLiveIds(scene, it.objectIds),
        source: "ai" as const,
        enabled: true,
      }));
      if (built.length === 0) {
        toast.error("No principles could be read from this solution.");
        return;
      }
      // Teacher-authored items are kept; AI items are replaced by the new run.
      const keep = doc.items.filter((i) => i.source === "teacher");
      onDocChange({
        ...doc,
        generatedFromSolution: true,
        questionId: context.questionId ?? null,
        solutionHash: context.solutionHash ?? "",
        generatedAt: new Date().toISOString(),
        items: [...built, ...keep].map((it, i) => ({ ...it, order: i })),
      });
      toast.success(`Map built from the solution — ${built.length} principles.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Map generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const addManual = () => {
    const item: GeometryMapItem = {
      id: newMapItemId(),
      order: items.length,
      principle: "",
      relation: "",
      explanation: "",
      usedTo: "",
      stepIndex: items.length + 1,
      objectIds: targetId ? keepLiveIds(scene, [targetId]) : [],
      source: "teacher",
      enabled: true,
    };
    onDocChange(upsertMapItem(doc, item));
    setEditingId(item.id);
  };

  const shown = onlyThisPart && targetId
    ? itemsForObject(items, targetId)
    : items;

  const nodes = pathway(doc);
  const hasSolution = context.hasSolution ?? !!context.solution.trim();
  const status = mapStatus(doc, {
    questionId: context.questionId ?? null,
    solutionHash: context.solutionHash ?? "",
  });

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-2.5 text-[12px]">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Geometry map{context.questionLabel ? ` — ${context.questionLabel}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-foreground/60">
          Based on the saved solution for this question — one principle per step, linked to
          the diagram.
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Chip
            tone={hasSolution ? "ok" : "warn"}
            label={hasSolution ? "Solution: saved" : "Solution: none"}
          />
          <Chip
            tone={status === "ready" ? "ok" : status === "stale" ? "warn" : "muted"}
            label={
              status === "ready" ? "Map: ready"
                : status === "stale" ? "Map: out of date"
                : "Map: not generated"
            }
          />
        </div>
      </div>

      {status === "stale" && (
        <p className="rounded border border-amber-400/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
          The solution changed since this map was built. The steps below may no longer match —
          regenerate the map from the current solution.
        </p>
      )}

      {/* Teacher authoring comes first — the property builder, not the AI. */}
      <PropertyComposer
        scene={scene}
        targetId={relinkId ? null : targetId}
        onHighlight={onHighlight}
        onAdd={addComposed}
        colorOf={(id) => objectColor(doc, id)}
        onColor={(id, color) => onDocChange(setObjectColor(doc, id, color))}
        onAutoColor={(id) => {
          const next = autoColorObject(doc, id);
          if (next !== doc) onDocChange(next);
        }}
      />

      <button
        type="button"
        onClick={() => setShowAi((v) => !v)}
        className="self-start text-[11px] text-foreground/55 underline underline-offset-2"
      >
        {showAi ? "Hide AI helper" : "AI helper (optional)"}
      </button>


      {showAi && (
        <>
          <button
            type="button"
            onClick={runGenerate}
            disabled={busy || !hasSolution}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {status === "stale"
              ? "Regenerate map"
              : doc.items.length ? "Rebuild map from solution" : "Generate map from solution"}
          </button>

          {!hasSolution && (
            <div className="rounded border border-amber-400/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
              This question has no saved solution yet. The AI helper is always derived from the
              solution.
              {onOpenSolution && (
                <button
                  type="button"
                  onClick={onOpenSolution}
                  className="mt-1.5 block rounded border border-amber-500/50 px-2 py-1 text-[11px] font-medium hover:bg-amber-100"
                >
                  Open Solution
                </button>
              )}
            </div>
          )}
        </>
      )}



      <div className="flex items-center justify-between gap-2 rounded-md border border-foreground/15 px-2 py-1.5">
        <span className="text-[11.5px]">Show map to students</span>
        <button
          type="button"
          onClick={() => onDocChange({ ...doc, published: !doc.published })}
          className={`h-5 w-9 rounded-full transition-colors ${
            doc.published ? "bg-primary" : "bg-foreground/20"
          }`}
          aria-pressed={doc.published}
        >
          <span
            className={`block h-4 w-4 translate-y-[2px] rounded-full bg-white transition-transform ${
              doc.published ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>

      {targetId && (
        <label className="flex items-center gap-1.5 text-[11px] text-foreground/70">
          <input
            type="checkbox"
            checked={onlyThisPart}
            onChange={(e) => setOnlyThisPart(e.target.checked)}
          />
          Only items linked to {objectChipLabel(scene, targetId)}
        </label>
      )}

      <div className="space-y-1.5">
        {shown.length === 0 && (
          <p className="rounded border border-dashed border-foreground/20 px-2 py-3 text-center text-[11px] text-foreground/55">
            The map is empty. Generate it from the solution, or add a step yourself.
          </p>
        )}
        {shown.map((item, i) =>
          editingId === item.id ? (
            <ItemForm
              key={item.id}
              item={item}
              scene={scene}
              relinking={relinkId === item.id}
              onRelink={() => setRelinkId(relinkId === item.id ? null : item.id)}
              onSave={(next) => {
                onDocChange(upsertMapItem(doc, next));
                setEditingId(null);
                setRelinkId(null);
              }}
              onCancel={() => { setEditingId(null); setRelinkId(null); }}
            />
          ) : (
            <ItemRow
              key={item.id}
              index={i + 1}
              item={item}
              scene={scene}
              active={activeId === item.id}
              colorForObject={(oid) => objectColor(doc, oid)}
              onPick={() => pick(item)}
              onEdit={() => setEditingId(item.id)}
              onToggle={() => onDocChange(upsertMapItem(doc, { ...item, enabled: !item.enabled }))}
              onDelete={() => {
                onDocChange(removeMapItem(doc, item.id));
                if (activeId === item.id) { setActiveId(null); onHighlight([]); }
              }}
              onMove={(dir) => onDocChange(reorderMap(doc, item.id, dir))}
            />
          ),
        )}
      </div>

      <button
        type="button"
        onClick={addManual}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-foreground/20 px-2.5 py-1.5 text-[11.5px] hover:bg-foreground/[0.04]"
      >
        <Plus className="h-3.5 w-3.5" /> Add a step myself
      </button>

      {nodes.length > 0 && (
        <div className="rounded-md border border-foreground/15 p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            Pathway
          </p>
          <ol className="space-y-1">
            <li className="text-[11px] text-foreground/60">Given</li>
            {nodes.map((n) => (
              <li key={n.id} className="text-[11px] leading-snug">
                <span className="text-foreground/40">↓ </span>
                <span className="font-medium">
                  {n.principle ? <MathText value={n.principle} /> : "—"}
                </span>
                {n.produces && (
                  <span className="text-foreground/55"> → <MathText value={n.produces} /></span>
                )}
              </li>

            ))}
            <li className="text-[11px] text-foreground/60">↓ Answer</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  index, item, scene, active, onPick, onEdit, onToggle, onDelete, onMove,
  colorForObject,
}: {
  index: number;
  item: GeometryMapItem;
  /** Colour of a geometry object, by stable id — never by label text. */
  colorForObject?: (objectId: string) => string | undefined;
  scene: GeometryScene;
  active: boolean;
  onPick: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div
      className={`rounded-md border p-2 ${
        active ? "border-primary bg-primary/[0.07]" : "border-foreground/12 bg-background"
      } ${item.enabled ? "" : "opacity-55"}`}
    >
      <button type="button" onClick={onPick} className="block w-full text-left">
        <div className="flex items-start gap-1.5">
          <span className="mt-[1px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-foreground/10 text-[9.5px] font-semibold">
            {index}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-snug">
              {item.principle ? <MathText value={item.principle} /> : "Untitled principle"}
            </p>
            {item.relation && (
              <p className="text-[12px] leading-snug text-foreground/85">
                <ColoredMathText
                  value={item.relation}
                  tokens={[]}
                  colorForObject={colorForObject}
                />
              </p>
            )}

            {item.usedTo && (
              <p className="text-[10.5px] text-foreground/55">{item.usedTo}</p>
            )}
            {item.objectIds.length > 0 && (
              <p className="mt-0.5 flex flex-wrap gap-1">
                {item.objectIds.map((id) => (
                  <span
                    key={id}
                    className="rounded-full border border-foreground/20 px-1.5 py-[1px] text-[10px]"
                  >
                    {objectChipLabel(scene, id)}
                  </span>
                ))}
              </p>
            )}
            {item.objectIds.length === 0 && (
              <p className="mt-0.5 text-[10px] text-amber-700">Not linked to the diagram yet</p>
            )}
          </div>
          <span className="ml-auto flex-none rounded border border-foreground/15 px-1 text-[9px] uppercase text-foreground/50">
            {item.source}
          </span>
        </div>
      </button>
      <div className="mt-1.5 flex items-center gap-1">
        <IconBtn title={item.enabled ? "Hide from students" : "Show to students"} onClick={onToggle}>
          {item.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </IconBtn>
        <IconBtn title="Edit" onClick={onEdit}><Pencil className="h-3 w-3" /></IconBtn>
        <IconBtn title="Move up" onClick={() => onMove(-1)}><ArrowUp className="h-3 w-3" /></IconBtn>
        <IconBtn title="Move down" onClick={() => onMove(1)}><ArrowDown className="h-3 w-3" /></IconBtn>
        <IconBtn title="Delete" onClick={onDelete}><Trash2 className="h-3 w-3" /></IconBtn>
      </div>
    </div>
  );
}

function ItemForm({
  item, scene, relinking, onRelink, onSave, onCancel,
}: {
  item: GeometryMapItem;
  scene: GeometryScene;
  relinking: boolean;
  onRelink: () => void;
  onSave: (next: GeometryMapItem) => void;
  onCancel: () => void;
}) {
  const [principle, setPrinciple] = useState(item.principle);
  const [relation, setRelation] = useState(item.relation);
  const [usedTo, setUsedTo] = useState(item.usedTo);
  const [explanation, setExplanation] = useState(item.explanation);

  return (
    <div className="space-y-1.5 rounded-md border border-primary/50 bg-primary/[0.04] p-2">
      <Field label="Principle" value={principle} onChange={setPrinciple} placeholder="Cosine Rule" />
      <Field label="Relationship" value={relation} onChange={setRelation} placeholder="∠ABC = ∠ADC" />
      <Field label="Used to" value={usedTo} onChange={setUsedTo} placeholder="Used to find BC" />
      <Field label="Theory" value={explanation} onChange={setExplanation} placeholder="Angles in the same segment are equal." />

      <div className="flex flex-wrap items-center gap-1">
        {item.objectIds.map((id) => (
          <span key={id} className="rounded-full border border-foreground/25 px-1.5 py-[1px] text-[10px]">
            {objectChipLabel(scene, id)}
          </span>
        ))}
        <button
          type="button"
          onClick={onRelink}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] ${
            relinking ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25"
          }`}
        >
          <Link2 className="h-3 w-3" />
          {relinking ? "Click parts on the diagram · Done" : "Link to diagram"}
        </button>
      </div>

      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() =>
            onSave({
              ...item,
              principle: principle.trim(),
              relation: normalizeMathSource(stripNumericAnswers(relation)),
              usedTo: stripNumericAnswers(usedTo),
              explanation: stripNumericAnswers(explanation),
            })
          }
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
        >
          <Check className="h-3 w-3" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded border border-foreground/20 px-2 py-1 text-[11px]"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded border border-foreground/20 bg-background px-1.5 py-1 text-[12px]"
      />
    </label>
  );
}

function IconBtn({
  title, onClick, children,
}: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded border border-foreground/15 text-foreground/70 hover:bg-foreground/[0.06]"
    >
      {children}
    </button>
  );
}

export default GeometryMapPanel;

function Chip({ tone, label }: { tone: "ok" | "warn" | "muted"; label: string }) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-50 text-amber-800"
        : "border-foreground/20 bg-foreground/[0.04] text-foreground/60";
  return (
    <span className={`rounded-full border px-1.5 py-[1px] text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
