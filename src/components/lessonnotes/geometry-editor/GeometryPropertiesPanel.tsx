// GeometryPropertiesPanel — the authoring control centre for the teacher.
//
// The diagram is the navigation system: whatever the teacher clicks on the
// live canvas becomes the selected target here. Relationships are always
// stored against diagram object IDs, so renaming a label never breaks them.

import { useEffect, useMemo, useState } from "react";
import {
  Check, Eye, Loader2, Pencil, Plus, Sparkles, Trash2, X,
  ChevronUp, ChevronDown, Link2, AlertTriangle,
} from "lucide-react";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import {
  PROPERTY_KINDS,
  VIRTUAL_KINDS,
  angleNameFromRefs,
  connectionsOf,
  describeObject,
  describeTarget,
  detectTokens,
  newPropertyId,
  newVirtualId,
  validateProperties,
  type GeometryPropertiesDoc,
  type GeometryPropertyItem,
  type PropertyCategory,
  type PropertyKind,
  type VirtualKind,
  type VirtualObject,
} from "@/lib/geometry/properties/model";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  scene: GeometryScene;
  doc: GeometryPropertiesDoc;
  onDocChange: (next: GeometryPropertiesDoc) => void;
  /** Currently selected diagram object (from the live canvas). */
  targetId: GeoId | null;
  /** Halo painted on the diagram (preview / editing feedback). */
  onHighlight: (ids: GeoId[]) => void;
  /** Reports the selected object's display name to the workspace header. */
  onTargetName?: (name: string | null) => void;
  /** Pick mode: while true, canvas clicks toggle connections. */
  connecting: boolean;
  setConnecting: (b: boolean) => void;
}

