/**
 * BUILDING SELECTOR — one complete building at a time.
 *
 * A building is one complete environment: its own rotating outside plus its own
 * inside (hallways, doors, rooms, locks, frames, windows, screens). This screen
 * only SELECTS; it never edits. Three shelves are browsed the same way, with
 * circular arrows, keyboard and swipe:
 *
 *   Public     — master buildings published by the platform
 *   Mine       — this account's own buildings, private unless shared
 *   Community  — buildings other people chose to share
 *
 * Using a public or community building makes a private personal copy, so a
 * master is never modified. Saving from a building always creates a new one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  DoorOpen,
  Loader2,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import BuildingSettingsSheet from "@/components/homepage/BuildingSettingsSheet";
import SaveBuildingDialog from "@/components/homepage/SaveBuildingDialog";
import { useAccount } from "@/lib/accounts/useAccount";
import { useBuildingContext } from "@/lib/homepage/useBuildingContext";
import {
  activateBuilding,
  deleteBuilding,
  listBuildings,
  nextBuildingName,
} from "@/lib/building/api";
import { saveBuildingAsNew } from "@/lib/building/versions.functions";
import { useGalleryBuilding } from "@/lib/building/gallery.functions";
import { listGalleryShelf } from "@/lib/building/galleryEntries";
import { applyExterior, readMyExterior } from "@/lib/building/exterior";
import type { Building } from "@/lib/building/types";
import type { HomepageConfig } from "@/lib/homepage/homepageConfig";
import { cn } from "@/lib/utils";

type Shelf = "public" | "mine" | "community";

const SHELVES: { key: Shelf; label: string }[] = [
  { key: "public", label: "Public" },
  { key: "mine", label: "Mine" },
  { key: "community", label: "Community" },
];

/** One complete building, whichever shelf it came from. */
interface Item {
  key: string;
  name: string;
  exterior: HomepageConfig | null;
  /** Set for own buildings; gallery entries are copied before they can be used. */
  buildingId: string | null;
  /** Set for published masters and shared community buildings. */
  entryId: string | null;
  inUse: boolean;
}

const exteriorOf = (value: unknown): HomepageConfig | null =>
  value && typeof value === "object" ? (value as HomepageConfig) : null;

