import { useMemo, useState } from "react";
import { ArrowLeft, Sparkles, Upload as UploadIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssetsPanel from "./AssetsPanel";
import { assetCategories, type AssetItem, type Category, type Subcategory } from "@/data/assets";
import type { AssetKind, GameAssetRow, MediaType } from "@/lib/games/types";

export interface UrlPick {
  name: string;
  src: string;
  mediaType: MediaType;
}

interface AssetLibraryModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: AssetKind;
  onKindChange: (k: AssetKind) => void;
  onPickUploaded: (asset: GameAssetRow) => void;
  onPickUrl: (pick: UrlPick) => void;
  onPickPreset: (presetId: string) => void;
}

const isPlaceable = (src: string) =>
  /\.(png|jpg|jpeg|webp|gif|svg|mp4|webm|mov|m4v)$/i.test(src);
const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

const defaultCategoryFor = (kind: AssetKind): string => {
  switch (kind) {
    case "background":
      return "environment";
    case "effect":
      return "effects";
    default:
      return "rewards";
  }
};

const MathGplBrowser = ({ kind, onPick }: { kind: AssetKind; onPick: (p: UrlPick) => void }) => {
  const [catSlug, setCatSlug] = useState<string | null>(defaultCategoryFor(kind));
  const [subSlug, setSubSlug] = useState<string | null>(null);

  const category: Category | null = useMemo(
    () => assetCategories.find((c) => c.slug === catSlug) ?? null,
    [catSlug],
  );
  const subcategory: Subcategory | null = useMemo(
    () => category?.subcategories.find((s) => s.slug === subSlug) ?? null,
    [category, subSlug],
  );

  if (!category) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {assetCategories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => {
              setCatSlug(c.slug);
              setSubSlug(null);
            }}
            className="rounded-xl border border-border/50 bg-muted/30 p-5 text-left transition hover:border-primary/60 hover:bg-muted/50"
          >
            <p className="text-sm font-semibold">{c.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.subcategories.length} collections
            </p>
          </button>
        ))}
      </div>
    );
  }

  if (!subcategory) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCatSlug(null)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All categories
        </button>
        <p className="text-sm font-semibold">{category.name}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {category.subcategories.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSubSlug(s.slug)}
              className="rounded-xl border border-border/50 bg-muted/30 p-4 text-left transition hover:border-primary/60 hover:bg-muted/50"
            >
              <p className="text-sm font-medium">{s.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {(s.assets ?? []).length} items
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const items = (subcategory.assets ?? []).filter((a) => isPlaceable(a.src));

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setSubSlug(null)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {category.name}
      </button>
      <p className="text-sm font-semibold">{subcategory.name}</p>
      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No placeable images or videos in this collection.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((a: AssetItem) => {
            const video = isVideo(a.src);
            return (
              <button
                key={a.src}
                type="button"
                onClick={() =>
                  onPick({ name: a.name, src: a.src, mediaType: video ? "video" : "image" })
                }
                className="group overflow-hidden rounded-lg border border-border/50 bg-[conic-gradient(#0000_90deg,#8883_0)] bg-[length:16px_16px] transition hover:border-primary/60"
                title={a.name}
              >
                <div className="aspect-square w-full">
                  {video ? (
                    <video
                      src={a.src}
                      className="h-full w-full object-contain"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={a.src}
                      alt={a.name}
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AssetLibraryModal = ({
  open,
  onOpenChange,
  kind,
  onKindChange,
  onPickUploaded,
  onPickUrl,
  onPickPreset,
}: AssetLibraryModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle>Add asset to your game</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-3">
            <TabsList>
              <TabsTrigger value="upload" className="gap-1.5">
                <UploadIcon className="h-4 w-4" /> Upload
              </TabsTrigger>
              <TabsTrigger value="mathgpl" className="gap-1.5">
                <Sparkles className="h-4 w-4" /> From MathGPL Assets
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upload" className="mt-0 min-h-0 flex-1 overflow-hidden px-5 py-4">
            <div className="h-full">
              <AssetsPanel
                onPick={(a) => {
                  onPickUploaded(a);
                  onOpenChange(false);
                }}
                onPickPreset={(id) => {
                  onPickPreset(id);
                  onOpenChange(false);
                }}
                value={kind}
                onValueChange={(v) => onKindChange(v as AssetKind)}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="mathgpl"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4"
          >
            <MathGplBrowser
              kind={kind}
              onPick={(p) => {
                onPickUrl(p);
                onOpenChange(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AssetLibraryModal;
