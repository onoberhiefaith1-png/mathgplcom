// Create / edit a Session or Sub-Session, including how its folder looks:
// upload a cover, paste a URL, choose an emoji, or generate artwork with AI.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Upload } from "lucide-react";

import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { uploadOfficialFile } from "@/lib/gpl/assetLibrary";
import { generateFolderCover } from "@/lib/gpl/cover.functions";
import FolderCover, { STORAGE_PREFIX } from "./FolderCover";

export interface FolderFormDraft {
  name: string;
  description: string;
  icon: string;
  image_url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  initial?: Partial<FolderFormDraft>;
  onSave: (draft: FolderFormDraft) => Promise<void>;
}

const FolderFormDialog = ({ open, onClose, title, initial, onSave }: Props) => {
  const generate = useServerFn(generateFolderCover);
  const { toast } = useToast();
  const [draft, setDraft] = useState<FolderFormDraft>({
    name: "", description: "", icon: "", image_url: "",
  });
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<"upload" | "ai" | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      icon: initial?.icon ?? "",
      image_url: initial?.image_url ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const uploadCover = async (file: File) => {
    setWorking("upload");
    try {
      const path = await uploadOfficialFile(file, "covers", "folders");
      setDraft((d) => ({ ...d, image_url: `${STORAGE_PREFIX}${path}` }));
    } catch (error) {
      toast({ title: "Upload failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const generateCover = async () => {
    if (!draft.name.trim()) {
      toast({ title: "Name the folder first", description: "The artwork is built from the name." });
      return;
    }
    setWorking("ai");
    try {
      const { path } = await generate({
        data: { name: draft.name.trim(), hint: draft.description.trim() },
      });
      setDraft((d) => ({ ...d, image_url: `${STORAGE_PREFIX}${path}` }));
    } catch (error) {
      toast({ title: "Could not generate artwork", description: (error as Error).message, variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const submit = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onClose();
    } catch (error) {
      toast({ title: "Could not save", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Environment"
              className="mt-1 min-h-[44px]"
            />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label>How this folder looks</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                <FolderCover value={draft.image_url} icon={draft.icon} name={draft.name || "Folder"} />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:border-primary/60">
                  <Upload className="h-4 w-4" /> Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadCover(file);
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[38px] gap-2"
                  disabled={working !== null}
                  onClick={() => void generateCover()}
                >
                  {working === "ai" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate with AI
                </Button>
              </div>
            </div>
            {working === "upload" && (
              <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Emoji (used when there is no cover)</Label>
              <Input
                value={draft.icon}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                placeholder="🌳"
                className="mt-1 min-h-[44px] text-xl"
              />
            </div>
            <div>
              <Label>…or a cover image URL</Label>
              <Input
                value={draft.image_url.startsWith(STORAGE_PREFIX) ? "" : draft.image_url}
                onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
                placeholder="https://…"
                className="mt-1 min-h-[44px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !draft.name.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FolderFormDialog;
