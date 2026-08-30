/**
 * THE ACADEMY WORLD — one shared 3D product-discovery environment.
 *
 * Entered from the rotating building on the homepage. The corridor, rooms and
 * showroom shelves are all read from the database, so what a teacher builds in
 * /academy/edit is exactly what a student walks through here. The building
 * shell (walkway graph, surfaces, lighting, doors) is read the same way.
 *
 * The world page also subscribes to realtime changes on the academy hierarchy
 * and building tables, so a doorway's section count refreshes live as rooms
 * and courses are added or moved in the editor. Room doorways navigate to the
 * deep-linkable /academy/room/:roomId leaf.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Star } from "lucide-react";
import HallwayScene from "@/components/academy/world/HallwayScene";
import { ensureAcademy, loadAcademyTree, loadProductCatalogue } from "@/lib/academy/api";
import { productRoute, type AcademyProduct, type AcademyTree } from "@/lib/academy/types";
import {
  activateBuilding,
  doorRoute,
  ensureBuilding,
  listBuildings,
  loadBuildingData,
} from "@/lib/building/api";
import type { Building, BuildingData, BuildingDoor } from "@/lib/building/types";
import { resolveEnvironmentTextures } from "@/lib/building/textures";
import { useAccount } from "@/lib/accounts/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/** Tables whose changes should refresh the world live. */
const LIVE_TABLES = [
  "academy_rooms",
  "academy_categories",
  "academy_topics",
  "academy_subtopics",
  "academy_placements",
  "building_walkways",
  "building_doors",
];

