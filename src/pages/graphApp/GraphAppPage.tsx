import { lazy, Suspense, useMemo, useState, useEffect, useCallback } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Activity, Box, Hand, MousePointer2, Pencil, RotateCcw, Rotate3d, Search, Shapes, Slash, Sigma,
  Square, Settings, X, ZoomIn, BookOpen, Eye, EyeOff, Trash2, Circle, Terminal, Check, Expand, Plus, Calculator, Grid2X2, Save, FolderOpen, Users, Route as RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { combinedBounds, modeFor, type PlotBounds } from "@/lib/graphApp/framing";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { parseEquation } from "@/lib/graphApp/math";
import { LIBRARY, type LibraryTab } from "@/lib/graphApp/library";
import Graph2D, { CURVE_COLOURS, DEFAULT_VIEW, type Item, type View2D } from "@/components/graphApp/Graph2D";
import ConsolePanel from "@/components/graphApp/ConsolePanel";
import SpacePanel from "@/components/graphApp/SpacePanel";
import OdePanel from "@/components/graphApp/OdePanel";
import AnalysisPanel from "@/components/graphApp/AnalysisPanel";
import ExplorePanel, { EXPLORE_TOOLS, type ExploreTool } from "@/components/graphApp/ExplorePanel";
import ProblemsPanel from "@/components/graphApp/ProblemsPanel";
import LabToolsPanel from "@/components/graphApp/LabToolsPanel";
import SavedGraphsPanel from "@/components/graphApp/SavedGraphsPanel";
import SharePanel from "@/components/graphApp/SharePanel";
import FeaturesCard from "@/components/graphApp/FeaturesCard";
import ModesCard from "@/components/graphApp/ModesCard";
import JourneyPanel from "@/components/graphApp/JourneyPanel";
import type { JourneyStep } from "@/lib/graphApp/journeys";
import ConceptPanel from "@/components/graphApp/ConceptPanel";
import SolidPanel from "@/components/graphApp/SolidPanel";
import { solidExample, type Solid, type SolidKind } from "@/lib/graphApp/solids";
import { CONCEPTS, type ConceptAction } from "@/lib/graphApp/concepts";
import { interpret } from "@/lib/graphApp/interpret";
import type { LabSnapshot } from "@/lib/graphApp/savedGraphs";
import type { SceneControls } from "@/lib/graphApp/scenes.functions";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useAccount } from "@/lib/accounts/useAccount";
import { cn } from "@/lib/utils";

const Graph3D = lazy(() => import("@/components/graphApp/Graph3D"));
const SolidView = lazy(() => import("@/components/graphApp/SolidView"));
type Mode = "2D" | "3D" | "ND";
let nextId = 1;

interface GraphAppPageProps {
  initialSnapshot?: LabSnapshot;
  allowed?: SceneControls;
  studentMode?: boolean;
  sceneName?: string;
}

