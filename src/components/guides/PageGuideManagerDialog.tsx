// Administrator management for one page's guide video. Deliberately small: no
// media library to navigate, just this page's guide.

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  deletePageGuide,
  guideVideoUrl,
  savePageGuide,
  setGuideStatus,
  type PageGuide,
} from "@/lib/guides/pageGuides";
import { pageKeyLabel } from "@/lib/guides/pageKey";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  guide: PageGuide | null;
  onSaved: (guide: PageGuide | null) => void;
}

const PageGuideManagerDialog = ({ open, onOpenChange, pageKey, guide, onSaved }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(guide?.title || `How to use ${pageKeyLabel(pageKey)}`);
    setDescription(guide?.description ?? "");
    setFile(null);
  }, [open, guide, pageKey]);

  const previewUrl = file ? URL.createObjectURL(file) : guideVideoUrl(guide?.videoPath ?? null);

  const save = async (status?: "draft" | "published") => {
    setBusy(true);
    try {
      const saved = await savePageGuide({ pageKey, title, description, file, status });
      onSaved(saved);
      toast.success(status === "published" ? "Guide published." : "Guide saved.");
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!guide) return;
    const next = guide.status === "published" ? "draft" : "published";
    setBusy(true);
    try {
      await setGuideStatus(pageKey, next);
      onSaved({ ...guide, status: next });
      toast.success(next === "published" ? "Guide published." : "Guide unpublished.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!guide) return;
    setBusy(true);
    try {
      await deletePageGuide(guide);
      onSaved(null);
      toast.success("Guide video deleted.");
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Page Guide Video</DialogTitle>
          <DialogDescription>
            {pageKeyLabel(pageKey)} · <span className="font-mono text-[11px]">{pageKey}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Status:{" "}
            <span className="font-semibold text-foreground">
              {guide ? (guide.status === "published" ? "Published" : "Unpublished") : "No guide video uploaded"}
            </span>
          </p>

          <div className="space-y-1">
            <Label htmlFor="guide-title">Title</Label>
            <Input id="guide-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="guide-desc">Description</Label>
            <Textarea
              id="guide-desc"
              rows={2}
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this page does, in one line."
            />
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              {guide?.videoPath ? "Replace video" : "Upload guide video"}
            </Button>
            {guide && (
              <>
                <Button variant="outline" size="sm" onClick={() => void toggleStatus()} disabled={busy}>
                  {guide.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => void remove()} disabled={busy}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </>
            )}
          </div>

          {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}

          {previewUrl && (
            <video src={previewUrl} controls preload="metadata" className="max-h-56 w-full rounded-lg bg-black" />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => void save("draft")} disabled={busy}>
            Save as unpublished
          </Button>
          <Button onClick={() => void save("published")} disabled={busy} className="gap-1">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save &amp; publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PageGuideManagerDialog;
