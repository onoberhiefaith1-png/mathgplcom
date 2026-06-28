// GeometryEditorPanel — floating, non-modal manual editor for a single
// GeometryScene. The teacher opens it from the diagram's hover toolbar
// ("Edit") or the Diagram menu. Changes stay LOCAL inside the panel
// until the teacher presses Save (or Add to section…).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Undo2, Redo2, Sparkles, Lock, RotateCw, Triangle, Star, Equal,
  Save, RotateCcw, FilePlus2, ChevronRight,
} from "lucide-react";
import { GeometryToolbar } from "./GeometryToolbar";
import { GeometryCanvas } from "./GeometryCanvas";
import { SelectionInspector } from "./SelectionInspector";
import { SketchLayer } from "./SketchLayer";
import { useGeometryEditor } from "./useGeometryEditor";
import { type GeometryScene, sanitizeScene } from "@/lib/geometry/scene";
import { TOOLS } from "@/lib/geometry/editor/tools";
import {
  makeEqualSegments, makeIsosceles, makeEquilateral, rotateScene, closePolygon,
} from "@/lib/geometry/editor/sceneOps";
import { openGeometryAiEdit } from "@/components/lessonnotes/extensions/GeometryDiagram";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "geometry-editor:open";
const LIST_SECTIONS_EVENT = "geometry-editor:list-sections";
const INSERT_INTO_SECTION_EVENT = "geometry-editor:insert-into-section";

export interface OpenGeometryEditorDetail {
  scene: GeometryScene;
  topic?: string;
  onApply: (next: GeometryScene) => void;
}

export interface GeometryEditorSection {
  /** Stable id (TipTap doc position is fine, but caller decides). */
  id: string;
  title: string;
}

export interface ListSectionsRequest {
  reply: (sections: GeometryEditorSection[]) => void;
}

export interface InsertIntoSectionRequest {
  sectionId: string;
  scene: GeometryScene;
}

export function openGeometryEditor(detail: OpenGeometryEditorDetail) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

/** Request the section list from the host document. Returns [] when no
 *  document editor is mounted (panel opened in isolation). */
function requestSections(): GeometryEditorSection[] {
  let result: GeometryEditorSection[] = [];
  const detail: ListSectionsRequest = {
    reply: (sections) => { result = sections; },
  };
  window.dispatchEvent(new CustomEvent(LIST_SECTIONS_EVENT, { detail }));
  return result;
}

function insertIntoSection(sectionId: string, scene: GeometryScene) {
  const detail: InsertIntoSectionRequest = { sectionId, scene };
  window.dispatchEvent(new CustomEvent(INSERT_INTO_SECTION_EVENT, { detail }));
}

interface Session extends OpenGeometryEditorDetail {
  /** Stable id for this open session — used as React key. */
  sessionId: string;
}

export function GeometryEditorPanel() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenGeometryEditorDetail>).detail;
      setSession({
        ...detail,
        sessionId: `gep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  if (!session) return null;
  return (
    <PanelBody
      key={session.sessionId}
      session={session}
      onClose={() => setSession(null)}
    />
  );
}

function PanelBody({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const editor = useGeometryEditor(session.scene, session.onApply);
  const [pos, setPos] = useState({ x: Math.max(16, window.innerWidth - 880), y: 80 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [sketchBusy, setSketchBusy] = useState(false);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);

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

  const constraintButtons = editor.tool === "constraint" && (
    <div className="px-2 py-1.5 border-b border-foreground/10 flex flex-wrap gap-1.5 text-[11px]">
      <span className="text-foreground/55 self-center mr-1">Constraint:</span>
      <Cbtn icon={<Equal className="h-3 w-3" />} onClick={() => editor.apply(makeEqualSegments(editor.scene, editor.selectedIds))}>Make equal</Cbtn>
      <Cbtn icon={<Triangle className="h-3 w-3" />} onClick={() => editor.apply(makeIsosceles(editor.scene, editor.selectedIds))}>Make isosceles</Cbtn>
      <Cbtn icon={<Star className="h-3 w-3" />} onClick={() => editor.apply(makeEquilateral(editor.scene, editor.selectedIds))}>Make equilateral</Cbtn>
    </div>
  );

  const polygonClose =
    editor.tool === "polygon" && editor.pendingIds.length >= 3 ? (
      <button
        type="button"
        onClick={() => {
          editor.apply(closePolygon(editor.scene, editor.pendingIds));
          editor.setPendingIds([]);
        }}
        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px]"
      >
        Close polygon
      </button>
    ) : null;

  const handleSave = () => {
    editor.save();
    toast({ title: "Diagram saved" });
  };

  const handleClose = () => {
    if (editor.dirty) {
      const ok = window.confirm("Discard unsaved changes to this diagram?");
      if (!ok) return;
    }
    onClose();
  };

  const handleAddToSection = () => {
    setSectionPickerOpen((v) => !v);
  };

  const sections = useMemo(
    () => (sectionPickerOpen ? requestSections() : []),
    [sectionPickerOpen, editor.scene],
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
        <span className="ml-2 text-[11px] text-foreground/60 truncate flex items-center gap-1">
          {hint}
          {polygonClose}
        </span>

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
        <button type="button" onClick={handleClose} className="p-1 rounded hover:bg-foreground/10" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
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

      <footer className="border-t border-foreground/10 px-3 py-2 flex items-center gap-2 text-[11px]">
        <span className={cn("text-foreground/55", editor.dirty && "text-amber-600 font-medium")}>
          {editor.dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <div className="ml-auto flex items-center gap-1.5 relative">
          <button
            type="button"
            onClick={handleAddToSection}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-foreground/15 hover:bg-foreground/5"
            title="Insert this diagram into any section of the lesson note"
          >
            <FilePlus2 className="h-3 w-3" /> Add to section…
          </button>
          {sectionPickerOpen && (
            <SectionPicker
              sections={sections}
              onPick={(id) => {
                insertIntoSection(id, editor.scene);
                setSectionPickerOpen(false);
                toast({ title: "Diagram added to section" });
              }}
              onClose={() => setSectionPickerOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={editor.revert}
            disabled={!editor.dirty}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-foreground/15 hover:bg-foreground/5 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <RotateCcw className="h-3 w-3" /> Revert
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!editor.dirty}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Save className="h-3 w-3" /> Save
          </button>
        </div>
      </footer>
    </div>
  );
}

function SectionPicker({
  sections, onPick, onClose,
}: {
  sections: GeometryEditorSection[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute bottom-full right-0 mb-1 w-[240px] max-h-[260px] overflow-y-auto bg-popover border border-foreground/15 rounded-md shadow-lg p-1 z-10"
      onMouseLeave={onClose}
    >
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-foreground/50">
        Pick a section
      </div>
      {sections.length === 0 ? (
        <div className="px-2 py-2 text-[11px] text-foreground/55">
          No sections found in the current document.
        </div>
      ) : (
        sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-foreground/5 inline-flex items-center gap-1.5 text-[12px]"
          >
            <ChevronRight className="h-3 w-3 text-foreground/40" />
            <span className="truncate">{s.title}</span>
          </button>
        ))
      )}
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
