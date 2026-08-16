// Workspace3DDialog — the universal 3D Mathematics Workspace.
//
// Two stages:
//   Workspace Mode   — build and arrange the scene (insert, transform, settings)
//   Lesson Mode      — objects locked, mathematics tools by topic
// In both stages the camera is always free: rotate, zoom and pan.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Download, Trash2, Boxes, MousePointer2, CopyPlus, Move3d, Rotate3d, Scaling, Eraser,
  GraduationCap, ArrowLeft, PanelLeft,
  Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Scene3DCanvas } from "./Scene3DCanvas";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";
import { ObjectInspector } from "./ObjectInspector";
import { LessonModePanel } from "./LessonModePanel";
import { FacesEdgesVerticesTools } from "./lessonmodes/FacesEdgesVerticesTools";
import { PropertiesPanel } from "./lessonmodes/PropertiesPanel";
import { MeasurementsTools } from "./lessonmodes/MeasurementsTools";
import { AnglesTools } from "./lessonmodes/AnglesTools";
import { SurfaceAreaTools } from "./lessonmodes/SurfaceAreaTools";
import { VolumeTools } from "./lessonmodes/VolumeTools";
import { NetsTools } from "./lessonmodes/NetsTools";
import { CrossSectionsTools } from "./lessonmodes/CrossSectionsTools";
import { CoordinatesTools } from "./lessonmodes/CoordinatesTools";
import { TransformationsTools } from "./lessonmodes/TransformationsTools";
import { topologyFor, type ElementKind } from "@/lib/geometry3d/topology";
import {
  DEFAULT_CAMERA, DEFAULT_LABEL_SETTINGS, DEFAULT_LESSON, DEFAULT_SETTINGS, EMPTY_SCENE_3D,
  SOLID_DEFS, SOLID_GROUPS,
  createSolid, duplicateSolid, newId, sanitizeScene3D,
  type Annotation3D, type LabelSettings, type LessonModeId, type LessonState,
  type Scene3D, type Scene3DSettings, type Solid3D, type Solid3DKind, type Vec3,
} from "@/lib/geometry3d/scene3d";
import { LabelSettingsPanel } from "./labels/LabelSettingsPanel";
import { AnnotationManager } from "./labels/AnnotationManager";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-load an existing scene (when editing a pasted 3D object). */
  initialScene?: Scene3D | null;
  /** Export → insert / replace in the Lesson Note. */
  onExport: (scene: Scene3D) => void;
}

type TransformMode = "translate" | "rotate" | "scale";
type Stage = "workspace" | "lesson";

const emptyScene = (): Scene3D => ({
  version: 1,
  objects: [],
  annotations: [],
  lesson: { ...DEFAULT_LESSON },
  camera: { ...DEFAULT_CAMERA },
  settings: { ...DEFAULT_SETTINGS },
});


