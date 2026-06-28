// GeometryEditorPanel — floating, non-modal manual editor for a single
// GeometryScene. The teacher opens it from the diagram's hover toolbar
// ("Edit"). Every change is pushed to the underlying TipTap node via the
// onApply callback supplied by the dispatching component.

import { useEffect, useRef, useState } from "react";
import {
  X, Undo2, Redo2, Sparkles, Lock, RotateCw, Triangle, Star, Equal,
} from "lucide-react";
import { GeometryToolbar } from "./GeometryToolbar";
import { GeometryCanvas } from "./GeometryCanvas";
import { SelectionInspector } from "./SelectionInspector";
import { SketchLayer } from "./SketchLayer";
import { useGeometryEditor } from "./useGeometryEditor";
import { type GeometryScene, sanitizeScene } from "@/lib/geometry/scene";
import { TOOLS } from "@/lib/geometry/editor/tools";
import {
  makeEqualSegments, makeIsosceles, makeEquilateral, rotateScene,
} from "@/lib/geometry/editor/sceneOps";
import { openGeometryAiEdit } from "@/components/lessonnotes/extensions/GeometryDiagram";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const OPEN_EVENT = "geometry-editor:open";

export interface OpenGeometryEditorDetail {
  scene: GeometryScene;
  topic?: string;
  onApply: (next: GeometryScene) => void;
}

export function openGeometryEditor(detail: OpenGeometryEditorDetail) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

export function GeometryEditorPanel() {
  const [session, setSession] = useState<OpenGeometryEditorDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setSession((e as CustomEvent<OpenGeometryEditorDetail>).detail);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  if (!session) return null;
  return (
    <PanelBody
      key={`gep-${Date.now()}`}
      session={session}
      onClose={() => setSession(null)}
    />
  );
}

function PanelBody({
  session,
  onClose,
}: {
  session: OpenGeometryEditorDetail;
  onClose: () => void;
}) {
  const editor = useGeometryEditor(session.scene, session.onApply);
  const [pos, setPos] = useState({ x: Math.max(16, window.innerWidth - 880), y: 80 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [sketchBusy, setSketchBusy] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    if (editor.tool === "sketch") setSketchOpen(true);
  }, [editor.tool]);

  const onConvertSketch = async (strokes: { points: { x: number; y: number }[] }[]) => {
    setSketchBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("geometry-sketch", {
        body: {
          strokes,
          bounds: editor.scene.bounds,
          topic: session.topic,
        },
      });
      if (error) throw error;
      const next = sanitizeScene((data as any)?.scene);
      if (!next) throw new Error("AI returned an invalid scene");
      editor.commit(next);
      setSketchOpen(false);
      editor.setTool("select");
      toast({ title: "Sketch converted" });
    } catch (e: any) {
      toast({ title: "Convert failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setSketchBusy(false);
    }
  };

  const hint = TOOLS.find((t) => t.id === editor.tool)?.hint ?? "";

  // Convenience: constraint actions when the user has the constraint tool selected.
  const constraintButtons = editor.tool === "constraint" && (
    <div className="px-2 py-1.5 border-b border-foreground/10 flex flex-wrap gap-1.5 text-[11px]">
      <span className="text-foreground/55 self-center mr-1">Constraint:</span>
      <Cbtn icon={<Equal className="h-3 w-3" />} onClick={() => editor.apply(makeEqualSegments(editor.scene, editor.selectedIds))}>Make equal</Cbtn>
      <Cbtn icon={<Triangle className="h-3 w-3" />} onClick={() => editor.apply(makeIsosceles(editor.scene, editor.selectedIds))}>Make isosceles</Cbtn>
      <Cbtn icon={<Star className="h-3 w-3" />} onClick={() => editor.apply(makeEquilateral(editor.scene, editor.selectedIds))}>Make equilateral</Cbtn>
    </div>
  );

  return (
    <div
      className="fixed z-50 bg-background border border-foreground/15 rounded-lg shadow-2xl flex flex-col"
      style={{ left: pos.x, top: pos.y, width: 820, maxWidth: "95vw", maxHeight: "85vh" }}
      role="dialog"
      aria-label="Geometry editor"
    >
      <header
        className="px-3 py-2 border-b border-foreground/10 flex items-center gap-2 cursor-move select-none"
        onMouseDown={(e) => { dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }}
      >
        <Lock className="h-3.5 w-3.5 text-foreground/40" />
        <h2 className="text-sm font-medium">Geometry editor</h2>
        {session.topic && (
          <span className="text-[10px] uppercase tracking-wider text-foreground/50">{session.topic}</span>
        )}
        <span className="ml-2 text-[11px] text-foreground/60 truncate">{hint}</span>

        <button
          type="button"
          onClick={() => openGeometryAiEdit({ scene: editor.scene, topic: session.topic, onApply: (s) => { editor.commit(s); } })}
          className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground"
          title="Edit this diagram with AI"
        >
          <Sparkles className="h-3 w-3" /> AI Edit
        </button>
        <button type="button" disabled={!editor.canUndo} onClick={editor.doUndo} className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={!editor.canRedo} onClick={editor.doRedo} className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30" title="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.commit(rotateScene(editor.scene, 15).scene)} className="p-1 rounded hover:bg-foreground/10" title="Rotate 15°"><RotateCw className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-foreground/10" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
      </header>

      {constraintButtons}

      <div className="flex-1 flex min-h-0">
        <GeometryToolbar tool={editor.tool} onTool={editor.setTool} />
        <div className="flex-1 overflow-auto p-3 flex items-start justify-center relative">
          <GeometryCanvas editor={editor} />
          {sketchOpen && (
            <SketchLayer
              width={editor.scene.bounds.width}
              height={editor.scene.bounds.height}
              pad={24}
              busy={sketchBusy}
              onConvert={onConvertSketch}
              onCancel={() => { setSketchOpen(false); editor.setTool("select"); }}
            />
          )}
        </div>
        <aside className="w-[220px] shrink-0 border-l border-foreground/10 p-3 bg-muted/20 overflow-y-auto">
          <SelectionInspector
            scene={editor.scene}
            selected={editor.selectedObjects}
            onApply={(next) => editor.commit(next)}
          />
        </aside>
      </div>
    </div>
  );
}

function Cbtn({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-foreground/20 bg-background hover:bg-foreground/5"
    >
      {icon}{children}
    </button>
  );
}
