import { useEffect, useRef, useState } from "react";
import { Brush, Eraser, Loader2, Scissors, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { flowUrl, uploadFlowBlob } from "@/lib/flow/api";
import { grabFrame, segmentVideo } from "@/lib/flow/segmentVideo";
import type { FlowClip } from "@/lib/flow/types";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  clip: FlowClip;
  notebookId: string;
  onChange: (patch: Partial<FlowClip>) => void;
}

export const ClipProcessor = ({ clip, notebookId, onChange }: Props) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [brushOpen, setBrushOpen] = useState(false);
  const [qa, setQa] = useState<{ total: number; repaired: number; model: string; checking: boolean; flagged: { t: number; issue: string }[]; error?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = async (refineMaskPath = clip.refineMaskPath) => {
    const url = await flowUrl(clip.path);
    if (!url) return;
    const refineUrl = refineMaskPath ? await flowUrl(refineMaskPath) : null;
    abort.current = new AbortController();
    setProgress(0);
    setQa(null);
    try {
      const { blob, report } = await segmentVideo({ url, refineMaskUrl: refineUrl, onProgress: setProgress, onStage: setStage, signal: abort.current.signal, edgeStrength: clip.edgeStrength ?? "normal" });
      const path = await uploadFlowBlob(notebookId, blob, "webm");
      onChange({ processedPath: path, removeBg: false });
      toast({ title: "Matte built", description: `${clip.name}: ${report.repaired} broken frames repaired` });
      setQa({ total: report.total, repaired: report.repaired, model: report.model, checking: true, flagged: [] });
      const { data, error } = await supabase.functions.invoke("flow-qa", { body: { frames: report.samples } });
      const flagged = ((data as any)?.frames ?? [])
        .filter((f: any) => f && f.ok === false)
        .map((f: any) => ({ t: f.index / report.fps, issue: f.issue ?? "Needs attention" }));
      setQa((q) => q && { ...q, checking: false, flagged, error: error ? "AI check unavailable" : (data as any)?.error ? "AI check unavailable" : undefined });
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Matte build failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  if (progress !== null) {
    return (
      <div className="flex w-56 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <Progress value={progress * 100} className="h-2 flex-1" />
        <span className="w-9 text-right text-xs tabular-nums">{Math.round(progress * 100)}%</span>
        <button aria-label="Cancel" onClick={() => abort.current?.abort()} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
      </div>
      <span className="text-[10px] text-muted-foreground">{stage || "Starting…"}</span>
      </div>
    );
  }

  const status =
    clip.transparency === "alpha" ? "Transparent Video — alpha channel preserved"
    : clip.transparency === "checker" ? "Transparent Video — transparency restored during playback"
    : clip.transparency === "opaque" ? "This video is opaque: it contains no transparency"
    : "Transparent Video — plays straight away";

  return (
    <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5">
      <select aria-label="Alpha edge tightness" title="How tightly the alpha edge is trimmed" value={clip.edgeStrength ?? "normal"} onChange={(e) => onChange({ edgeStrength: e.target.value as any })} className="h-7 rounded-md border border-input bg-background px-1 text-xs">
        <option value="soft">Soft</option><option value="normal">Normal</option><option value="tight">Tight</option>
      </select>
      {!clip.processedPath && <span className="text-[10px] text-muted-foreground">{status}</span>}
      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setBrushOpen(true)} title="Optional alpha / matte refinement">
        <Brush className="h-3.5 w-3.5" /> Alpha Refine
      </Button>
      {clip.processedPath ? (
        <button className="text-xs text-muted-foreground underline" onClick={() => onChange({ processedPath: null })}>Use original</button>
      ) : clip.transparency !== "alpha" ? (
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" title="Optional: build a matte for clips that have no transparency at all" onClick={() => run()}>
          <Scissors className="h-3.5 w-3.5" /> Build matte
        </Button>
      ) : null}
    </div>

    {qa && (
      <div className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px]">
        {qa.total} frames checked ({qa.model}), {qa.repaired} repaired.{" "}
        {qa.checking ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> AI checking…</span>
          : qa.error ? <span className="text-muted-foreground">{qa.error}</span>
          : qa.flagged.length === 0 ? <span>AI check: all sampled frames look clean.</span>
          : <span className="text-destructive">{qa.flagged.length} still need attention: {qa.flagged.map((f) => `${f.t.toFixed(1)}s (${f.issue})`).join("; ")}. Use Refine on those moments.</span>}
      </div>
    )}
      {brushOpen && (
        <MaskBrush
          clip={clip}
          onClose={() => setBrushOpen(false)}
          onSave={async (blob) => {
            const path = await uploadFlowBlob(notebookId, blob, "png");
            onChange({ refineMaskPath: path });
            setBrushOpen(false);
            run(path);
          }}
        />
      )}
    </div>
  );
};