export function Workspace3DDialog({ open, onOpenChange, initialScene, onExport }: Props) {
  const [scene, setScene] = useState<Scene3D>(EMPTY_SCENE_3D);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(true);
  const [transformMode, setTransformMode] = useState<TransformMode>("translate");
  const [resetToken, setResetToken] = useState(0);
  const [stage, setStage] = useState<Stage>("workspace");
  const [lessonMode, setLessonMode] = useState<LessonModeId>("facesEdgesVertices");
  const [pickKind, setPickKind] = useState<ElementKind>("face");
  const [active, setActive] = useState<{ solidId: string; kind: ElementKind; index: number } | null>(null);
  const [unit, setUnit] = useState("cm");
  const [decimals, setDecimals] = useState(2);
  /** Transient teaching emphasis driven by hovering the teaching panel. */
  const [guide, setGuide] = useState<string | null>(null);
  const [hoverFace, setHoverFace] = useState<number | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<"hidden" | "normal" | "expanded">("normal");
  const clipboard = useRef<Solid3D | null>(null);
  const liveCamera = useRef<{ position: Vec3; target: Vec3 } | null>(null);

  // Reset to an empty world (or the scene being edited) each time it opens.
  useEffect(() => {
    if (!open) return;
    const next = initialScene ? sanitizeScene3D(initialScene) : emptyScene();
    setScene(next);
    // In Lesson Mode the teaching panel always needs a solid to talk about.
    setSelectedId(next.lesson?.mode && next.objects.length ? next.objects[0].id : null);
    setActive(null);
    setStage(next.lesson?.mode ? "lesson" : "workspace");
    if (next.lesson?.mode) setLessonMode(next.lesson.mode);
  }, [open, initialScene]);

  const settings = scene.settings ?? DEFAULT_SETTINGS;
  const showLabels = scene.lesson?.showLabels ?? true;
  const selected = useMemo(
    () => scene.objects.find((o) => o.id === selectedId) ?? null,
    [scene.objects, selectedId],
  );
  const selectedAnnotations = useMemo(
    () => (scene.annotations ?? []).filter((a) => a.target.solidId === selectedId),
    [scene.annotations, selectedId],
  );

  const insert = useCallback((kind: Solid3DKind) => {
    const solid = createSolid(kind, settings.defaultDisplay);
    setScene((prev) => ({ ...prev, objects: [...prev.objects, solid] }));
    setSelectedId(solid.id);
    setSelectMode(true);
  }, [settings.defaultDisplay]);

  const patchSolid = useCallback((id: string, patch: Partial<Solid3D>) => {
    setScene((prev) => ({
      ...prev,
      objects: prev.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  /** Live edit of a shape parameter — every formula recalculates instantly. */
  const patchParam = useCallback((key: string, value: number) => {
    if (!selectedId || !Number.isFinite(value) || value <= 0) return;
    setScene((prev) => ({
      ...prev,
      objects: prev.objects.map((o) =>
        o.id === selectedId ? { ...o, params: { ...(o.params ?? {}), [key]: value } } : o,
      ),
    }));
  }, [selectedId]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setScene((prev) => ({
      ...prev,
      objects: prev.objects.filter((o) => o.id !== selectedId),
      annotations: (prev.annotations ?? []).filter((a) => a.target.solidId !== selectedId),
    }));
    setSelectedId(null);
    setActive(null);
  }, [selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy = duplicateSolid(selected);
    setScene((prev) => ({ ...prev, objects: [...prev.objects, copy] }));
    setSelectedId(copy.id);
  }, [selected]);

  const copySelected = useCallback(() => {
    if (selected) clipboard.current = selected;
  }, [selected]);

  const paste = useCallback(() => {
    if (!clipboard.current) return;
    const copy = duplicateSolid(clipboard.current);
    setScene((prev) => ({ ...prev, objects: [...prev.objects, copy] }));
    setSelectedId(copy.id);
  }, []);

  const clear = () => {
    setScene((prev) => ({ ...prev, objects: [], annotations: [] }));
    setSelectedId(null);
    setActive(null);
  };

  const patchSettings = (patch: Partial<Scene3DSettings>) =>
    setScene((prev) => ({ ...prev, settings: { ...(prev.settings ?? DEFAULT_SETTINGS), ...patch } }));

  // ---- annotations (always attached to a mathematical element) ----

  const setAnnotation = useCallback(
    (
      type: Annotation3D["type"],
      kind: ElementKind,
      index: number,
      value: string | null,
      style?: Annotation3D["style"],
    ) => {
      if (!selectedId) return;
      setScene((prev) => {
        const list = prev.annotations ?? [];
        const previous = list.find(
          (a) => a.type === type && a.target.solidId === selectedId && a.target.kind === kind && a.target.index === index,
        );
        const rest = list.filter(
          (a) => !(a.type === type && a.target.solidId === selectedId && a.target.kind === kind && a.target.index === index),
        );
        if (value === null || value === "") return { ...prev, annotations: rest };
        return {
          ...prev,
          annotations: [
            ...rest,
            {
              id: previous?.id ?? newId("ann"),
              type,
              // Created by an explicit teacher action, so it starts shown; the
              // properties panel can hide it again at any time.
              visible: true,
              target: { solidId: selectedId, kind, index },
              style: { ...(previous?.style ?? {}), ...(style ?? {}) },
              ...(type === "label" ? { text: value } : { color: value }),
            } as Annotation3D,
          ],
        };
      });
    },
    [selectedId],
  );

  /** Patch the style (size / density / colour) of one existing annotation. */
  const patchAnnotationStyle = useCallback(
    (id: string, patch: NonNullable<Annotation3D["style"]>) => {
      setScene((prev) => ({
        ...prev,
        annotations: (prev.annotations ?? []).map((a) =>
          a.id === id ? { ...a, style: { ...(a.style ?? {}), ...patch } } : a,
        ),
      }));
    },
    [],
  );


  const clearAnnotationsForSelected = useCallback(() => {
    if (!selectedId) return;
    setScene((prev) => ({
      ...prev,
      annotations: (prev.annotations ?? []).filter((a) => a.target.solidId !== selectedId),
    }));
  }, [selectedId]);

  const patchLesson = useCallback((patch: Partial<LessonState>) => {
    setScene((prev) => ({
      ...prev,
      lesson: { ...DEFAULT_LESSON, ...(prev.lesson ?? {}), ...patch },
    }));
  }, []);

  const labelSettings = scene.lesson?.labels ?? DEFAULT_LABEL_SETTINGS;

  const patchLabels = useCallback((patch: Partial<LabelSettings>) => {
    setScene((prev) => {
      const lesson = { ...DEFAULT_LESSON, ...(prev.lesson ?? {}) };
      return { ...prev, lesson: { ...lesson, labels: { ...lesson.labels, ...patch } } };
    });
  }, []);

  const setShowLabels = (v: boolean) => patchLesson({ showLabels: v });

  const enterLesson = () => {
    setStage("lesson");
    patchLesson({ mode: lessonMode });
    if (!selectedId && scene.objects.length) setSelectedId(scene.objects[0].id);
  };

  const backToWorkspace = () => {
    setStage("workspace");
    setActive(null);
    patchLesson({ mode: null });
  };

  const chooseLessonMode = (id: LessonModeId) => {
    setLessonMode(id);
    setActive(null);
    patchLesson({ mode: id });
  };


  const camera = scene.camera ?? DEFAULT_CAMERA;
  const defaultZoom = useMemo(() => Math.hypot(...camera.position) || 7, [camera.position]);

  const setDefaultZoom = (dist: number) => {
    const cur = camera.position;
    const len = Math.hypot(...cur) || 1;
    const next: Vec3 = [cur[0] / len * dist, cur[1] / len * dist, cur[2] / len * dist];
    setScene((prev) => ({ ...prev, camera: { position: next, target: (prev.camera ?? DEFAULT_CAMERA).target } }));
    setResetToken((t) => t + 1);
  };

  // Keyboard shortcuts — workspace stage only, so lesson work is never disturbed.
  useEffect(() => {
    if (!open || stage !== "workspace") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") { setSelectedId(null); return; }
      if (meta && e.key.toLowerCase() === "c") { copySelected(); return; }
      if (meta && e.key.toLowerCase() === "v") { e.preventDefault(); paste(); return; }
      if (meta && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSelected(); return; }
      if (!meta && e.key.toLowerCase() === "g") setTransformMode("translate");
      if (!meta && e.key.toLowerCase() === "r") setTransformMode("rotate");
      if (!meta && e.key.toLowerCase() === "s") setTransformMode("scale");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, copySelected, paste, duplicateSelected, deleteSelected, selectedId]);

  const modes: { mode: TransformMode; icon: typeof Move3d; label: string }[] = [
    { mode: "translate", icon: Move3d, label: "Move" },
    { mode: "rotate", icon: Rotate3d, label: "Rotate" },
    { mode: "scale", icon: Scaling, label: "Scale" },
  ];

  // Which lesson modes let the teacher pick faces / edges / vertices directly.
  const PICKING_MODES: LessonModeId[] = ["facesEdgesVertices", "measurements", "angles", "surfaceArea"];
  const lessonPickKind = stage === "lesson" && PICKING_MODES.includes(lessonMode) ? pickKind : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">3D Mathematics Workspace</DialogTitle>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-foreground/10 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Boxes className="h-4 w-4" />
            {stage === "workspace" ? "Workspace Mode" : "Lesson Mode"}
          </span>

          {/* Axes visibility — hides X / Y / Z from view without removing them,
              so the solid can be shown cleanly to a class. */}
          {(() => {
            const axesOn = !!(settings.showAxisX || settings.showAxisY || settings.showAxisZ);
            return (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5"
                onClick={() => patchSettings({
                  showAxisX: !axesOn, showAxisY: !axesOn, showAxisZ: !axesOn, axisLabels: !axesOn,
                })}
                title={axesOn ? "Hide the X / Y / Z axes" : "Show the X / Y / Z axes"}
                aria-pressed={axesOn}
              >
                {axesOn ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Axes
              </Button>
            );
          })()}

          <Separator orientation="vertical" className="mx-2 h-6" />



          {stage === "workspace" ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                    <Plus className="h-4 w-4" /> Insert
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
                  {SOLID_GROUPS.map((group, gi) => (
                    <div key={group.label}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                      {group.kinds.map((kind) => (
                        <DropdownMenuItem key={kind} onClick={() => insert(kind)}>
                          {SOLID_DEFS[kind].label}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                variant={selectMode ? "secondary" : "ghost"}
                className="h-8 gap-1.5"
                onClick={() => setSelectMode((v) => !v)}
                title="Toggle select mode — click an object to select it"
              >
                <MousePointer2 className="h-4 w-4" /> Select
              </Button>

              <div className={cn("inline-flex rounded-md border border-border p-0.5", !selected && "opacity-50")}>
                {modes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={!selected}
                    title={label}
                    onClick={() => setTransformMode(mode)}
                    className={cn(
                      "rounded px-2 py-1 transition",
                      transformMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={duplicateSelected} disabled={!selected}>
                <CopyPlus className="h-4 w-4" /> Duplicate
              </Button>

              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={deleteSelected} disabled={!selected}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>

              <WorkspaceSettingsPanel
                settings={settings}
                onChange={patchSettings}
                onResetCamera={() => setResetToken((t) => t + 1)}
                onSaveCameraAsDefault={() => {
                  if (!liveCamera.current) return;
                  const cam = liveCamera.current;
                  setScene((prev) => ({ ...prev, camera: { position: [...cam.position] as Vec3, target: [...cam.target] as Vec3 } }));
                }}
                defaultZoom={defaultZoom}
                onDefaultZoom={setDefaultZoom}
              />

              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={clear} disabled={scene.objects.length === 0}>
                <Eraser className="h-4 w-4" /> Clear
              </Button>

              <Button
                size="sm" variant="secondary" className="h-8 gap-1.5"
                onClick={enterLesson} disabled={scene.objects.length === 0}
                title="Lock the objects and teach the mathematics"
              >
                <GraduationCap className="h-4 w-4" /> Start Lesson
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={backToWorkspace}>
                <ArrowLeft className="h-4 w-4" /> Back to Workspace
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setLeftOpen((v) => !v)}
                title={leftOpen ? "Collapse the lesson menu" : "Show the lesson menu"}>
                <PanelLeft className="h-4 w-4" /> {leftOpen ? "Hide menu" : "Menu"}
              </Button>
              <div className="inline-flex rounded-md border border-border p-0.5">
                {([
                  { v: "hidden", label: "Off" },
                  { v: "normal", label: "20%" },
                  { v: "expanded", label: "40%" },
                ] as const).map((o) => (
                  <button key={o.v} type="button" onClick={() => setRightPanel(o.v)}
                    className={cn("rounded px-2 py-1 text-[11px] transition",
                      rightPanel === o.v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                    title={`Teaching panel ${o.label}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Objects are locked · camera stays free
              </span>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm" className="h-8 gap-1.5"
              onClick={() => { onExport(scene); onOpenChange(false); }}
            >
              <Download className="h-4 w-4" /> Export to Lesson Note
            </Button>
            <span className="w-6" aria-hidden />
          </div>
        </div>

        <div className={cn("grid min-h-0 flex-1 transition-[grid-template-columns] duration-300 ease-out",
          stage === "lesson"
            ? leftOpen
              ? rightPanel === "hidden"
                ? "grid-cols-[minmax(0,20%)_minmax(0,80%)_minmax(0,0%)]"
                : rightPanel === "expanded"
                  ? "grid-cols-[minmax(0,20%)_minmax(0,40%)_minmax(0,40%)]"
                  : "grid-cols-[minmax(0,20%)_minmax(0,60%)_minmax(0,20%)]"
              : rightPanel === "hidden"
                ? "grid-cols-[minmax(0,0%)_minmax(0,100%)_minmax(0,0%)]"
                : rightPanel === "expanded"
                  ? "grid-cols-[minmax(0,0%)_minmax(0,60%)_minmax(0,40%)]"
                  : "grid-cols-[minmax(0,0%)_minmax(0,80%)_minmax(0,20%)]"
            : selected ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1")}>
          {stage === "lesson" && (
            <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
              <LessonModePanel value={lessonMode} onChange={chooseLessonMode} />
              <div className="p-2">
                <LabelSettingsPanel value={labelSettings} onChange={patchLabels} />
              </div>
            </div>
          )}


          <div className="relative min-w-0">
            {open && (
              <Scene3DCanvas
                scene={scene}
                interaction={stage === "workspace" ? (selectMode ? "workspace" : "view") : "lesson"}
                selectedId={selectedId}
                onSelect={setSelectedId}
                transformMode={transformMode}
                onTransform={(id, next) => patchSolid(id, next)}
                pickKind={lessonPickKind}
                onPickElement={(solidId, kind, index) => setActive({ solidId, kind, index })}
                activeElement={active}
                unit={unit}
                decimals={decimals}
                emphasis={guide && selectedId ? { solidId: selectedId, guide } : null}
                highlightFace={hoverFace != null && selectedId ? { solidId: selectedId, index: hoverFace } : null}
                fillSolidId={stage === "lesson" && lessonMode === "volume" ? selectedId : null}
                resetToken={resetToken}
                onCameraChange={(c) => { liveCamera.current = c; }}
                frameloop="always"
                className="h-full w-full"
              />
            )}
            <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-muted-foreground mix-blend-difference">
              {stage === "workspace"
                ? "Drag to rotate · scroll to zoom · right-drag to pan · G/R/S switch gizmo"
                : "Drag to rotate · scroll to zoom · right-drag to pan · click a solid, then its faces, edges or vertices"}
            </p>
            {scene.objects.length === 0 && (
              <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground mix-blend-difference">
                Empty workspace — use Insert to add an object
              </p>
            )}
          </div>

          {stage === "workspace" && selected && (
            <ObjectInspector
              solid={selected}
              onChange={(patch) => patchSolid(selected.id, patch)}
              onCopy={copySelected}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
            />
          )}

          {stage === "lesson" && (
            <div className={cn(
              "h-full min-h-0 min-w-0 overflow-hidden transition-all duration-300",
              rightPanel === "hidden" && "pointer-events-none opacity-0",
              rightPanel === "expanded" &&
                "[&>div]:block [&>div]:[column-count:2] [&>div]:[column-gap:0.6rem] [&>div>*]:mb-2 [&>div>*]:break-inside-avoid",
            )}>
          {stage === "lesson" && lessonMode === "facesEdgesVertices" && (
              <FacesEdgesVerticesTools
                solid={selected}
                annotations={selectedAnnotations}
                pickKind={pickKind}
                onPickKind={(k) => { setPickKind(k); setActive(null); }}
                active={active && selected && active.solidId === selected.id ? { kind: active.kind, index: active.index } : null}
                showLabels={showLabels}
                clearActive={() => setActive(null)}
              onShowLabels={setShowLabels}
                onHighlight={(kind, index, color, style) => setAnnotation("highlight", kind, index, color, style)}
                onLabel={(kind, index, text, style) => setAnnotation("label", kind, index, text, style)}
                onStyle={patchAnnotationStyle}
                  onClearAll={clearAnnotationsForSelected}
              />
            )}

            {stage === "lesson" && lessonMode === "properties" && <PropertiesPanel solid={selected} />}

            {stage === "lesson" && lessonMode === "measurements" && (
              <MeasurementsTools
                solid={selected} scene={scene} setScene={setScene}
                pick={active} clearPick={() => setActive(null)}
                pickKind={pickKind} setPickKind={setPickKind}
                unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals}
                onParam={patchParam} onGuide={setGuide}
              />
            )}

            {stage === "lesson" && lessonMode === "angles" && (
              <AnglesTools
                solid={selected} scene={scene} setScene={setScene}
                pick={active} clearPick={() => setActive(null)}
                pickKind={pickKind} setPickKind={setPickKind}
              />
            )}

            {stage === "lesson" && lessonMode === "surfaceArea" && (
              <SurfaceAreaTools
                solid={selected} scene={scene} setScene={setScene}
                pick={active} clearPick={() => setActive(null)} setPickKind={setPickKind}
                unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals}
                onParam={patchParam} onGuide={setGuide}
              />
            )}

            {stage === "lesson" && lessonMode === "volume" && (
              <VolumeTools
                solid={selected} unit={unit} setUnit={setUnit}
                decimals={decimals} setDecimals={setDecimals}
                onParam={patchParam} onGuide={setGuide}
              />
            )}

            {stage === "lesson" && lessonMode === "nets" && (
              <NetsTools
                solid={selected} unit={unit} setUnit={setUnit}
                decimals={decimals} setDecimals={setDecimals}
                onParam={patchParam} onHoverFace={setHoverFace}
              />
            )}

            {stage === "lesson" && lessonMode === "crossSections" && (
              <CrossSectionsTools
                solid={selected} scene={scene} setScene={setScene}
                unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals}
                onParam={patchParam}
              />
            )}

            {stage === "lesson" && lessonMode === "coordinates" && (
              <CoordinatesTools
                solid={selected} scene={scene} setScene={setScene}
                unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals}
              />
            )}

            {stage === "lesson" && lessonMode === "transformations" && (
              <TransformationsTools solid={selected} scene={scene} setScene={setScene} />
            )}

            {stage === "lesson" && selected && (
              <AnnotationManager solid={selected} scene={scene} setScene={setScene} />
            )}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Workspace3DDialog;