export function GeometryPropertiesPanel({
  scene, doc, onDocChange, targetId, onHighlight, onTargetName, connecting, setConnecting,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftKind, setDraftKind] = useState<PropertyKind>("statement");
  const [busy, setBusy] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  /** Symbol waiting to be bound to the next object the teacher clicks. */
  const [bindToken, setBindToken] = useState<string | null>(null);
  /** A teacher-defined part (∠ABC, a distance, an unknown) held as the target. */
  const [activeVirtualId, setActiveVirtualId] = useState<GeoId | null>(null);
  /** Defining a new part: collecting the diagram objects it is made of. */
  const [defining, setDefining] = useState<{ kind: VirtualKind; refIds: GeoId[]; name: string } | null>(null);

  const virtuals = doc.virtuals ?? [];
  const target = describeTarget(scene, doc, activeVirtualId ?? targetId);

  // A canvas click always means "work on this drawn object" — unless the
  // teacher is defining a part or wiring connections.
  useEffect(() => {
    if (!targetId || defining || connecting || bindToken) return;
    setActiveVirtualId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  // While defining, each canvas click adds (or removes) a piece of the part.
  useEffect(() => {
    if (!defining || !targetId) return;
    const base = targetId.split("#")[0];
    setDefining((cur) => {
      if (!cur) return cur;
      const refIds = cur.refIds.includes(base)
        ? cur.refIds.filter((x) => x !== base)
        : [...cur.refIds, base];
      const name = cur.kind === "angle" ? angleNameFromRefs(scene, refIds) : cur.name;
      return { ...cur, refIds, name };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  useEffect(() => {
    onHighlight(defining ? defining.refIds : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defining?.refIds.join(",")]);

  const startDefining = (kind: VirtualKind) => {
    setEditingId(null);
    setConnecting(false);
    setActiveVirtualId(null);
    setDefining({
      kind,
      refIds: targetId ? [targetId.split("#")[0]] : [],
      name: kind === "unknown" ? "x" : VIRTUAL_KINDS.find((k) => k.value === kind)?.label ?? "Part",
    });
  };

  const saveDefinition = () => {
    if (!defining) return;
    if (defining.refIds.length === 0) {
      toast.error("Click the diagram parts this belongs to first.");
      return;
    }
    const virtual: VirtualObject = {
      id: newVirtualId(),
      kind: defining.kind,
      name: defining.name.trim() || "Part",
      refIds: defining.refIds,
    };
    onDocChange({ ...doc, virtuals: [...virtuals, virtual] });
    setDefining(null);
    setActiveVirtualId(virtual.id);
  };

  const removeVirtual = (id: GeoId) => {
    onDocChange({
      ...doc,
      virtuals: virtuals.filter((v) => v.id !== id),
      items: doc.items.filter((i) => !i.sourceObjectIds.includes(id)),
    });
    if (activeVirtualId === id) setActiveVirtualId(null);
  };

  useEffect(() => {
    onTargetName?.(target ? `${target.typeLabel} ${target.name}` : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, target?.name, target?.typeLabel]);

  const issues = useMemo(() => validateProperties(scene, doc), [scene, doc]);

  const items = useMemo(() => {
    if (!target) return [];
    return doc.items
      .filter(
        (i) =>
          i.sourceObjectIds.includes(target.id) ||
          i.connectedObjectIds.includes(target.id),
      )
      .sort((a, b) => a.order - b.order);
  }, [doc, target]);

  const editing = items.find((i) => i.id === editingId) ?? null;

  // Editing an item shows its connections on the diagram.
  useEffect(() => {
    if (editing) onHighlight(connectionsOf(editing));
    else if (!connecting) onHighlight([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, editing?.connectedObjectIds.join(","), connecting]);

  const write = (next: GeometryPropertyItem[]) =>
    onDocChange({ ...doc, items: next });

  const upsert = (item: GeometryPropertyItem) => {
    const idx = doc.items.findIndex((i) => i.id === item.id);
    const next = [...doc.items];
    if (idx >= 0) next[idx] = item;
    else next.push(item);
    write(next);
  };

  const remove = (id: string) => {
    write(doc.items.filter((i) => i.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const move = (item: GeometryPropertyItem, dir: -1 | 1) => {
    const sameGroup = doc.items
      .filter((i) => i.category === item.category)
      .sort((a, b) => a.order - b.order);
    const i = sameGroup.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= sameGroup.length) return;
    const a = sameGroup[i], b = sameGroup[j];
    write(
      doc.items.map((x) =>
        x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x,
      ),
    );
  };

  const startAdd = (category: PropertyCategory) => {
    if (!target) return;
    const item: GeometryPropertyItem = {
      id: newPropertyId(),
      category,
      kind: category === "general" ? "theorem" : "statement",
      content: "",
      sourceObjectIds: [target.id],
      connectedObjectIds: [target.id],
      approved: true,
      enabled: true,
      order: doc.items.length,
    };
    upsert(item);
    setEditingId(item.id);
    setDraftText("");
    setDraftKind(item.kind);
  };

  const openEdit = (item: GeometryPropertyItem) => {
    setEditingId(item.id);
    setDraftText(item.content);
    setDraftKind(item.kind);
  };

  const saveEdit = () => {
    if (!editing) return;
    const content = draftText.trim();
    if (!content) {
      remove(editing.id);
      return;
    }
    upsert({ ...editing, content, kind: draftKind, approved: true, aiGenerated: editing.aiGenerated });
    setEditingId(null);
    setConnecting(false);
  };

  /* ── connection mode: canvas clicks land here via targetId ── */
  useEffect(() => {
    if (!editing || !targetId) return;
    const base = targetId.split("#")[0];
    if (bindToken) {
      const rest = (editing.tokens ?? []).filter((t) => t.token !== bindToken);
      upsert({
        ...editing,
        tokens: [...rest, { token: bindToken, objectId: base }],
      });
      setBindToken(null);
      return;
    }
    if (!connecting) return;
    const has = editing.connectedObjectIds.includes(base);
    upsert({
      ...editing,
      connectedObjectIds: has
        ? editing.connectedObjectIds.filter((x) => x !== base)
        : [...editing.connectedObjectIds, base],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, connecting, bindToken]);

  const aiSuggest = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("relationship-ai", {
        body: {
          mode: "properties",
          scene,
          target: { id: target.id, type: target.type, name: target.name },
          objects: scene.objects.map((o) => {
            const d = describeObject(scene, o.id);
            return { id: o.id, type: o.type, name: d?.name };
          }),
          topic: scene.meta?.topic ?? "",
        },
      });
      if (error) throw error;
      const list = (data?.relationships ?? []) as Array<{
        content?: string; name?: string; formula?: string; applied?: string;
        category?: string; kind?: string; connectedObjectIds?: string[];
      }>;
      if (list.length === 0) {
        toast.info("No suggestions for this object.");
        return;
      }
      const alive = new Set(scene.objects.map((o) => o.id));
      const drafts: GeometryPropertyItem[] = list.slice(0, 8).map((r, i) => ({
        id: newPropertyId(),
        category: (r.category === "specific" ? "specific" : "general") as PropertyCategory,
        kind: (PROPERTY_KINDS.some((k) => k.value === r.kind) ? r.kind : "theorem") as PropertyKind,
        content: (r.content || r.applied || r.formula || r.name || "").trim(),
        sourceObjectIds: [target.id],
        connectedObjectIds: [
          ...new Set(
            [target.id, ...(r.connectedObjectIds ?? []).filter((x) => alive.has(x))],
          ),
        ],
        aiGenerated: true,
        approved: false,
        enabled: true,
        order: doc.items.length + i,
      })).filter((d) => d.content.length > 0);
      write([...doc.items, ...drafts]);
      toast.success(`${drafts.length} suggestion${drafts.length === 1 ? "" : "s"} — review and approve`);
    } catch (e) {
      toast.error("AI suggestions are unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  const group = (category: PropertyCategory) => items.filter((i) => i.category === category);

  return (
    <div className="space-y-2.5 text-foreground">
      {/* Selected object */}
      <div className="rounded-lg border border-foreground/15 bg-foreground/[0.03] p-2">
        <p className="text-[10px] uppercase tracking-wider text-foreground/50">Selected</p>
        {target ? (
          <>
            <p className="text-sm font-semibold leading-tight">{target.name}</p>
            <p className="text-[11px] text-foreground/60">{target.typeLabel}</p>
          </>
        ) : (
          <p className="text-[11px] text-foreground/60">
            Click any object on the diagram to author its relationships.
          </p>
        )}
      </div>

      {/* Parts of the diagram the teacher wants to talk about. Nothing is drawn:
          a part only references the real objects it is made of. */}
      <div className="rounded-lg border border-foreground/15 p-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-foreground/50">
          Define a part
        </p>
        {defining ? (
          <div className="space-y-1.5">
            <p className="text-[10.5px] text-foreground/70">
              {VIRTUAL_KINDS.find((k) => k.value === defining.kind)?.hint} — click them on the
              diagram.
            </p>
            <div className="flex flex-wrap gap-1">
              {defining.refIds.length === 0 ? (
                <span className="text-[10.5px] text-foreground/45">Nothing picked yet</span>
              ) : (
                defining.refIds.map((id) => (
                  <span key={id} className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10.5px]">
                    {describeTarget(scene, doc, id)?.name ?? id}
                  </span>
                ))
              )}
            </div>
            <input
              value={defining.name}
              onChange={(e) => setDefining((c) => (c ? { ...c, name: e.target.value } : c))}
              placeholder="Name (e.g. ∠ABC, x, θ)"
              className="w-full rounded border border-foreground/20 bg-transparent px-1.5 py-1 text-[11px]"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={saveDefinition}
                className="flex-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
              >
                Save part
              </button>
              <button
                type="button"
                onClick={() => setDefining(null)}
                className="rounded border border-foreground/20 px-2 py-1 text-[11px] hover:bg-foreground/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {VIRTUAL_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => startDefining(k.value)}
                className="rounded border border-foreground/20 px-1.5 py-0.5 text-[10.5px] hover:bg-foreground/5"
                title={k.hint}
              >
                <Plus className="mr-0.5 inline h-3 w-3" />{k.label}
              </button>
            ))}
          </div>
        )}
        {virtuals.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-foreground/10 pt-1.5">
            {virtuals.map((v) => (
              <span
                key={v.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px]",
                  activeVirtualId === v.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/20 hover:bg-foreground/5",
                )}
              >
                <button type="button" onClick={() => setActiveVirtualId(v.id)}>{v.name}</button>
                <button
                  type="button"
                  onClick={() => removeVirtual(v.id)}
                  title="Delete this part"
                  aria-label="Delete this part"
                >
                  <X className="h-2.5 w-2.5 opacity-70" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {target && (
        <>
          <Group
            title="Specific"
            hint="Applies to this question / diagram"
            items={group("specific")}
          >
            <AddButton onClick={() => startAdd("specific")} />
          </Group>
          {group("specific").map((item) => (
            <ItemCard
              key={item.id}
              scene={scene}
              item={item}
              editing={editingId === item.id}
              draftText={draftText}
              draftKind={draftKind}
              connecting={connecting && editingId === item.id}
              onDraftText={setDraftText}
              onDraftKind={setDraftKind}
              onOpenEdit={() => openEdit(item)}
              onSave={saveEdit}
              onCancel={() => { setEditingId(null); setConnecting(false); }}
              onRemove={() => remove(item.id)}
              onToggleCategory={() =>
                upsert({ ...item, category: item.category === "specific" ? "general" : "specific" })
              }
              onToggleEnabled={() => upsert({ ...item, enabled: item.enabled === false })}
              onApprove={() => upsert({ ...item, approved: true })}
              onMove={(d) => move(item, d)}
              onPreview={() => onHighlight(connectionsOf(item))}
              onToggleConnecting={() => {
                if (editingId !== item.id) openEdit(item);
                setConnecting(!(connecting && editingId === item.id));
              }}
              bindToken={editingId === item.id ? bindToken : null}
              onBindToken={(t) => {
                if (editingId !== item.id) openEdit(item);
                setBindToken((cur) => (cur === t ? null : t));
              }}
              onUnbindToken={(t) =>
                upsert({ ...item, tokens: (item.tokens ?? []).filter((x) => x.token !== t) })
              }
              onRemoveConnection={(id) =>
                upsert({
                  ...item,
                  connectedObjectIds: item.connectedObjectIds.filter((x) => x !== id),
                })
              }
            />
          ))}

          <Group
            title="General"
            hint="Mathematical rule for this structure"
            items={group("general")}
          >
            <AddButton onClick={() => startAdd("general")} />
          </Group>
          {group("general").map((item) => (
            <ItemCard
              key={item.id}
              scene={scene}
              item={item}
              editing={editingId === item.id}
              draftText={draftText}
              draftKind={draftKind}
              connecting={connecting && editingId === item.id}
              onDraftText={setDraftText}
              onDraftKind={setDraftKind}
              onOpenEdit={() => openEdit(item)}
              onSave={saveEdit}
              onCancel={() => { setEditingId(null); setConnecting(false); }}
              onRemove={() => remove(item.id)}
              onToggleCategory={() =>
                upsert({ ...item, category: item.category === "specific" ? "general" : "specific" })
              }
              onToggleEnabled={() => upsert({ ...item, enabled: item.enabled === false })}
              onApprove={() => upsert({ ...item, approved: true })}
              onMove={(d) => move(item, d)}
              onPreview={() => onHighlight(connectionsOf(item))}
              onToggleConnecting={() => {
                if (editingId !== item.id) openEdit(item);
                setConnecting(!(connecting && editingId === item.id));
              }}
              bindToken={editingId === item.id ? bindToken : null}
              onBindToken={(t) => {
                if (editingId !== item.id) openEdit(item);
                setBindToken((cur) => (cur === t ? null : t));
              }}
              onUnbindToken={(t) =>
                upsert({ ...item, tokens: (item.tokens ?? []).filter((x) => x.token !== t) })
              }
              onRemoveConnection={(id) =>
                upsert({
                  ...item,
                  connectedObjectIds: item.connectedObjectIds.filter((x) => x !== id),
                })
              }
            />
          ))}

          <button
            type="button"
            onClick={aiSuggest}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Assist — suggest relationships
          </button>
        </>
      )}

      {/* Student access */}
      <div className="rounded-lg border border-foreground/15 p-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-foreground/50">Geometry guide</p>
        <div className="grid grid-cols-2 gap-1">
          {([
            ["off", "Off"],
            ["specific", "Specific only"],
            ["general", "General only"],
            ["both", "Specific + General"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onDocChange({ ...doc, access: v })}
              className={cn(
                "rounded border px-1.5 py-1 text-[11px]",
                doc.access === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground/20 hover:bg-foreground/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {issues.length > 0 && (
          <button
            type="button"
            onClick={() => setShowIssues((s) => !s)}
            className="mt-1 flex w-full items-start gap-1.5 rounded border border-amber-400/50 bg-amber-400/10 px-2 py-1.5 text-left text-[11px] text-amber-700 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Geometry Properties needs attention — {issues.length} issue
              {issues.length === 1 ? "" : "s"}. {showIssues ? "Hide" : "Review"}
            </span>
          </button>
        )}
        {showIssues && (
          <ul className="space-y-1 text-[10.5px] text-foreground/70">
            {issues.map((iss, i) => {
              const item = doc.items.find((x) => x.id === iss.itemId);
              return (
                <li key={`${iss.itemId}-${i}`} className="rounded bg-foreground/[0.04] px-1.5 py-1">
                  <span className="font-medium">{item?.content?.slice(0, 40) || "Relationship"}</span>
                  {" — "}{iss.message}
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => {
            if (doc.published) {
              onDocChange({ ...doc, published: false });
              toast.success("Guide unpublished — students no longer see it.");
              return;
            }
            if (issues.length > 0) {
              setShowIssues(true);
              toast.error("Fix the listed issues before publishing.");
              return;
            }
            if (doc.access === "off") {
              toast.error("Choose what students may see before publishing.");
              return;
            }
            onDocChange({ ...doc, published: true });
            toast.success("Geometry guide published to students.");
          }}
          className={cn(
            "w-full rounded px-2 py-1.5 text-[11px] font-semibold",
            doc.published
              ? "border border-foreground/20 hover:bg-foreground/5"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
        >
          {doc.published ? "Unpublish guide" : "Publish to students"}
        </button>
      </div>
    </div>
  );
}

/* ───────────── pieces ───────────── */

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-foreground/20 px-1.5 py-0.5 text-[10.5px] hover:bg-foreground/5"
    >
      <Plus className="h-3 w-3" /> Add
    </button>
  );
}

function Group({
  title, hint, items, children,
}: {
  title: string; hint: string; items: GeometryPropertyItem[]; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-foreground/10 pb-1 pt-1">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
          {title} <span className="font-normal text-foreground/40">({items.length})</span>
        </p>
        <p className="text-[10px] text-foreground/45">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function ItemCard({
  scene, item, editing, draftText, draftKind, connecting,
  onDraftText, onDraftKind, onOpenEdit, onSave, onCancel, onRemove,
  onToggleCategory, onToggleEnabled, onApprove, onMove, onPreview,
  onToggleConnecting, onRemoveConnection,
  bindToken, onBindToken, onUnbindToken,
}: {
  scene: GeometryScene;
  item: GeometryPropertyItem;
  editing: boolean;
  draftText: string;
  draftKind: PropertyKind;
  connecting: boolean;
  onDraftText: (v: string) => void;
  onDraftKind: (v: PropertyKind) => void;
  onOpenEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onToggleCategory: () => void;
  onToggleEnabled: () => void;
  onApprove: () => void;
  onMove: (dir: -1 | 1) => void;
  onPreview: () => void;
  onToggleConnecting: () => void;
  onRemoveConnection: (id: GeoId) => void;
  bindToken: string | null;
  onBindToken: (token: string) => void;
  onUnbindToken: (token: string) => void;
}) {
  const chips = item.connectedObjectIds.map((id) => ({ id, info: describeObject(scene, id) }));
  const symbols = detectTokens(editing ? draftText : item.content);
  const bound = new Map((item.tokens ?? []).map((t) => [t.token, t.objectId]));

  return (
    <div
      className={cn(
        "rounded-lg border p-2 space-y-1.5",
        item.enabled === false && "opacity-50",
        item.approved === false
          ? "border-violet-400/60 bg-violet-400/[0.07]"
          : "border-foreground/15",
      )}
      onMouseEnter={onPreview}
    >
      {editing ? (
        <>
          <textarea
            autoFocus
            value={draftText}
            onChange={(e) => onDraftText(e.target.value)}
            placeholder="e.g. sin θ = X / H"
            className="w-full rounded border border-foreground/20 bg-background px-1.5 py-1 text-[12px] leading-snug"
            rows={2}
          />
          <select
            value={draftKind}
            onChange={(e) => onDraftKind(e.target.value as PropertyKind)}
            className="w-full rounded border border-foreground/20 bg-background px-1 py-0.5 text-[11px]"
          >
            {PROPERTY_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </>
      ) : (
        <p className="text-[12px] leading-snug">{item.content || "Untitled relationship"}</p>
      )}

      {symbols.length > 0 && (
        <div className="space-y-1 rounded border border-foreground/10 bg-foreground/[0.02] p-1.5">
          <p className="text-[9.5px] uppercase tracking-wider text-foreground/50">
            Symbols — tap one, then click the object on the diagram
          </p>
          <div className="flex flex-wrap gap-1">
            {symbols.map((tk) => {
              const objId = bound.get(tk);
              const info = objId ? describeObject(scene, objId) : null;
              const active = bindToken === tk;
              return (
                <span
                  key={tk}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
                    active
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : info
                        ? "border-foreground/25 bg-foreground/[0.05]"
                        : "border-dashed border-foreground/30",
                  )}
                >
                  <button type="button" onClick={() => onBindToken(tk)} className="font-semibold">
                    {tk}
                  </button>
                  {info ? <span className="opacity-80">= {info.name}</span> : <span className="opacity-60">unbound</span>}
                  {info && (
                    <button type="button" onClick={() => onUnbindToken(tk)} title="Unbind symbol">
                      <X className="h-2.5 w-2.5 opacity-60 hover:opacity-100" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {bindToken && (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
              Click the diagram object that “{bindToken}” refers to.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {chips.map(({ id, info }) => (
          <span
            key={id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
              info ? "border-foreground/20 bg-foreground/[0.04]" : "border-red-400/60 text-red-500",
            )}
          >
            {info ? info.name : "deleted object"}
            <button type="button" onClick={() => onRemoveConnection(id)} title="Remove connection">
              <X className="h-2.5 w-2.5 opacity-60 hover:opacity-100" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={onToggleConnecting}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
            connecting
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-dashed border-foreground/30 hover:bg-foreground/5",
          )}
        >
          <Link2 className="h-2.5 w-2.5" />
          {connecting ? "Click objects · Done" : "Connect to diagram"}
        </button>
      </div>

      {connecting && (
        <p className="rounded bg-emerald-500/10 px-1.5 py-1 text-[10px] text-emerald-700 dark:text-emerald-300">
          Connecting… click objects on the diagram to add or remove them.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        {editing ? (
          <>
            <MiniBtn onClick={onSave} tone="primary"><Check className="h-3 w-3" /> Save</MiniBtn>
            <MiniBtn onClick={onCancel}>Cancel</MiniBtn>
          </>
        ) : (
          <>
            <MiniBtn onClick={onOpenEdit}><Pencil className="h-3 w-3" /> Edit</MiniBtn>
            <MiniBtn onClick={onPreview}><Eye className="h-3 w-3" /> Preview</MiniBtn>
            {item.approved === false && (
              <MiniBtn onClick={onApprove} tone="primary"><Check className="h-3 w-3" /> Accept</MiniBtn>
            )}
          </>
        )}
        <MiniBtn onClick={onToggleCategory} title="Move between Specific and General">
          {item.category === "specific" ? "→ General" : "→ Specific"}
        </MiniBtn>
        <MiniBtn onClick={onToggleEnabled}>{item.enabled === false ? "Enable" : "Disable"}</MiniBtn>
        <MiniBtn onClick={() => onMove(-1)} title="Move up"><ChevronUp className="h-3 w-3" /></MiniBtn>
        <MiniBtn onClick={() => onMove(1)} title="Move down"><ChevronDown className="h-3 w-3" /></MiniBtn>
        <MiniBtn onClick={onRemove} tone="danger" title="Delete relationship">
          <Trash2 className="h-3 w-3" />
        </MiniBtn>
      </div>
    </div>
  );
}

function MiniBtn({
  children, onClick, tone, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "danger";
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px]",
        tone === "primary"
          ? "border-primary bg-primary text-primary-foreground"
          : tone === "danger"
            ? "border-red-300 text-red-600 hover:bg-red-50"
            : "border-foreground/20 hover:bg-foreground/5",
      )}
    >
      {children}
    </button>
  );
}

export default GeometryPropertiesPanel;
