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
import { ChevronDown, ChevronRight, GraduationCap, Link2, Plus, Route, Trash2, Wand2 } from "lucide-react";
import type {
  BuildingClassroom,
  ClassroomKind,
  BuildingDoor,
  BuildingWalkway,
  BuildingWalkwayLink,
  WalkwayDirection,
} from "@/lib/building/types";
import { CLASSROOM_KIND_LABEL, DIRECTION_LABEL } from "@/lib/building/types";
import { CLASSROOM_KIND_BLURB } from "@/lib/building/classroom";
import { nextBranchDirection, nextObjectOffset } from "@/lib/building/navigation";
import { DEFAULT_ENDPOINT_NAME } from "@/lib/building/env";
import { DOOR_STYLES } from "@/lib/building/doors";
import DoorLockSettings from "./DoorLockSettings";
import type { DoorLock, LockCharset } from "@/lib/building/lock";
import type { AcademyProduct } from "@/lib/academy/types";

export interface WalkwayManagerProps {
  walkways: BuildingWalkway[];
  doors: BuildingDoor[];
  catalogue: AcademyProduct[];
  /** Create a connected hallway. Returns nothing; the parent refreshes the world. */
  onAddWalkway: (
    parentId: string | null,
    direction: WalkwayDirection,
    name?: string,
    junctionAt?: number,
  ) => Promise<void>;
  /** Slide an existing junction further along its parent road (0–1). */
  onSetJunction: (id: string, junctionAt: number) => Promise<void>;
  onRenameWalkway?: (id: string, name: string) => Promise<void>;
  /** Rename this hallway's ENDPOINT (the terminal node at its far end). */
  onRenameEndpoint?: (id: string, endLabel: string) => Promise<void>;
  onRenameDoor?: (id: string, title: string) => Promise<void>;
  onDeleteWalkway: (id: string) => Promise<void>;
  /**
   * ADD ROOM — a door and its room shell created together as one object. There
   * is no way to create a door on its own, and never a room without its door.
   */
  onAddRoom: (
    walkwayId: string,
    fields: {
      position_along: number;
      kind: ClassroomKind;
      name: string;
      style?: string | null;
    },
  ) => Promise<void>;
  onUpdateDoor: (id: string, position_along: number) => Promise<void>;
  /** Per-door design override; empty string clears back to the building default. */
  onSetDoorStyle?: (id: string, style: string) => Promise<void>;
  onDeleteDoor: (id: string) => Promise<void>;
  /** Existing hallway-to-hallway connections (the loops in the maze). */
  links?: BuildingWalkwayLink[];
  /** Connect two hallways that already exist, closing the maze into a loop. */
  onAddLink?: (fromWalkwayId: string, toWalkwayId: string) => Promise<void>;
  onDeleteLink?: (id: string) => Promise<void>;
  /** Create a ready-made branching maze with multiple doors. */
  onBuildSampleMaze?: () => Promise<void>;
  /** A door clicked in the live world — highlighted and revealed here. */
  selectedDoorId?: string | null;
  /**
   * How many more objects each hallway can carry. A hallway that runs from one
   * junction to another is finite: when it is full it is not offered for a new
   * door at all, so a door is never squeezed into a junction. Hallways that can
   * still grow report `Infinity`.
   */
  remainingSlots?: Record<string, number>;

  /** Classrooms that already exist, one per door. */
  classrooms?: BuildingClassroom[];
  /** Change the type of the room behind a door. The door never moves. */
  onSetRoomKind?: (roomId: string, kind: ClassroomKind) => Promise<void>;

  /** OPTIONAL ACCESS LOCKS, at most one per door. */
  locks?: DoorLock[];
  onSetDoorLock?: (doorId: string, code: string, charset: LockCharset, length: number) => Promise<void>;
  onRemoveDoorLock?: (doorId: string) => Promise<void>;
}

/**
 * A hallway is a road. Adding a hallway adds another road connected to it
 * through a real cut in its wall — the teacher never picks a side or a
 * position: branches alternate right → left → right → left along the road and
 * fall in after everything already on it, so a hallway opening and a door can
 * never end up directly opposite each other.
 */