export default function GraphAppPage({ initialSnapshot, allowed, studentMode, sceneName }: GraphAppPageProps = {}) {
  const { userId } = useAccount();
  const { activeOrgId, isLoading: workspaceLoading } = useWorkspace();
  const canEdit = allowed?.editEquations ?? true;
  const canTools = allowed?.tools ?? true;
  const canConsole = allowed?.console ?? true;
  const [panel, setPanel] = useState<"matrices" | "calculus" | "saved" | "share" | "space" | "ode" | "problems" | "analysis" | "concept" | "journey" | ExploreTool | null>(null);
  const [solid, setSolid] = useState<Solid | null>(null);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [section, setSection] = useState<[number, number, number][][] | null>(null);
  const [matrices, setMatrices] = useState<LabSnapshot["matrices"]>({ a: [[2, 0], [0, 1]], b: [[1, 0], [0, 1]] });
  const [calculus, setCalculus] = useState<LabSnapshot["calculus"]>({ src: "y = x^2", x: 1, lower: 0, upper: 3 });
  const [mode, setMode] = useState<Mode>("2D");
  const [input, setInput] = useState("y = x^2");
  const [items, setItems] = useState<Item[]>(() => [{ id: "i0", eq: parseEquation("y = x^2"), colour: CURVE_COLOURS[0] }]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View2D>(DEFAULT_VIEW);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(true);
  const [labels, setLabels] = useState(true);
  const [tool, setTool] = useState("select");
  const [orbit, setOrbit] = useState<"rotate" | "pan" | "zoom">("rotate");
  const [resetKey, setResetKey] = useState(0);
  const [libOpen, setLibOpen] = useState(true);
  const [libTab, setLibTab] = useState<LibraryTab>("2D");
  const [q, setQ] = useState("");
  const [ndN, setNdN] = useState(4);
  const [ndAngle, setNdAngle] = useState(0.5);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [framing, setFraming] = useState<{ bounds: PlotBounds; revision: number } | undefined>({ bounds: combinedBounds(items.map(i => i.eq)), revision: 0 });
  const frame = (next: Item[]) => { setFraming(prev => ({ bounds: combinedBounds(next.filter(i => !i.hidden).map(i => i.eq)), revision: (prev?.revision ?? 0) + 1 })); setResetKey(k => k + 1); };

  const plot = (src: string) => {
    setSolid(null);
    const cube = src.trim().match(/^(?:ncube:\s*|)([4-6])D?(?:\s+hypercube)?$/i);
    if (cube) { setMode("ND"); setNdN(Number(cube[1])); setError(null); setInput(src); setEditingId(null); return; }
    const eq = parseEquation(src);
    if (eq.kind === "error") { setError(eq.message); return; }
    setError(null); setInput(src);
    const target = modeFor(eq);
    setMode(target); setLibTab(target);
    const same = items.filter(p => modeFor(p.eq) === target);
    const next = editingId
      ? items.map(it => it.id === editingId ? { ...it, eq } : it)
      : [...items, { id: `i${nextId++}`, eq, colour: CURVE_COLOURS[same.length % CURVE_COLOURS.length] }];
    setItems(next); frame(next); setEditingId(null);
  };
  /** Add several equations at once (examples), so each is kept. */
  const plotMany = (srcs: string[]) => {
    setSolid(null);
    let next = items;
    for (const src of srcs) {
      const eq = parseEquation(src);
      if (eq.kind === "error") { setError(eq.message); return; }
      const same = next.filter(p => modeFor(p.eq) === modeFor(eq));
      next = [...next, { id: `i${nextId++}`, eq, colour: CURVE_COLOURS[same.length % CURVE_COLOURS.length] }];
    }
    const last = next[next.length - 1];
    if (last) { const m = modeFor(last.eq); setMode(m); setLibTab(m); }
    setError(null); setItems(next); frame(next); setEditingId(null);
  };

  /** Stage 15: a concept's values become plots, a panel route or an ND view. */
  const buildConcept = (action: ConceptAction) => {
    setNote(action.note ?? null);
    if (action.plots?.length) plotMany(action.plots);
    const matrix = action.matrix;
    if (matrix) setMatrices(m => ({ ...m, a: matrix }));
    if (action.nd) { setMode("ND"); setNdN(action.nd); setResetKey(k => k + 1); }
    if (action.panel) { setPanel(action.panel as typeof panel); setLibOpen(false); }
    else setPanel(null);
    setConceptId(null);
  };

  /** Stage 17: show a journey step's picture while the journey stays open. */
  const showJourneyStep = (step: JourneyStep) => {
    if (step.input) { const lines = step.input.split("\n"); if (lines.length > 1) { setSolid(null); plotMany(lines); } else submitInput(step.input); }
    const a = step.action;
    if (a?.plots?.length) { setSolid(null); plotMany(a.plots); }
    const matrix = a?.matrix;
    if (matrix) setMatrices(m => ({ ...m, a: matrix }));
    setPanel("journey"); setLibOpen(false);
  };

  /** Stage 13 front door: one box, the engine decides where the maths goes. */
  const submitInput = (src: string) => {
    if (editingId) { plot(src); return; }
    const r = interpret(src);
    if (r.kind === "error") { setError(r.message); return; }
    setError(null); setNote(null);
    setSolid(null);
    if (r.kind === "solid") { setSolid(r.solid); setMode("3D"); setPanel(null); setLibOpen(false); setEditingId(null); }
    else if (r.kind === "plot") plot(src);
    else if (r.kind === "system") plotMany(r.srcs);
    else if (r.kind === "hypercube") plot(`${r.n}D`);
    else if (r.kind === "matrix") { setMatrices(m => ({ ...m, a: r.matrix })); setPanel("matrices"); setLibOpen(false); }
    else if (r.kind === "ode") { setPanel("ode"); setLibOpen(false); }
    else if (r.kind === "concept") { setConceptId(r.id); setPanel("concept"); setLibOpen(false); }
    else { setPanel(r.tool as typeof panel); setLibOpen(false); if (r.tool === "space") setMode("3D"); }
  };
  const [preview, setPreview] = useState<string[]>([]);
  const onPreview = useCallback((srcs: string[]) => setPreview(prev => prev.join("|") === srcs.join("|") ? prev : srcs), []);
  const visibleItems = useMemo(() => items.filter(i => modeFor(i.eq) === mode), [items, mode]);
  const canvasItems = useMemo<Item[]>(() => {
    const base = items.filter(i => modeFor(i.eq) === mode);
    if (mode !== "2D" || (panel !== "calculus" && panel !== "analysis" && !EXPLORE_TOOLS.some(t => t[0] === panel))) return base;
    const colours = ["#0f172a", "#9333ea", "#16a34a", "#ea580c"];
    return [...base, ...preview.map((src, k) => ({ id: `preview${k}`, eq: parseEquation(src), colour: colours[Math.min(k, colours.length - 1)] })).filter(i => i.eq.kind !== "error")];
  }, [items, mode, panel, preview]);
  const lib = LIBRARY.filter((e) => e.tab === libTab && e.label.toLowerCase().includes(q.toLowerCase()));

  const snapshot: LabSnapshot = { equations: items.map(i => ({ src: i.eq.src, colour: i.colour, hidden: Boolean(i.hidden) })), mode, view, grid, axes, labels, ndN, ndAngle, matrices, calculus, solid };
  const loadSnapshot = (s: LabSnapshot) => {
    setSolid(s.solid ?? null);
    setItems(s.equations.map(e => ({ id: `i${nextId++}`, eq: parseEquation(e.src), colour: e.colour, hidden: e.hidden })));
    setMode(s.mode); setView(s.view); setGrid(s.grid); setAxes(s.axes); setLabels(s.labels); setNdN(s.ndN); setNdAngle(s.ndAngle); setMatrices(s.matrices); setCalculus(s.calculus); setEditingId(null); setError(null); setInput(s.equations[0]?.src ?? "");
    setFraming(undefined); setResetKey(k => k + 1);
  };
  // Student scene view: load the teacher's snapshot once.
  const initialRef = useMemo(() => initialSnapshot, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialRef) loadSnapshot(initialRef); }, [initialRef]); // eslint-disable-line react-hooks/exhaustive-deps
  // Offline shell: cache Math Lab so it opens without data after first load.
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/mathlab-sw.js").catch(() => undefined);
    }
  }, []);
  useEffect(() => { if (studentMode) return; setSolid(null); setPanel(null); setEditingId(null); setError(null); setInput("y = x^2"); setMode("2D"); setView(DEFAULT_VIEW); setGrid(true); setAxes(true); setLabels(true); setNdN(4); setNdAngle(0.5); setFraming({ bounds: combinedBounds([parseEquation("y = x^2")]), revision: 0 }); setItems([{ id: `i${nextId++}`, eq: parseEquation("y = x^2"), colour: CURVE_COLOURS[0] }]); setMatrices({ a: [[2, 0], [0, 1]], b: [[1, 0], [0, 1]] }); setCalculus({ src: "y = x^2", x: 1, lower: 0, upper: 3 }); }, [userId, activeOrgId, studentMode]);
  const openTool = (next: "matrices" | "calculus" | "saved") => { setPanel(p => p === next ? null : next); setLibOpen(false); if (next === "calculus") { const selected = items.find(i => i.id === editingId && i.eq.kind === "curve2d") ?? items.find(i => !i.hidden && i.eq.kind === "curve2d"); if (selected) setCalculus(c => ({ ...c, src: selected.eq.src })); } setEditingId(null); };
  const tools = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "point", label: "Point", icon: Circle },
    { id: "line", label: "Line", icon: Slash, eq: "y = x" },
    { id: "plane", label: "Plane", icon: Square, eq: "z = 0.5x + 0.3y + 1" },
    { id: "equation", label: "Equation", icon: Sigma },
    { id: "shapes", label: "Shapes", icon: Shapes, eq: "x^2 + y^2 + z^2 = 9" },
  ];

  return (
    <div className="flex h-dvh flex-col gap-2 bg-muted p-2 text-foreground">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <Link to="/teaching-hub" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Math Lab</span>
        </Link>
        <div className="flex rounded-lg border bg-muted p-0.5">
          {(["2D", "3D", "ND"] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setSolid(null); setMode(m); setEditingId(null); if (m !== "2D") setLibTab(m === "3D" ? "3D" : "ND"); else setLibTab("2D"); }}
              className={cn("rounded-md px-3 py-1 text-sm font-semibold", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m}</button>
          ))}
        </div>
        {sceneName && <span className="rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">{sceneName}</span>}
        {canEdit && (
        <form className="flex min-w-0 basis-64 flex-1 items-center gap-1 rounded-md border bg-background px-3"
          onSubmit={(e) => { e.preventDefault(); submitInput(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Equation"
            className="h-9 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none" placeholder="y = x^2 · eigenvalues · cube with side 5 cm" />
          <Button type="submit" size="sm">{editingId ? <Check /> : <Sigma />}{editingId ? "Apply" : "Plot"}</Button>
          {editingId && <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel equation edit" onClick={() => { setEditingId(null); setInput(""); setError(null); }}><X /></Button>}
        </form>
        )}
        <button onClick={() => { setPanel(null); setLibOpen((v) => !v); }} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium">
          <BookOpen className="h-4 w-4" /> Library
        </button>
        {canConsole && (
        <button onClick={() => setConsoleOpen((v) => !v)} aria-label="Console"
          className={cn("flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium", consoleOpen && "bg-primary text-primary-foreground")}>
          <Terminal className="h-4 w-4" /> Console
        </button>
        )}
        <Button variant={panel === "journey" ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === "journey" ? null : "journey"); setLibOpen(false); }}><RouteIcon />Journeys</Button>
        <Button variant={panel === "matrices" ? "default" : "outline"} size="sm" onClick={() => openTool("matrices")}><Grid2X2 />Matrices</Button>
        <Button variant={panel === "calculus" ? "default" : "outline"} size="sm" onClick={() => openTool("calculus")}><Calculator />Calculus</Button>
        <Button variant={panel === "space" ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === "space" ? null : "space"); setLibOpen(false); if (mode !== "3D") setMode("3D"); }}><Box />3D tools</Button>
        {canEdit && <Button variant={solid ? "default" : "outline"} size="sm" onClick={() => { setEditingId(null); setInput(solidExample("cube")); setSolid({ kind: "cube", dimensions: [5], unit: "cm", source: solidExample("cube") }); setMode("3D"); setPanel(null); setLibOpen(false); }}><Shapes/>Solids</Button>}
        <Button variant="outline" size="sm" onClick={() => openTool("saved")}><Save />Save</Button>
        {!studentMode && <Button variant={panel === "share" ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === "share" ? null : "share"); setLibOpen(false); }}><Users />Share</Button>}
        <Button variant={panel === "ode" ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === "ode" ? null : "ode"); setLibOpen(false); }}>dy/dx</Button>
        <Button variant={panel === "problems" ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === "problems" ? null : "problems"); setLibOpen(false); }}>Real-world problems</Button>
        <Button variant={panel === "analysis" ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === "analysis" ? null : "analysis"); setLibOpen(false); }}><Activity />Analysis</Button>
        {EXPLORE_TOOLS.map(([id, label]) => <Button key={id} variant={panel === id ? "default" : "outline"} size="sm" onClick={() => { setPanel(panel === id ? null : id); setLibOpen(false); if (id !== "complex" && mode !== "2D") setMode("2D"); }}>{label}</Button>)}
        <Button variant={panel === "saved" ? "default" : "outline"} size="sm" onClick={() => openTool("saved")}><FolderOpen />Saved graphs</Button>
      </header>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-1 text-sm text-destructive">{error}</p>}
      {note && <p role="status" className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">{note}<button aria-label="Dismiss note" onClick={() => setNote(null)}><X className="h-4 w-4" /></button></p>}

      <div className={cn("relative flex min-h-0 flex-1 gap-2", solid && "max-sm:flex-col max-sm:overflow-y-auto")}>
        {(panel === "matrices" || panel === "calculus") && <LabToolsPanel key={panel} tab={panel} matrices={matrices} setMatrices={setMatrices} calculus={calculus} setCalculus={setCalculus} onPlot={plot} onPreview={onPreview} onClose={() => setPanel(null)} />}
        {panel === "concept" && conceptId && (() => { const concept = CONCEPTS.find(c => c.id === conceptId); return concept ? <ConceptPanel key={conceptId} concept={concept} onBuild={buildConcept} onClose={() => setPanel(null)} /> : null; })()}
        {panel === "journey" && <JourneyPanel userId={userId} onShow={showJourneyStep} onClose={() => setPanel(null)} />}
        {panel === "problems" && <ProblemsPanel onPlot={plot} onClose={() => setPanel(null)} />}
        {panel === "ode" && <OdePanel onPlot={plot} onClose={() => setPanel(null)} />}
        {panel && EXPLORE_TOOLS.some(t => t[0] === panel) && <ExplorePanel tool={panel as ExploreTool} onPreview={onPreview} onClose={() => setPanel(null)} />}
        {panel === "analysis" && <AnalysisPanel onPlot={plot} onPreview={onPreview} onClose={() => setPanel(null)} />}
        {panel === "space" && <SpacePanel items={items} onPlot={plot} onPlotMany={plotMany} onSection={setSection} onClose={() => setPanel(null)} />}
        {panel === "saved" && <SavedGraphsPanel key={`${userId}:${activeOrgId}`} userId={workspaceLoading ? null : userId} orgId={activeOrgId} snapshot={snapshot} onLoad={loadSnapshot} onClose={() => setPanel(null)} />}
        {panel === "share" && !studentMode && <SharePanel userId={userId} snapshot={snapshot} onLoad={loadSnapshot} onClose={() => setPanel(null)} />}
        {/* Tool rail */}
        {canTools && !solid && (
        <nav className="flex flex-col gap-1 rounded-xl border bg-card p-1 max-sm:absolute max-sm:bottom-2 max-sm:left-2 max-sm:right-2 max-sm:z-10 max-sm:flex-row max-sm:overflow-x-auto">
          {tools.map((t) => (
            <button key={t.id} onClick={() => { setTool(t.id); if (t.eq) plot(t.eq); if (t.id === "equation") document.querySelector<HTMLInputElement>('input[aria-label="Equation"]')?.focus(); }}
              className={cn("flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium",
                tool === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
              <t.icon className="h-5 w-5" />{t.label}
            </button>
          ))}
        </nav>
        )}

        {/* Canvas */}
        <main className={cn("relative min-w-0 flex-1 overflow-hidden bg-card", solid ? "max-sm:min-h-96 max-sm:shrink-0" : "rounded-xl border")}>
          {solid ? <ClientOnly><Suspense fallback={<div className="grid h-full place-items-center">Loading solid…</div>}><SolidView key={solid.kind} solid={solid}/></Suspense></ClientOnly> : mode === "2D" ? (
            <Graph2D items={canvasItems} view={view} setView={setView} grid={grid} axes={axes} labels={labels}
              framing={framing} tool={tool} onAddPoint={(x, y) => setItems((p) => [...p, { id: `i${nextId++}`, eq: parseEquation(`(${x}, ${y})`), colour: CURVE_COLOURS[p.length % CURVE_COLOURS.length] }])} />
          ) : (
            <ClientOnly fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading 3D…</div>}>
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading 3D…</div>}>
                <Graph3D items={visibleItems} grid={grid} axes={axes} labels={labels} mode={orbit} resetKey={resetKey}
                  nd={mode === "ND" ? { n: ndN, angle: ndAngle } : null} section={panel === "space" && mode === "3D" ? section : null} />
              </Suspense>
            </ClientOnly>
          )}

          {mode === "2D" && (() => { const c = [...visibleItems].reverse().find(i => !i.hidden && i.eq.kind === "curve2d"); return c && c.eq.kind === "curve2d" ? <FeaturesCard key={c.id + c.eq.src} src={c.eq.src} f={c.eq.f} /> : null; })()}
          {mode === "2D" && <ModesCard items={visibleItems} onPlot={plot} />}
          {/* View controls */}
          {!solid && <div className="absolute right-2 top-2 w-48 space-y-2 rounded-xl border bg-card/95 p-3 text-sm shadow-lg max-sm:w-40">
            <p className="font-semibold">View Controls</p>
            {mode !== "2D" && (
              <div className="grid grid-cols-3 gap-1">
                {([["rotate", Rotate3d, "Rotate"], ["pan", Hand, "Pan"], ["zoom", ZoomIn, "Zoom"]] as const).map(([id, Icon, l]) => (
                  <button key={id} onClick={() => setOrbit(id)}
                    className={cn("flex flex-col items-center rounded-md py-1 text-[11px]", orbit === id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <Icon className="h-4 w-4" />{l}
                  </button>
                ))}
              </div>
            )}
            {mode === "ND" && (
              <div className="space-y-2">
                <label className="flex items-center justify-between">Dimension
                  <select value={ndN} onChange={(e) => setNdN(+e.target.value)} className="rounded border bg-background px-1">
                    {[4, 5, 6].map((n) => <option key={n} value={n}>{n}D</option>)}
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">Rotate the extra dimension</p>
                <Slider value={[ndAngle]} min={0} max={Math.PI * 2} step={0.01} onValueChange={([v]) => setNdAngle(v)} />
              </div>
            )}
            {[["Grid", grid, setGrid], ["Axes", axes, setAxes], ["Show labels", labels, setLabels]].map(([l, v, s]) => (
              <label key={l as string} className="flex items-center justify-between">{l as string}
                <Switch checked={v as boolean} onCheckedChange={s as (b: boolean) => void} />
              </label>
            ))}
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Equal axis scale</span><Check className="h-4 w-4" /></div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => frame(visibleItems)}><Expand /> Fit plots</Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => { setView(DEFAULT_VIEW); frame(visibleItems); }}><RotateCcw /> Reset View</Button>
          </div>}


        </main>

        {solid ? <SolidPanel solid={solid} editable={canEdit} onChange={setSolid} onClose={() => setSolid(null)} /> : <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 max-md:w-44 max-sm:absolute max-sm:bottom-20 max-sm:left-2 max-sm:z-10 max-sm:max-h-40 max-sm:w-[calc(100%-1rem)]">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Equations</h2><Button variant="ghost" size="icon-sm" aria-label="New equation" onClick={() => { setEditingId(null); setInput(""); setError(null); document.querySelector<HTMLInputElement>('input[aria-label="Equation"]')?.focus(); }}><Plus /></Button></div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {visibleItems.map(it => <li key={it.id} className={cn("flex items-center gap-1 rounded-md border p-1", editingId === it.id && "border-primary")}>
              <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start px-1 font-mono text-xs" title={it.eq.src} aria-label={`Edit ${it.eq.src}`} onClick={() => { setEditingId(it.id); setInput(it.eq.src); setError(null); }}><Pencil className="shrink-0" /><span className="truncate">{it.eq.src}</span></Button>
              <Button variant="ghost" size="icon-xs" aria-label={`${it.hidden ? "Show" : "Hide"} ${it.eq.src}`} title={it.hidden ? "Show equation" : "Hide equation"} onClick={() => { const next = items.map(x => x.id === it.id ? { ...x, hidden: !x.hidden } : x); setItems(next); frame(next); }}>{it.hidden ? <EyeOff /> : <Eye />}</Button>
              <Button variant="ghost" size="icon-xs" aria-label={`Remove ${it.eq.src}`} title="Remove equation" onClick={() => { const next = items.filter(x => x.id !== it.id); setItems(next); frame(next); if (editingId === it.id) { setEditingId(null); setInput(""); } }}><Trash2 /></Button>
            </li>)}
          </ul>
        </aside>}

        {/* Library */}
        {libOpen && (
          <aside className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-xl max-sm:w-full">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Equation Library</h2>
              <button aria-label="Close library" onClick={() => setLibOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <label className="flex items-center gap-2 rounded-lg border px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equations…" className="h-8 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div className="flex flex-wrap gap-1">
              {(["2D", "3D", "Parametric", "ND", "Matrices"] as LibraryTab[]).map((t) => (
                <button key={t} onClick={() => { if (t === "Matrices") openTool("matrices"); else setLibTab(t); }}
                  className={cn("rounded-md border px-2 py-0.5 text-xs", libTab === t ? "bg-primary text-primary-foreground" : "")}>{t}</button>
              ))}
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              
              {libTab === "3D" && canEdit && (["cube", "cuboid", "sphere", "cylinder", "cone"] as SolidKind[]).map(kind => <li key={kind} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5"><span className="text-xs capitalize">{kind}</span><Button size="sm" variant="outline" onClick={() => { setInput(solidExample(kind)); submitInput(solidExample(kind)); }}>Build</Button></li>)}
              {lib.map((e) => (
                <li key={e.expr} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5">
                  <span className="truncate font-mono text-xs">{e.label}</span>
                  <button onClick={() => plot(e.expr)} className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Plot</button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      {consoleOpen && <ConsolePanel onPlot={plot} onClose={() => setConsoleOpen(false)} />}
    </div>
  );
}

// Keep imported-but-optional icons referenced for tree-shaking clarity.
void Box; void Pencil; void Settings;
