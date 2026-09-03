/**
 * ACADEMY EDITOR — the real management surface for the 3D world.
 *
 * Split screen: the structure tree on the left, the live world on the right.
 * Every action here writes to the database immediately (create, rename, move,
 * reorder, hide/show, duplicate, delete, place a product), and the world beside
 * it re-reads the same rows, so what you see is what learners get.
 *
 * Below the structure tree sits the Building: the environment shell (surface
 * designs, lighting, effects) and the walkway graph with content doors.
 * Environment edits flow into the live preview as a draft and persist only on
 * "Save Changes". Doors reference existing products — never duplicate them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import BuildingSettingsPanel from "@/components/academy/editor/BuildingSettingsPanel";
import WalkwayManager from "@/components/academy/editor/WalkwayManager";
import { removeRoomLock, setRoomLock } from "@/lib/building/lock.functions";
import { indexLocksByRoom } from "@/lib/building/lock";
import type { LockCharset } from "@/lib/building/lock";
import { createSampleMaze } from "@/lib/building/sampleMaze";
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
import {
  activateBuilding,
  addRoom,
  addWalkway,
  addWalkwayLink,
  deleteWalkwayLink,
  deleteDoor,
  deleteRoom,
  deleteWalkway,
  duplicateBuilding,
  connectHallways,
  ensureBuilding,
  listBuildings,
  loadBuildingData,
  updateClassroom,
  updateClassroomOverrides,
  updateDoor,
  updateEnvironment,
  updateWalkway,
  updateWalkwayOverrides,
  uploadBuildingTexture,
} from "@/lib/building/api";
import {
  HALLWAY_ENTRY_RUN,
  HALLWAY_PAD,
  HALL_WIDTH,
  hallwayLength,
  layoutHallwayObjects,
  mergeLimits,
  nextBranchDirection,
  nextObjectOffset,
  remainingObjectSlots,
} from "@/lib/building/navigation";

import { CLASSROOM_KIND_LABEL } from "@/lib/building/types";
import type {
  Building,
  BuildingData,
  ClassroomKind,
  EnvironmentSettings,
  SurfaceKey,
  WalkwayDirection,
} from "@/lib/building/types";
import { resolveEnvironmentTextures } from "@/lib/building/textures";
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

  // ── Building layer ────────────────────────────────────────────────────────
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingData, setBuildingData] = useState<BuildingData | null>(null);
  const [previewEnv, setPreviewEnv] = useState<EnvironmentSettings | null>(null);
  const [textures, setTextures] = useState<Record<string, string>>({});
  const [buildingOpen, setBuildingOpen] = useState<Record<string, boolean>>({ env: true, walk: true });
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  /** Hallway the live preview should walk into (set after creating one). */
  const [navigateTo, setNavigateTo] = useState<string | null>(null);
  const doorPosTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEditorBuilding = useCallback(async (org: string | null) => {
let list = await listBuildings(org);
    let building: Building | null = list.find((b) => b.is_active) ?? list[0] ?? null;
    if (!building) building = await ensureBuilding(org);
    list = await listBuildings(org); // fresh after possible creation
    const data: BuildingData | null = building ? await loadBuildingData(building) : null;
    return { list, data };
  }, []);

  /** Which element the Environment panel is editing: "" = Default Settings. */
  const [settingsScope, setSettingsScope] = useState("");

  const refreshBuilding = useCallback(async () => {
    const { list, data } = await loadEditorBuilding(orgId ?? null);
    setBuildings(list);
    setBuildingData(data);
  }, [orgId, loadEditorBuilding]);

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
      await refreshBuilding();
      setLoading(false);
    })();
  }, [accountLoading, refresh, refreshBuilding]);

  // Resolve uploaded textures whenever the (draft) environment changes.
  const textureEnv = previewEnv ?? buildingData?.building.environment ?? null;
  const textureEnvKey = JSON.stringify(textureEnv);
  useEffect(() => {
    let cancelled = false;
    if (!textureEnv) {
      setTextures({});
      return;
    }
    resolveEnvironmentTextures(textureEnv).then((t) => {
      // Merge, never replace: a freshly chosen image must not blank the walls
      // that are already showing while its URL resolves.
      if (!cancelled) setTextures((prev) => ({ ...prev, ...t }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureEnvKey]);

  /** The live preview uses the draft environment until it is saved. */
  const previewData: BuildingData | null = useMemo(() => {
    if (!buildingData) return null;
    if (!previewEnv) return buildingData;
    return { ...buildingData, building: { ...buildingData.building, environment: previewEnv } };
  }, [buildingData, previewEnv]);

  const switchBuilding = useCallback(
    async (id: string) => {
      await activateBuilding(id, orgId ?? null);
      setPreviewEnv(null);
      await refreshBuilding();
    },
    [orgId, refreshBuilding],
  );

  const handleDuplicate = useCallback(async () => {
    if (!buildingData) return;
    const copy = await duplicateBuilding(buildingData.building, orgId ?? null);
    if (copy) {
      toast({
        title: "Building duplicated",
        description: `“${copy.name}” — the frame was copied; its doors start empty.`,
      });
    }
    await refreshBuilding();
  }, [buildingData, orgId, refreshBuilding]);

const handleTextureUpload = useCallback(
    async (
      surface: SurfaceKey | "door",
      blob: Blob,
      contentType: string,
      previousPath: string | null,
    ): Promise<string> => {
      if (!buildingData) throw new Error("No building loaded yet.");
      const { path } = await uploadBuildingTexture(
        buildingData.building.id,
        surface,
        blob,
        contentType,
        previousPath,
      );
      return path;
    },
    [buildingData],
  );

  /**
   * A hallway may always MEET another hallway: when it runs out of space it is
   * clamped to the connection point and a junction is made there (see
   * `mergeRoadInto` in the scene). Growth is therefore never refused — only
   * continuing PAST a junction is impossible, and that is handled by geometry.
   */

  const handleAddWalkway = useCallback(
    async (
      parentId: string | null,
      direction: WalkwayDirection,
      name?: string,
      junctionAt?: number,
    ) => {
      if (!buildingData) throw new Error("The building is still loading — try again in a moment.");
      try {
        const id = await addWalkway(
          buildingData.building.id,
          parentId,
          direction,
          name,
          junctionAt ?? 0.5,
        );
        await refreshBuilding();
        // Stand the walker in the hallway that was just created.
        if (id) {
          setNavigateTo(null);
          setTimeout(() => setNavigateTo(id), 0);
        }
      } catch (e: unknown) {
        const reason = String((e as Error)?.message ?? e);
        console.error("[building] create hallway failed", e);
        toast({ title: "Could not create hallway", description: reason, variant: "destructive" });
        throw e;
      }
    },
    [buildingData, refreshBuilding],
  );

  /**
   * Connect two hallways that already exist. Each end takes the next free slot
   * on its own road, so a connection never lands on top of a door.
   */
  const handleAddLink = useCallback(
    async (fromWalkwayId: string, toWalkwayId: string) => {
      if (!buildingData) throw new Error("The building is still loading — try again in a moment.");
      const slot = (walkwayId: string) =>
        nextObjectOffset([
          ...buildingData.doors.filter((d) => d.walkway_id === walkwayId).map((d) => d.position_along),
          ...buildingData.walkways
            .filter((w) => w.parent_id === walkwayId && w.direction !== "forward")
            .map((w) => w.junction_at ?? 0.5),
          ...buildingData.links
            .filter((l) => l.from_walkway_id === walkwayId || l.to_walkway_id === walkwayId)
            .map((l) => (l.from_walkway_id === walkwayId ? l.from_position : l.to_position)),
        ]);
      try {
        // A connection is a REAL corridor: it branches off the first hallway and
        // stops at the second one, where an open junction is created.
        const from = buildingData.walkways.find((w) => w.id === fromWalkwayId);
        const to = buildingData.walkways.find((w) => w.id === toWalkwayId);
        await connectHallways(
          buildingData.building.id,
          fromWalkwayId,
          toWalkwayId,
          { from: slot(fromWalkwayId), to: slot(toWalkwayId) },
          nextBranchDirection(buildingData.walkways, fromWalkwayId),
          `${from?.name ?? "Hallway"} → ${to?.name ?? "Hallway"}`,
        );
        await refreshBuilding();
      } catch (e: unknown) {
        const reason = String((e as Error)?.message ?? e);
        console.error("[building] create connection failed", e);
        toast({ title: "Could not connect the hallways", description: reason, variant: "destructive" });
        throw e;
      }
    },
    [buildingData, refreshBuilding],
  );

  const handleDeleteLink = useCallback(
    async (id: string) => {
      await deleteWalkwayLink(id);
      await refreshBuilding();
    },
    [refreshBuilding],
  );

  /**
   * ADD ROOM — the door and its room shell are created together as one object,
   * so a door never exists without the room it opens into.
   */
  const handleAddRoom = useCallback(
    async (
      walkwayId: string,
      fields: {
        position_along: number;
        kind: ClassroomKind;
        name: string;
        style?: string | null;
        lock?: {
          code: string;
          charset: LockCharset;
          length: number;
          maxAttempts: number | null;
          retryAfterMinutes: number | null;
        } | null;
      },
    ) => {
      if (!buildingData) throw new Error("The building is still loading — try again in a moment.");
      try {
        const { style, position_along, kind: roomKind, name } = fields;
        const { doorId, roomId } = await addRoom(buildingData.building.id, walkwayId, {
          position_along,
          kind: roomKind,
          name,
        });
        if (doorId && style) {
          await updateDoor(doorId, { design: { ...buildingData.building.environment.door, style } as never });
        }
        // The optional lock, chosen while creating the room. If it cannot be
        // stored the whole room is rolled back, so a room never exists with a
        // lock the teacher believes is protecting it.
        if (fields.lock) {
          try {
            await setRoomLock({
              data: {
                roomId,
                code: fields.lock.code,
                charset: fields.lock.charset,
                codeLength: fields.lock.length,
              },
            });
          } catch (lockError) {
            await deleteRoom(doorId).catch(() => undefined);
            throw lockError;
          }
        }
        await refreshBuilding();
        if (doorId) setSelectedDoorId(doorId);
      } catch (e: unknown) {
        const reason = String((e as Error)?.message ?? e);
        console.error("[building] create room failed", e);
        toast({ title: "Could not create room", description: reason, variant: "destructive" });
        throw e;
      }
    },
    [buildingData, refreshBuilding],
  );

  const handleDoorPosition = useCallback(
    async (id: string, position_along: number) => {
      await updateDoor(id, { position_along });
      if (doorPosTimer.current) clearTimeout(doorPosTimer.current);
      doorPosTimer.current = setTimeout(() => {
        void refreshBuilding();
      }, 400);
    },
    [refreshBuilding],
  );

  /**
   * HOW MANY MORE OBJECTS EACH HALLWAY CAN TAKE.
   *
   * A hallway that runs from one junction to another has a finite wall run: once
   * its doors and openings are spaced across it there is no wall left. Such a
   * hallway is simply not offered when adding a door, so a door can never be
   * pushed into the junction and end up standing in the middle of the road.
   * A hallway that is still free to grow always has room, because adding a door
   * lengthens it.
   */
  /**
   * Everything that can carry Individual Settings: each hallway and each
   * classroom. New elements appear automatically, so the settings architecture
   * never needs changing when the building grows.
   */
  const settingsScopes = useMemo(
    () => [
      ...(buildingData?.walkways ?? []).map((w) => ({
        id: `hallway:${w.id}`,
        label: `Hallway · ${w.name}`,
        overrides: w.surface_overrides ?? {},
      })),
      ...(buildingData?.classrooms ?? []).map((c) => ({
        id: `classroom:${c.id}`,
        label: `${CLASSROOM_KIND_LABEL[c.kind]} · ${c.name}`,
        overrides: c.surface_overrides ?? {},
      })),
    ],
    [buildingData],
  );

  const remainingSlots = useMemo(() => {
    const out: Record<string, number> = {};
    if (!buildingData) return out;
    const { walkways, doors, links } = buildingData;
    const lineLinks = links.filter((l) => !l.corridor_walkway_id);
    const objectsOf = (w: { id: string; parent_id: string | null }) =>
      layoutHallwayObjects({
        doors: doors
          .filter((d) => d.walkway_id === w.id)
          .map((d) => ({ id: d.id, name: "", order: 5 + d.position_along * 100 })),
        openings: walkways
          .filter((k) => k.parent_id === w.id && k.direction !== "forward")
          .map((k) => ({
            id: k.id,
            name: k.name,
            direction: k.direction,
            order: 5 + (k.junction_at ?? 0.5) * 100,
          })),
        links: lineLinks
          .filter((l) => l.from_walkway_id === w.id || l.to_walkway_id === w.id)
          .map((l) => ({
            id: l.id,
            name: "",
            targetWalkwayId: l.from_walkway_id === w.id ? l.to_walkway_id : l.from_walkway_id,
            order:
              5 + (l.from_walkway_id === w.id ? l.from_position : l.to_position) * 100,
          })),
        pad: w.parent_id ? HALLWAY_ENTRY_RUN : HALLWAY_PAD,
      });
    const counts = new Map<string, number>();
    const limits = mergeLimits(walkways, HALL_WIDTH, (w) => {
      const objs = objectsOf(w);
      counts.set(w.id, objs.length);
      return hallwayLength(objs, w.parent_id ? HALLWAY_ENTRY_RUN : HALLWAY_PAD);
    });
    for (const w of walkways) {
      const merged = limits.get(w.id);
      const count = counts.get(w.id) ?? objectsOf(w).length;
      out[w.id] = merged
        ? remainingObjectSlots(merged.limit, count)
        : Number.POSITIVE_INFINITY;
    }
    return out;
  }, [buildingData]);


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
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground">Building structure</h1>
            <p className="text-[11px] text-muted-foreground">
              Hallways are the paths, rooms are the destinations. Build it here, walk it on the right.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {buildings.length > 1 && (
              <select
                aria-label="Switch building"
                value={buildingData?.building.id ?? ""}
                onChange={(e) => e.target.value && switchBuilding(e.target.value)}
                className="h-9 max-w-[120px] rounded-full border border-border bg-background px-2 text-[11px]"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.is_active ? " · active" : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              aria-label="Duplicate building"
              title="Duplicate the building frame (doors start empty)"
              onClick={handleDuplicate}
              disabled={!buildingData}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <Link to="/academy" className="min-h-[40px] rounded-full border border-border px-3 py-2 text-xs font-semibold">
              View world
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">

          {/* The Building — environment + walkways + doors */}
          <div className="mt-6 border-t border-border/70 pt-4">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              The Building
            </h2>
            <p className="px-1 pb-2 text-[11px] text-muted-foreground">
              The shell learners walk through: surfaces, lighting, hallways and doors.
            </p>
            {!buildingData ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                Loading the building…
              </p>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl border border-border/70 bg-card">
                  <button
                    type="button"
                    onClick={() => setBuildingOpen((o) => ({ ...o, env: !o.env }))}
                    className="flex min-h-[44px] w-full items-center justify-between px-3 text-sm font-semibold text-foreground"
                  >
                    Environment
                    {buildingOpen.env ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {buildingOpen.env && (
                    <div className="border-t border-border/60 p-3">
<BuildingSettingsPanel
                        key={buildingData.building.id}
                        buildingId={buildingData.building.id}
                        environment={buildingData.building.environment}
                        onPreviewChange={setPreviewEnv}
                        onSave={async (env) => {
                          await updateEnvironment(buildingData.building.id, env);
                          toast({ title: "Building saved", description: "The environment is live in the world." });
                          await refreshBuilding();
                        }}
                        scopes={settingsScopes}
                        scopeId={settingsScope}
                        onScopeChange={setSettingsScope}
                        roomLock={
                          settingsScope.startsWith("classroom:")
                            ? indexLocksByRoom(buildingData.locks).get(
                                settingsScope.slice("classroom:".length),
                              ) ?? null
                            : null
                        }
                        onSetRoomLock={async (roomId, code, charset, length) => {
                          await setRoomLock({ data: { roomId, code, charset, codeLength: length } });
                          toast({ title: "Lock saved", description: "This room now asks for its code." });
                          await refreshBuilding();
                        }}
                        onRemoveRoomLock={async (roomId) => {
                          await removeRoomLock({ data: { roomId } });
                          toast({ title: "Lock removed", description: "This room opens without a code." });
                          await refreshBuilding();
                        }}
                        onSaveOverrides={async (id, overrides) => {
                          const [kind, rowId] = id.split(":");
                          if (kind === "hallway") await updateWalkwayOverrides(rowId, overrides);
                          else await updateClassroomOverrides(rowId, overrides);
                          toast({
                            title: "Individual settings saved",
                            description: "Only the fields you changed stop following the default.",
                          });
                          await refreshBuilding();
                        }}
                        onUpload={handleTextureUpload}
                        getTextureUrl={(p) => textures[p]}
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/70 bg-card">
                  <button
                    type="button"
                    onClick={() => setBuildingOpen((o) => ({ ...o, walk: !o.walk }))}
                    className="flex min-h-[44px] w-full items-center justify-between px-3 text-sm font-semibold text-foreground"
                  >
                    Hallways &amp; rooms
                    {buildingOpen.walk ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {buildingOpen.walk && (
                    <div className="border-t border-border/60 p-3">
                      <WalkwayManager
                        walkways={buildingData.walkways}
                        doors={buildingData.doors}
                        catalogue={catalogue}
                        classrooms={buildingData.classrooms}
                        onSetRoomKind={async (roomId, kind) => {
                          await updateClassroom(roomId, { kind });
                          await refreshBuilding();
                        }}
                        selectedDoorId={selectedDoorId}
                        remainingSlots={remainingSlots}

                        onAddWalkway={handleAddWalkway}
                        links={buildingData.links}
                        onAddLink={handleAddLink}
                        onDeleteLink={handleDeleteLink}
                        onBuildSampleMaze={async () => {
                          await createSampleMaze(buildingData.building.id, buildingData.walkways[0]?.id ?? null);
                          await refreshBuilding();
                        }}
                        onSetJunction={async (id, junctionAt) => {
                          await updateWalkway(id, { junction_at: junctionAt });
                          await refreshBuilding();
                        }}
                        onRenameWalkway={async (id, name) => {
                          await updateWalkway(id, { name });
                          await refreshBuilding();
                        }}
                        onRenameEndpoint={async (id, end_label) => {
                          await updateWalkway(id, { end_label });
                          await refreshBuilding();
                        }}
                        onRenameDoor={async (id, title) => {
                          const room = buildingData.classrooms.find((c) => c.door_id === id);
                          if (room) await updateClassroom(room.id, { name: title });
                          await updateDoor(id, { title_override: title });
                          await refreshBuilding();
                        }}
                        onDeleteWalkway={async (id) => {
                          await deleteWalkway(id);
                          await refreshBuilding();
                        }}
                        onAddRoom={handleAddRoom}
                        onUpdateDoor={handleDoorPosition}
                        onSetDoorStyle={async (id, style) => {
                          const door = buildingData?.doors.find((d) => d.id === id);
                          const design = { ...(door?.design ?? {}) } as Record<string, unknown>;
                          if (style) design.style = style;
                          else delete design.style;
                          await updateDoor(id, { design: design as never });
                          await refreshBuilding();
                        }}
                        onDeleteDoor={async (id) => {
                          await deleteDoor(id);
                          await refreshBuilding();
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live navigable world — the same walk navigation as View world */}
      <div className="relative min-h-[60vh] flex-1 bg-[#0b0f18]">
        {(buildingData?.walkways.length ?? 0) > 0 ? (
          <HallwayScene
            building={previewData}
            catalogue={catalogue}
            textures={textures}
            focus={focus}
            onFocusChange={setFocus}
            navigateTo={navigateTo}
            editing
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">
            Add a hallway and the corridor builds itself here — then walk into it.
          </div>
        )}
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Live world · arrows or WASD to walk, left/right at a junction
        </p>
      </div>
    </div>
  );
};

export default AcademyEditorPage;