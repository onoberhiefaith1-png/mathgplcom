// "Clean transparency" review step for building artwork. The original file is
// never replaced here: the caller only receives a blob once the person picks
// it, and the caller's own save must succeed before anything changes.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Scissors, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  cleanTransparencyFile,
  TRANSPARENCY_KIND_LABEL,
  type CleanedImage,
} from "@/lib/games/imageTransparency";
import { makeBuildingTransparent } from "@/lib/games/removeBackground";

export const CLEAN_TRANSPARENCY_HINT =
  "Preserves existing transparency and removes baked checkerboard previews.";

export type CleanupChoice = "cleaned" | "original" | "background-removed";

interface Props {
  /** The picture to review; null closes the dialog. */
  source: Blob | null;
  title?: string;
  onCancel: () => void;
  /** Save the chosen picture. Throw to keep the dialog open with the error. */
  onUse: (blob: Blob, choice: CleanupChoice) => Promise<void>;
}

type Backdrop = "light" | "dark" | "checker";
const BACKDROP: Record<Backdrop, React.CSSProperties> = {
  light: { background: "#f4f4f2" },
  dark: { background: "#101521" },
  checker: {
    backgroundColor: "#fff",
    backgroundImage:
      "linear-gradient(45deg,#d0d0d0 25%,transparent 25%,transparent 75%,#d0d0d0 75%),linear-gradient(45deg,#d0d0d0 25%,transparent 25%,transparent 75%,#d0d0d0 75%)",
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0,8px 8px",
  },
};

const useObjectUrl = (blob: Blob | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
};

const Preview = ({ url, label, backdrop }: { url: string | null; label: string; backdrop: Backdrop }) => (
  <figure className="min-w-0">
    <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-border" style={BACKDROP[backdrop]}>
      {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : null}
    </div>
    <figcaption className="mt-1 text-center text-[11px] text-muted-foreground">{label}</figcaption>
  </figure>
);

const TransparencyCleanupDialog = ({ source, title = "Clean transparency", onCancel, onUse }: Props) => {
  const [result, setResult] = useState<CleanedImage | null>(null);
  const [fallback, setFallback] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"clean" | "fallback" | "save" | null>(null);
  const [backdrop, setBackdrop] = useState<Backdrop>("dark");
  const originalUrl = useObjectUrl(source);
  const cleanedBlob = fallback ?? result?.blob ?? null;
  const cleanedUrl = useObjectUrl(cleanedBlob);

  const run = useCallback(async () => {
    if (!source) return;
    setBusy("clean");
    setError(null);
    setFallback(null);
    try {
      setResult(await cleanTransparencyFile(source));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Cleaning failed.");
    } finally {
      setBusy(null);
    }
  }, [source]);

  useEffect(() => {
    setResult(null);
    setFallback(null);
    setError(null);
    if (source) void run();
  }, [source, run]);

  const removeOpaqueBackground = async () => {
    if (!source) return;
    setBusy("fallback");
    setError(null);
    try {
      const file = source instanceof File ? source : new File([source], "artwork.png", { type: source.type || "image/png" });
      setFallback(await makeBuildingTransparent(file));
    } catch (err) {
      setError(`Background removal failed: ${err instanceof Error ? err.message : "unknown error"}. The original is unchanged.`);
    } finally {
      setBusy(null);
    }
  };

  const use = async (blob: Blob, choice: CleanupChoice) => {
    setBusy("save");
    setError(null);
    try {
      await onUse(blob, choice);
    } catch (err) {
      // Keep the dialog (and the original) so the person can retry.
      setError(`Saving failed: ${err instanceof Error ? err.message : "unknown error"}. Nothing was changed — try again.`);
    } finally {
      setBusy(null);
    }
  };

  const status = busy === "clean"
    ? "Checking for transparency and baked checkerboards…"
    : busy === "fallback"
      ? "Removing the opaque background…"
      : fallback
        ? "Opaque background removed (fallback). Check pale stone, glass and doorways before using it."
        : result
          ? TRANSPARENCY_KIND_LABEL[result.kind]
          : "";

  return (
    <Dialog open={!!source} onOpenChange={(v) => !v && busy !== "save" && onCancel()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> {title}</DialogTitle>
          <DialogDescription>{CLEAN_TRANSPARENCY_HINT}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Preview on</span>
          {(["light", "dark", "checker"] as Backdrop[]).map((b) => (
            <Button key={b} size="sm" variant={backdrop === b ? "default" : "outline"} className="h-7 px-2 text-[11px] capitalize" onClick={() => setBackdrop(b)}>
              {b}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Preview url={originalUrl} label="Original" backdrop={backdrop} />
          {busy === "clean" || busy === "fallback" ? (
            <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Preview url={cleanedUrl ?? originalUrl} label={fallback ? "Background removed" : cleanedUrl ? "Cleaned" : "Unchanged"} backdrop={backdrop} />
          )}
        </div>

        {status && <p className="text-sm text-muted-foreground" aria-live="polite">{status}</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void run()}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void removeOpaqueBackground()}>
              <Scissors className="mr-1.5 h-3.5 w-3.5" /> Remove opaque background (fallback)
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!source || !!busy} onClick={() => source && void use(source, "original")}>
              Use original
            </Button>
            <Button size="sm" disabled={!cleanedBlob || !!busy} onClick={() => cleanedBlob && void use(cleanedBlob, fallback ? "background-removed" : "cleaned")}>
              {busy === "save" ? "Saving…" : fallback ? "Use background-removed" : "Use cleaned"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransparencyCleanupDialog;
