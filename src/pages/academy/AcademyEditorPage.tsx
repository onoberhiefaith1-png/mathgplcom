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
  addDoor,
  addWalkway,
  deleteDoor,
  deleteWalkway,
  duplicateBuilding,
  ensureBuilding,
  listBuildings,
  loadBuildingData,
  updateDoor,
  updateEnvironment,
  updateWalkway,
  uploadBuildingTexture,
} from "@/lib/building/api";
import type {
  Building,
  BuildingData,
  DoorContentKind,
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
      if (!cancelled) setTextures(t);
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

  const handleAddWalkway = useCallback(
    async (parentId: string | null, direction: WalkwayDirection) => {
      if (!buildingData) return;
      await addWalkway(buildingData.building.id, parentId, direction);
      await refreshBuilding();
    },
    [buildingData, refreshBuilding],
  );

  const handleAddDoor = useCallback(
    async (
      walkwayId: string,
      fields: { position_along: number; content_kind: DoorContentKind; content_id: string },
    ) => {
      if (!buildingData) return;
      await addDoor(buildingData.building.id, walkwayId, fields);
      await refreshBuilding();
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
              Hallways are the paths, doors are the destinations. Build it here, walk it on the right.
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
                    Hallways &amp; doors
                    {buildingOpen.walk ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {buildingOpen.walk && (
                    <div className="border-t border-border/60 p-3">
                      <WalkwayManager
                        walkways={buildingData.walkways}
                        doors={buildingData.doors}
                        catalogue={catalogue}
                        onAddWalkway={handleAddWalkway}
                        onUpdateWalkway={async (id, length) => {
                          await updateWalkway(id, { length });
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
                          await updateDoor(id, { title_override: title });
                          await refreshBuilding();
                        }}
                        onDeleteWalkway={async (id) => {
                          await deleteWalkway(id);
                          await refreshBuilding();
                        }}
                        onAddDoor={handleAddDoor}
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
            onOpenDoor={(door) => {
              setSelectedDoorId(door.id);
              setBuildingOpen((o) => ({ ...o, walk: true }));
            }}
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