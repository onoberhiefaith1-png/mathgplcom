import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Megaphone } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { assetCategories, type AssetItem } from "@/data/assets";
import {
  ensureCurrentBuildingsRegistered,
  listBuildingAssets,
  type BuildingAssetRow,
} from "@/lib/homepage/buildingAssets";
import type { BuildingVersion } from "./BuildingVersionSelector";
import type { MediaType } from "@/lib/games/types";

export interface BuildingMediaPick {
  name: string;
  src: string;
  mediaType: MediaType;
}

interface BuildingLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: BuildingVersion;
  canIncludeFreeSnapshots: boolean;
  onPickMedia: (pick: BuildingMediaPick) => void;
  onApplySnapshot: (row: BuildingAssetRow) => Promise<void>;
}

const structures = (): AssetItem[] => {
  const category = assetCategories.find(
    (candidate) => candidate.slug === "props" || candidate.name === "Props",
  );
  const subcategory = category?.subcategories.find(
    (sub) => sub.slug === "structures" || sub.name === "Structures",
  );
  return subcategory?.assets ?? [];
};

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

const BuildingLibraryModal = ({
  open,
  onOpenChange,
  target,
  canIncludeFreeSnapshots,
  onPickMedia,
  onApplySnapshot,
}: BuildingLibraryModalProps) => {
  const [snapshots, setSnapshots] = useState<BuildingAssetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const structureItems = useMemo(() => structures(), []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        await ensureCurrentBuildingsRegistered({ includeFree: canIncludeFreeSnapshots });
        const rows = await listBuildingAssets();
        if (alive) setSnapshots(rows);
      } catch (err) {
        console.error("building library load failed", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, canIncludeFreeSnapshots]);

  const applySnapshot = async (row: BuildingAssetRow) => {
    setBusyId(row.id);
    try {
      await onApplySnapshot(row);
      onOpenChange(false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle>Choose a building</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="saved" className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-3">
            <TabsList>
              <TabsTrigger value="saved" className="gap-1.5">
                <Building2 className="h-4 w-4" /> Saved buildings
              </TabsTrigger>
              <TabsTrigger value="structures" className="gap-1.5">
                <Megaphone className="h-4 w-4" /> Building art
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="saved" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : snapshots.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Saved building versions will appear here after you save one.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {snapshots.map((row) => {
                  const custom = row.config?.customBuilding ?? null;
                  return (
                    <div key={row.id} className="rounded-xl border border-border/60 bg-card/50 p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                          {custom ? (
                            <SignedMedia
                              path={custom.storagePath}
                              source={custom.source}
                              mediaType={custom.mediaType}
                              fit="contain"
                              className="h-full w-full"
                            />
                          ) : row.version === "free" ? (
                            <Megaphone className="h-6 w-6 text-primary" />
                          ) : (
                            <Building2 className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{row.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.version === "free" ? "Free building" : "Pro building"} · {new Date(row.created_at).toLocaleString()}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Applies to the {target === "free" ? "Free" : "Pro"} building only.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        disabled={busyId === row.id}
                        onClick={() => void applySnapshot(row)}
                      >
                        {busyId === row.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Apply to {target === "free" ? "Free" : "Pro"} building
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="structures" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {structureItems.map((item) => {
                const video = isVideo(item.src);
                return (
                  <button
                    key={item.src}
                    type="button"
                    onClick={() => {
                      onPickMedia({ name: item.name, src: item.src, mediaType: video ? "video" : "image" });
                      onOpenChange(false);
                    }}
                    className="overflow-hidden rounded-lg border border-border/50 bg-[conic-gradient(#0000_90deg,#8883_0)] bg-[length:16px_16px] transition hover:border-primary/60"
                    title={item.name}
                  >
                    <div className="aspect-square w-full">
                      {video ? (
                        <video
                          src={item.src}
                          className="h-full w-full object-contain"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={item.src}
                          alt={item.name}
                          draggable={false}
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <p className="truncate border-t border-border/40 px-2 py-1 text-left text-xs">
                      {item.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default BuildingLibraryModal;