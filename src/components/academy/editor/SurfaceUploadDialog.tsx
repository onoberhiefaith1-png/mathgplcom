/**
 * SURFACE UPLOAD — the teacher's "Upload your own" flow for one surface.
 *
 * Pick an image, see a 2D preview of how it will fit the surface like a
 * physical panel (cover crop, never stretched), adjust zoom / move / reset,
 * then Apply. The parent optimises the file and uploads it.
 */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SurfaceUploadDialogProps {
  open: boolean;
  /** Surface display name, e.g. "Left wall". */
  title: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen file and the placement adjustments. */
  onApply: (file: File, zoom: number, panX: number, panY: number) => void;
}

const Slider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <label className="block">
    <span className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
      {label}
      <span className="tabular-nums">{Math.round(value * 100) / 100}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-6 w-full accent-primary"
    />
  </label>
);

export default function SurfaceUploadDialog({
  open,
  title,
  onOpenChange,
  onApply,
}: SurfaceUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the dialog state each time it opens, and release the preview URL.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setWorking(false);
    }
  }, [open]);

  // Revoke a replaced preview URL so large images do not linger in memory.
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload your own image — {title}</DialogTitle>
          <DialogDescription>
            The image is fitted like a physical panel: it covers the whole surface, keeps
            its own proportions and crops the excess — it is never squeezed or distorted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 2D cover preview — mirrors the 3D fitting (zoom + pan) */}
          <div className="relative aspect-[16/7] w-full overflow-hidden rounded-lg border border-border bg-muted">
            {url ? (
              <img
                src={url}
                alt="Surface preview"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: `scale(${zoom}) translate(${-panX * 6}%, ${-panY * 6}%)` }}
              />
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">Choose an image from your device</span>
              </button>
            )}
          </div>

          {file && (
            <div className="space-y-2 rounded-lg border border-border/50 p-2.5">
              <Slider label="Zoom" value={zoom} min={0.2} max={4} step={0.05} onChange={setZoom} />
              <div className="grid grid-cols-2 gap-2">
                <Slider label="Move left / right" value={panX} min={-2} max={2} step={0.05} onChange={setPanX} />
                <Slider label="Move up / down" value={panY} min={-2} max={2} step={0.05} onChange={setPanY} />
              </div>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPanX(0);
                  setPanY(0);
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset (fit the surface)
              </button>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="min-h-[40px] rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </DialogClose>
          <button
            type="button"
            disabled={!file || working}
            onClick={() => {
              if (!file) return;
              setWorking(true);
              try {
                onApply(file, zoom, panX, panY);
              } finally {
                setWorking(false);
              }
            }}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply to {title}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}