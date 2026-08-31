/**
 * BUILDING STRUCTURE — hallways (paths) and doors (destinations).
 *
 * The building is a tree-shaped maze: every hallway has exactly one parent and
 * unlimited children, and a junction offers at most one forward, one left and
 * one right continuation. Two branches can therefore never reconnect, so the
 * structure stays a loop-free tree.
 *
 * There is no "room" concept here. A hallway is the navigable path, a door is
 * the destination that opens an existing product (never duplicated).
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, DoorOpen, Plus, Route, Trash2 } from "lucide-react";
import type {
  BuildingDoor,
  BuildingWalkway,
  DoorContentKind,
  WalkwayDirection,
} from "@/lib/building/types";
import { DIRECTION_LABEL, DOOR_KIND_LABEL } from "@/lib/building/types";
import { doorTitle } from "@/lib/building/api";
import { DEFAULT_ENDPOINT_NAME } from "@/lib/building/env";
import { DOOR_STYLES } from "@/lib/building/doors";
import type { AcademyProduct, AcademyProductKind } from "@/lib/academy/types";
import { PRODUCT_KINDS } from "@/lib/academy/types";

export interface WalkwayManagerProps {
  walkways: BuildingWalkway[];
  doors: BuildingDoor[];
  catalogue: AcademyProduct[];
  /** Create a connected hallway. Returns nothing; the parent refreshes the world. */
  onAddWalkway: (parentId: string | null, direction: WalkwayDirection, name?: string) => Promise<void>;
  onUpdateWalkway: (id: string, length: number) => Promise<void>;
  onRenameWalkway?: (id: string, name: string) => Promise<void>;
  /** Rename this hallway's ENDPOINT (the terminal node at its far end). */
  onRenameEndpoint?: (id: string, endLabel: string) => Promise<void>;
  onRenameDoor?: (id: string, title: string) => Promise<void>;
  onDeleteWalkway: (id: string) => Promise<void>;
  onAddDoor: (
    walkwayId: string,
    fields: {
      position_along: number;
      content_kind: DoorContentKind;
      content_id: string;
      title?: string;
      style?: string;
    },
  ) => Promise<void>;
  onUpdateDoor: (id: string, position_along: number) => Promise<void>;
  /** Per-door design override; empty string clears back to the building default. */
  onSetDoorStyle?: (id: string, style: string) => Promise<void>;
  onDeleteDoor: (id: string) => Promise<void>;
  /** A door clicked in the live world — highlighted and revealed here. */
  selectedDoorId?: string | null;
}

const DIRECTIONS: WalkwayDirection[] = ["forward", "left", "right"];

