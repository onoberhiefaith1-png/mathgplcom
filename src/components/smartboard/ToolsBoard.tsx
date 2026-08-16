// ToolsBoard — BOARD 2. A completely independent working board beside the
// main Smartboard.
//
// It exists so Geometry, Tables, Graph, Calculator, Conversion and Slide stop
// competing with the lesson-note text on Board 1. Board 2 has its own canvas,
// its own objects, its own undo/redo and its own saved state. It never reads,
// moves or merges anything from Board 1.
//
// This is NOT the Slide feature: Slide is only one of the tools it can open.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowLeftRight as ArrowLeftRightIcon, Calculator as CalculatorIcon,
  ChevronDown, LayoutGrid as LayoutGridIcon, LineChart as LineChartIcon,
  Redo2, RotateCcw, Shapes as ShapesIcon, Table as TableIcon, Undo2,
} from "lucide-react";

import { BoardToolLayer } from "./BoardToolLayer";
import { FloatingToolLayer, type FloatingToolPalette } from "./FloatingToolLayer";
import { MathTablesPicker } from "@/components/lessonnotes/math-tools/MathTablesPicker";
import { SmartCalculatorBody } from "@/components/lessonnotes/math-tools/SmartCalculator";
import { ConversionBody } from "@/components/lessonnotes/ConversionPanel";
import { Workspace3DDialog } from "@/components/lessonnotes/geometry3d/Workspace3DDialog";
import { SlidePlayer } from "@/components/lessonnotes/slides/SlidePlayer";
import { listSlides, type Slide } from "@/lib/lessonnotes/slides";
import {
  sanitizeBoardDiagrams, newBoardDiagram2D, newBoardDiagram3D,
  newBoardGraph, newBoardTable, type BoardDiagram,
} from "@/lib/smartboard/boardDiagrams";
import type { MathTableAttrs } from "@/components/lessonnotes/extensions/MathTable";
import type { Scene3D } from "@/lib/geometry3d/scene3d";
import { useBoardHistory } from "@/lib/smartboard/boardHistory";

interface Props {
  /** Cache key for this board's objects — already class × notebook scoped. */
  storageKey: string;
  notebookId?: string;
  editable: boolean;
  palette: FloatingToolPalette & { background: string; ink: string; hoverBg: string };
  /** Board writing colour — the default geometry ink. */
  ink: string;
  onReturn: () => void;
  /** True while Board 2 is the visible board (keyboard undo scoping). */
  active: boolean;
}

/** Extra breathing room under the lowest object, so the canvas keeps growing. */
const TAIL = 480;

