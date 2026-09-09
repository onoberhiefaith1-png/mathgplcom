/**
 * CHOOSE A BUILDING — the single entry point of the Building layer.
 *
 * The gallery is the main visual: one building at a time, walked live in 3D,
 * browsed by category with swipe or arrows. Below the preview sit the settings
 * of the ACTIVE building, passed in as children, so there is exactly one place
 * that edits a building and no duplicated settings anywhere.
 *
 * Selecting a building copies the whole package into this workspace. The
 * published original is a template and is never modified.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Share2, Upload } from "lucide-react";
import HallwayScene from "@/components/academy/world/HallwayScene";
import { toast } from "@/hooks/use-toast";
import type { AcademyProduct } from "@/lib/academy/types";
import type { BuildingData } from "@/lib/building/types";
import { resolveEnvironmentTextures } from "@/lib/building/textures";
import {
  GALLERY_KIND_LABEL,
  listGalleryCategories,
  listGalleryEntries,
  type GalleryCategory,
  type GalleryEntry,
  type GalleryKind,
} from "@/lib/building/galleryEntries";
import {
  canPublishToGallery,
  createGalleryCategory,
  listMyGalleryEntries,
  loadGalleryBuilding,
  publishBuildingToGallery,
  useGalleryBuilding,
} from "@/lib/building/gallery.functions";
import { applyExterior, exteriorThumbnail, readMyExterior } from "@/lib/building/exterior";
import type { HomepageConfig } from "@/lib/homepage/homepageConfig";

interface MyEntry {
  id: string;
  name: string;
  kind: GalleryKind;
  category_slug: string;
  published: boolean;
  published_at: string;
}

interface Props {
  /** The building that is active right now; its settings are the ones shown. */
  activeBuildingId: string | null;
  activeBuildingName: string;
  orgId: string | null;
  catalogue: AcademyProduct[];
  /** Called after a different building becomes active. */
  onSelected: () => Promise<void> | void;
  /** The existing Building Settings panel for the active building. */
  children: React.ReactNode;
}

