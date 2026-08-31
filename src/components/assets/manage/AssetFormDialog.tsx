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
  cutVideoBackground, NotKeyableError, type EdgeSoftness,
} from "@/lib/games/videoChromaCut";
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
  const [softness, setSoftness] = useState<EdgeSoftness>("normal");
  const [keySwatch, setKeySwatch] = useState<string | null>(null);
  const [detectState, setDetectState] =
    useState<"idle" | "checking" | "detected" | "not-flat">("idle");
  const [detectNote, setDetectNote] = useState("");
  const [manualKey, setManualKey] = useState<{ r: number; g: number; b: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const frameRef = useRef<{ data: Uint8ClampedArray | number[]; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const hasVideo = files.some((f) => isVideoFile(f));

  // Show the detected background colour of the first video, so the teacher can
  // see what is about to be cut before pressing save. Detection now has three
  // honest outcomes, so "checking…" no longer doubles as the failure state.
  useEffect(() => {
    const video = removeBg ? files.find((f) => isVideoFile(f)) : undefined;
    if (!video) {
      setDetectState("idle");
      setKeySwatch(null);
      setDetectNote("");
      setManualKey(null);
      setPreviewUrl(null);
      frameRef.current = null;
      return;
    }
    let cancelled = false;
    setDetectState("checking");
    setKeySwatch(null);
    setDetectNote("");
    setManualKey(null);
    const url = URL.createObjectURL(video);
    void import("@/lib/games/removeBackground")
      .then(async ({ detectMediaBackground, grabPreviewFrame }) => {
        const preview = await grabPreviewFrame(url, "video");
        if (!cancelled && preview) {
          frameRef.current = preview.frame;
          setPreviewUrl(preview.dataUrl);
        }
        return detectMediaBackground(url, "video");
      })
      .then((detection) => {
        if (cancelled) return;
        const { color, keyable, coverage, reason } = detection;
        setKeySwatch(`rgb(${color.r}, ${color.g}, ${color.b})`);
        setDetectState(keyable ? "detected" : "not-flat");
        setDetectNote(
          keyable ? `${reason} (${Math.round(coverage * 100)}% of the frame edge)` : reason,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setDetectState("not-flat");
        setKeySwatch(null);
        setDetectNote("This file could not be read for background detection.");
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [removeBg, files]);

  /** Reads the clicked pixel of the preview still as the background colour. */
  const pickFromPreview = (event: React.MouseEvent<HTMLImageElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(
      frame.w - 1,
      Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * frame.w)),
    );
    const y = Math.min(
      frame.h - 1,
      Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * frame.h)),
    );
    const i = (y * frame.w + x) * 4;
    const color = {
      r: frame.data[i] ?? 255,
      g: frame.data[i + 1] ?? 255,
      b: frame.data[i + 2] ?? 255,
    };
    setManualKey(color);
    setKeySwatch(`rgb(${color.r}, ${color.g}, ${color.b})`);
    setDetectNote("Background colour chosen by hand from the preview frame.");
  };

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setGlyph(initial?.glyph ?? "");
    setUrl(initial?.external_url ?? "");
    setSurfaces(initial?.surfaces ?? []);
    setRemoveBg(false);
    setSoftness("normal");
    setKeySwatch(null);
    setDetectState("idle");
    setDetectNote("");
    setManualKey(null);
    setPreviewUrl(null);
    setStep("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = editing
    ? !!name.trim()
    : files.length > 0 || (!!glyph.trim() && !!name.trim()) || (!!url.trim() && !!name.trim());

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const items: AssetFormItem[] = [];

      if (files.length) {
        for (const [index, raw] of files.entries()) {
          let file = raw;
          const type = typeOfFile(raw);
          let assetType = type;
          if (removeBg && type === "image") {
            setStep(`Removing background ${index + 1} of ${files.length}…`);
            try {
              const blob = await makeTransparent(raw);
              file = new File([blob], `${baseName(raw)}.png`, { type: "image/png" });
              assetType = "transparent";
            } catch (error) {
              if ((error as Error).name === "AbortError") throw error;
              toast({
                title: "Background kept",
                description: `${raw.name}: ${(error as Error).message} The original image was stored.`,
              });
            }
          } else if (removeBg && type === "video") {
            try {
              setStep(`Cutting background — 0%`);
              const cut = await cutVideoBackground(raw, {
                softness,
                signal: controller.signal,
                // A hand-picked colour overrides detection, so a clip detection
                // called busy can still be cut when the teacher knows better.
                ...(manualKey ? { keyColor: manualKey } : {}),
                onProgress: (f) =>
                  setStep(`Cutting background — ${Math.round(f * 100)}%`),
              });
              file = cut;
              assetType = "transparent";
            } catch (error) {
              if ((error as Error).name === "AbortError") throw error;
              if (error instanceof NotKeyableError) {
                toast({
                  title: "Background kept",
                  description:
                    `${raw.name}: the background isn't a flat colour, so the original video was stored untouched.`,
                });
              } else {
                toast({
                  title: "Could not cut the background",
                  description: `${raw.name}: ${(error as Error).message} The original video was stored.`,
                  variant: "destructive",
                });
              }
            }
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
                Remove background before storing (images and solid-colour videos)
              </label>

              {removeBg && hasVideo && (
                <div className="mt-3 space-y-2 rounded-md border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Background:</span>
                    {detectState === "checking" && (
                      <span className="text-muted-foreground">checking…</span>
                    )}
                    {detectState !== "checking" && keySwatch && (
                      <span
                        className="inline-block h-4 w-8 rounded border border-border"
                        style={{ backgroundColor: keySwatch }}
                        aria-label="Detected background colour"
                      />
                    )}
                    {detectState === "detected" && (
                      <span className="text-muted-foreground">flat colour found</span>
                    )}
                    {detectState === "not-flat" && !manualKey && (
                      <span className="text-destructive">not a flat colour</span>
                    )}
                    {manualKey && <span className="text-muted-foreground">chosen by hand</span>}
                  </div>
                  {detectNote && (
                    <p className="text-xs text-muted-foreground">{detectNote}</p>
                  )}
                  {previewUrl && (
                    <div>
                      <Label className="text-xs">Pick the background colour</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click anywhere on the still below to use that exact colour as the
                        background.
                      </p>
                      <img
                        src={previewUrl}
                        alt="First frame of the clip"
                        onClick={pickFromPreview}
                        className="mt-1 max-h-40 w-full cursor-crosshair rounded border border-border object-contain"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Edge softness</Label>
                    <div className="mt-1 flex gap-1">
                      {(["tight", "normal", "soft"] as EdgeSoftness[]).map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={softness === option ? "default" : "outline"}
                          onClick={() => setSoftness(option)}
                          className="min-h-[36px] capitalize"
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The clip keeps its own size, frame rate and detail — only the flat
                    background colour is cut. Transparent video plays on Chrome, Edge and
                    Firefox boards.
                  </p>
                </div>
              )}
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
          <Button
            variant="ghost"
            onClick={() => {
              if (busy) abortRef.current?.abort();
              else onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !valid}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssetFormDialog;
