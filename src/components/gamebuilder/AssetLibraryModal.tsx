import { useEffect, useMemo, useState } from "react";
import {
  countSubSessions,
  listAssets,
  listSessions,
  listSubSessions,
  type GplAsset,
  type GplSession,
  type GplSubSession,
} from "@/lib/gpl/assetLibrary";
import { useSignedUrl } from "./SignedMedia";
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
  title?: string;
  initialCatalogCategory?: string | null;
  myGplKind?: "image" | "video" | "any";
  pickGplImmediately?: boolean;
}

const isPlaceable = (src: string) =>
  /\.(png|jpg|jpeg|webp|gif|svg|mp4|webm|mov|m4v)$/i.test(src);
const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

/**
 * Every asset inside a subcategory, whether it sits flat on `assets` or inside
 * a `groups[]` collection. The picker used to read `assets` only, so grouped
 * libraries (Video FX, Generative Video, …) looked empty until a full reload.
 */
const allAssetsOf = (sub: Subcategory): AssetItem[] => {
  const flat = sub.assets ?? [];
  const grouped = (sub.groups ?? []).flatMap((g) => g.assets ?? []);
  const seen = new Set<string>();
  return [...flat, ...grouped].filter((a) => {
    if (!a?.src || seen.has(a.src)) return false;
    seen.add(a.src);
    return true;
  });
};

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

/** Live-library tile: resolves the signed/external URL and hands it back on pick. */
const LiveAssetTile = ({
  asset,
  onPick,
}: {
  asset: GplAsset;
  onPick: (p: UrlPick) => void;
}) => {
  const signed = useSignedUrl(asset.external_url ? null : asset.storage_path);
  const url = asset.external_url || signed;
  const video = asset.media_type === "video";
  return (
    <button
      key={asset.id}
      type="button"
      disabled={!url}
      onClick={() =>
        url && onPick({ name: asset.name, src: url, mediaType: video ? "video" : "image" })
      }
      className="group overflow-hidden rounded-lg border border-border/50 bg-muted/30 transition hover:border-primary/60 disabled:opacity-50"
      title={asset.name}
    >
      <div className="aspect-square w-full">
        {url && video ? (
          <video src={url} className="h-full w-full object-contain" muted loop playsInline />
        ) : url ? (
          <img src={url} alt={asset.name} className="h-full w-full object-contain" draggable={false} />
        ) : (
          <span className="grid h-full w-full place-items-center text-lg">
            {asset.glyph ?? "🖼"}
          </span>
        )}
      </div>
      <p className="truncate px-1 pb-1 text-[11px]">{asset.name}</p>
    </button>
  );
};