const WalkwayManager = ({
  walkways,
  doors,
  catalogue,
  onAddWalkway,
  onUpdateWalkway,
  onRenameWalkway,
  onRenameEndpoint,
  onRenameDoor,
  onDeleteWalkway,
  onAddDoor,
  onUpdateDoor,
  onSetDoorStyle,
  onDeleteDoor,
  selectedDoorId = null,
}: WalkwayManagerProps) => {
  const [openWalkway, setOpenWalkway] = useState<string | null>(null);
  const [form, setForm] = useState<"hallway" | "door" | null>(null);

  // Add Hallway form state
  const [hallParent, setHallParent] = useState<string>("");
  const [hallDir, setHallDir] = useState<WalkwayDirection>("forward");
  const [hallName, setHallName] = useState("");

  // Add Door form state
  const [doorWalkway, setDoorWalkway] = useState<string>("");
  const [doorName, setDoorName] = useState("");
  const [doorStyle, setDoorStyle] = useState("");
  const [kind, setKind] = useState<AcademyProductKind>("course");
  const [busy, setBusy] = useState(false);

  const titles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of catalogue) out[`${p.kind}:${p.id}`] = p.title;
    return out;
  }, [catalogue]);

  const childrenOf = (id: string | null) =>
    walkways
      .filter((w) => (w.parent_id ?? null) === id)
      .sort((a, b) => a.position - b.position);

  const roots = childrenOf(null);
  const doorsOf = (walkwayId: string) =>
    doors
      .filter((d) => d.walkway_id === walkwayId)
      .sort((a, b) => a.position_along - b.position_along);

  const products = catalogue.filter((p) => p.kind === kind);

  /** Depth-first list of hallways so a select can show the tree by name. */
  const flat = useMemo(() => {
    const out: { w: BuildingWalkway; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const w of walkways
        .filter((x) => (x.parent_id ?? null) === parent)
        .sort((a, b) => a.position - b.position)) {
        out.push({ w, depth });
        walk(w.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [walkways]);

  /** Directions already used at a junction — one child per direction keeps the tree. */
  const takenAt = (parentId: string): WalkwayDirection[] =>
    walkways.filter((w) => w.parent_id === parentId).map((w) => w.direction);

  const openHallwayForm = (parentId?: string) => {
    const parent = parentId ?? hallParent ?? roots[0]?.id ?? "";
    setHallParent(parent);
    const taken = parent ? takenAt(parent) : [];
    setHallDir(DIRECTIONS.find((d) => !taken.includes(d)) ?? "forward");
    setHallName("");
    setForm("hallway");
  };

  const openDoorForm = (walkwayId?: string) => {
    setDoorWalkway(walkwayId ?? doorWalkway ?? roots[0]?.id ?? "");
    setDoorName("");
    setDoorStyle("");
    setForm("door");
  };

  const submitHallway = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAddWalkway(roots.length === 0 ? null : hallParent, roots.length === 0 ? "forward" : hallDir, hallName);
      setForm(null);
    } finally {
      setBusy(false);
    }
  };

  const hallTaken = hallParent ? takenAt(hallParent) : [];

  const WalkwayRow = ({ w, depth }: { w: BuildingWalkway; depth: number }) => {
    const kids = childrenOf(w.id);
    const segDoors = doorsOf(w.id);
    const open = openWalkway === w.id || segDoors.some((d) => d.id === selectedDoorId);
    return (
      <div>
        <div
          className="flex min-h-[44px] items-center gap-1 rounded-lg px-1 hover:bg-muted/60"
          style={{ paddingLeft: depth * 14 + 4 }}
        >
          <button
            type="button"
            onClick={() => setOpenWalkway(open ? null : w.id)}
            aria-label="Hallway details"
            className="p-1 text-muted-foreground"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <input
            aria-label="Hallway name"
            defaultValue={w.name}
            placeholder={DIRECTION_LABEL[w.direction]}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== w.name) void onRenameWalkway?.(w.id, next);
              else e.target.value = w.name;
            }}
            className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-sm text-foreground"
          />
          <input
            aria-label="Hallway length"
            type="number"
            min={6}
            max={120}
            defaultValue={w.length}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 6 && v <= 120 && v !== w.length) {
                void onUpdateWalkway(w.id, v);
              } else {
                e.target.value = String(w.length);
              }
            }}
            className="w-14 rounded border border-border bg-background px-1 py-1 text-right text-[11px]"
          />
          <button
            type="button"
            aria-label="Delete hallway"
            onClick={async () => {
              if (window.confirm("Delete this hallway and everything connected beyond it?")) {
                await onDeleteWalkway(w.id);
              }
            }}
            className="rounded p-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {open && (
          <div style={{ paddingLeft: depth * 14 + 10 }}>
            {/* ENDPOINT — the terminal node at the far end of this hallway.
                Only meaningful while the hallway does not continue forward. */}
            {!kids.some((k) => k.direction === "forward") && (
              <label className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
                End wall name
                <input
                  aria-label="End wall name"
                  defaultValue={w.end_label ?? ""}
                  placeholder={DEFAULT_ENDPOINT_NAME}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== (w.end_label ?? "")) void onRenameEndpoint?.(w.id, next);
                    else e.target.value = w.end_label ?? "";
                  }}
                  className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-sm text-foreground"
                />
              </label>
            )}
            <div className="flex flex-wrap gap-1 py-1">
              <button
                type="button"
                onClick={() => openHallwayForm(w.id)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-sky-500/40 px-2.5 text-[11px] font-semibold text-sky-400"
              >
                <Route className="h-3 w-3" /> Add Hallway here
              </button>
              <button
                type="button"
                onClick={() => openDoorForm(w.id)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-emerald-500/40 px-2.5 text-[11px] font-semibold text-emerald-400"
              >
                <DoorOpen className="h-3 w-3" /> Add Door here
              </button>
            </div>

            {segDoors.map((d) => (
              <div
                key={d.id}
                className={`flex min-h-[44px] items-center gap-1 rounded-lg px-1 ${
                  d.id === selectedDoorId ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60"
                }`}
              >
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  {d.content_kind ? DOOR_KIND_LABEL[d.content_kind] : "Empty"}
                </span>
                <input
                  aria-label="Door name"
                  defaultValue={doorTitle(d, titles)}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== doorTitle(d, titles)) void onRenameDoor?.(d.id, next);
                    else e.target.value = doorTitle(d, titles);
                  }}
                  className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-sm text-foreground"
                />
                <select
                  aria-label="Door design"
                  value={(d.design as { style?: string } | null)?.style ?? ""}
                  onChange={(e) => void onSetDoorStyle?.(d.id, e.target.value)}
                  className="min-h-[32px] max-w-[7.5rem] rounded border border-border bg-background px-1 text-[11px] text-foreground"
                >
                  <option value="">Building default</option>
                  {DOOR_STYLES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Door position"
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={Math.round(d.position_along * 100)}
                  onChange={(e) => onUpdateDoor(d.id, Number(e.target.value) / 100)}
                  className="w-16 accent-primary"
                />
                <button
                  type="button"
                  aria-label="Remove door"
                  onClick={() => onDeleteDoor(d.id)}
                  className="rounded p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {kids.map((k) => (
          <WalkwayRow key={k.id} w={k} depth={depth + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => (form === "hallway" ? setForm(null) : openHallwayForm())}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-sky-500/40 px-3 text-xs font-semibold text-sky-400"
        >
          <Plus className="h-3.5 w-3.5" /> Add Hallway
        </button>
        <button
          type="button"
          onClick={() => (form === "door" ? setForm(null) : openDoorForm())}
          disabled={roots.length === 0}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-emerald-500/40 px-3 text-xs font-semibold text-emerald-400 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add Door
        </button>
      </div>

      {form === "hallway" && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add hallway</p>
          {roots.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              This is the main hallway — the corridor learners walk down from the entrance.
            </p>
          ) : (
            <>
              <label className="mt-2 block text-[11px] text-muted-foreground">
                Connect to
                <select
                  aria-label="Connect to hallway"
                  value={hallParent}
                  onChange={(e) => {
                    setHallParent(e.target.value);
                    const taken = takenAt(e.target.value);
                    setHallDir(DIRECTIONS.find((d) => !taken.includes(d)) ?? "forward");
                  }}
                  className="mt-1 min-h-[38px] w-full rounded border border-border bg-background px-2 text-sm text-foreground"
                >
                  {flat.map(({ w, depth }) => (
                    <option key={w.id} value={w.id}>
                      {"— ".repeat(depth)}
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Direction
                <div className="mt-1 flex flex-wrap gap-1">
                  {DIRECTIONS.map((d) => {
                    const disabled = hallTaken.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={disabled}
                        onClick={() => setHallDir(d)}
                        className={`min-h-[34px] rounded-full px-3 text-[11px] font-semibold ${
                          hallDir === d
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground"
                        } disabled:opacity-35`}
                      >
                        {d === "forward" ? "Forward" : d === "left" ? "Left" : "Right"}
                        {disabled ? " · taken" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <label className="mt-2 block text-[11px] text-muted-foreground">
            Name
            <input
              aria-label="New hallway name"
              value={hallName}
              onChange={(e) => setHallName(e.target.value)}
              placeholder={roots.length === 0 ? "Main Hallway" : "Algebra Hallway"}
              className="mt-1 min-h-[38px] w-full rounded border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submitHallway}
              disabled={busy || (roots.length > 0 && (!hallParent || hallTaken.includes(hallDir)))}
              className="min-h-[38px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              Create Hallway
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="min-h-[38px] rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {form === "door" && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add door</p>
          <label className="mt-2 block text-[11px] text-muted-foreground">
            On hallway
            <select
              aria-label="Door hallway"
              value={doorWalkway}
              onChange={(e) => setDoorWalkway(e.target.value)}
              className="mt-1 min-h-[38px] w-full rounded border border-border bg-background px-2 text-sm text-foreground"
            >
              {flat.map(({ w, depth }) => (
                <option key={w.id} value={w.id}>
                  {"— ".repeat(depth)}
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-[11px] text-muted-foreground">
            Door name (optional)
            <input
              aria-label="New door name"
              value={doorName}
              onChange={(e) => setDoorName(e.target.value)}
              placeholder="Statistics"
              className="mt-1 min-h-[38px] w-full rounded border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="mt-2 block text-[11px] text-muted-foreground">
            Door design
            <select
              aria-label="New door design"
              value={doorStyle}
              onChange={(e) => setDoorStyle(e.target.value)}
              className="mt-1 min-h-[38px] w-full rounded border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="">Building default</option>
              {DOOR_STYLES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 text-[11px] text-muted-foreground">Opens</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {PRODUCT_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={`min-h-[32px] rounded-full px-2.5 text-[11px] font-semibold ${
                  kind === k.value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="mt-2 max-h-44 overflow-y-auto">
            {products.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                You have no {kind}s yet. The door only references existing products — it never duplicates them.
              </p>
            ) : (
              products.map((p) => (
                <button
                  key={`${p.kind}-${p.id}`}
                  type="button"
                  disabled={busy || !doorWalkway}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onAddDoor(doorWalkway, {
                        position_along: 0.5,
                        content_kind: p.kind as DoorContentKind,
                        content_id: p.id,
                        title: doorName.trim() || undefined,
                        style: doorStyle || undefined,
                      });
                      setForm(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted disabled:opacity-40"
                >
                  <span className="truncate">{p.title}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setForm(null)}
            className="mt-2 min-h-[38px] rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {roots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          This building has no hallway yet. Add the main hallway — it becomes the corridor learners walk down.
        </p>
      ) : (
        <div className="space-y-1">
          {roots.map((w) => (
            <WalkwayRow key={w.id} w={w} depth={0} />
          ))}
        </div>
      )}

      <p className="pt-1 text-[11px] text-muted-foreground">
        A hallway is the path: it continues forward or turns left/right into another hallway, and a branch can
        branch again without limit. Each junction takes one hallway per direction, so branches never reconnect. A
        door is the destination: it opens an existing course, game, adventure or assessment.
      </p>
    </div>
  );
};

export default WalkwayManager;
