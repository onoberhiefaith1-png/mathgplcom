// Canvas session control strip.
//
// The Canvas itself is NOT rendered here: it lives in the note as a real
// `canvasEmbed` block, exactly like a diagram. This strip only chooses which
// Canvas the session presents, and lets the teacher change it or open the
// editing panel.
import { useEffect, useState } from "react";
import { PanelsTopLeft, Pencil, RefreshCw } from "lucide-react";
import { listCanvases, type SlideCanvasRecord } from "@/lib/lessonnotes/slides";

interface Props {
  notebookId: string;
  canvasId: string | null;
  canvasName?: string | null;
  onCanvasChange: (id: string | null, name: string | null) => void;
}

export function CanvasSessionGateway({ notebookId, canvasId, canvasName, onCanvasChange }: Props) {
  const [canvases, setCanvases] = useState<SlideCanvasRecord[]>([]);
  const [choosing, setChoosing] = useState(false);

  const load = () => {
    listCanvases(notebookId)
      .then(setCanvases)
      .catch(() => setCanvases([]));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [notebookId]);

  useEffect(() => {
    const selected = (event: Event) => {
      const detail = (event as CustomEvent<{ canvasId?: string; name?: string }>).detail;
      if (detail?.canvasId) onCanvasChange(detail.canvasId, detail.name ?? null);
      load();
    };
    window.addEventListener("mathgpl:canvas-selected", selected);
    return () => window.removeEventListener("mathgpl:canvas-selected", selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCanvasChange, notebookId]);

  const openPanel = (id: string | null) => {
    window.dispatchEvent(new CustomEvent("mathgpl:open-canvas", { detail: { canvasId: id } }));
  };

  const pick = (canvas: SlideCanvasRecord) => {
    onCanvasChange(canvas.id, canvas.name);
    setChoosing(false);
  };

  const bound = canvases.find((c) => c.id === canvasId) ?? null;
  const showList = choosing || !canvasId;

  return (
    <div contentEditable={false} className="mt-1 print:hidden">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <PanelsTopLeft className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{bound?.name ?? canvasName ?? "No Canvas chosen"}</span>
        {canvasId && (
          <>
            <button type="button" onClick={() => setChoosing((v) => !v)} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-muted">
              <RefreshCw className="h-3 w-3" /> Change
            </button>
            <button type="button" onClick={() => openPanel(canvasId)} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-muted">
              <Pencil className="h-3 w-3" /> Edit slides
            </button>
          </>
        )}
      </div>

      {showList && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {canvases.map((canvas) => (
            <button
              key={canvas.id}
              type="button"
              onClick={() => pick(canvas)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                canvas.id === canvasId ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {canvas.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => openPanel(null)}
            className="rounded-full border border-dashed px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            {canvases.length ? "New Canvas" : "Create the first Canvas"}
          </button>
        </div>
      )}
    </div>
  );
}
