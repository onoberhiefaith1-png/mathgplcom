/**
 * CHOOSE BUILDING — the collection of complete buildings, one at a time.
 *
 * Every entry here is a whole independent environment: its own rotating outside
 * plus its own inside (hallways, doors, rooms, locks, frames, windows, screens).
 * Browsing shows exactly one building filling the screen; the arrows move to the
 * next one. Nothing is merged: using, copying or deleting one building never
 * touches another, and no course, adventure or assignment is ever duplicated or
 * removed, because rooms only ever point at them.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Loader2,
  PencilRuler,
  Trash2,
  Check,
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
import { useAccount } from "@/lib/accounts/useAccount";
import {
  activateBuilding,
  deleteBuilding,
  listBuildings,
  nextBuildingName,
} from "@/lib/building/api";
import { saveBuildingAsNew } from "@/lib/building/versions.functions";
import { applyExterior, readMyExterior } from "@/lib/building/exterior";
import type { Building } from "@/lib/building/types";
import type { HomepageConfig } from "@/lib/homepage/homepageConfig";

const exteriorOf = (building: Building | undefined): HomepageConfig | null =>
  (building?.exterior_config as HomepageConfig | undefined) ?? null;

const BuildingsGalleryPage = () => {
  const { orgId, isLoading } = useAccount();
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listBuildings(orgId ?? null);
    setBuildings(list);
    setIndex((i) => Math.min(i, Math.max(list.length - 1, 0)));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (isLoading) return;
    void refresh().catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, [isLoading, refresh]);

  const current = buildings[index];
  const total = buildings.length;
  const step = (delta: number) => {
    if (total < 2) return;
    setIndex((i) => (i + delta + total) % total);
  };

  const use = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await activateBuilding(current.id, orgId ?? null);
      await applyExterior(exteriorOf(current));
      toast.success(`“${current.name}” is now your building`);
      void navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That building could not be opened");
    } finally {
      setBusy(false);
    }
  };

  const saveAsNew = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const exterior = exteriorOf(current) ?? (await readMyExterior());
      await saveBuildingAsNew({
        data: {
          sourceBuildingId: current.id,
          orgId: orgId ?? null,
          name: nextBuildingName(buildings),
          exteriorConfig: exterior,
          thumbnailUrl: current.thumbnail_url ?? null,
        },
      });
      await refresh();
      toast.success("A new building was created from this one");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The new building was not created");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await deleteBuilding(current.id);
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
    <div className="relative h-screen w-screen overflow-hidden">
      {/* One complete building fills the screen, shown with its own outside. */}
      <RotatingAdventureScene
        interactive={false}
        configOverride={exteriorOf(current)}
      />

      <Link
        to="/"
        className="fixed left-5 top-5 z-50 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm backdrop-blur transition hover:bg-background"
      >
        <ArrowLeft className="h-4 w-4" /> Homepage
      </Link>

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
          <h1 className="text-2xl font-semibold">{current?.name ?? "No buildings yet"}</h1>
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `Building ${index + 1} of ${total}` : "Save a building and it appears here"}
            {current?.is_active ? " · in use now" : ""}
          </p>
        </div>

        {current && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button disabled={busy || current.is_active} onClick={() => void use()}>
              <Check className="mr-2 h-4 w-4" />
              {current.is_active ? "In use" : "Use this building"}
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/academy/edit">
                <PencilRuler className="mr-2 h-4 w-4" /> Building settings
              </Link>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void saveAsNew()}>
              <CopyPlus className="mr-2 h-4 w-4" /> Save as a new building
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" disabled={busy || total < 2}>
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
                  <AlertDialogAction onClick={() => void remove()}>Delete building</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildingsGalleryPage;
