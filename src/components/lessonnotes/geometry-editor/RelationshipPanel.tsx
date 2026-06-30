// Right-hand panel listing every mathematical relationship attached to
// the current selection. White / black / yellow theme. Empty by default;
// activates when the teacher selects something in the diagram. Each
// relationship is editable, pinable, hideable, duplicable, and deletable.
// The AI Edit button opens a side editor for the *relationships* — it
// does NOT touch the diagram.

import { useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, Sparkles, RefreshCw, Pin, PinOff,
  Eye, EyeOff, Copy as CopyIcon, Trash2, Pencil, Check, X,
} from "lucide-react";
import { useSmartGeometry } from "./SmartGeometryContext";
import { derivedFor } from "@/lib/geometry/smart/evaluate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RelationshipEditorSheet } from "./RelationshipEditorSheet";
import { genId, type Relationship } from "@/lib/geometry/smart/relationships";
import type { GeometryScene } from "@/lib/geometry/scene";

interface Props {
  scene: GeometryScene;
  topic?: string;
  onApply: (next: GeometryScene) => void;
}

export function RelationshipPanel({ scene, topic }: Props) {
  const {
    selectedParts, mode, setMode, graph,
    relationships, upsertRelationship, removeRelationship,
    togglePinned, toggleHidden, duplicateRelationship, replaceRelationships,
    clearSelection,
  } = useSmartGeometry();
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Relationship> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Conditional visibility — the panel is invisible until the teacher
  // selects at least one object inside the diagram. Selecting more
  // objects updates the panel; pressing "Clear" hides it again.
  if (selectedParts.length === 0) return null;

  const empty = selectedParts.length === 0;
  const visible = useMemo(() => relationships.filter((r) => !r.hidden), [relationships]);

  const beginEdit = (r: Relationship) => {
    setEditingId(r.id);
    setDraft({ name: r.name, formula: r.formula, applied: r.applied, explanation: r.explanation });
  };
  const saveEdit = (r: Relationship) => {
    if (!draft) return;
    upsertRelationship({
      ...r,
      name: draft.name ?? r.name,
      formula: draft.formula ?? r.formula,
      applied: draft.applied,
      explanation: draft.explanation ?? r.explanation,
      source: r.source === "library" ? "teacher" : r.source,
      confidence: r.source === "library" ? "teacher" : r.confidence,
    });
    setEditingId(null);
    setDraft(null);
  };

  const onRegenerate = () => {
    // Drop AI-only / library suggestions; keep teacher-authored and pinned.
    const keep = relationships.filter((r) => r.source === "teacher" || r.pinned);
    replaceRelationships(keep);
  };

  return (
    <>
      <aside
        data-smart-relationship-panel="true"
        contentEditable={false}
        className="w-72 shrink-0 border border-black/10 bg-white text-black px-3 py-3 text-sm rounded-md shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold tracking-wide text-black uppercase">Relationships</h4>
          <div className="inline-flex rounded-md overflow-hidden border border-black/15 text-[11px]">
            <button
              type="button"
              onClick={() => setMode("relation")}
              className={cn("px-2 py-0.5 transition", mode === "relation" ? "bg-yellow-400 text-black" : "bg-white text-black hover:bg-yellow-50")}
            >Generic</button>
            <button
              type="button"
              onClick={() => setMode("apply")}
              className={cn("px-2 py-0.5 transition", mode === "apply" ? "bg-yellow-400 text-black" : "bg-white text-black hover:bg-yellow-50")}
            >Apply</button>
          </div>
        </div>

        {empty ? (
          <div className="rounded-md border border-dashed border-black/15 bg-white px-3 py-6 text-center">
            <p className="text-xs text-black/60 leading-relaxed">
              Select an object in the diagram to view its mathematical relationships.
            </p>
          </div>
        ) : (
          <>
            {/* Selection chips */}
            <div className="mb-2 flex flex-wrap gap-1">
              {selectedParts.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-yellow-100 text-black border border-yellow-300">
                  {p.label}
                </span>
              ))}
            </div>

            {/* Derived values for single selection */}
            {selectedParts.length === 1 && derivedFor(selectedParts[0], graph).length > 0 && (
              <div className="mb-3 rounded-md border border-black/10 bg-white px-2 py-1.5 text-[11px]">
                {derivedFor(selectedParts[0], graph).map((d) => (
                  <div key={d.label} className="flex justify-between gap-2">
                    <span className="text-black/60">{d.label}</span>
                    <span className="font-mono text-black">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-1 mb-2">
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-black/15 bg-white text-black hover:bg-yellow-50"
                title="Regenerate AI suggestions (keeps teacher-authored & pinned items)"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-yellow-400 text-black hover:bg-yellow-300"
              >
                <Sparkles className="h-3 w-3" /> AI Edit
              </button>
            </div>

            {/* Relationships list */}
            <div className="space-y-1.5">
              {visible.length === 0 && (
                <p className="text-xs text-black/50 italic px-1">No relationships yet — try “AI Edit”.</p>
              )}
              {visible.map((r) => {
                const open = openIds[r.id] ?? false;
                const isEditing = editingId === r.id;
                const display = mode === "apply" && r.applied ? r.applied : r.formula;
                return (
                  <Collapsible key={r.id} open={open} onOpenChange={(v) => setOpenIds((p) => ({ ...p, [r.id]: v }))}>
                    <div className={cn(
                      "rounded-md border bg-white",
                      r.pinned ? "border-yellow-400" : "border-black/10",
                    )}>
                      <div className="flex items-start gap-1 px-2 py-1.5">
                        <CollapsibleTrigger asChild>
                          <button type="button" className="mt-0.5 shrink-0 text-black/60 hover:text-black">
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </CollapsibleTrigger>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={draft?.name ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...(d ?? {}), name: e.target.value }))}
                              className="h-6 text-[12px] px-1 bg-white text-black border-black/15 focus-visible:ring-yellow-400"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-semibold text-black">{r.name}</span>
                              <ConfidenceBadge level={r.confidence} source={r.source} />
                            </div>
                          )}
                          {isEditing ? (
                            <Input
                              value={(mode === "apply" ? draft?.applied : draft?.formula) ?? ""}
                              onChange={(e) => setDraft((d) => ({
                                ...(d ?? {}),
                                [mode === "apply" ? "applied" : "formula"]: e.target.value,
                              } as Partial<Relationship>))}
                              className="h-6 mt-0.5 text-[11px] font-mono px-1 bg-white text-black border-black/15 focus-visible:ring-yellow-400"
                              placeholder={mode === "apply" ? "Substituted form" : "Generic formula"}
                            />
                          ) : (
                            <div className="text-[11px] font-mono text-black/80">{display || <em className="text-black/40">no formula</em>}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isEditing ? (
                            <>
                              <IconBtn title="Save" onClick={() => saveEdit(r)}><Check className="h-3 w-3" /></IconBtn>
                              <IconBtn title="Cancel" onClick={() => { setEditingId(null); setDraft(null); }}><X className="h-3 w-3" /></IconBtn>
                            </>
                          ) : (
                            <>
                              <IconBtn title={r.pinned ? "Unpin" : "Pin"} onClick={() => togglePinned(r.id)}>
                                {r.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                              </IconBtn>
                              <IconBtn title="Edit" onClick={() => beginEdit(r)}><Pencil className="h-3 w-3" /></IconBtn>
                              <IconBtn title="Duplicate" onClick={() => duplicateRelationship(r.id)}><CopyIcon className="h-3 w-3" /></IconBtn>
                              <IconBtn title="Hide" onClick={() => toggleHidden(r.id)}>
                                {r.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                              </IconBtn>
                              <IconBtn title="Delete" onClick={() => removeRelationship(r.id)}><Trash2 className="h-3 w-3" /></IconBtn>
                            </>
                          )}
                        </div>
                      </div>
                      <CollapsibleContent className="px-2 pb-2 text-[11px] text-black/70">
                        {isEditing ? (
                          <Textarea
                            value={draft?.explanation ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), explanation: e.target.value }))}
                            className="min-h-[60px] text-[11px] bg-white text-black border-black/15 focus-visible:ring-yellow-400"
                            placeholder="Explanation"
                          />
                        ) : (
                          <p>{r.explanation}</p>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>

            {/* Quick add */}
            <button
              type="button"
              onClick={() => {
                const r: Relationship = {
                  id: genId(),
                  name: "New relationship",
                  formula: "",
                  explanation: "",
                  confidence: "teacher",
                  source: "teacher",
                };
                upsertRelationship(r);
                beginEdit(r);
              }}
              className="mt-3 w-full text-[11px] px-2 py-1.5 rounded-md border border-dashed border-black/20 text-black/70 hover:bg-yellow-50 hover:border-yellow-400"
            >
              + Add relationship manually
            </button>
          </>
        )}
      </aside>

      <RelationshipEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        scene={scene}
        topic={topic}
        selectedParts={selectedParts}
        existing={relationships}
        onMerge={(chosen) => {
          for (const r of chosen) upsertRelationship(r);
        }}
      />
    </>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center h-5 w-5 rounded text-black/60 hover:text-black hover:bg-yellow-100"
    >
      {children}
    </button>
  );
}

function ConfidenceBadge({ level, source }: { level: Relationship["confidence"]; source: Relationship["source"] }) {
  const effective: "high" | "medium" | "teacher" =
    source === "teacher" ? "teacher" : level;
  const map = {
    high: { label: "High", dot: "bg-green-500", border: "border-green-300", bg: "bg-green-50" },
    medium: { label: "Possible", dot: "bg-yellow-500", border: "border-yellow-300", bg: "bg-yellow-50" },
    teacher: { label: "Teacher", dot: "bg-blue-500", border: "border-blue-300", bg: "bg-blue-50" },
  } as const;
  const c = map[effective];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border", c.border, c.bg, "text-black/70")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