const MaskBrush = ({ clip, onClose, onSave }: { clip: FlowClip; onClose: () => void; onSave: (b: Blob) => void }) => {
  const [frame, setFrame] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [mode, setMode] = useState<"keep" | "remove">("keep");
  const [size, setSize] = useState(24);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let alive = true;
    flowUrl(clip.path).then(async (u) => { if (u) { const f = await grabFrame(u, t); if (alive) setFrame(f); } });
    return () => { alive = false; };
  }, [clip.path, t]);

  // Load existing refinement strokes once.
  const loaded = useRef(false);
  const onImgLoad = async (img: HTMLImageElement) => {
    const c = canvasRef.current;
    if (!c || loaded.current) return;
    loaded.current = true;
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    if (clip.refineMaskPath) {
      const u = await flowUrl(clip.refineMaskPath);
      if (u) {
        const m = new Image(); m.crossOrigin = "anonymous";
        m.onload = () => c.getContext("2d")!.drawImage(m, 0, 0, c.width, c.height);
        m.src = u;
      }
    }
  };

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c || !drawing.current) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width;
    const y = ((e.clientY - r.top) / r.height) * c.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = mode === "keep" ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
    ctx.beginPath();
    ctx.arc(x, y, (size * c.width) / r.width, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Alpha / matte refinement: {clip.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">White = always opaque (part of the character). Black = always transparent. Strokes apply to every frame of this clip.</p>
        <div className="relative overflow-hidden rounded-md bg-muted">
          {frame ? <img src={frame} alt="" className="block w-full" onLoad={(e) => onImgLoad(e.currentTarget)} /> : <div className="flex aspect-video items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full cursor-crosshair opacity-60"
            onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); paint(e); }}
            onPointerMove={paint}
            onPointerUp={() => { drawing.current = false; }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant={mode === "keep" ? "default" : "outline"} onClick={() => setMode("keep")} className="gap-1"><Brush className="h-3.5 w-3.5" /> Keep</Button>
          <Button size="sm" variant={mode === "remove" ? "default" : "outline"} onClick={() => setMode("remove")} className="gap-1"><Eraser className="h-3.5 w-3.5" /> Remove</Button>
          <span className="text-xs">Size</span>
          <Slider className="w-28" min={4} max={80} value={[size]} onValueChange={([v]) => setSize(v)} />
          <span className="text-xs">Frame</span>
          <Slider className="w-32" min={0} max={Math.max(0.1, clip.duration)} step={0.1} value={[t]} onValueCommit={([v]) => setT(v)} />
          <Button size="sm" variant="ghost" onClick={() => { const c = canvasRef.current; c?.getContext("2d")!.clearRect(0, 0, c.width, c.height); }}>Clear</Button>
          <div className="flex-1" />
          <Button size="sm" onClick={() => canvasRef.current?.toBlob((b) => b && onSave(b), "image/png")}>Save refinement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type PreviewBg = "checker" | "white" | "black" | "custom";
export const previewBgStyle = (bg: PreviewBg, custom: string): React.CSSProperties =>
  bg === "checker"
    ? { backgroundImage: "repeating-conic-gradient(hsl(var(--muted)) 0 25%, hsl(var(--background)) 0 50%)", backgroundSize: "20px 20px" }
    : { background: bg === "white" ? "#ffffff" : bg === "black" ? "#000000" : custom };

export default ClipProcessor;