const AcademyWorldPage = () => {
  const { orgId, isLoading: accountLoading } = useAccount();
  const navigate = useNavigate();
  const [tree, setTree] = useState<AcademyTree | null>(null);
  const [catalogue, setCatalogue] = useState<AcademyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(0);
  const [buildingData, setBuildingData] = useState<BuildingData | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [textures, setTextures] = useState<Record<string, string>>({});
  const [walking, setWalking] = useState(false);
  const buildingRef = useRef<BuildingData | null>(null);
  buildingRef.current = buildingData;

  useEffect(() => {
    if (accountLoading) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const academy = await ensureAcademy(orgId ?? null);
        if (!academy) {
          if (!cancelled) setError("Sign in to enter the Academy.");
          return;
        }
        const [loaded, products] = await Promise.all([
          loadAcademyTree(academy),
          loadProductCatalogue(),
        ]);
        if (cancelled) return;
        setTree(loaded);
        setCatalogue(products);

        // The building shell: view the workspace's active building; only an
        // editor creates one when none exists yet.
        let list = await listBuildings(orgId ?? null);
        let building: Building | null = list.find((b) => b.is_active) ?? list[0] ?? null;
        if (!building && loaded.canEdit) {
          building = await ensureBuilding(orgId ?? null);
        }
        if (building && !list.some((b) => b.id === building?.id)) {
          list = await listBuildings(orgId ?? null);
        }
        if (cancelled) return;
        setBuildings(list);
        setBuildingData(building ? await loadBuildingData(building) : null);
      } catch (e: unknown) {
        if (!cancelled) setError(String((e as Error)?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, accountLoading]);

  // Live refresh: debounce realtime changes on the hierarchy + building tables
  // so doorway section counts and the walkway graph stay in sync while the
  // editor is open in another tab.
  const academyId = tree?.academy.id ?? null;
  useEffect(() => {
    if (!academyId) return;
    let timer: number | undefined;
    let disposed = false;
    const reload = async () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (disposed || !tree) return;
        try {
          const [loaded, products] = await Promise.all([
            loadAcademyTree(tree.academy),
            loadProductCatalogue(),
          ]);
          if (disposed) return;
          setTree(loaded);
          setCatalogue(products);
          const b = buildingRef.current;
          if (b) setBuildingData(await loadBuildingData(b.building));
        } catch {
          // transient realtime blip — keep showing the last good state
        }
      }, 500);
    };
    const channel = supabase.channel(`academy-live-${academyId}`);
    for (const table of LIVE_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, reload);
    }
    channel.subscribe();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  // Resolve uploaded textures whenever the environment changes.
  const textureEnv = buildingData?.building.environment ?? null;
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

  const rooms = useMemo(
    () => (tree?.rooms ?? []).filter((r) => r.is_visible || tree?.canEdit),
    [tree],
  );

  /** Live section counts per room, shown on the room doorways. */
  const roomCounts = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of rooms) {
      const cats = r.categories.filter((c) => c.is_visible).length;
      const topics = r.categories.reduce(
        (n, c) => n + c.topics.filter((t) => t.is_visible).length,
        0,
      );
      out[r.id] = `${cats} section${cats === 1 ? "" : "s"} · ${topics} topic${topics === 1 ? "" : "s"}`;
    }
    return out;
  }, [rooms]);

  /** Featured shelf: every placement a teacher marked as featured, anywhere. */
  const featured = useMemo(
    () =>
      rooms.flatMap((r) =>
        r.categories.flatMap((c) =>
          c.topics.flatMap((t) =>
            t.subtopics.flatMap((s) =>
              s.placements
                .filter((p) => p.is_featured && p.is_visible)
                .map((p) => ({ placement: p, path: `${r.name} · ${t.name}` })),
            ),
          ),
        ),
      ),
    [rooms],
  );

  /** Entering a room navigates to its deep-linkable leaf route. */
  const enterRoom = useCallback(
    (id: string) => {
      navigate(`/academy/room/${id}` as never);
    },
    [navigate],
  );

  /** A door either opens an existing product, or is class-context only. */
  const handleOpenDoor = useCallback(
    (door: BuildingDoor) => {
      const route = doorRoute(door);
      if (route) {
        navigate(route as never);
        return;
      }
      toast({
        title: "Runs in class",
        description:
          "Adventures and assessments are played in class — open this product from your class dashboard.",
      });
    },
    [navigate],
  );

  const switchBuilding = useCallback(
    async (id: string) => {
      await activateBuilding(id, orgId ?? null);
      const list = await listBuildings(orgId ?? null);
      const next = list.find((b) => b.id === id) ?? null;
      setBuildings(list);
      setBuildingData(next ? await loadBuildingData(next) : null);
    },
    [orgId],
  );

  if (loading || accountLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening the Academy…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link to="/" className="rounded-full border border-border px-5 py-2 text-sm">
          Back to the building
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0f18]">
      {rooms.length > 0 ? (
        <HallwayScene
          rooms={rooms}
          building={buildingData}
          catalogue={catalogue}
          textures={textures}
          roomCounts={roomCounts}
          focus={focus}
          onFocusChange={setFocus}
          onEnterRoom={enterRoom}
          onOpenDoor={handleOpenDoor}
          onModeChange={(m) => setWalking(m === "walk")}
        />
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">The Academy hallway is empty</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            No rooms have been created yet. A teacher or administrator builds the hallway, rooms and
            shelves, then courses and games appear here for learners.
          </p>
          {tree?.canEdit && (
            <Link
              to="/academy/edit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <Pencil className="h-4 w-4" /> Build the Academy
            </Link>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4">
        <Link
          to="/"
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 text-sm font-medium text-foreground backdrop-blur"
        >
          <ChevronLeft className="h-4 w-4" /> Building
        </Link>
        <span className="pointer-events-none flex min-w-0 flex-col items-center gap-1">
          <span className="truncate text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            {tree?.academy.name || "Academy"}
          </span>
          {buildings.length > 1 && (
            <select
              aria-label="Switch building"
              value={buildingData?.building.id ?? ""}
              onChange={(e) => e.target.value && switchBuilding(e.target.value)}
              className="pointer-events-auto h-8 max-w-[220px] rounded-full border border-border/60 bg-background/80 px-3 text-[11px] text-foreground backdrop-blur"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_active ? " · active" : ""}
                </option>
              ))}
            </select>
          )}
        </span>
        {tree?.canEdit ? (
          <Link
            to="/academy/edit"
            className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-primary/50 bg-background/70 px-4 text-sm font-medium text-primary backdrop-blur"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        ) : (
          <span className="w-[92px]" />
        )}
      </div>

      {/* Corridor controls + featured shelf, hidden while walking */}
      {!walking && rooms.length > 0 && (
        <>
          <div className="absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-3 px-4">
            {featured.length > 0 && (
              <div className="flex w-full max-w-4xl gap-2 overflow-x-auto pb-1">
                {featured.slice(0, 8).map(({ placement, path }) => {
                  const route = productRoute(placement.product_kind, placement.product_id);
                  const label =
                    placement.title_override ||
                    catalogue.find(
                      (c) => c.kind === placement.product_kind && c.id === placement.product_id,
                    )?.title ||
                    "Product";
                  const body = (
                    <>
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      <span className="truncate">{label}</span>
                      <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                        {path}
                      </span>
                    </>
                  );
                  return route ? (
                    <Link
                      key={placement.id}
                      to={route}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/75 px-4 text-sm text-foreground backdrop-blur"
                    >
                      {body}
                    </Link>
                  ) : (
                    <span
                      key={placement.id}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 text-sm text-muted-foreground backdrop-blur"
                    >
                      {body}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/75 p-1 backdrop-blur">
              <button
                type="button"
                aria-label="Previous room"
                onClick={() => setFocus((f) => Math.max(0, f - 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => rooms[focus] && enterRoom(rooms[focus].id)}
                className="min-h-[44px] rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Enter {rooms[focus]?.name ?? "room"}
              </button>
              <button
                type="button"
                aria-label="Next room"
                onClick={() => setFocus((f) => Math.min(rooms.length - 1, f + 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AcademyWorldPage;