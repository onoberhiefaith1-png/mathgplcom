/**
 * ACADEMY EDITOR — the real management surface for the 3D world.
 *
 * Split screen: the structure tree on the left, the live world on the right.
 * Every action here writes to the database immediately (create, rename, move,
 * reorder, hide/show, duplicate, delete, place a product), and the world beside
 * it re-reads the same rows, so what you see is what learners get.
 *
 * Placing a product NEVER copies it: the row stores the product's kind and id.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import HallwayScene from "@/components/academy/world/HallwayScene";
import { toast } from "@/hooks/use-toast";
import {
  createNode,
  deleteNode,
  duplicateRoom,
  ensureAcademy,
  loadAcademyTree,
  loadProductCatalogue,
  reorderNodes,
  updateNode,
  type AcademyLevelTable,
} from "@/lib/academy/api";
import {
  PRODUCT_KINDS,
  ROOM_TYPES,
  type AcademyProduct,
  type AcademyProductKind,
  type AcademyTree,
} from "@/lib/academy/types";
import { useAccount } from "@/lib/accounts/useAccount";

interface RowProps {
  table: AcademyLevelTable;
  id: string;
  name: string;
  visible: boolean;
  depth: number;
  open?: boolean;
  hasChildren?: boolean;
  extra?: React.ReactNode;
  onToggleOpen?: () => void;
  onRefresh: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

const Row = ({
  table,
  id,
  name,
  visible,
  depth,
  open,
  hasChildren,
  extra,
  onToggleOpen,
  onRefresh,
  onDragStart,
  onDrop,
}: RowProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const save = async () => {
    setEditing(false);
    if (draft.trim() === name || !draft.trim()) return setDraft(name);
    try {
      await updateNode(table, id, { name: draft.trim() });
      onRefresh();
    } catch (e: unknown) {
      toast({ title: "Could not rename", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className="flex min-h-[44px] items-center gap-1 rounded-lg px-1 hover:bg-muted/60"
      style={{ paddingLeft: depth * 14 + 4 }}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
      {hasChildren ? (
        <button type="button" onClick={onToggleOpen} aria-label="Expand" className="p-1 text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-[22px]" />
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`min-w-0 flex-1 truncate py-1 text-left text-sm ${visible ? "text-foreground" : "text-muted-foreground line-through"}`}
        >
          {name}
        </button>
      )}
      {extra}
      <button
        type="button"
        aria-label={visible ? "Hide" : "Show"}
        onClick={async () => {
          await updateNode(table, id, { is_visible: !visible });
          onRefresh();
        }}
        className="rounded p-2 text-muted-foreground hover:text-foreground"
      >
        {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={async () => {
          await deleteNode(table, id);
          onRefresh();
        }}
        className="rounded p-2 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const AddButton = ({ label, onAdd }: { label: string; onAdd: () => void }) => (
  <button
    type="button"
    onClick={onAdd}
    className="ml-1 inline-flex min-h-[36px] items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
  >
    <Plus className="h-3 w-3" /> {label}
  </button>
);

const AcademyEditorPage = () => {
  const { orgId, isLoading: accountLoading } = useAccount();
  const [tree, setTree] = useState<AcademyTree | null>(null);
  const [catalogue, setCatalogue] = useState<AcademyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [focus, setFocus] = useState(0);
  const [drag, setDrag] = useState<{ table: AcademyLevelTable; id: string; parentId: string } | null>(null);
  const [placeInto, setPlaceInto] = useState<string | null>(null);
  const [kind, setKind] = useState<AcademyProductKind>("course");

  const refresh = useCallback(async () => {
    try {
      const academy = await ensureAcademy(orgId ?? null);
      if (!academy) {
        setError("Sign in with a teaching account to build the Academy.");
        return;
      }
      const loaded = await loadAcademyTree(academy);
      setTree(loaded);
      if (!loaded.canEdit) setError("Your account can view the Academy but not edit it.");
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
    }
  }, [orgId]);

  useEffect(() => {
    if (accountLoading) return;
    (async () => {
      setLoading(true);
      await refresh();
      setCatalogue(await loadProductCatalogue());
      setLoading(false);
    })();
  }, [accountLoading, refresh]);

  const rooms = tree?.rooms ?? [];
  const products = useMemo(() => catalogue.filter((p) => p.kind === kind), [catalogue, kind]);

  const handleDrop = async (
    table: AcademyLevelTable,
    parentId: string,
    siblings: { id: string }[],
    targetId: string,
  ) => {
    if (!drag || drag.table !== table) return;
    const ids = siblings.map((s) => s.id);
    if (drag.parentId !== parentId) {
      // Moving to a different parent: re-parent, then order it next to the target.
      const { moveNode } = await import("@/lib/academy/api");
      await moveNode(table, drag.id, parentId);
      const next = ids.filter((i) => i !== drag.id);
      next.splice(Math.max(0, next.indexOf(targetId)), 0, drag.id);
      await reorderNodes(table, next);
    } else {
      const next = ids.filter((i) => i !== drag.id);
      next.splice(Math.max(0, next.indexOf(targetId)), 0, drag.id);
      await reorderNodes(table, next);
    }
    setDrag(null);
    await refresh();
  };

  if (loading || accountLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading the Academy editor…
      </div>
    );
  }

  if (error && !tree) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link to="/academy" className="rounded-full border border-border px-5 py-2 text-sm">
          Open the Academy
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Structure */}
      <div className="flex w-full flex-col border-b border-border/60 lg:w-[440px] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Academy structure</h1>
            <p className="text-[11px] text-muted-foreground">Drag to reorder or move between parents.</p>
          </div>
          <Link to="/academy" className="min-h-[40px] rounded-full border border-border px-3 py-2 text-xs font-semibold">
            View world
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {rooms.length === 0 && (
            <p className="mb-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              The hallway has no rooms yet. Add your first room — it appears in the corridor instantly.
            </p>
          )}

          {rooms.map((room) => (
            <div key={room.id}>
              <Row
                table="academy_rooms"
                id={room.id}
                name={room.name}
                visible={room.is_visible}
                depth={0}
                open={open[room.id]}
                hasChildren
                onToggleOpen={() => setOpen((o) => ({ ...o, [room.id]: !o[room.id] }))}
                onRefresh={refresh}
                onDragStart={() => setDrag({ table: "academy_rooms", id: room.id, parentId: room.academy_id })}
                onDrop={() => handleDrop("academy_rooms", room.academy_id, rooms, room.id)}
                extra={
                  <>
                    <select
                      aria-label="Room type"
                      value={room.room_type}
                      onChange={async (e) => {
                        await updateNode("academy_rooms", room.id, { room_type: e.target.value });
                        refresh();
                      }}
                      className="rounded border border-border bg-background px-1 py-1 text-[11px]"
                    >
                      {ROOM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Duplicate room"
                      onClick={async () => {
                        await duplicateRoom(room);
                        refresh();
                      }}
                      className="rounded p-2 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </>
                }
              />

              {open[room.id] && (
                <div>
                  {room.categories.map((category) => (
                    <div key={category.id}>
                      <Row
                        table="academy_categories"
                        id={category.id}
                        name={category.name}
                        visible={category.is_visible}
                        depth={1}
                        open={open[category.id]}
                        hasChildren
                        onToggleOpen={() => setOpen((o) => ({ ...o, [category.id]: !o[category.id] }))}
                        onRefresh={refresh}
                        onDragStart={() => setDrag({ table: "academy_categories", id: category.id, parentId: room.id })}
                        onDrop={() => handleDrop("academy_categories", room.id, room.categories, category.id)}
                      />
                      {open[category.id] && (
                        <div>
                          {category.topics.map((topic) => (
                            <div key={topic.id}>
                              <Row
                                table="academy_topics"
                                id={topic.id}
                                name={topic.name}
                                visible={topic.is_visible}
                                depth={2}
                                open={open[topic.id]}
                                hasChildren
                                onToggleOpen={() => setOpen((o) => ({ ...o, [topic.id]: !o[topic.id] }))}
                                onRefresh={refresh}
                                onDragStart={() => setDrag({ table: "academy_topics", id: topic.id, parentId: category.id })}
                                onDrop={() => handleDrop("academy_topics", category.id, category.topics, topic.id)}
                              />
                              {open[topic.id] && (
                                <div>
                                  {topic.subtopics.map((sub) => (
                                    <div key={sub.id}>
                                      <Row
                                        table="academy_subtopics"
                                        id={sub.id}
                                        name={sub.name}
                                        visible={sub.is_visible}
                                        depth={3}
                                        open={open[sub.id]}
                                        hasChildren
                                        onToggleOpen={() => setOpen((o) => ({ ...o, [sub.id]: !o[sub.id] }))}
                                        onRefresh={refresh}
                                        onDragStart={() => setDrag({ table: "academy_subtopics", id: sub.id, parentId: topic.id })}
                                        onDrop={() => handleDrop("academy_subtopics", topic.id, topic.subtopics, sub.id)}
                                      />
                                      {open[sub.id] && (
                                        <div>
                                          {sub.placements.map((placement) => {
                                            const product = catalogue.find(
                                              (c) => c.kind === placement.product_kind && c.id === placement.product_id,
                                            );
                                            return (
                                              <div
                                                key={placement.id}
                                                className="flex min-h-[44px] items-center gap-1 rounded-lg px-1 hover:bg-muted/60"
                                                style={{ paddingLeft: 4 * 14 + 4 }}
                                              >
                                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                                  {placement.product_kind}
                                                </span>
                                                <span
                                                  className={`min-w-0 flex-1 truncate text-sm ${placement.is_visible ? "text-foreground" : "text-muted-foreground line-through"}`}
                                                >
                                                  {placement.title_override || product?.title || "Missing product"}
                                                </span>
                                                <button
                                                  type="button"
                                                  aria-label="Feature"
                                                  onClick={async () => {
                                                    await updateNode("academy_placements", placement.id, {
                                                      is_featured: !placement.is_featured,
                                                    });
                                                    refresh();
                                                  }}
                                                  className={`rounded p-2 ${placement.is_featured ? "text-amber-500" : "text-muted-foreground"}`}
                                                >
                                                  <Star className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  aria-label={placement.is_visible ? "Hide" : "Show"}
                                                  onClick={async () => {
                                                    await updateNode("academy_placements", placement.id, {
                                                      is_visible: !placement.is_visible,
                                                    });
                                                    refresh();
                                                  }}
                                                  className="rounded p-2 text-muted-foreground hover:text-foreground"
                                                >
                                                  {placement.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                                </button>
                                                <button
                                                  type="button"
                                                  aria-label="Remove from shelf"
                                                  onClick={async () => {
                                                    await deleteNode("academy_placements", placement.id);
                                                    refresh();
                                                  }}
                                                  className="rounded p-2 text-muted-foreground hover:text-destructive"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            );
                                          })}
                                          <div style={{ paddingLeft: 4 * 14 + 4 }}>
                                            <AddButton
                                              label="Place a product"
                                              onAdd={() => setPlaceInto(placeInto === sub.id ? null : sub.id)}
                                            />
                                          </div>
                                          {placeInto === sub.id && (
                                            <div
                                              className="mt-2 rounded-xl border border-border bg-card p-3"
                                              style={{ marginLeft: 4 * 14 + 4 }}
                                            >
                                              <div className="flex flex-wrap gap-1">
                                                {PRODUCT_KINDS.map((k) => (
                                                  <button
                                                    key={k.value}
                                                    type="button"
                                                    onClick={() => setKind(k.value)}
                                                    className={`min-h-[36px] rounded-full px-3 text-xs font-semibold ${kind === k.value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
                                                  >
                                                    {k.label}
                                                  </button>
                                                ))}
                                              </div>
                                              <div className="mt-2 max-h-56 overflow-y-auto">
                                                {products.length === 0 ? (
                                                  <p className="p-2 text-xs text-muted-foreground">
                                                    You have no {kind}s yet. Create one first — the Academy only
                                                    displays existing products, it never duplicates them.
                                                  </p>
                                                ) : (
                                                  products.map((p) => (
                                                    <button
                                                      key={`${p.kind}-${p.id}`}
                                                      type="button"
                                                      onClick={async () => {
                                                        await createNode("academy_placements", sub.id, {
                                                          product_kind: p.kind,
                                                          product_id: p.id,
                                                        });
                                                        setPlaceInto(null);
                                                        refresh();
                                                      }}
                                                      className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
                                                    >
                                                      <span className="truncate">{p.title}</span>
                                                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </button>
                                                  ))
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  <div style={{ paddingLeft: 3 * 14 + 4 }}>
                                    <AddButton
                                      label="Add subtopic"
                                      onAdd={async () => {
                                        const id = await createNode("academy_subtopics", topic.id, {});
                                        setOpen((o) => ({ ...o, [topic.id]: true, [id]: true }));
                                        refresh();
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <div style={{ paddingLeft: 2 * 14 + 4 }}>
                            <AddButton
                              label="Add topic"
                              onAdd={async () => {
                                const id = await createNode("academy_topics", category.id, {});
                                setOpen((o) => ({ ...o, [category.id]: true, [id]: true }));
                                refresh();
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ paddingLeft: 1 * 14 + 4 }}>
                    <AddButton
                      label="Add section"
                      onAdd={async () => {
                        const id = await createNode("academy_categories", room.id, {});
                        setOpen((o) => ({ ...o, [room.id]: true, [id]: true }));
                        refresh();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="mt-2">
            <AddButton
              label="Add room"
              onAdd={async () => {
                if (!tree) return;
                const id = await createNode("academy_rooms", tree.academy.id, {});
                setOpen((o) => ({ ...o, [id]: true }));
                refresh();
              }}
            />
          </div>
        </div>
      </div>

      {/* Live world */}
      <div className="relative min-h-[60vh] flex-1 bg-[#0b0f18]">
        {rooms.length > 0 ? (
          <HallwayScene
            rooms={rooms}
            focus={Math.min(focus, rooms.length - 1)}
            onFocusChange={setFocus}
            onEnterRoom={(id) => setOpen((o) => ({ ...o, [id]: true }))}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">
            Add a room and the corridor builds itself here.
          </div>
        )}
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Live preview · arrow keys or drag to glide
        </p>
      </div>
    </div>
  );
};

export default AcademyEditorPage;