const WalkwayManager = ({
  walkways,
  doors,
  catalogue,
  onAddWalkway,
  onSetJunction,
  onRenameWalkway,
  onRenameEndpoint,
  onRenameDoor,
  onDeleteWalkway,
  onAddRoom,
  onUpdateDoor,
  onSetDoorStyle,
  onDeleteDoor,
  links = [],
  onAddLink,
  onDeleteLink,
  onBuildSampleMaze,
  selectedDoorId = null,
  remainingSlots = {},
  classrooms = [],
  onSetRoomKind,
  locks = [],
  onSetDoorLock,
  onRemoveDoorLock,
}: WalkwayManagerProps) => {
  const [openWalkway, setOpenWalkway] = useState<string | null>(null);
  const [form, setForm] = useState<"hallway" | "room" | "link" | null>(null);

  // Add Room wizard: hallway → room type → name. Nothing is created until the
  // whole chain has been chosen, and the door and the shell are made together.
  const [roomStep, setRoomStep] = useState<"hallway" | "kind" | "name">("hallway");
  const [roomKind, setRoomKind] = useState<ClassroomKind>("classroom");
  const [roomName, setRoomName] = useState("");

  // Connect Hallways form state
  const [linkFrom, setLinkFrom] = useState("");
  const [linkTo, setLinkTo] = useState("");

  // Add Hallway form state
  const [hallParent, setHallParent] = useState<string>("");
  const [hallName, setHallName] = useState("");

  // Which hallway and door design the new room uses.
  const [doorWalkway, setDoorWalkway] = useState<string>("");
  const [doorStyle, setDoorStyle] = useState("");
  const [busy, setBusy] = useState(false);
  /** Why the last create failed, shown inline so a failure is never silent. */
  const [formError, setFormError] = useState("");

  /** The room behind a door — every door is a room entrance. */
  const roomOf = (doorId: string) => classrooms.find((c) => c.door_id === doorId) ?? null;
  const lockOf = (doorId: string) => locks.find((l) => l.door_id === doorId) ?? null;
  const roomLabel = (doorId: string) => roomOf(doorId)?.name ?? "Room";

  const childrenOf = (id: string | null) =>
    walkways
      .filter((w) => (w.parent_id ?? null) === id)
      .sort((a, b) => a.position - b.position);

  const roots = childrenOf(null);
  const doorsOf = (walkwayId: string) =>
    doors
      .filter((d) => d.walkway_id === walkwayId)
      .sort((a, b) => a.position_along - b.position_along);

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

  /**
   * The side and the position of a new junction are decided by the road itself:
   * branches alternate right → left, and the junction lands after everything
   * already on that hallway, so a hallway and a door are never opposite.
   */
  const autoDirection = (parentId: string): WalkwayDirection =>
    parentId ? nextBranchDirection(walkways, parentId) : "forward";
  /**
   * ONE SHARED SEQUENCE. Doors and hallways take the next slot on the road from
   * the SAME order key, so a door created after a hallway lands after that
   * hallway — door, hallway, door, hallway alternating along the corridor.
   */
  const nextSlot = (walkwayId: string): number =>
    nextObjectOffset([
      ...doors.filter((d) => d.walkway_id === walkwayId).map((d) => d.position_along),
      ...walkways
        .filter((w) => w.parent_id === walkwayId && w.direction !== "forward")
        .map((w) => w.junction_at ?? 0.5),
      ...links
        .filter((l) => l.from_walkway_id === walkwayId || l.to_walkway_id === walkwayId)
        .map((l) => (l.from_walkway_id === walkwayId ? l.from_position : l.to_position)),
    ]);
  const autoJunction = (parentId: string): number => nextSlot(parentId);

  /**
   * A hallway that has been filled between its two junctions has no wall left
   * for another door, so it is not offered — never an error message.
   */
  const hasRoom = (walkwayId: string) => (remainingSlots[walkwayId] ?? Infinity) > 0;
  const doorHallways = useMemo(() => flat.filter(({ w }) => hasRoom(w.id)), [flat, remainingSlots]);

  const openHallwayForm = (parentId?: string) => {
    const parent = parentId || hallParent || roots[0]?.id || "";
    setHallParent(parent);
    setHallName("");
    setFormError("");
    setForm("hallway");
  };

  const openRoomForm = (walkwayId?: string) => {
    const preferred = [walkwayId, doorWalkway, ...doorHallways.map(({ w }) => w.id)].find(
      (id): id is string => Boolean(id) && hasRoom(id as string),
    );
    setDoorWalkway(preferred ?? "");
    setDoorStyle("");
    setRoomKind("classroom");
    setRoomName("");
    setRoomStep(walkwayId ? "kind" : "hallway");
    setFormError("");
    setForm("room");
  };


  const submitHallway = async () => {
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      await onAddWalkway(
        roots.length === 0 ? null : hallParent,
        roots.length === 0 ? "forward" : autoDirection(hallParent),
        hallName,
        roots.length === 0 ? 0.5 : autoJunction(hallParent),
      );
      setForm(null);
    } catch (e: unknown) {
      setFormError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const submitLink = async () => {
    if (busy || !onAddLink || !linkFrom || !linkTo || linkFrom === linkTo) return;
    setBusy(true);
    setFormError("");
    try {
      await onAddLink(linkFrom, linkTo);
      setForm(null);
    } catch (e: unknown) {
      setFormError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const submitRoom = async () => {
    if (busy || !doorWalkway || roomName.trim().length === 0) return;
    setBusy(true);
    setFormError("");
    try {
      await onAddRoom(doorWalkway, {
        position_along: nextSlot(doorWalkway),
        kind: roomKind,
        name: roomName.trim(),
        style: doorStyle || null,
      });
      setForm(null);
    } catch (e: unknown) {
      setFormError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  /** Which wall the next hallway will cut through — shown, never chosen. */
  const autoSide = hallParent ? (autoDirection(hallParent) === "left" ? "left" : "right") : "right";

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
          {w.parent_id && (
            <input
              aria-label="Junction position"
              title="How far along the parent hallway this junction sits (%)"
              type="number"
              min={5}
              max={95}
              step={5}
              defaultValue={Math.round((w.junction_at ?? 0.5) * 100)}
              onBlur={(e) => {
                const v = Number(e.target.value);
                const current = Math.round((w.junction_at ?? 0.5) * 100);
                if (Number.isFinite(v) && v >= 5 && v <= 95 && v !== current) {
                  void onSetJunction(w.id, v / 100);
                } else {
                  e.target.value = String(current);
                }
              }}
              className="w-14 rounded border border-border bg-background px-1 py-1 text-right text-[11px]"
            />
          )}
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
                Terminal Wall name
                <input
                  aria-label="Terminal Wall name"
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
              {hasRoom(w.id) && (
                <button
                  type="button"
                  onClick={() => openRoomForm(w.id)}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-emerald-500/40 px-2.5 text-[11px] font-semibold text-emerald-400"
                >
                  <GraduationCap className="h-3 w-3" /> Add Room here
                </button>
              )}

            </div>

            {segDoors.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg px-1 ${
                  d.id === selectedDoorId ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex min-h-[44px] items-center gap-1">
                <select
                  aria-label="Room type"
                  value={roomOf(d.id)?.kind ?? "classroom"}
                  disabled={!roomOf(d.id) || !onSetRoomKind}
                  onChange={(e) => {
                    const room = roomOf(d.id);
                    if (room) void onSetRoomKind?.(room.id, e.target.value as ClassroomKind);
                  }}
                  className="min-h-[32px] max-w-[7.5rem] rounded-full border border-primary/40 bg-primary/10 px-1.5 text-[10px] font-bold uppercase text-primary"
                >
                  {(["classroom", "teaching_hall", "auditorium"] as ClassroomKind[]).map((k) => (
                    <option key={k} value={k}>
                      {CLASSROOM_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Room name"
                  defaultValue={roomLabel(d.id)}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== roomLabel(d.id)) void onRenameDoor?.(d.id, next);
                    else e.target.value = roomLabel(d.id);
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
                  aria-label="Room position"
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={Math.round(d.position_along * 100)}
                  onChange={(e) => onUpdateDoor(d.id, Number(e.target.value) / 100)}
                  className="w-16 accent-primary"
                />
                <button
                  type="button"
                  aria-label="Remove room"
                  onClick={() => onDeleteDoor(d.id)}
                  className="rounded p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                </div>
                {/* Door settings — the optional access lock lives here. */}
                {onSetDoorLock && onRemoveDoorLock && (
                  <DoorLockSettings
                    doorId={d.id}
                    lock={lockOf(d.id)}
                    onSetLock={onSetDoorLock}
                    onRemoveLock={onRemoveDoorLock}
                  />
                )}
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
          onClick={() => (form === "room" ? setForm(null) : openRoomForm())}
          disabled={roots.length === 0}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-emerald-500/40 px-3 text-xs font-semibold text-emerald-400 disabled:opacity-40"
        >
          <GraduationCap className="h-3.5 w-3.5" /> Add Room
        </button>
        {onAddLink && (
          <button
            type="button"
            onClick={() => {
              if (form === "link") return setForm(null);
              setLinkFrom(roots[0]?.id ?? "");
              setLinkTo(flat.find((f) => f.w.id !== (roots[0]?.id ?? ""))?.w.id ?? "");
              setFormError("");
              setForm("link");
            }}
            disabled={walkways.length < 2}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-cyan-500/40 px-3 text-xs font-semibold text-cyan-400 disabled:opacity-40"
          >
            <Link2 className="h-3.5 w-3.5" /> Connect Hallways
          </button>
        )}
        {onBuildSampleMaze && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onBuildSampleMaze();
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground disabled:opacity-40"
          >
            <Wand2 className="h-3.5 w-3.5" /> Build sample maze
          </button>
        )}
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
                  onChange={(e) => setHallParent(e.target.value)}
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
              <p className="mt-2 rounded-lg border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                The new hallway leaves{" "}
                <strong className="text-foreground">
                  {flat.find((f) => f.w.id === hallParent)?.w.name ?? "this hallway"}
                </strong>{" "}
                on the <strong className="text-foreground">{autoSide}</strong> through a cut in its
                wall, after everything already on that road. Sides alternate right, left, right —
                you never have to choose.
              </p>
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
          {formError && (
            <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              {formError}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={submitHallway}
              disabled={busy || (roots.length > 0 && !hallParent)}
              className="min-h-[38px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Creating…" : "Create Hallway"}
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

      {form === "link" && onAddLink && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Connect hallways
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            A connection joins two roads that already exist, so learners can walk round a loop
            instead of always coming back the way they came.
          </p>
          {(["from", "to"] as const).map((end) => (
            <label key={end} className="mt-2 block text-[11px] text-muted-foreground">
              {end === "from" ? "From hallway" : "To hallway"}
              <select
                aria-label={end === "from" ? "Connect from hallway" : "Connect to hallway"}
                value={end === "from" ? linkFrom : linkTo}
                onChange={(e) => (end === "from" ? setLinkFrom(e.target.value) : setLinkTo(e.target.value))}
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
          ))}
          {linkFrom === linkTo && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Choose two different hallways.
            </p>
          )}
          {formError && (
            <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              {formError}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={submitLink}
              disabled={busy || !linkFrom || !linkTo || linkFrom === linkTo}
              className="min-h-[38px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Connecting…" : "Create Connection"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="min-h-[38px] rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground"
            >
              Cancel
            </button>
          </div>
          {links.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {links.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground"
                >
                  <span className="truncate">
                    {walkways.find((w) => w.id === l.from_walkway_id)?.name ?? "Hallway"} ↔{" "}
                    {walkways.find((w) => w.id === l.to_walkway_id)?.name ?? "Hallway"}
                  </span>
                  {onDeleteLink && (
                    <button
                      type="button"
                      aria-label="Remove connection"
                      onClick={() => onDeleteLink(l.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {form === "room" && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add room</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            A room is a door and its shell together: the door is the entrance, the room is the space
            behind it.
          </p>

          {/* STEP 1 — the hallway the entrance opens off. */}
          {roomStep === "hallway" && (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              On hallway
              <select
                aria-label="Room hallway"
                value={doorWalkway}
                onChange={(e) => setDoorWalkway(e.target.value)}
                className="mt-1 min-h-[38px] w-full rounded border border-border bg-background px-2 text-sm text-foreground"
              >
                {doorHallways.map(({ w, depth }) => (
                  <option key={w.id} value={w.id}>
                    {"— ".repeat(depth)}
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* STEP 2 — the room type. */}
          {roomStep === "kind" && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Select room type</p>
              {(["classroom", "teaching_hall", "auditorium"] as ClassroomKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setRoomKind(k);
                    setRoomStep("name");
                  }}
                  className={`block w-full rounded-lg border p-2.5 text-left ${
                    roomKind === k ? "border-emerald-500/60 bg-emerald-500/10" : "border-border bg-background"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {CLASSROOM_KIND_LABEL[k]}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {CLASSROOM_KIND_BLURB[k]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* STEP 3 — the name and the door design. */}
          {roomStep === "name" && (
            <>
              <label className="mt-2 block text-[11px] text-muted-foreground">
                Room name
                <input
                  aria-label="Room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="JSS1 Mathematics"
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
                  {DOOR_STYLES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 rounded-lg border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {CLASSROOM_KIND_LABEL[roomKind]} on{" "}
                <strong className="text-foreground">
                  {flat.find((f) => f.w.id === doorWalkway)?.w.name ?? "this hallway"}
                </strong>
                . The entrance takes the next free slot along that hallway, clear of every junction.
              </p>
            </>
          )}

          {formError && (
            <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              {formError}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {roomStep !== "name" ? (
              <button
                type="button"
                disabled={!doorWalkway}
                onClick={() => setRoomStep(roomStep === "hallway" ? "kind" : "name")}
                className="min-h-[38px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={submitRoom}
                disabled={busy || !doorWalkway || roomName.trim().length === 0}
                className="min-h-[38px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy ? "Creating…" : "Create Room"}
              </button>
            )}
            {roomStep !== "hallway" && (
              <button
                type="button"
                onClick={() => setRoomStep(roomStep === "name" ? "kind" : "hallway")}
                className="min-h-[38px] rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground"
              >
                Back
              </button>
            )}
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
        branch again without limit. A room is a door plus the space behind it — the door is only the entrance to
        its room, never a shortcut to a course, and courses live inside the room.
      </p>
    </div>
  );
};

export default WalkwayManager;
