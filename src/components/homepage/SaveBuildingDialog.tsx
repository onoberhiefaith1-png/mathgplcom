/**
 * SAVE BUILDING — create a NEW complete building in the Building Gallery.
 *
 * One press captures the rotating exterior as it looks right now plus the whole
 * interior of the building being worked on (hallways, rooms, doors, locks,
 * frames, windows, screens, lighting, effects) and files them as one reusable
 * building. Nothing that was saved before is ever overwritten, so a library of
 * complete buildings grows one save at a time.
 *
 * Course / Adventure / Assignment connections deliberately stay behind: they
 * belong to one particular use of a building, not to the building itself.
 */
import { useEffect, useState } from "react";
import { Loader2, Plus, Share2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listGalleryCategories,
  type GalleryCategory,
  type GalleryKind,
} from "@/lib/building/galleryEntries";
import {
  canPublishToGallery,
  createGalleryCategory,
  publishBuildingToGallery,
} from "@/lib/building/gallery.functions";
import { exteriorThumbnail, readMyExterior } from "@/lib/building/exterior";
import { ensureBuilding } from "@/lib/building/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The workspace whose building is being saved (null = personal). */
  orgId?: string | null;
  /** When known, the building to capture; otherwise the active one is used. */
  buildingId?: string | null;
  defaultName?: string;
  onSaved?: () => void;
}

const SaveBuildingDialog = ({
  open,
  onOpenChange,
  orgId = null,
  buildingId = null,
  defaultName = "",
  onSaved,
}: Props) => {
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState(defaultName);
  const [official, setOfficial] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    void (async () => {
      try {
        const list = await listGalleryCategories();
        setCategories(list);
        setCategory((current) => current || list[0]?.slug || "");
      } catch (err) {
        console.error("gallery categories failed", err);
      }
      try {
        const { official: allowed } = await canPublishToGallery();
        setOfficial(allowed);
      } catch {
        setOfficial(false);
      }
    })();
  }, [open, defaultName]);

  const addCategory = async () => {
    const label = newCategory.trim();
    if (label.length < 2) return;
    setBusy(true);
    try {
      const row = await createGalleryCategory({ data: { name: label } });
      setCategories((list) =>
        list.some((c) => c.slug === row.slug)
          ? list
          : [...list, row].sort((a, b) => a.position - b.position),
      );
      setCategory(row.slug);
      setNewCategory("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that category");
    } finally {
      setBusy(false);
    }
  };

  const save = async (kind: GalleryKind) => {
    const title = name.trim();
    if (title.length < 2) {
      toast.error("Give the building a name");
      return;
    }
    setBusy(true);
    try {
      let id = buildingId;
      if (!id) {
        const active = await ensureBuilding(orgId);
        id = active?.id ?? null;
      }
      if (!id) throw new Error("There is no building to save yet.");

      const exterior = await readMyExterior();
      const thumbnail = await exteriorThumbnail(exterior);

      await publishBuildingToGallery({
        data: {
          buildingId: id,
          name: title,
          categorySlug: category,
          kind,
          exteriorConfig: exterior,
          exteriorThumbnail: thumbnail,
        },
      });
      toast.success(
        kind === "official"
          ? `“${title}” is now in the Building Gallery`
          : `“${title}” is now shared with the community`,
      );
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The building was not saved");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save building</DialogTitle>
          <DialogDescription>
            This creates a new building from the outside of your building and everything inside it —
            rooms, hallways, doors, windows, screens and lighting. Buildings you saved before are
            left exactly as they are.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Building name — e.g. Calculus Castle"
            aria-label="Building name"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Building category"
            className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {official && (
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category — e.g. Ancient"
                aria-label="New category name"
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || newCategory.trim().length < 2}
                onClick={() => void addCategory()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void save("community")}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Share to Community
            </Button>
            {official && (
              <Button disabled={busy} onClick={() => void save("official")}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Save to Building Gallery
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Links to courses, adventures and assignments are not saved with the building — whoever
            uses it decides what to connect.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveBuildingDialog;