const MathGplBrowser = ({
  kind,
  onPick,
  initialCategory,
}: {
  kind: AssetKind;
  onPick: (p: UrlPick) => void;
  initialCategory?: string | null;
}) => {
  const [catSlug, setCatSlug] = useState<string | null>(
    initialCategory === undefined ? defaultCategoryFor(kind) : initialCategory,
  );
  const [subSlug, setSubSlug] = useState<string | null>(null);

  // Live library (the same folders shown on the Assets page), plus the bundled
  // catalogue behind it so nothing that existed before disappears.
  const [sessions, setSessions] = useState<GplSession[]>([]);
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [subs, setSubs] = useState<GplSubSession[]>([]);
  const [liveAssets, setLiveAssets] = useState<GplAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listSessions(), countSubSessions()])
      .then(([rows, counts]) => {
        if (!alive) return;
        setSessions(rows.filter((s) => s.is_active !== false));
        setSubCounts(counts);
      })
      .catch(() => alive && setSessions([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const liveSession = useMemo(
    () => sessions.find((s) => s.slug === catSlug) ?? null,
    [sessions, catSlug],
  );
  const liveSub = useMemo(() => subs.find((s) => s.slug === subSlug) ?? null, [subs, subSlug]);

  useEffect(() => {
    if (!liveSession) {
      setSubs([]);
      return;
    }
    let alive = true;
    setLoading(true);
    listSubSessions(liveSession.id)
      .then((rows) => alive && setSubs(rows.filter((s) => s.is_active !== false)))
      .catch(() => alive && setSubs([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [liveSession]);

  useEffect(() => {
    if (!liveSub) {
      setLiveAssets([]);
      return;
    }
    let alive = true;
    setLoading(true);
    listAssets(liveSub.id)
      .then((rows) =>
        alive &&
        setLiveAssets(
          rows.filter(
            (a) => a.is_active !== false && (a.media_type === "image" || a.media_type === "video"),
          ),
        ),
      )
      .catch(() => alive && setLiveAssets([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [liveSub]);

  const managedSlugs = useMemo(() => new Set(sessions.map((s) => s.slug)), [sessions]);
  const bundledOnly = useMemo(
    () => assetCategories.filter((c) => !managedSlugs.has(c.slug)),
    [managedSlugs],
  );

  const category: Category | null = useMemo(
    () => (liveSession ? null : assetCategories.find((c) => c.slug === catSlug) ?? null),
    [catSlug, liveSession],
  );
  const subcategory: Subcategory | null = useMemo(
    () => category?.subcategories.find((s) => s.slug === subSlug) ?? null,
    [category, subSlug],
  );

  const openCategory = (slug: string) => {
    setCatSlug(slug);
    setSubSlug(null);
  };

  /* ── Level 1: every folder (live library + bundled) ── */
  if (!category && !liveSession) {
    return (
      <div className="space-y-3">
        {loading && <p className="text-xs text-muted-foreground">Loading your assets…</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openCategory(s.slug)}
              className="rounded-xl border border-border/50 bg-muted/30 p-5 text-left transition hover:border-primary/60 hover:bg-muted/50"
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {subCounts[s.id] ?? 0} collections
              </p>
            </button>
          ))}
          {bundledOnly.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => openCategory(c.slug)}
              className="rounded-xl border border-border/50 bg-muted/30 p-5 text-left transition hover:border-primary/60 hover:bg-muted/50"
            >
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.subcategories.length} collections
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Live library folder ── */
  if (liveSession) {
    if (!liveSub) {
      return (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setCatSlug(null)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All categories
          </button>
          <p className="text-sm font-semibold">{liveSession.name}</p>
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {subs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSubSlug(s.slug)}
                className="rounded-xl border border-border/50 bg-muted/30 p-4 text-left transition hover:border-primary/60 hover:bg-muted/50"
              >
                <p className="text-sm font-medium">{s.name}</p>
              </button>
            ))}
          </div>
          {!loading && !subs.length && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              This folder has no collections yet.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSubSlug(null)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {liveSession.name}
        </button>
        <p className="text-sm font-semibold">{liveSub.name}</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : liveAssets.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No placeable images or videos in this collection.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {liveAssets.map((a) => (
              <LiveAssetTile key={a.id} asset={a} onPick={onPick} />
            ))}
          </div>
        )}
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
        <p className="text-sm font-semibold">{category!.name}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {category!.subcategories.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSubSlug(s.slug)}
              className="rounded-xl border border-border/50 bg-muted/30 p-4 text-left transition hover:border-primary/60 hover:bg-muted/50"
            >
              <p className="text-sm font-medium">{s.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {allAssetsOf(s).filter((a) => isPlaceable(a.src)).length} items
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const items = allAssetsOf(subcategory).filter((a) => isPlaceable(a.src));

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setSubSlug(null)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {category!.name}
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
                className="group overflow-hidden rounded-lg border border-border/50 bg-muted/30 transition hover:border-primary/60"
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
  title = "Add asset to your game",
  initialCatalogCategory,
  myGplKind,
  pickGplImmediately,
}: AssetLibraryModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
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
                myGplKind={myGplKind}
                pickGplImmediately={pickGplImmediately}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="mathgpl"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4"
          >
            <MathGplBrowser
              kind={kind}
              initialCategory={initialCatalogCategory}
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