const ChooseBuildingPanel = ({
  activeBuildingId,
  activeBuildingName,
  orgId,
  catalogue,
  onSelected,
  children,
}: Props) => {
  const [source, setSource] = useState<GalleryKind>("official");
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [category, setCategory] = useState<string>("");
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [preview, setPreview] = useState<BuildingData | null>(null);
  const [previewTextures, setPreviewTextures] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  // The building's face: the rotating exterior saved with the entry.
  const [previewFace, setPreviewFace] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPublishOfficial, setCanPublishOfficial] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishCategory, setPublishCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const touchStart = useRef<number | null>(null);

  const loadMine = useCallback(async () => {
    try {
      setMyEntries((await listMyGalleryEntries()) as MyEntry[]);
    } catch {
      setMyEntries([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listGalleryCategories();
        setCategories(list);
        setCategory((current) => current || list[0]?.slug || "");
        setPublishCategory((current) => current || list[0]?.slug || "");
      } catch (e) {
        console.error("gallery categories failed", e);
      }
      try {
        const { official } = await canPublishToGallery();
        setCanPublishOfficial(official);
        if (official) await loadMine();
      } catch {
        setCanPublishOfficial(false);
      }
    })();
  }, [loadMine]);

  useEffect(() => {
    if (!category) return;
    let alive = true;
    setLoadingList(true);
    void (async () => {
      try {
        const rows = await listGalleryEntries({ kind: source, categorySlug: category });
        if (!alive) return;
        setEntries(rows);
        setIndex(0);
      } catch (e) {
        console.error("gallery entries failed", e);
        if (alive) setEntries([]);
      } finally {
        if (alive) setLoadingList(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [category, source]);

  const current = entries[index] ?? null;

  // One building at a time is loaded, complete, and walked live.
  useEffect(() => {
    if (!current) {
      setPreview(null);
      return;
    }
    let alive = true;
    setLoadingPreview(true);
    void (async () => {
      try {
        const data = await loadGalleryBuilding({ data: { entryId: current.id } });
        if (!alive) return;
        setPreviewFace((data as { exteriorThumbnail?: string | null }).exteriorThumbnail ?? null);
        const built = {
          ...data,
          canEdit: false,
        } as unknown as BuildingData;
        setPreview(built);
        const pictures = (built.frames ?? []).map((f) => f.content_path);
        const textures = await resolveEnvironmentTextures(
          built.building.environment,
          [],
          pictures,
        );
        if (alive) setPreviewTextures(textures);
      } catch (e) {
        console.error("gallery preview failed", e);
        if (alive) setPreview(null);
      } finally {
        if (alive) setLoadingPreview(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [current?.id]);

  const move = useCallback(
    (delta: number) => {
      setIndex((i) => {
        if (entries.length === 0) return 0;
        return (i + delta + entries.length) % entries.length;
      });
    },
    [entries.length],
  );

  /** Bring a gallery building in as this workspace's building, complete. */
  const useEntry = async (entryId: string, name: string) => {
    setBusy(true);
    try {
      const result = await useGalleryBuilding({ data: { entryId, orgId } });
      // The exterior travels with the building, so the outside and the inside
      // arrive together instead of an interior on somebody else's face.
      await applyExterior((result?.exterior ?? null) as HomepageConfig | null);
      toast({
        title: canPublishOfficial ? "Building opened" : "Building selected",
        description: `“${name}” is now your building — outside, hallways, rooms and all.`,
      });
      await onSelected();
    } catch (e) {
      toast({
        title: "Could not use that building",
        description: String((e as Error).message),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const publish = async (kind: GalleryKind) => {
    if (!activeBuildingId) return;
    const name = publishName.trim() || activeBuildingName;
    setBusy(true);
    try {
      const exterior = await readMyExterior();
      await publishBuildingToGallery({
        data: {
          buildingId: activeBuildingId,
          name,
          categorySlug: publishCategory,
          kind,
          exteriorConfig: exterior,
          exteriorThumbnail: await exteriorThumbnail(exterior),
        },
      });
      toast({
        title: kind === "official" ? "Saved to the Building Gallery" : "Shared to Community",
        description: `“${name}” is available with everything inside it.`,
      });
      setPublishOpen(false);
      setPublishName("");
      await loadMine();
      if (kind === source) {
        const rows = await listGalleryEntries({ kind: source, categorySlug: category });
        setEntries(rows);
      }
    } catch (e) {
      toast({
        title: "Could not publish",
        description: String((e as Error).message),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (name.length < 2) return;
    setBusy(true);
    try {
      const row = await createGalleryCategory({ data: { name } });
      setCategories((list) =>
        list.some((c) => c.slug === row.slug) ? list : [...list, row].sort((a, b) => a.position - b.position),
      );
      setPublishCategory(row.slug);
      setNewCategory("");
      toast({ title: "Category added", description: row.name });
    } catch (e) {
      toast({
        title: "Could not add that category",
        description: String((e as Error).message),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const counter = useMemo(
    () => (entries.length ? `${index + 1} of ${entries.length}` : "none yet"),
    [entries.length, index],
  );

  return (
    <div className="space-y-3">
      {canPublishOfficial ? (
        <p className="text-[11px] text-muted-foreground">
          Create Building — the building below is a starting template. Open one, change it with the
          settings underneath, then Save it into the MATHGPL Gallery as a new building. The template
          you started from never changes.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Choose Building — walk each one, then use it. It arrives complete, and anything you change
          afterwards belongs only to you.
        </p>
      )}

      {canPublishOfficial && myEntries.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card/60 p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">Buildings you created</p>
          <div className="flex flex-wrap gap-1.5">
            {myEntries.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => void useEntry(m.id, m.name)}
                className="min-h-[30px] rounded-full border border-border px-3 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                {m.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Picking one opens it here as the building you are working on.
          </p>
        </div>
      )}

      {/* Source + categories */}
      <div className="flex flex-wrap gap-1.5">
        {(["official", "community"] as GalleryKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSource(k)}
            className={`min-h-[32px] rounded-full border px-3 text-[11px] font-semibold ${
              source === k
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {GALLERY_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCategory(c.slug)}
            className={`min-h-[32px] rounded-full border px-3 text-[11px] ${
              category === c.slug
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* One building, as large as the panel allows */}
      <div
        className="relative h-[300px] overflow-hidden rounded-xl border border-border/70 bg-[#0b0f18]"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          const end = e.changedTouches[0]?.clientX ?? null;
          touchStart.current = null;
          if (start === null || end === null) return;
          if (Math.abs(end - start) < 40) return;
          move(end < start ? 1 : -1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          if (e.key === "ArrowLeft") move(-1);
        }}
        tabIndex={0}
        role="group"
        aria-label="Building preview"
      >
        {loadingList || loadingPreview ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : preview && (preview.walkways?.length ?? 0) > 0 ? (
          <HallwayScene
            key={current?.id}
            building={preview}
            catalogue={catalogue}
            textures={previewTextures}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-300">
            {entries.length === 0
              ? source === "official"
                ? "No buildings have been published in this category yet."
                : "Nobody has shared a building in this category yet."
              : "This building has no hallways to walk yet."}
          </div>
        )}

        {previewFace && (
          <img
            src={previewFace}
            alt={`${current?.name ?? "Building"} seen from outside`}
            className="pointer-events-none absolute left-2 top-2 h-16 w-16 rounded-lg border border-white/25 bg-black/40 object-contain p-1"
          />
        )}

        {entries.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous building"
              onClick={() => move(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/40 text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next building"
              onClick={() => move(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/40 text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
          <span className="truncate text-xs font-semibold text-white">
            {current?.name ?? "Building gallery"}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">{counter}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!current || busy}
          onClick={() => current && void useEntry(current.id, current.name)}
          className="min-h-[36px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {canPublishOfficial ? "Open as my template" : "Use this building"}
        </button>
        <button
          type="button"
          onClick={() => setPublishOpen((o) => !o)}
          disabled={!activeBuildingId}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-xs disabled:opacity-40"
        >
          {canPublishOfficial ? (
            <>
              <Upload className="h-3.5 w-3.5" /> Save building
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" /> Share my building
            </>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Active: <span className="font-semibold text-foreground">{activeBuildingName}</span>
        </p>
      </div>

      {publishOpen && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
          <p className="text-[11px] text-muted-foreground">
            Saving takes a complete copy of this building — its rotating outside plus rooms, doors,
            frames, windows, lighting and effects. Course, adventure and assignment links stay
            behind, and the building you are working on keeps working exactly as it is.
          </p>
          <input
            value={publishName}
            onChange={(e) => setPublishName(e.target.value)}
            placeholder={`Building name — ${activeBuildingName}`}
            aria-label="Building name"
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
          />
          <select
            value={publishCategory}
            onChange={(e) => setPublishCategory(e.target.value)}
            aria-label="Building category"
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {canPublishOfficial && (
            <div className="flex gap-1.5">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category — e.g. Ancient"
                aria-label="New category name"
                className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
              />
              <button
                type="button"
                disabled={busy || newCategory.trim().length < 2}
                onClick={() => void addCategory()}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-border px-3 text-xs disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish("community")}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-border px-3 text-xs disabled:opacity-40"
            >
              <Share2 className="h-3.5 w-3.5" /> Share to Community
            </button>
            {canPublishOfficial && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void publish("official")}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" /> Save to MATHGPL Gallery
              </button>
            )}
          </div>
        </div>
      )}

      {/* The settings of the ACTIVE building — the only settings surface. */}
      <div className="border-t border-border/60 pt-3">{children}</div>
    </div>
  );
};

export default ChooseBuildingPanel;
