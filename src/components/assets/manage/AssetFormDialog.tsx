// Add or edit official assets. Several files can be dropped in at once; each
// becomes its own asset. Backgrounds can be removed before the file is stored,
// so every teacher receives an already-transparent image.

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { makeTransparent, isVideoFile } from "@/lib/games/removeBackground";
import {
  GPL_SURFACES, SURFACE_LABEL, type GplAssetType, type GplSurface,
} from "@/lib/gpl/assetLibrary";
import { filesFromTransfer, linkFromTransfer } from "@/lib/clipboard/assetClipboard";

export interface AssetFormItem {
  name: string;
  description: string;
  asset_type: GplAssetType;
  glyph: string;
  external_url: string;
  file: File | null;
  surfaces: GplSurface[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Editing a single asset. Omitted when adding. */
  initial?: Partial<AssetFormItem>;
  onSave: (items: AssetFormItem[]) => Promise<void>;
}

const typeOfFile = (file: File): GplAssetType => {
  if (isVideoFile(file)) return "video";
  if (/^audio\//.test(file.type)) return "audio";
  if (/\.gif$/i.test(file.name)) return "gif";
  if (/\.(glb|gltf|fbx|obj)$/i.test(file.name)) return "model";
  return "image";
};

const baseName = (file: File) =>
  file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Asset";

const AssetFormDialog = ({ open, onClose, title, initial, onSave }: Props) => {
  const { toast } = useToast();
  const editing = !!initial;

  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [glyph, setGlyph] = useState("");
  const [url, setUrl] = useState("");
  const [surfaces, setSurfaces] = useState<GplSurface[]>([]);
  const [removeBg, setRemoveBg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setGlyph(initial?.glyph ?? "");
    setUrl(initial?.external_url ?? "");
    setSurfaces(initial?.surfaces ?? []);
    setRemoveBg(false);
    setStep("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = editing
    ? !!name.trim()
    : files.length > 0 || (!!glyph.trim() && !!name.trim()) || (!!url.trim() && !!name.trim());

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const items: AssetFormItem[] = [];

      if (files.length) {
        for (const [index, raw] of files.entries()) {
          let file = raw;
          const type = typeOfFile(raw);
          let assetType = type;
          if (removeBg && type === "image") {
            setStep(`Removing background ${index + 1} of ${files.length}…`);
            const blob = await makeTransparent(raw);
            file = new File([blob], `${baseName(raw)}.png`, { type: "image/png" });
            assetType = "transparent";
          }
          items.push({
            name: files.length === 1 && name.trim() ? name.trim() : baseName(raw),
            description,
            asset_type: assetType,
            glyph: "",
            external_url: "",
            file,
            surfaces,
          });
        }
      } else {
        items.push({
          name: name.trim(),
          description,
          asset_type: glyph.trim() ? "emoji" : initial?.asset_type ?? "image",
          glyph: glyph.trim(),
          external_url: url.trim(),
          file: null,
          surfaces,
        });
      }

      setStep("Saving…");
      await onSave(items);
      onClose();
    } catch (error) {
      toast({ title: "Could not save", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        onPaste={(e) => {
          const pasted = filesFromTransfer(e.clipboardData);
          if (pasted.length) {
            e.preventDefault();
            setFiles((prev) => [...prev, ...pasted]);
            if (!name.trim() && pasted.length === 1) setName(baseName(pasted[0]));
            return;
          }
          const link = linkFromTransfer(e.clipboardData);
          if (link) {
            e.preventDefault();
            setUrl(link);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const dropped = filesFromTransfer(e.dataTransfer);
          if (!dropped.length) return;
          e.preventDefault();
          setFiles((prev) => [...prev, ...dropped]);
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Official assets become available to every account once active.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!editing && (
            <div>
              <Label>Files (images, transparent PNGs, GIFs, video, audio, 3D models)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose files, drag them in, or copy a picture and press Ctrl/Cmd + V here.
              </p>
              <Input
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.glb,.gltf,.fbx,.obj"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="mt-1 min-h-[44px]"
              />
              {files.length === 1 && (
                <p className="mt-1 text-xs text-muted-foreground">{files[0].name}</p>
              )}
              {files.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {files.length} files — each becomes its own asset, named from its filename.
                </p>
              )}
              <label className="mt-3 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={removeBg}
                  onCheckedChange={(checked) => setRemoveBg(checked === true)}
                />
                Remove background before storing (images only)
              </label>
            </div>
          )}

          <div>
            <Label>{files.length > 1 ? "Shared description" : "Name"}</Label>
            {files.length > 1 ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1"
              />
            ) : (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Blue Diamond"
                className="mt-1 min-h-[44px]"
              />
            )}
          </div>

          {files.length <= 1 && (
            <>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Emoji (instead of a file)</Label>
                  <Input
                    value={glyph}
                    onChange={(e) => setGlyph(e.target.value)}
                    placeholder="🐿️"
                    className="mt-1 min-h-[44px] text-xl"
                  />
                </div>
                <div>
                  <Label>…or an existing URL</Label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="/assets/rewards/diamond.png"
                    className="mt-1 min-h-[44px]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <Label>Used in</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GPL_SURFACES.map((surface) => (
                <label key={surface} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={surfaces.includes(surface)}
                    onCheckedChange={(checked) =>
                      setSurfaces((prev) =>
                        checked ? [...prev, surface] : prev.filter((s) => s !== surface),
                      )
                    }
                  />
                  {SURFACE_LABEL[surface]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          {step && <span className="mr-auto text-xs text-muted-foreground">{step}</span>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !valid}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssetFormDialog;
