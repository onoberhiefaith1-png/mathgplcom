/**
 * WALKWAY & DOORS — the building's navigable structure.
 *
 * The walkway graph grows from a root segment: extend forward, or branch
 * left/right at the end of any segment. Doors sit along a segment and open
 * existing products (never duplicated). Content is associated per door here,
 * so a duplicated building starts with empty doors.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type {
  BuildingDoor,
  BuildingWalkway,
  DoorContentKind,
  WalkwayDirection,
} from "@/lib/building/types";
import { DIRECTION_LABEL, DOOR_KIND_LABEL } from "@/lib/building/types";
import { doorTitle } from "@/lib/building/api";
import type { AcademyProduct, AcademyProductKind } from "@/lib/academy/types";
import { PRODUCT_KINDS } from "@/lib/academy/types";

export interface WalkwayManagerProps {
  walkways: BuildingWalkway[];
  doors: BuildingDoor[];
  catalogue: AcademyProduct[];
  onAddWalkway: (parentId: string | null, direction: WalkwayDirection) => Promise<void>;
  onUpdateWalkway: (id: string, length: number) => Promise<void>;
  onRenameWalkway?: (id: string, name: string) => Promise<void>;
  onRenameDoor?: (id: string, title: string) => Promise<void>;
  onDeleteWalkway: (id: string) => Promise<void>;
  onAddDoor: (
    walkwayId: string,
    fields: { position_along: number; content_kind: DoorContentKind; content_id: string },
  ) => Promise<void>;
  onUpdateDoor: (id: string, position_along: number) => Promise<void>;
  onDeleteDoor: (id: string) => Promise<void>;
}

const WalkwayManager = ({
  walkways,
  doors,
  catalogue,
  onAddWalkway,
  onUpdateWalkway,
  onRenameWalkway,
  onRenameDoor,
  onDeleteWalkway,
  onAddDoor,
  onUpdateDoor,
  onDeleteDoor,
}: WalkwayManagerProps) => {
  const [openWalkway, setOpenWalkway] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [kind, setKind] = useState<AcademyProductKind>("course");

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

  const WalkwayRow = ({ w, depth }: { w: BuildingWalkway; depth: number }) => {
    const kids = childrenOf(w.id);
    const segDoors = doorsOf(w.id);
    const open = openWalkway === w.id;
    return (
      <div>
        <div
          className="flex min-h-[44px] items-center gap-1 rounded-lg px-1 hover:bg-muted/60"
          style={{ paddingLeft: depth * 14 + 4 }}
        >
          <button
            type="button"
            onClick={() => setOpenWalkway(open ? null : w.id)}
            aria-label="Walkway details"
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
            aria-label="Walkway length"
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
            aria-label="Delete walkway"
            onClick={async () => {
              if (window.confirm("Delete this walkway and its branches?")) {
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
            <div className="flex flex-wrap gap-1 py-1">
              <button
                type="button"
                onClick={() => onAddWalkway(w.id, "forward")}
                className="min-h-[32px] rounded-full border border-emerald-500/40 px-2.5 text-[11px] font-semibold text-emerald-400"
              >
                + Forward
              </button>
              <button
                type="button"
                onClick={() => onAddWalkway(w.id, "left")}
                className="min-h-[32px] rounded-full border border-sky-500/40 px-2.5 text-[11px] font-semibold text-sky-400"
              >
                + Left branch
              </button>
              <button
                type="button"
                onClick={() => onAddWalkway(w.id, "right")}
                className="min-h-[32px] rounded-full border border-sky-500/40 px-2.5 text-[11px] font-semibold text-sky-400"
              >
                + Right branch
              </button>
            </div>

            {segDoors.map((d) => (
              <div key={d.id} className="flex min-h-[44px] items-center gap-1 rounded-lg px-1 hover:bg-muted/60">
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

            {pickerFor === w.id ? (
              <div className="mt-2 rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap gap-1">
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
                        onClick={async () => {
                          await onAddDoor(w.id, {
                            position_along: 0.5,
                            content_kind: p.kind as DoorContentKind,
                            content_id: p.id,
                          });
                          setPickerFor(null);
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
            ) : (
              <button
                type="button"
                onClick={() => setPickerFor(pickerFor === w.id ? null : w.id)}
                className="ml-1 mt-1 inline-flex min-h-[34px] items-center gap-1 rounded-full border border-dashed border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add door
              </button>
            )}
          </div>
        )}
        {kids.map((k) => (
          <WalkwayRow key={k.id} w={k} depth={depth + 1} />
        ))}
      </div>
    );
  };

  if (roots.length === 0) {
    return (
      <div className="space-y-2">
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          The building has no walkway yet. Start one — it becomes the corridor learners walk down.
        </p>
        <button
          type="button"
          onClick={() => onAddWalkway(null, "forward")}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add first walkway
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((w) => (
        <WalkwayRow key={w.id} w={w} depth={0} />
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Walkways extend forward and branch left/right. Doors open existing courses and games.
      </p>
    </div>
  );
};

export default WalkwayManager;