export const ToolsBoard = ({
  storageKey, notebookId, editable, palette, ink, onReturn, active,
}: Props) => {
  /* ── Board 2 objects + its own history ── */
  const history = useBoardHistory<BoardDiagram[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      return raw ? sanitizeBoardDiagrams(JSON.parse(raw)) : [];
    } catch { return []; }
  });
  const objects = history.value;

  // Reload when the teaching context changes (different class / notebook):
  // a new context always starts from that context's own saved state.
  const firstKey = useRef(storageKey);
  useEffect(() => {
    if (firstKey.current === storageKey) return;
    firstKey.current = storageKey;
    try {
      const raw = localStorage.getItem(storageKey);
      history.reset(raw ? sanitizeBoardDiagrams(JSON.parse(raw)) : []);
    } catch { history.reset([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist — closing the board never clears it.
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(objects)); } catch { /* noop */ }
  }, [objects, storageKey]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing3dId, setEditing3dId] = useState<string | null>(null);
  const [diagramMenuOpen, setDiagramMenuOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [calcFloat, setCalcFloat] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [convFloat, setConvFloat] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [slideMenuOpen, setSlideMenuOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [slideShowIndex, setSlideShowIndex] = useState<number | null>(null);

  const editing3d = useMemo(() => {
    const d = objects.find((o) => o.id === editing3dId);
    return d && d.kind === "3d" ? d : null;
  }, [objects, editing3dId]);

  const add = useCallback((d: BoardDiagram) => {
    history.set((prev) => [...prev, d]);
    setActiveId(d.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.set]);

  const openSlideMenu = useCallback(() => {
    setSlideMenuOpen((v) => !v);
    if (!notebookId) return;
    listSlides(notebookId).then(setSlides).catch(() => setSlides([]));
  }, [notebookId]);

  /* ── Keyboard undo / redo — only while Board 2 is the visible board ── */
  useEffect(() => {
    if (!active || !editable) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); history.undo(); }
      else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); history.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, editable, history.undo, history.redo]);

  /* ── The canvas grows downward as objects are placed ── */
  const canvasHeight = useMemo(() => {
    const lowest = objects.reduce((m, o) => Math.max(m, o.y + o.height), 0);
    return Math.max(1200, lowest + TAIL);
  }, [objects]);

  const chromeStyle: React.CSSProperties = {
    background: palette.chromeBg,
    color: palette.chromeFg,
    borderColor: palette.chromeBorder,
    backdropFilter: "blur(10px)",
  };
  const btn = "inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] hover:bg-black/5";

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: palette.background, color: palette.ink }}
      data-sb-board="tools"
    >
      {/* Board 2 top bar */}
      <header
        className="absolute z-30 left-1/2 top-0 flex items-center gap-2 rounded-b-2xl border px-3 py-2"
        style={{ ...chromeStyle, transform: "translateX(-50%)", maxWidth: "min(940px, 96%)", width: "max-content" }}
      >
        <button onClick={onReturn} className={btn} title="Return to the main board">
          <ArrowLeft className="h-3.5 w-3.5" /> Main Board
        </button>
        <span className="px-1 text-[11px] font-medium opacity-70">Board 2 · Tools</span>

        {editable && (
          <>
            <span className="relative inline-flex items-center rounded-md px-1 py-0.5" style={{ background: palette.hoverBg }}>
              <button
                onClick={() => setDiagramMenuOpen((v) => !v)}
                className={btn}
                title="Add a diagram — 2D or 3D"
                aria-haspopup="menu"
                aria-expanded={diagramMenuOpen}
              >
                <ShapesIcon className="h-3.5 w-3.5" /> Diagram
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
              {diagramMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-40 mt-1 min-w-[7rem] overflow-hidden rounded-md border shadow-lg"
                  style={chromeStyle}
                >
                  <button
                    role="menuitem"
                    onClick={() => { setDiagramMenuOpen(false); add(newBoardDiagram2D(80, 80)); }}
                    className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-black/10"
                  >2D</button>
                  <button
                    role="menuitem"
                    onClick={() => { setDiagramMenuOpen(false); add(newBoardDiagram3D(80, 80)); }}
                    className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-black/10"
                  >3D</button>
                </div>
              )}
            </span>

            <span className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5" style={{ background: palette.hoverBg }}>
              <button onClick={() => setTablesOpen(true)} className={btn} title="Mathematical tables">
                <TableIcon className="h-3.5 w-3.5" /> Tables
              </button>
              <button onClick={() => add(newBoardGraph(80, 80))} className={btn} title="Add a graph">
                <LineChartIcon className="h-3.5 w-3.5" /> Graph
              </button>
              <button
                onClick={() => setCalcFloat((c) => c ?? { x: 120, y: 120, w: 420, h: 520 })}
                className={btn}
                title="Open the calculator"
              ><CalculatorIcon className="h-3.5 w-3.5" /> Calc</button>
              <button
                onClick={() => setConvFloat((c) => c ?? { x: 160, y: 160, w: 620, h: 480 })}
                className={btn}
                title="Open the conversion workspace"
              ><ArrowLeftRightIcon className="h-3.5 w-3.5" /> Conversion</button>
              <span className="relative inline-flex">
                <button onClick={openSlideMenu} className={btn} title="Present a slide from this lesson note" aria-expanded={slideMenuOpen}>
                  <LayoutGridIcon className="h-3.5 w-3.5" /> Slide
                </button>
                {slideMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-40 mt-1 max-h-64 min-w-[11rem] overflow-auto rounded-md border shadow-lg"
                    style={chromeStyle}
                  >
                    {slides.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] opacity-70">No slides in this lesson note yet.</p>
                    ) : slides.map((s, i) => (
                      <button
                        key={s.id}
                        role="menuitem"
                        onClick={() => { setSlideMenuOpen(false); setSlideShowIndex(i); }}
                        className="block w-full truncate px-3 py-1.5 text-left text-[11px] hover:bg-black/10"
                      >{s.title || `Slide ${i + 1}`}</button>
                    ))}
                  </div>
                )}
              </span>
            </span>

            {/* Board 2's OWN undo / redo — Board 1's history is untouched. */}
            <span className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5" style={{ background: palette.hoverBg }}>
              <button
                onClick={history.undo}
                disabled={!history.canUndo}
                className={`${btn} disabled:opacity-30`}
                title="Undo on this board"
              ><Undo2 className="h-3.5 w-3.5" /></button>
              <button
                onClick={history.redo}
                disabled={!history.canRedo}
                className={`${btn} disabled:opacity-30`}
                title="Redo on this board"
              ><Redo2 className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => { if (objects.length) history.set([]); }}
                className={btn}
                title="Clear this board"
              ><RotateCcw className="h-3.5 w-3.5" /></button>
            </span>
          </>
        )}
      </header>

      {/* Board 2 canvas — extends downward and scrolls, like Board 1's page. */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain" style={{ paddingTop: 56 }}>
        <div className="relative w-full" style={{ height: canvasHeight }}>
          {objects.length === 0 && (
            <p className="pointer-events-none absolute left-0 right-0 top-16 text-center text-[12px] opacity-45">
              Board 2 — open Diagram, Tables, Graph, Calc, Conversion or Slide. Nothing here touches the main board.
            </p>
          )}
          <BoardToolLayer
            diagrams={objects}
            onChange={(next) => history.set(next)}
            onEdit={(id) => {
              const d = objects.find((x) => x.id === id);
              if (!d) return;
              setActiveId(id);
              if (d.kind === "3d") setEditing3dId(id);
            }}
            onDelete={(id) => {
              history.set((prev) => prev.filter((d) => d.id !== id));
              setActiveId((cur) => (cur === id ? null : cur));
            }}
            activeId={activeId}
            onActivate={setActiveId}
            editable={editable}
            ink={ink}
            palette={palette}
          />
        </div>
      </div>

      {/* 3D / TVD workspace */}
      {editable && editing3d && (
        <Workspace3DDialog
          open
          onOpenChange={(open) => { if (!open) setEditing3dId(null); }}
          initialScene={editing3d.scene}
          onExport={(scene: Scene3D) => {
            history.set((prev) => prev.map((d) => (d.id === editing3d.id ? { ...d, scene } : d)));
            setEditing3dId(null);
          }}
        />
      )}

      {/* Mathematical reference tables */}
      {editable && (
        <MathTablesPicker
          open={tablesOpen}
          onOpenChange={setTablesOpen}
          onInsert={(attrs: MathTableAttrs) => add(newBoardTable(100, 100, attrs))}
        />
      )}

      {/* Calculator + Conversion — used and closed; nothing merges. */}
      {editable && (calcFloat || convFloat) && (
        <div className="absolute inset-0" style={{ pointerEvents: "none", zIndex: 60 }}>
          {calcFloat && (
            <FloatingToolLayer
              title="Calculator"
              icon={<CalculatorIcon className="h-3 w-3" />}
              x={calcFloat.x} y={calcFloat.y} width={calcFloat.w} height={calcFloat.h}
              editable solidBody minWidth={300} minHeight={280}
              palette={palette}
              onGeometry={(g) => setCalcFloat((c) => c && {
                x: g.x ?? c.x, y: g.y ?? c.y, w: g.width ?? c.w, h: g.height ?? c.h,
              })}
              onClose={() => setCalcFloat(null)}
            >
              <div className="p-2"><SmartCalculatorBody onInsertWorking={() => { /* board 2 keeps working here */ }} /></div>
            </FloatingToolLayer>
          )}
          {convFloat && (
            <FloatingToolLayer
              title="Conversion"
              icon={<ArrowLeftRightIcon className="h-3 w-3" />}
              x={convFloat.x} y={convFloat.y} width={convFloat.w} height={convFloat.h}
              editable solidBody minWidth={360} minHeight={260}
              palette={palette}
              onGeometry={(g) => setConvFloat((c) => c && {
                x: g.x ?? c.x, y: g.y ?? c.y, w: g.width ?? c.w, h: g.height ?? c.h,
              })}
              onClose={() => setConvFloat(null)}
            >
              <div className="p-3"><ConversionBody /></div>
            </FloatingToolLayer>
          )}
        </div>
      )}

      {/* Slide — presentation only, from this lesson note. */}
      {slideShowIndex !== null && slides.length > 0 && (
        <SlidePlayer
          slides={slides}
          startIndex={slideShowIndex}
          dark={palette.dark}
          onExit={() => setSlideShowIndex(null)}
        />
      )}
    </div>
  );
};

export default ToolsBoard;