const BuildingsGalleryPage = () => {
  const { orgId, isLoading } = useAccount();
  const { canManageAds } = useBuildingContext();
  const navigate = useNavigate();

  const [shelf, setShelf] = useState<Shelf>("mine");
  const [mine, setMine] = useState<Building[]>([]);
  const [publicItems, setPublicItems] = useState<Item[]>([]);
  const [communityItems, setCommunityItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const touchX = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const [own, official, community] = await Promise.all([
      listBuildings(orgId ?? null),
      listGalleryShelf("official").catch(() => []),
      listGalleryShelf("community").catch(() => []),
    ]);
    setMine(own);
    const toItem = (row: {
      id: string;
      name: string;
      exterior_config: unknown;
    }): Item => ({
      key: `entry:${row.id}`,
      name: row.name,
      exterior: exteriorOf(row.exterior_config),
      buildingId: null,
      entryId: row.id,
      inUse: false,
    });
    setPublicItems(official.map(toItem));
    setCommunityItems(community.map(toItem));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (isLoading) return;
    void refresh().catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, [isLoading, refresh]);

  const mineItems = useMemo<Item[]>(
    () =>
      mine.map((b) => ({
        key: `building:${b.id}`,
        name: b.name,
        exterior: exteriorOf(b.exterior_config),
        buildingId: b.id,
        entryId: null,
        inUse: Boolean(b.is_active),
      })),
    [mine],
  );

  const items = shelf === "mine" ? mineItems : shelf === "public" ? publicItems : communityItems;
  const total = items.length;
  const current = items[Math.min(index, Math.max(total - 1, 0))];

  const step = useCallback(
    (delta: number) => {
      if (total < 2) return;
      setIndex((i) => (i + delta + total) % total);
    },
    [total],
  );

  useEffect(() => {
    setIndex(0);
  }, [shelf]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  /** A gallery master is copied first, so the master is never modified. */
  const copyOf = async (item: Item): Promise<string> => {
    const { buildingId, exterior } = await useGalleryBuilding({
      data: { entryId: item.entryId as string, orgId: orgId ?? null },
    });
    await applyExterior(exteriorOf(exterior) ?? item.exterior);
    await refresh();
    return buildingId;
  };

  const use = async () => {
    if (!current) return;
    setBusy(true);
    try {
      if (current.entryId) {
        await copyOf(current);
        toast.success(`“${current.name}” is now yours to use`);
      } else {
        await activateBuilding(current.buildingId as string, orgId ?? null);
        await applyExterior(current.exterior);
        toast.success(`“${current.name}” is now your building`);
      }
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That building could not be opened");
    } finally {
      setBusy(false);
    }
  };

  const openSettings = async () => {
    if (!current) return;
    if (current.buildingId) {
      setSettingsOpen(true);
      return;
    }
    setBusy(true);
    try {
      const id = await copyOf(current);
      toast.success("A private copy was made — your changes stay yours");
      setShelf("mine");
      setIndex(0);
      navigate(`/homepage/building?building=${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That copy could not be made");
    } finally {
      setBusy(false);
    }
  };

  const saveAsNew = async () => {
    if (!current?.buildingId) return;
    setBusy(true);
    try {
      const exterior = current.exterior ?? (await readMyExterior());
      await saveBuildingAsNew({
        data: {
          sourceBuildingId: current.buildingId,
          orgId: orgId ?? null,
          name: nextBuildingName(mine),
          exteriorConfig: exterior,
          thumbnailUrl: null,
        },
      });
      await refresh();
      toast.success("A new building was created — this one is unchanged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The new building was not created");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current?.buildingId) return;
    setBusy(true);
    try {
      await deleteBuilding(current.buildingId);
      toast.success(`“${current.name}” was deleted`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That building was not deleted");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening your buildings…
      </main>
    );
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start == null || end == null) return;
        if (Math.abs(end - start) < 48) return;
        step(end < start ? 1 : -1);
      }}
    >
      {/* One complete building fills the screen, shown with its own outside. */}
      <RotatingAdventureScene interactive={false} configOverride={current?.exterior ?? null} />

      <Link
        to="/"
        className="fixed left-5 top-5 z-50 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm backdrop-blur transition hover:bg-background"
      >
        <ArrowLeft className="h-4 w-4" /> Homepage
      </Link>

      <div className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-border/60 bg-background/70 p-1 backdrop-blur">
        {SHELVES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setShelf(s.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition",
              shelf === s.key ? "bg-primary text-primary-foreground" : "hover:bg-muted/50",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous building"
            onClick={() => step(-1)}
            className="fixed left-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-border/60 bg-background/70 p-3 backdrop-blur transition hover:bg-background"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next building"
            onClick={() => step(1)}
            className="fixed right-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-border/60 bg-background/70 p-3 backdrop-blur transition hover:bg-background"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 bg-gradient-to-t from-background/90 to-transparent px-4 pb-6 pt-10">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{current?.name ?? "Nothing on this shelf yet"}</h1>
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `Building ${Math.min(index, total - 1) + 1} of ${total}`
              : "Choose another shelf, or save a building to start your own collection"}
            {current?.inUse ? " · in use now" : ""}
          </p>
        </div>

        {current && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button disabled={busy || current.inUse} onClick={() => void use()}>
              <Check className="mr-2 h-4 w-4" />
              {current.inUse ? "In use" : current.entryId ? "Use a copy of this" : "Use this building"}
            </Button>
            {current.inUse && (
              <Button variant="secondary" asChild>
                <Link to="/academy">
                  <DoorOpen className="mr-2 h-4 w-4" /> Go inside
                </Link>
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={() => void openSettings()}>
              <Settings2 className="mr-2 h-4 w-4" /> Settings
            </Button>
            {current.buildingId && (
              <Button variant="outline" disabled={busy} onClick={() => void saveAsNew()}>
                <CopyPlus className="mr-2 h-4 w-4" /> Save as a new building
              </Button>
            )}
            {current.buildingId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" disabled={busy || mineItems.length < 2}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{current.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Only this building and its own inside are removed. Your other buildings stay
                      exactly as they are, and no course, adventure or assignment is deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void remove()}>
                      Delete building
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>

      {current?.buildingId && (
        <>
          <BuildingSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            buildingId={current.buildingId}
            buildingName={current.name}
            canManageAds={canManageAds}
            canShare
            onShare={() => {
              setSettingsOpen(false);
              setShareOpen(true);
            }}
          />
          <SaveBuildingDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            orgId={orgId ?? null}
            buildingId={current.buildingId}
            defaultName={current.name}
            onSaved={() => void refresh()}
          />
        </>
      )}
    </div>
  );
};

export default BuildingsGalleryPage;
