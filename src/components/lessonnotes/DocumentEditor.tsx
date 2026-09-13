// Word-style document editor for Lesson Notes. ONE editor for everything.
// Built on TipTap (ProseMirror). Page appearance (plain / ruled / math / grid /
// dotted) is purely visual — never changes behaviour. AI is an inline writing
// assistant; the teacher always owns the document.
//
// AI integration:
//  • Global ribbon AI button   → generates a WHOLE LESSON (or inserts at cursor)
//  • Per-section ✨ button      → generates ONE section, scoped to that heading
// Both reuse the existing notebook-ai edge function (modes: generate, floating).

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useServerFn } from "@tanstack/react-start";
import StarterKit from "@tiptap/starter-kit";
import { closeHistory } from "@tiptap/pm/history";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { MathInline } from "./extensions/MathInline";
import { MathBlock } from "./extensions/MathBlock";
import { CanvasFrame } from "./extensions/CanvasFrame";
import { SessionSpacer } from "./extensions/SessionSpacer";
import { attachSessionLayout } from "@/lib/lessonnotes/sessionLayout";
import { startObjectDrag } from "@/lib/lessonnotes/objectDrag";
import { analyzeProblem, isStructuralLabelLine, type ProblemReport } from "@/lib/lessonnotes/problemDetect";
import { ProblemCheckDialog } from "./ProblemCheckDialog";

import { SolutionRow, SolutionMath, SolutionProse } from "./extensions/SolutionRow";
import { SectionHeading, type SectionAiCallContext, type SectionAction } from "./extensions/SectionHeading";
import type { CoPilotBridge, CoPilotEntry } from "@/lib/lessonnotes/copilot/actions";
import { GeometryDiagramNode } from "./extensions/GeometryDiagram";
import { Scene3DDiagramNode, onScene3DWorkspaceOpen } from "./extensions/Scene3DDiagram";
// Heavy authoring dialogs load on first use, so opening the note does not wait
// for the 3D workspace, asset library, pickers or the emoji panel.
const Workspace3DDialog = lazy(() =>
  import("./geometry3d/Workspace3DDialog").then((m) => ({ default: m.Workspace3DDialog })),
);
import type { Scene3D } from "@/lib/geometry3d/scene3d";
import { GeometryAiPanel } from "./GeometryAiPanel";
import { GeometryToolbox } from "./geometry-editor/GeometryToolbox";
import { GeometryModeProvider, useGeometryMode } from "./geometry-editor/GeometryModeContext";
import { GeometryCanvas } from "./geometry-editor/GeometryCanvas";
import { useGeometryEditor } from "./geometry-editor/useGeometryEditor";
import { DiagramToolsPanel } from "@/components/lessonnotes/geometry-editor/DiagramToolsPanel";
import { SelectionInspector } from "./geometry-editor/SelectionInspector";
import { GeometryPropertiesWorkspace } from "./geometry-editor/GeometryPropertiesWorkspace";
import {
  isSolutionHeadingText,
  questionContextForOwner,
  questionContextForPos,
} from "@/lib/geometry/map/solutionText";
import { generateGeometryMap } from "@/lib/geometry/map/geometryMap.functions";
import {
  keepLiveIds as keepLiveMapIds,
  mapInventory,
  newMapItemId,
  readMap,
  stripNumericAnswers,
  writeMap,
  type GeometryMapItem,
} from "@/lib/geometry/map/model";
import { GeometryDiagram as StaticGeometryDiagram } from "./GeometryDiagram";
import { MathTableNode, type MathTableAttrs } from "./extensions/MathTable";
import { SmartGraphNode, DEFAULT_GRAPH } from "./extensions/SmartGraph";
import { SmartCalcNode, type SmartCalcAttrs } from "./extensions/SmartCalc";
import { MathObjectNode } from "./extensions/MathObject";
import { MathStructure, MathSlot } from "./extensions/MathStructure";
import { MathVisual } from "./extensions/MathVisual";
import { AtCommand, type AtCommandState } from "./extensions/AtCommand";
import { MathKeyShortcuts } from "./extensions/MathKeyShortcuts";
import { AtCommandMenu } from "./AtCommandMenu";
const AssetLibraryDialog = lazy(() => import("./AssetLibraryDialog").then((m) => ({ default: m.AssetLibraryDialog })));
import { LayoutGrid, Grid3X3, FunctionSquare } from "lucide-react";
import { StepAnimationNode, type AnimationFrame } from "./extensions/StepAnimation";
const MathTablesPicker = lazy(() => import("./math-tools/MathTablesPicker").then((m) => ({ default: m.MathTablesPicker })));
const SmartCalculator = lazy(() => import("./math-tools/SmartCalculator").then((m) => ({ default: m.SmartCalculator })));
const MathObjectsPicker = lazy(() => import("./math-objects/MathObjectsPicker").then((m) => ({ default: m.MathObjectsPicker })));
import { EMPTY_SCENE, sanitizeScene, pointById, type GeometryScene } from "@/lib/geometry/scene";
import { splitPageGeometryScene } from "@/lib/geometry/presentation";

import {
  addAngle,
  addArcThrough3,
  addCircleByRadius,
  addCircleThrough3,
  addPoint,
  addSegment,
  closePolygon,
  cycleEqualMarks,
  eraseObject,
  markParallel,
  midpointOfSegment,
  patchObject,
} from "@/lib/geometry/editor/sceneOps";
import { snap, pickObject } from "@/lib/geometry/editor/snap";
import type { ToolId } from "@/lib/geometry/editor/tools";
import { PageFrame } from "./PageFrame";
import { AiPopover } from "./AiPopover";
import {
  buildPreferenceDirective,
  hasCustomPreferences,
  loadAiPreferences,
} from "./ai/aiPreferences";

import { SymbolQuickPanel } from "./SymbolQuickPanel";
import type { QuickStructItem } from "@/lib/lessonnotes/symbolQuick";
import { MatrixQuickPanel } from "./MatrixQuickPanel";
import type { QuickMatrixSpec } from "@/lib/lessonnotes/matrixQuick";
import { insertAsset } from "@/lib/lessonnotes/assets/insert";
import { TABLES } from "@/lib/lessonnotes/assets/tables";

import { SelectionToolbar, type SelectionSnapshot } from "./SelectionToolbar";
import { AiEditPanel, type AiEditTarget } from "./AiEditPanel";
import { AiEditBridgeProvider, type AiEditRequest } from "@/hooks/useAiEditBridge";
import { detectSelectionKindFromText } from "@/lib/lessonnotes/detectSelectionKind";
import { sanitizePresentation } from "@/lib/lessonnotes/outputHygiene";

import { instructionTriggersStandards } from "@/lib/lessonnotes/editSuggestions";
import { AssetSelectionProvider, useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { PropertiesPanel } from "./PropertiesPanel";
import { SectionNav } from "./SectionNav";
const EmojiPanel = lazy(() => import("./EmojiPanel").then((m) => ({ default: m.EmojiPanel })));
import { EmojiMedia } from "./extensions/EmojiMedia";
import { ConversionPanel } from "./ConversionPanel";
import { renderMathInline, HAS_MATH } from "@/lib/notebook/mathRender";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";


import { SlidePanel } from "@/components/lessonnotes/slides/SlidePanel";
import {
  PAPER_LABELS, PAPER_SIZES,
  type PaperSize, type PaperStyle,
} from "@/lib/lessonnotes/paperThemes";
import {
  Undo2, Redo2, Sigma, Minus, Plus,
  Download, Sparkles, Plus as PlusIcon,
  FileText, Smartphone, Presentation, X,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Shapes, Table as TableIcon, LineChart, Calculator,
  ArrowLeftRight,

} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useViewAs } from "@/lib/accounts/viewAs";
import { withTimeout } from "@/lib/async/withTimeout";
import { exportDocx } from "@/lib/lessonnotes/exportDocx";
import {
  SECTION_LABELS, WHOLE_LESSON_ORDER, INSERT_SECTION_OPTIONS, aiSectionKind, blockKindFor,
  detectSectionKind, headingRole, type SectionKind,
} from "@/lib/lessonnotes/sectionKinds";
import { persistGeneratedExample } from "@/lib/lessonnotes/persistGenerated";
import {
  buildLessonTeachingContext,
  type LessonTeachingContext,
  type SectionChunk,
} from "@/lib/lessonnotes/lessonContext";
import { useLessonAiContextStore, sameSubtopic } from "@/lib/lessonnotes/aiContext";
import { useBuilderAiVisible } from "@/lib/lessonnotes/aiMode";
import { applyAutoNumbering } from "@/lib/lessonnotes/autoNumber";
import { reconcileSolutionOwnership } from "@/lib/lessonnotes/solutionPairing";
import { enforceQuestionSolutionPairs } from "@/lib/lessonnotes/questionPairs";



import { aiTextToNodes, hasStructuredAiContent, repairDocumentMath } from "@/lib/lessonnotes/aiToNodes";
import { sectionEndWithin, clampInsideSection, diagramsOwnedByQuestion, ownerQuestionHeadingFor, ensureOwnerQuestionId } from "@/lib/lessonnotes/containerRange";
import { describeExistingDiagram } from "@/lib/lessonnotes/diagramRef";

/** Stable identity for a diagram, so a Solution can reference it instead of
 *  generating a second one. */
const newDiagramId = (): string =>
  `D-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

import { buildWorkspaceManifest } from "@/lib/lessonnotes/ai/toolManifest";
import {
  buildSessionContext,
  describeSessionContext,
  materialFromSession,
  relatedContentFor,
  type SessionContextPackage,
} from "@/lib/lessonnotes/ai/sessionContext";

import { runBlueprintStage, summariseScene } from "@/lib/lessonnotes/ai/pipeline/generate";
import { blueprintDirective } from "@/lib/lessonnotes/ai/pipeline/blueprint";
import { hasMaterial, mergeMaterial } from "@/lib/lessonnotes/ai/pipeline/material";
import { verifyGeneration, failedGates } from "@/lib/lessonnotes/ai/pipeline/validate";
import {
  EMPTY_TEACHER_CONTEXT,
  STAGE_FAILURE_TITLE,
  hasTeacherContext,
  type QuestionBlueprint,
  type StageError,
  type TeacherContext,
} from "@/lib/lessonnotes/ai/pipeline/types";
import {
  expandSelectionToStructures,
  isStructuralHtml,
  rangeToStructuralPayload,
  structuralHtmlToSlice,
} from "@/lib/lessonnotes/structuralClipboard";

const SECTION_OPTIONS: SectionKind[] = INSERT_SECTION_OPTIONS;

/** Put the selected mathematical OBJECT on a native copy/cut event. Returns
 *  true when we handled it, so ProseMirror's plain serialisation is skipped.
 *  Selections that touch no structure fall through untouched. */
const writeMathClipboard = (
  view: { state: any; dispatch: (tr: any) => void },
  event: ClipboardEvent,
  isCut: boolean,
): boolean => {
  const state = view.state;
  if (state.selection.empty || !event.clipboardData) return false;
  const { from, to } = expandSelectionToStructures(state, state.selection.from, state.selection.to);
  const payload = rangeToStructuralPayload(state, from, to);
  if (!payload.hasStructure) return false;
  event.preventDefault();
  event.clipboardData.setData("text/html", payload.html);
  event.clipboardData.setData("text/plain", payload.text);
  if (isCut) view.dispatch(state.tr.delete(from, to).scrollIntoView());
  return true;
};



interface Props {
  documentJson: any | null;
  paperSize: PaperSize;
  paperStyle: PaperStyle;
  zoom: number;
  onZoomChange: (z: number) => void;
  onPaperSizeChange: (s: PaperSize) => void;
  onPaperStyleChange: (s: PaperStyle) => void;
  onDocChange: (json: any) => void;
  /** Extra page height (mm) added by Note Extend. */
  pageExtraMm?: number;
  onPageExtraMmChange?: (mm: number) => void;

  notebookContext?: { subject?: string; topic?: string; subtopic?: string };
  onPresent?: () => void;
  onScanFromPhone?: () => void;
  exportFileName?: string;
  /** When true, the section picker only offers "Game Questions" (used by Adventure scenes). */
  gameQuestionsOnly?: boolean;
  /** Board B (the teacher's working copy) has no Session system: hide the
   *  session/subtopic authoring controls. */
  hideSessionControls?: boolean;
  /** Explicit lesson-note id for callers that are not on the /lesson-notes/:id route
   *  (e.g. the Smartboard's companion workspace). Defaults to the route param. */
  notebookId?: string;
  /** Namespaces this editor's local-only state (canvas notes, page geometry) so a
   *  second instance of the same lesson note cannot collide with the primary one. */
  scopeSuffix?: string;
  /** Filled with the MyGPL Co-Pilot bridge — the only way the Co-Pilot may
   *  touch this note, and every entry wraps an existing editor handler. */
  copilotBridgeRef?: React.MutableRefObject<CoPilotBridge | null>;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Free-position text anchor rendered as an overlay outside the TipTap doc.
 *  Kept separate so flowing AI-generated lesson content can never overlap or
 *  compress with click-anywhere notes. */
interface CanvasBox {
  id: string;
  /** Paper-local X in CSS px (origin = paper left edge). */
  x: number;
  /** Paper-local Y in CSS px (origin = paper top edge). */
  y: number;
  text: string;
}

const canvasBoxesKey = (notebookId: string | undefined) =>
  notebookId ? `lesson-notes:canvas-boxes:${notebookId}` : null;

const notebookGeometryKey = (notebookId: string | undefined) =>
  notebookId ? `lesson-notes:notebook-geometry:${notebookId}` : null;

const loadCanvasBoxes = (notebookId: string | undefined): CanvasBox[] => {
  const key = canvasBoxesKey(notebookId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((b) => b && typeof b.id === "string") : [];
  } catch { return []; }
};

const saveCanvasBoxes = (notebookId: string | undefined, boxes: CanvasBox[]) => {
  const key = canvasBoxesKey(notebookId);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(boxes)); } catch { /* noop */ }
};

const loadNotebookGeometry = (notebookId: string | undefined): GeometryScene => {
  const key = notebookGeometryKey(notebookId);
  if (!key) return EMPTY_SCENE;
  try {
    const raw = localStorage.getItem(key);
    return raw ? ((sanitizeScene(JSON.parse(raw)) as GeometryScene) ?? EMPTY_SCENE) : EMPTY_SCENE;
  } catch { return EMPTY_SCENE; }
};

const saveNotebookGeometry = (notebookId: string | undefined, scene: GeometryScene) => {
  const key = notebookGeometryKey(notebookId);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(scene)); } catch { /* noop */ }
};


/** Bridge so the toolbar Dustbin can clean 2D diagram content that lives in
 *  the notebook-wide geometry scene. Only 2D objects are ever eligible —
 *  lesson-note text, tables, graphs, 3D scenes and text boxes are untouched. */
type GeometryEraser = (clientX: number, clientY: number) => boolean;
let notebookGeometryEraser: GeometryEraser | null = null;
const registerNotebookGeometryEraser = (fn: GeometryEraser | null) => {
  notebookGeometryEraser = fn;
};


const mergeGeometrySceneAt = (
  base: GeometryScene,
  incoming: unknown,
  dx: number,
  dy: number,
): GeometryScene => {
  const source = sanitizeScene(incoming) as GeometryScene | null;
  if (!source?.objects?.length) return base;
  const used = new Set(base.objects.map((o) => o.id));
  const idMap = new Map<string, string>();
  const mapId = (id: string) => {
    const existing = idMap.get(id);
    if (existing) return existing;
    let next = id;
    if (used.has(next)) {
      let i = 1;
      do { next = `${id}_m${i++}`; } while (used.has(next));
    }
    used.add(next);
    idMap.set(id, next);
    return next;
  };

  const shifted = source.objects.map((o) => {
    const n: any = { ...(o as any), id: mapId(o.id) };
    if (n.type === "point" || n.type === "label") {
      n.x = (n.x ?? 0) + dx;
      n.y = (n.y ?? 0) + dy;
    }
    if ("a" in n && typeof n.a === "string") n.a = mapId(n.a);
    if ("mid" in n && typeof n.mid === "string") n.mid = mapId(n.mid);
    if ("b" in n && typeof n.b === "string") n.b = mapId(n.b);
    if ("center" in n && typeof n.center === "string") n.center = mapId(n.center);
    if ("vertex" in n && typeof n.vertex === "string") n.vertex = mapId(n.vertex);
    if (Array.isArray(n.points)) n.points = n.points.map(mapId);
    if (Array.isArray(n.boundary)) n.boundary = n.boundary.map(mapId);
    return n;
  });

  return {
    ...base,
    bounds: {
      width: Math.max(base.bounds?.width ?? 0, dx + (source.bounds?.width ?? 0) + 48),
      height: Math.max(base.bounds?.height ?? 0, dy + (source.bounds?.height ?? 0) + 48),
    },
    objects: [...base.objects, ...shifted],
  };
};

/** Strip any legacy absolute-position attributes from a stored doc so old
 *  notebooks recover normal flow. Idempotent + safe on any input. */
function sanitizeLegacyCanvasAttrs(doc: any): any {
  if (!doc || typeof doc !== "object") return doc;
  const walk = (n: any): any => {
    if (!n || typeof n !== "object") return n;
    let next = n;
    if (n.attrs && typeof n.attrs === "object" &&
        ("canvasX" in n.attrs || "canvasY" in n.attrs || "canvasIndent" in n.attrs)) {
      const { canvasX, canvasY, canvasIndent, ...rest } = n.attrs;
      next = { ...n, attrs: rest };
    }
    if (Array.isArray(next.content)) {
      next = { ...next, content: next.content.map(walk) };
    }
    return next;
  };
  return walk(doc);
}


const eventTargetElement = (target: EventTarget | null): Element | null => {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const isEditorControlTarget = (target: EventTarget | null) => {
  const el = eventTargetElement(target);
  return Boolean(el?.closest('button, input, textarea, select, a, [contenteditable="false"]'));
};

/**
 * Mathematics goes through the MathGPL Math Engine.
 * Returns null when this request is not the Engine's business (teaching prose,
 * introductions, summaries) or when the Engine could not verify its own
 * mathematics — the caller then uses the ordinary generation path.
 */
async function engineGenerate(opts: {
  kind: SectionKind;
  teacherPrompt: string;
  ctx?: Props["notebookContext"];
  blockKind?: "problem" | "solution" | "text";
  activeQuestion?: string;
  context?: string;
  /** Receives the verified, constructed 2D figure for a generated question. */
  onScene?: (scene: unknown) => void;
  signal?: AbortSignal;
}): Promise<string | null> {
  const { runEngine } = await import("@/lib/mathengine/client");
  const base = {
    instruction: opts.teacherPrompt,
    topic: opts.ctx?.topic ?? "",
    subtopic: opts.ctx?.subtopic ?? "",
    sectionKind: aiSectionKind(opts.kind),
    sessionContext: opts.context ?? "",
  } as const;

  try {
    if (opts.blockKind === "solution") {
      const question = String(opts.activeQuestion ?? "").trim();
      if (!question) return null;
      const res = await runEngine({ ...base, operation: "solveQuestion", question, count: 1, signal: opts.signal });
      const q = res.questions[0];
      if (!q) return null;
      return q.solutionSteps.join("\n").trim() || null;
    }
    if (isQuestionSectionKind(opts.kind) && opts.blockKind !== "text") {
      const operation = opts.kind === "classwork"
        ? "generateClasswork"
        : opts.kind === "homework" || opts.kind === "assessment"
          ? "generateAssignment"
          : "generateExample";
      const res = await runEngine({ ...base, operation, count: 1, signal: opts.signal });
      const q = res.questions[0];
      // A constructed, verified figure travels WITH its question so the editor
      // can place the single authoritative diagram under the question body.
      if (res.scene) opts.onScene?.(res.scene);
      return q?.text?.trim() || null;
    }

  } catch {
    // A refusal or a failed verification is never shown as fabricated
    // mathematics — the ordinary generation path handles it instead.
    return null;
  }
  return null;
}

/** Call the notebook-ai edge function in `generate` mode. */
async function aiGenerate(opts: {
  kind: SectionKind;
  teacherPrompt: string;
  ctx?: Props["notebookContext"];
  context?: string;
  currentContent?: string;
  blockKind?: "problem" | "solution" | "text";
  activeQuestion?: string;
  existingHeading?: string;
  inheritedContext?: boolean;
  lessonContext?: LessonTeachingContext;
  /** Receives the verified 2D figure constructed for a generated question. */
  onScene?: (scene: unknown) => void;
  signal?: AbortSignal;
}): Promise<string> {

  const { hasCreditsForGeneration, INSUFFICIENT_CREDITS_MESSAGE } = await import("@/lib/costs/creditGuard");
  if (!(await hasCreditsForGeneration())) throw new Error(INSUFFICIENT_CREDITS_MESSAGE);
  const fromEngine = await engineGenerate(opts);
  if (fromEngine) return fromEngine;
  const { data, error } = await withTimeout(supabase.functions.invoke("notebook-ai", {

    body: {
      mode: "generate",
      sectionKind: aiSectionKind(opts.kind),
      blockKind: opts.blockKind ?? blockKindFor(opts.kind),
      topic: opts.ctx?.topic ?? "",
      subtopic: opts.ctx?.subtopic ?? "",
      subject: opts.ctx?.subject ?? "Mathematics",
      context: opts.context ?? "",
      currentContent: opts.currentContent ?? "",
      teacherPrompt: opts.teacherPrompt,
      activeQuestion: opts.activeQuestion ?? "",
      existingHeading: opts.existingHeading ?? "",
      inheritedContext: opts.inheritedContext ?? false,
      lessonContext: opts.lessonContext ?? null,
      workspaceManifest: buildWorkspaceManifest(),
    },
    signal: opts.signal,
  }), 45_000, "Lesson generation took too long. Please try again.");
  if (error) {
    // supabase.functions.invoke surfaces a generic "non-2xx status code"
    // message and hides the JSON body inside error.context (a Response). Read
    // it so callers can detect controlled errors like question_lock_mismatch
    // instead of treating every failure as an unhandled crash.
    let code = "";
    try {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.clone().json();
        code = String(body?.error ?? "");
      }
    } catch { /* body not JSON — ignore */ }
    if (code) throw new Error(code);
    throw error;
  }
  return ((data as any)?.content ?? "").toString();
}

/** True when an editor instance can still safely take commands. */
const editorAlive = (ed: any): boolean =>
  Boolean(ed && !ed.isDestroyed && (ed as any).view?.dom);

const QUESTION_SECTION_KINDS: SectionKind[] = ["example", "exercise", "classwork", "homework", "assessment", "game_questions"];
const isQuestionSectionKind = (kind: SectionKind) => QUESTION_SECTION_KINDS.includes(kind);


/** Durable identity for a question block, so its Solution can be bound to it
 *  the moment both are created. */
const newQuestionId = (): string => `q_${Math.random().toString(36).slice(2, 10)}`;

/** The Solution area of ONE question. It is ALWAYS stamped with the owning
 *  question's id: a solution never exists without its question. */
const solutionPlaceholderNodes = (ownerQuestionId?: string | null) => ([
  {
    type: "heading",
    attrs: { level: 3, ...(ownerQuestionId ? { ownerQuestionId } : {}) },
    content: [{ type: "text", text: "Solution" }],
  },
  { type: "paragraph" },
]);


/** True for a heading that already acts as this question's Solution slot. */
const isSolutionLabel = (raw: string): boolean => {
  const t = String(raw ?? "").trim().toLowerCase().replace(/[:.\s]+$/, "");
  return t === "solution" || t === "worked solution" || /^solution\b/.test(t) || t.includes("worked solution");
};

/** The AI sometimes restates the "Solution" label as the first body line.
 *  Strip it so the section never grows a second Solution marker. */
const stripLeadingSolutionLabel = (raw: string): string => {
  const lines = String(raw ?? "").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length && isSolutionLabel(lines[0])) lines.shift();
  return lines.join("\n").trim();
};


/** Run the existing notebook-ai `scan` mode on each image and merge problems. */
async function scanImages(images: string[]): Promise<string[]> {
  const results = await Promise.all(images.map(async (dataUrl) => {
    try {
      const { data, error } = await withTimeout(supabase.functions.invoke("notebook-ai", {
        body: { mode: "scan", imageDataUrl: dataUrl },
      }), 30_000, "Image scanning took too long.");
      if (error) return [] as string[];
      const items: string[] = (data as any)?.items ?? [];
      return items;
    } catch { return [] as string[]; }
  }));
  return results.flat();
}

// (legacy textToParagraphs removed — see aiTextToNodes for the math-aware version)


export function DocumentEditor(props: Props) {
  return (
    <GeometryModeProvider>
      <DocumentEditorInner {...props} />
    </GeometryModeProvider>
  );
}

function DocumentEditorInner({
  documentJson, paperSize, paperStyle, zoom,
  onZoomChange, onPaperSizeChange, onPaperStyleChange, onDocChange,
  notebookContext, onPresent, onScanFromPhone, exportFileName, gameQuestionsOnly, hideSessionControls,
  pageExtraMm: pageExtraMmProp, onPageExtraMmChange,
  notebookId: notebookIdProp, scopeSuffix, copilotBridgeRef,
}: Props) {
  /** Platform chrome translates; the teacher's own writing never does. */
  const tLabel = useT();
  const { mode: geometryMode, setMode: setGeometryMode, tool: geometryTool, setTool: setGeometryTool, showPoints: geometryShowPoints, setShowPoints: setGeometryShowPoints } = useGeometryMode();
  /** Whole-lesson AI assist belongs to MathGPL Builder mode only. */
  const builderAi = useBuilderAiVisible();
  // When a school looks through a teacher's workspace the page is identical;
  // the paper simply refuses to change.
  const { viewOnly, allowEdit } = useViewAs();

  /* ─── Note Extend / Note Shrink ────────────────────────────────────────
   * The sheet grows in fixed 50 mm slabs. Shrinking is clamped so the page
   * bottom can never rise above the last rendered object on the page. */
  const NOTE_STEP_MM = 50;
  const sheetElRef = useRef<HTMLDivElement | null>(null);
  const numberTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageExtraMm, setPageExtraMm] = useState<number>(pageExtraMmProp ?? 0);
  useEffect(() => {
    if (typeof pageExtraMmProp === "number") setPageExtraMm(pageExtraMmProp);
  }, [pageExtraMmProp]);

  const applyPageExtra = (mm: number) => {
    const next = Math.max(0, Math.round(mm));
    setPageExtraMm(next);
    onPageExtraMmChange?.(next);
  };

  const extendNote = () => applyPageExtra(pageExtraMm + NOTE_STEP_MM);

  /** Millimetres of blank space between the last object and the page bottom. */
  const trailingBlankMm = (): number => {
    const sheet = sheetElRef.current;
    if (!sheet) return pageExtraMm;
    const inner = sheet.firstElementChild as HTMLElement | null;
    const contentHost = inner?.firstElementChild as HTMLElement | null;
    if (!contentHost) return pageExtraMm;
    const scale = sheet.getBoundingClientRect().width / (sheet.offsetWidth || 1) || 1;
    let bottom = contentHost.getBoundingClientRect().top;
    for (const el of Array.from(contentHost.querySelectorAll<HTMLElement>("*"))) {
      // The extend spacer and the page-wide geometry overlay are not content —
      // they always reach the page bottom, so measuring them would make
      // Note Shrink believe there is nothing to reclaim.
      if (el.dataset.noteExtendSpacer || el.dataset.notebookGeometryOverlay) continue;
      if (el.closest("[data-notebook-geometry-overlay]")) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 && r.width === 0) continue;
      if (r.bottom > bottom) bottom = r.bottom;
    }

    const sheetBottom = sheet.getBoundingClientRect().bottom;
    const blankPx = (sheetBottom - bottom) / scale;
    return Math.max(0, blankPx / (96 / 25.4));
  };

  const shrinkNote = () => {
    if (pageExtraMm <= 0) return;
    // Never shrink into content: only reclaim genuinely blank trailing space.
    const reclaimable = Math.max(0, trailingBlankMm() - 12);
    if (reclaimable < 1) {
      toast({
        title: "Cannot shrink further",
        description: "The page already stops just below your last object.",
      });
      return;
    }
    applyPageExtra(pageExtraMm - Math.min(NOTE_STEP_MM, reclaimable));
  };

  /* ─── 3D Geometry Workspace (separate from the 2D editor) ─── */
  const [diagramTabsOpen, setDiagramTabsOpen] = useState(false);
  const [workspace3dOpen, setWorkspace3dOpen] = useState(false);
  const [workspace3dScene, setWorkspace3dScene] = useState<Scene3D | null>(null);
  const workspace3dApplyRef = useRef<((next: Scene3D) => void) | null>(null);

  const [tablesOpen, setTablesOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [objectsOpen, setObjectsOpen] = useState(false);
  
  const { id: routeNotebookId } = useParams();
  // Callers off the /lesson-notes/:id route (the Smartboard companion page) pass
  // the id explicitly. `storageId` additionally namespaces local-only state so a
  // second instance of the same note keeps its own canvas notes / page geometry.
  const notebookId = notebookIdProp ?? routeNotebookId;
  const storageId = notebookId
    ? (scopeSuffix ? `${notebookId}:${scopeSuffix}` : notebookId)
    : undefined;
  const navigate = useNavigate();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctxRef = useRef(notebookContext);
  useEffect(() => { ctxRef.current = notebookContext; }, [notebookContext]);

  // ── Lesson AI context ────────────────────────────────────────────────────
  // The ACTIVE SUBTOPIC is application state, not page text: whatever the
  // teacher last confirmed is what every AI feature generates for.
  const aiCtx = useLessonAiContextStore(notebookContext);
  useEffect(() => { aiCtx.syncNotebook(notebookContext ?? {}); }, [notebookContext, aiCtx]);

  const nbIdRef = useRef(notebookId);
  useEffect(() => { nbIdRef.current = notebookId; }, [notebookId]);

  /** Tag the FIRST `mathBlock` between [from, to] with a subsectionId so the
   *  parent section heading can render its faint "Floating numbers" chip
   *  pointing at the start of the solution. */
  const tagFirstMathBlock = (from: number, to: number, subsectionId: string) => {
    if (!editor) return;
    let firstPos: number | null = null;
    editor.state.doc.nodesBetween(from, Math.min(to, editor.state.doc.content.size), (n, p) => {
      if (firstPos != null) return false;
      if (n.type.name === "mathBlock") { firstPos = p; return false; }
      return true;
    });
    if (firstPos != null) {
      const tr = editor.state.tr.setNodeMarkup(firstPos, undefined, {
        ...editor.state.doc.nodeAt(firstPos)?.attrs,
        subsectionId,
      });
      editor.view.dispatch(tr);
    }
  };

  /** After AI generates a solution-style block, persist for smartboard +
   *  surface a toast that deep-links to the floating-numbers workspace. */
  const buildMapFn = useServerFn(generateGeometryMap);

  /**
   * A solution was just written. If its question owns a diagram, offer to build
   * that diagram's Geometry Map from this very solution — Question → Solution →
   * Map, bound by the question's own id.
   */
  const offerGeometryMap = (range: { from: number; to: number } | null) => {
    if (!editor || !range) return;
    const doc = editor.state.doc;
    const owner = ownerQuestionHeadingFor(doc, range.from);
    if (!owner) return;
    const diagrams = diagramsOwnedByQuestion(doc, owner.pos, isSolutionHeadingText);
    if (diagrams.length === 0) return;
    const target = diagrams[0];
    const questionId = (owner.node.attrs as { sectionId?: string })?.sectionId ?? null;

    const run = async () => {
      if (!editor) return;
      const live = editor.state.doc;
      let pos: number | null = null;
      live.descendants((n, p) => {
        if (pos != null) return false;
        if (n.type.name === "geometryDiagram" && n.attrs.scene === target.node.attrs.scene) {
          pos = p;
          return false;
        }
        return true;
      });
      if (pos == null) pos = target.pos;
      const node = live.nodeAt(pos);
      const scene = node?.attrs?.scene as GeometryScene | undefined;
      if (!scene) return;
      const ctx = questionContextForOwner(live, questionId, pos);
      if (!ctx.solution.trim()) return;
      try {
        const res = await buildMapFn({
          data: {
            question: ctx.question,
            solution: ctx.solution,
            topic: activeContext()?.subtopic || activeContext()?.topic || "",
            objects: mapInventory(scene),
          },
        });
        const built: GeometryMapItem[] = (res.items ?? []).map((it: any, i: number) => ({
          id: newMapItemId(),
          order: i,
          principle: it.principle,
          relation: stripNumericAnswers(it.relation),
          explanation: stripNumericAnswers(it.explanation),
          usedTo: stripNumericAnswers(it.usedTo),
          stepIndex: it.stepIndex,
          ...(it.producesToken ? { producesToken: it.producesToken } : {}),
          ...(it.needsTokens?.length ? { needsTokens: it.needsTokens } : {}),
          objectIds: keepLiveMapIds(scene, it.objectIds),
          source: "ai" as const,
          enabled: true,
        }));
        if (built.length === 0) {
          toast({ title: "No principles could be read from this solution." });
          return;
        }
        const existing = readMap(scene);
        const keep = existing.items.filter((i) => i.source === "teacher");
        const nextScene = writeMap(scene, {
          ...existing,
          generatedFromSolution: true,
          questionId,
          solutionHash: ctx.solutionHash,
          generatedAt: new Date().toISOString(),
          items: [...built, ...keep].map((it, i) => ({ ...it, order: i })),
        });
        updateGeometrySceneAt(pos, nextScene);
        toast({ title: `Geometry Map built — ${built.length} steps.` });
      } catch (e) {
        toast({
          title: "Map generation failed",
          description: e instanceof Error ? e.message : undefined,
        });
      }
    };

    toast({
      title: "Solution saved",
      description: "Generate the Geometry Map from this solution?",
      action: (
        <button
          onClick={() => { void run(); }}
          className="text-xs px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/10"
        >
          Generate Map
        </button>
      ) as any,
    });
  };

  const persistAndOfferFloating = async (
    kind: SectionKind,
    content: string,
    range: { from: number; to: number } | null,
    problemOverride?: string,
  ) => {
    if (blockKindFor(kind) !== "solution") return;
    offerGeometryMap(range);
    if (!nbIdRef.current) return;
    try {
      const res = await persistGeneratedExample({
        notebookId: nbIdRef.current,
        kind,
        problem: problemOverride?.trim() || activeContext()?.topic || activeContext()?.subtopic || "",
        solution: content,
        subject: activeContext()?.subject,
        subtopic: activeContext()?.subtopic,

      });
      if (!res) return;
      if (range) tagFirstMathBlock(range.from, range.to, res.subsectionId);
      toast({
        title: "Floating numbers ready",
        description: "Open the workspace to fine-tune them for the Smartboard.",
        action: (
          <button
            onClick={() => navigate(`/lesson-notes/${nbIdRef.current}/floating-prep/${res.subsectionId}`)}
            className="text-xs px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/10"
          >
            Open
          </button>
        ) as any,
      });
    } catch { /* noop */ }
  };

  /** Serialise the document range [from, to) into classroom-math text:
   *  math nodes contribute their LaTeX `value` attr verbatim, text nodes
   *  contribute their text, block boundaries become newlines. This is the
   *  ACTIVE_QUESTION extractor — textBetween() would silently drop math
   *  nodes (e.g. \frac{3}{2+5i}), which is the root cause of the
   *  Solution AI inventing a different equation. */
  const serializeRangeAsMath = (from: number, to: number): string => {
    if (!editor || to <= from) return "";
    const out: string[] = [];
    let line: string[] = [];
    const flushLine = () => {
      const t = line.join("").trim();
      if (t) out.push(t);
      line = [];
    };
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (pos < from) return true;
      if (node.type.name === "mathBlock" || node.type.name === "mathInline") {
        const v = String((node.attrs as any)?.value ?? "").trim();
        if (v) line.push(v);
        return false; // don't descend
      }
      if (node.type.name === "text") {
        line.push(node.text ?? "");
        return false;
      }
      // block-level boundary
      if (node.isBlock && line.length) flushLine();
      return true;
    });
    flushLine();
    return out.join("\n").trim();
  };

  /** SESSION CONTEXT — the AI never judges a request from one block alone.
   *  Everything the session already holds (each question, its diagram, its
   *  solution) is derived once and shared by the check and the pipeline. */
  const collectSessionContext = (pos: number): SessionContextPackage | null => {
    if (!editor) return null;
    try {
      return buildSessionContext({
        doc: editor.state.doc,
        pos,
        serialize: serializeRangeAsMath,
        diagramsFor: (headingPos) =>
          diagramsOwnedByQuestion(editor.state.doc, headingPos, isSolutionLabel),
        diagramSummary: (scene) => summariseScene(scene),
      });
    } catch {
      return null;
    }
  };

  /** Problem Check panel state. `askProblemCheck` resolves true when the
   *  teacher chooses to generate anyway. */
  const [problemCheck, setProblemCheck] = useState<{
    report: ProblemReport; heading?: string; resolve: (ok: boolean) => void;
  } | null>(null);
  const askProblemCheck = (report: ProblemReport, heading?: string) =>
    new Promise<boolean>((resolve) => setProblemCheck({ report, heading, resolve }));


  const getSolutionSource = (headingPos: number, session?: SessionContextPackage | null) => {
    let parentKind: SectionKind = "example";
    let parentPos = 0;
    // Walk every prior heading (≤ level 2). The CLOSEST prior heading — of any
    // kind — is the boundary, so we never span across a previous Solution and
    // accidentally pull an older example's question into ACTIVE_QUESTION.
    // We still remember the most recent QUESTION-kind heading to label the
    // parent (parentKind), but the range itself starts after the closest
    // heading regardless of kind.
    editor?.state.doc.descendants((n, p) => {
      if (p >= headingPos) return false;
      if (n.type.name === "heading" && (n.attrs.level ?? 6) <= 2) {
        parentPos = p;
        const k = detectSectionKind(n.textContent);
        if (k && k !== "solution") parentKind = k;
      }
      return true;
    });
    const parentNode = editor?.state.doc.nodeAt(parentPos);
    const problemStart = parentPos + (parentNode?.nodeSize ?? 0);
    const rawText = (editor && problemStart < headingPos)
      ? serializeRangeAsMath(problemStart, headingPos)
      : "";
    // An inline "Solution" label written as text still marks a boundary: keep
    // only what follows the LAST label-only line whose kind is `solution`, so
    // an older question above it can never leak into ACTIVE_QUESTION.
    const allLines = rawText.split("\n");
    let cutAt = -1;
    for (let i = allLines.length - 1; i >= 0; i--) {
      if (isStructuralLabelLine(allLines[i]) && detectSectionKind(allLines[i]) === "solution") {
        cutAt = i; break;
      }
    }
    const scoped = (cutAt >= 0 ? allLines.slice(cutAt + 1) : allLines).join("\n");
    // STRUCTURE vs MATHEMATICS. Structural labels ("Classwork 4",
    // "Example 3: Solve …") and interface metadata are set aside; the
    // mathematics is always kept — even when it sits on the same line as the
    // label. This is what stops the old "no parent question found" failure.
    // Content belonging to the SAME question (its diagram, its Solution) and to
    // the rest of the session counts as found mathematics.
    const pkg = session ?? collectSessionContext(headingPos);
    const report = analyzeProblem(scoped, {
      hasDiagram: editor
        ? diagramsOwnedByQuestion(editor.state.doc, parentPos, isSolutionLabel).length > 0
        : false,
      related: pkg ? relatedContentFor(pkg) : undefined,
    });


    // ACTIVE_QUESTION: the block's own text when it has any, otherwise the
    // question read from the session package (the question may have been typed
    // into a free frame, or exist only as the diagram belonging to it).
    const ownerQuestion = pkg?.owner?.questionText?.trim() ?? "";
    const ownerDiagram = pkg?.owner?.diagramSummary ?? "";
    const problemText =
      report.problem ||
      ownerQuestion ||
      (ownerDiagram ? `See the diagram belonging to this question (${ownerDiagram}).` : "");


    return {
      parentKind: isQuestionSectionKind(parentKind) ? parentKind : "example",
      // Position of the heading that OWNS this Solution (the question
      // heading). The geometry diagram belongs to that block, never to the
      // Solution itself.
      parentPos,
      problemText,
      report,
      hasInheritedQuestion: Boolean(problemText),
    };
  };


  /** The subtopic that owns `beforePos`: the nearest structural subtopic
   *  heading (level 1, custom text) above it. Everything generated below that
   *  heading belongs to this subtopic — the AI must never continue the
   *  previous one. */
  const currentSubtopicAt = (beforePos: number): { pos: number; title: string } | null => {
    if (!editor) return null;
    let found: { pos: number; title: string } | null = null;
    editor.state.doc.descendants((n, p) => {
      if (p >= beforePos) return false;
      if (n.type.name === "heading") {
        const role = headingRole(n.textContent, n.attrs?.level ?? 6);
        if (role?.role === "subtopic") found = { pos: p, title: role.title };
      }
      return true;
    });
    return found;
  };

  /** THE single AI-context resolver. The confirmed ACTIVE SUBTOPIC wins when
   *  the insertion point sits at or below its heading; when the teacher works
   *  further up the note, the nearest subtopic heading above that point owns
   *  the generation instead. Never falls back to the notebook's original
   *  subtopic once a subtopic has been confirmed. */
  const contextAt = (beforePos: number): Props["notebookContext"] => {
    const live = aiCtx.read();
    const base = {
      ...(ctxRef.current ?? {}),
      subject: live.subject || ctxRef.current?.subject || "Mathematics",
      topic: live.topic || ctxRef.current?.topic || "",
    };
    const active = live.activeSubtopic.trim();
    const activePos = live.activeSubtopicPos;
    if (active && (activePos == null || beforePos >= activePos)) {
      return { ...base, subtopic: active };
    }
    const sub = currentSubtopicAt(beforePos);
    if (sub) return { ...base, subtopic: sub.title };
    return { ...base, subtopic: active || base.subtopic };
  };

  /** Context for AI actions that have no document position (whole-note edits,
   *  selection AI Edit): always the confirmed active subtopic. */
  const activeContext = (): Props["notebookContext"] => {
    const live = aiCtx.read();
    return {
      ...(ctxRef.current ?? {}),
      subject: live.subject || "Mathematics",
      topic: live.topic || ctxRef.current?.topic || "",
      subtopic: live.activeSubtopic || ctxRef.current?.subtopic || "",
    };
  };


  /** Everything already taught in this lesson ABOVE `beforePos`, condensed
   *  into the teaching context the AI needs so sections stay connected.
   *  Scoped to the current subtopic when one exists. */
  const collectLessonContext = (beforePos: number, targetKind: SectionKind): LessonTeachingContext | undefined => {
    if (!editor) return undefined;
    const doc = editor.state.doc;
    const scopeStart = currentSubtopicAt(beforePos)?.pos ?? 0;
    const headings: { pos: number; size: number; text: string }[] = [];
    doc.descendants((n, p) => {
      if (p >= beforePos) return false;
      if (p < scopeStart) return true;
      if (n.type.name === "heading" && (n.attrs?.level ?? 6) <= 3) {
        headings.push({ pos: p, size: n.nodeSize, text: n.textContent });
      }
      return true;
    });
    const chunks: SectionChunk[] = [];
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const start = h.pos + h.size;
      const end = Math.min(headings[i + 1]?.pos ?? beforePos, beforePos);
      if (end <= start) continue;
      let text = "";
      try { text = serializeRangeAsMath(start, end); } catch { text = ""; }
      if (!text.trim()) continue;
      chunks.push({ kind: detectSectionKind(h.text), heading: h.text.trim(), text });
    }
    if (!chunks.length) return undefined;
    return buildLessonTeachingContext({ sections: chunks, targetKind });
  };



  /** Build a teacherPrompt that reflects scanned images + the requested action. */
  const buildPrompt = async (opts: {
    base: string; action: SectionAction; sectionText: string; images: string[]; kind: SectionKind;
  }): Promise<{ prompt: string; currentContent: string }> => {
    let prompt = opts.base.trim();
    if (opts.images.length) {
      toast({ title: "Reading attached image…" });
      const items = await scanImages(opts.images);
      if (items.length) {
        prompt = (prompt ? prompt + "\n\n" : "") +
          `Use these problems extracted from the attached image:\n` +
          items.map((s, i) => `${i + 1}. ${s}`).join("\n");
      }
    }
    const label = SECTION_LABELS[opts.kind].toLowerCase();
    switch (opts.action) {
      case "regenerate": {
        // Regenerate means "something is missing — fix it". The teacher's
        // latest instruction (typed, spoken or scanned from an image) is the
        // whole point of the press, so it MUST drive the rewrite, with the
        // current section handed over as the thing being corrected.
        const hasExisting = opts.sectionText.trim().length > 0;
        if (prompt && hasExisting) {
          return {
            prompt:
              `Regenerate the ${label} below, applying this teacher instruction exactly:\n` +
              `"""${prompt}"""\n\n` +
              `Keep everything the instruction does not mention. Output ONLY the full corrected ${label} body — ` +
              `no section headings, no commentary about what you changed.`,
            currentContent: opts.sectionText,
          };
        }
        return { prompt: prompt || `Rewrite the ${label} from scratch.`, currentContent: "" };
      }

      case "paraphrase":
        return {
          prompt: (prompt ? prompt + "\n\n" : "") +
            `Rewrite the ${label} in simpler, clearer classroom language. Keep the same meaning and math.`,
          currentContent: opts.sectionText,
        };
      case "extend":
        return {
          prompt: (prompt ? prompt + "\n\n" : "") +
            `Continue the ${label} from where it ends. Add more depth or another worked step — do not repeat what is already there.`,
          currentContent: opts.sectionText,
        };
      case "generate":
      default: {
        // In-place EDIT: section already has content → revise this section
        // only (never append a second copy underneath). Works with a typed
        // instruction OR with the teacher's saved AI preferences alone.
        const hasExisting = opts.sectionText.trim().length > 0;
        const prefsNow = loadAiPreferences(nbIdRef.current);
        const instruction = prompt || (
          hasCustomPreferences(prefsNow)
            ? "Rewrite this content so it follows the teacher preferences below."
            : ""
        );
        if (hasExisting && instruction) {
          return {
            prompt:
              `Apply this teacher instruction to the ${label} below:\n` +
              `"""${instruction}"""\n\n` +
              `Output ONLY the full revised ${label}. Keep everything not mentioned in the instruction exactly as-is. ` +
              `Do NOT add section headings (no "Introduction", "Explanation", "Example", "Summary" titles). ` +
              `Do NOT generate any other section. Return just the body text of this ${label}.\n\n` +
              `DIAGRAM OWNERSHIP: This section may contain a geometry diagram that the editor preserves automatically. ` +
              `Do NOT mention the diagram, do NOT say it was removed/replaced/moved, and do NOT add "(see diagram)" placeholders. ` +
              `Only describe the diagram differently if the teacher's instruction explicitly asks to change it.`,
            currentContent: opts.sectionText,
          };
        }


        if (isQuestionSectionKind(opts.kind)) {
          return { prompt: prompt || `Generate one ${label} question only. Do not write the solution.`, currentContent: "" };
        }
        return { prompt: prompt || `Generate the ${SECTION_LABELS[opts.kind]}.`, currentContent: "" };
      }
    }
  };

  /** True when a "generate" press should behave as an in-place edit: the
   *  section already has content and the teacher either typed an instruction
   *  or has saved AI preferences to apply. */
  const isInPlaceEdit = (info: SectionAiCallContext, basePrompt: string) =>
    info.action === "generate" &&
    info.sectionText.trim().length > 0 &&
    (basePrompt.trim().length > 0 || hasCustomPreferences(loadAiPreferences(nbIdRef.current)));

  /** Handle per-section AI button (passed into SectionHeading extension). */
  const handleSectionAi = async (prompt: string, infoIn: SectionAiCallContext) => {
    // The editor may be null on first paint, or destroyed while an async stage
    // was running. Every stage below re-checks it instead of assuming it lives.
    if (!editorAlive(editor)) return;
    let info = infoIn;

    // The heading must still exist — every position below is anchored to it.
    const anchorNode = editor.state.doc.nodeAt(info.headingPos);
    if (!anchorNode || anchorNode.type.name !== "heading") {
      toast({ title: "That section moved or was deleted — click AI on the heading again.", variant: "destructive" });
      return;
    }
    // Always trust a freshly resolved, container-scoped section end over the
    // value captured when the button was clicked.
    info = { ...info, sectionEndPos: sectionEndWithin(editor.state.doc, info.headingPos) };

    // CLEAR: delete the section content (between this heading and the next).
    if (info.action === "clear") {
      if (!info.sectionText) return;
      const headingNodeSize = editor.state.doc.nodeAt(info.headingPos)?.nodeSize ?? 0;
      const start = info.headingPos + headingNodeSize;
      if (info.sectionEndPos > start) {
        editor.chain().focus()
          .deleteRange({ from: start, to: info.sectionEndPos })
          .insertContentAt(start, { type: "paragraph" })
          .run();
      }
      return;
    }

    // Custom session ("+ Add Session"): the teacher's typed title IS the
    // instruction. A session that owns a Solution area behaves exactly like an
    // Example (question + solution + floating prep); one without behaves like
    // an Explanation (content only, no solution area is ever created).
    let sessionTitle: string | null = null;
    if (info.kind === "custom_session") {
      sessionTitle = info.headingText.trim();
      let hasSolutionArea = false;
      editor.state.doc.nodesBetween(
        info.headingPos,
        Math.min(info.sectionEndPos, editor.state.doc.content.size),
        (n, p) => {
          if (hasSolutionArea) return false;
          if (p <= info.headingPos) return true;
          if (n.type.name === "heading" && isSolutionLabel(n.textContent)) hasSolutionArea = true;
          return true;
        },
      );
      info = { ...info, kind: hasSolutionArea ? "example" : "explanation" };
    }


    const promptBase = sessionTitle
      ? `Teacher's session request: "${sessionTitle}". Generate this section specifically for that request — ` +
        `not a generic treatment of the topic.` +
        (prompt.trim() ? `\n\nAdditional teacher instruction: ${prompt.trim()}` : "")
      : prompt;

    const built = await buildPrompt({
      base: promptBase, action: info.action, sectionText: info.sectionText,
      images: info.images, kind: info.kind,
    });

    const { currentContent } = built;
    // Layer 2 — teacher preferences appended AFTER the task prompt so the
    // pedagogy / QUESTION_LOCK / continuity standards keep priority.
    const prefDirective = buildPreferenceDirective(loadAiPreferences(nbIdRef.current));
    let finalPrompt = prefDirective ? `${built.prompt}\n\n${prefDirective}` : built.prompt;

    // ── SESSION CONTEXT — derived once, used by every stage below ───────────
    const session = collectSessionContext(info.headingPos);
    const sessionDigest = session ? describeSessionContext(session) : "";
    if (sessionDigest) finalPrompt = `${finalPrompt}\n\n${sessionDigest}`;

    // ── PIPELINE STAGE 2/3 — understand the material, then structure it ─────
    // A question section is never generated straight from a loose prompt: the
    // teacher's material (text, photos, documents) plus the Add-context strip
    // are first analysed into a mathematical blueprint. Generation then works
    // from that blueprint, so question, diagram and solution share one model.
    const teacherContext: TeacherContext = info.context ?? { ...EMPTY_TEACHER_CONTEXT };
    // When the teacher typed nothing, the material is read from the lesson note
    // itself, so the blueprint stage can never fail with "no material".
    const documentMaterial = session ? materialFromSession(session) : "";
    const typedMaterial = mergeMaterial(prompt, info.images ?? [], info.files ?? []);
    const material = hasMaterial(typedMaterial)
      ? typedMaterial
      : mergeMaterial(documentMaterial, info.images ?? [], info.files ?? []);
    const wantsPipeline =
      !((info.presetContent ?? "").trim()) &&
      isQuestionSectionKind(info.kind) &&
      info.action !== "clear" &&
      (hasMaterial(material) || hasTeacherContext(teacherContext));
    let blueprint: QuestionBlueprint | null = null;
    if (wantsPipeline) {
      try {
        blueprint = await runBlueprintStage({
          material,
          context: teacherContext,
          sectionKind: info.kind,
          fallbackTopic: contextAt(info.headingPos)?.topic ?? "",
          fallbackSubtopic: contextAt(info.headingPos)?.subtopic ?? "",
          sessionContext: sessionDigest,
          onStage: info.reportStage,
        });
      } catch (err) {
        const stage = (err as StageError)?.stage ?? "ANALYSING";
        toast({
          title: STAGE_FAILURE_TITLE[stage] ?? "Generation stopped",
          description: String((err as any)?.message ?? err),
          variant: "destructive",
        });
        return;
      }
      const directive = blueprintDirective(blueprint);
      if (directive) finalPrompt = `${finalPrompt}\n\n${directive}`;
      if (teacherContext.count > 1) {
        finalPrompt += `\n\nGenerate ${teacherContext.count} separate questions, numbered 1., 2., …`;
      }
      info.reportStage?.("GENERATING_QUESTION");
    }
    if (!editorAlive(editor)) return;


    const isSolutionBlock = info.kind === "solution";
    const solutionSource = isSolutionBlock ? getSolutionSource(info.headingPos, session) : null;

    // TWO-STAGE PIPELINE — stage 1: identify + validate, stage 2: generate.
    // A non-valid report never silently blocks the teacher: the Problem Check
    // panel states exactly what was inspected and offers "Generate anyway".
    if (isSolutionBlock && solutionSource && solutionSource.report.status !== "valid") {
      const heading = editor.state.doc.nodeAt(solutionSource.parentPos)?.textContent?.trim();
      const proceed = await askProblemCheck(solutionSource.report, heading);
      if (!proceed) return;
    }

    // The Solution references the question's EXISTING diagram. We hand the
    // model an inventory of what is already drawn so it never redraws it,
    // renames its points, or invents a second figure.
    // Diagrams are part of the document now, so the figure that belongs to this
    // exercise travels with the text for questions AND solutions.
    const diagramOwnerPos = isSolutionBlock
      ? (solutionSource?.parentPos ?? -1)
      : info.headingPos;
    const ownedQuestionDiagrams = diagramOwnerPos >= 0
      ? diagramsOwnedByQuestion(editor.state.doc, diagramOwnerPos, isSolutionLabel)
      : [];

    // Backward-compatible repair for notes saved before permanent ownership:
    // keep the first authoritative scene and remove only later AI-GENERATED
    // geometryDiagram nodes associated with this same question.
    //
    // A DIAGRAM THE TEACHER DREW IS PERMANENT LESSON CONTENT: it is never
    // removed here. Only diagrams the model authored (they carry
    // `questionText`) can be de-duplicated, and only the teacher can delete
    // their own figure. The cleanup is one undoable document step.
    if (ownedQuestionDiagrams.length > 1) {
      const duplicates = ownedQuestionDiagrams.slice(1).sort((a, b) => b.pos - a.pos);
      const tr = editor.state.tr;
      for (const duplicate of duplicates) {
        const live = tr.doc.nodeAt(duplicate.pos);
        const aiAuthored = typeof live?.attrs?.questionText === "string"
          && String(live.attrs.questionText).trim().length > 0;
        if (live?.type.name === "geometryDiagram" && aiAuthored) {
          tr.delete(duplicate.pos, duplicate.pos + live.nodeSize);
        }
      }
      if (tr.docChanged) {
        closeHistory(tr);
        editor.view.dispatch(tr);
      }
    }
    const ownedQuestionDiagram = ownedQuestionDiagrams[0];
    const existingDiagramNote = ownedQuestionDiagram
      ? describeExistingDiagram(ownedQuestionDiagram.node.attrs?.scene as any)
      : "";
    const promptForAi = existingDiagramNote
      ? `${finalPrompt}\n\n${existingDiagramNote}\nDescribe the solution using those labels only. Do NOT output any diagram, figure or 3D directive.`
      : finalPrompt;

    const generationKind = solutionSource?.parentKind ?? info.kind;
    const generationBlockKind = isQuestionSectionKind(info.kind)
      ? "problem"
      : isSolutionBlock
        ? "solution"
        : undefined;

    // A question the teacher already approved is committed verbatim: no AI call,
    // so it can never be reworded, restated twice, or drift from the draft.
    const preset = (info.presetContent ?? "").trim();
    let content: string = preset;
    // The verified figure the Math Engine constructed for THIS question, if any.
    let engineScene: unknown = null;
    if (!preset) try {
      content = (await aiGenerate({
        kind: generationKind,
        teacherPrompt: promptForAi,
        ctx: contextAt(info.headingPos),

        context: isSolutionBlock ? solutionSource?.problemText : info.sectionText,
        currentContent,
        blockKind: generationBlockKind,
        activeQuestion: isSolutionBlock ? solutionSource?.problemText : undefined,
        // The application owns this heading — the AI must not reproduce it.
        existingHeading: editor.state.doc.nodeAt(info.headingPos)?.textContent?.trim(),
        inheritedContext: isSolutionBlock ? true : undefined,
        lessonContext: collectLessonContext(info.headingPos, generationKind),
        // ONE QUESTION = ONE DIAGRAM: only accepted when this question does not
        // already own an authoritative figure.
        onScene: (scene) => { if (!ownedQuestionDiagram) engineScene = scene; },
        signal: info.signal,
      })).trim();

    } catch (err: any) {
      const msg = String(err?.message ?? err);
      // The Co-Pilot builds unattended: it must see the real failure, otherwise
      // an item is marked built while its block was left empty.
      if (info.throwOnFailure) throw err instanceof Error ? err : new Error(msg);
      if (msg.includes("question_lock_mismatch") || msg.includes("missing_inherited_question")) {
        toast({
          title: "Couldn't match this solution to the question",
          description: "Try again, or simplify the question text above the Solution.",
          variant: "destructive",
        });
        return;
      }
      // Out of credits / rate limit: tell the teacher exactly what happened,
      // otherwise "Generation failed" hides a billing problem they can fix.
      const lower = msg.toLowerCase();
      if (lower.includes("credit") || lower.includes("402") || lower.includes("payment required")) {
        toast({
          title: "Out of AI credits",
          description: "Top up your balance in Settings → Plans & credits to keep generating.",
          variant: "destructive",
        });
        return;
      }
      if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
        toast({
          title: "AI is busy",
          description: "Too many requests right now — wait a few seconds and try again.",
          variant: "destructive",
        });
        return;
      }
      // Any other backend/network failure: show a friendly message instead of
      // letting the error bubble up into React (which triggers the full app
      // error overlay teachers and students were seeing).
      console.warn("[handleSectionAi] generation failed:", msg);
      toast({
        title: "Generation failed",
        description: msg.slice(0, 200) || "Something went wrong while generating. Please try again.",
        variant: "destructive",
      });

      return;
    }
    if (!content) {
      if (info.throwOnFailure) throw new Error("The AI returned nothing for this block.");
      toast({ title: "No content returned" });
      return;
    }
    if (!editorAlive(editor)) return;

    // ── PIPELINE STAGE 6 — validation gate ──────────────────────────────────
    // A blueprinted question is checked against its blueprint before it is
    // shown: solvable, internally consistent, answerable in the required form.
    if (blueprint) {
      info.reportStage?.("VALIDATING");
      const verdict = await verifyGeneration({
        gate: "maths",
        blueprint,
        question: content,
        diagramSummary: ownedQuestionDiagram
          ? summariseScene(ownedQuestionDiagram.node.attrs?.scene)
          : "",
      });
      const failed = failedGates([verdict]);
      if (failed.length) {
        toast({
          title: "This question did not pass the check",
          description: `${failed.flatMap((f) => f.problems).slice(0, 3).join(" • ")} — adjust the instruction and generate again.`,
          variant: "destructive",
        });
        return;
      }
      if (!editorAlive(editor)) return;
      info.reportStage?.("READY");
    }

    // A model that writes "\frac" inside a JSON string loses the backslash to
    // the string escape (\f = form feed), so "\frac{6}{2}" would reach the page
    // as "rac62". Put the command back before anything is rendered, so the
    // fraction is drawn stacked instead of leaking broken text.
    content = content
      .replace(/\f(rac|loor)/g, "\\f$1")
      .replace(/\r(ight|ho)/g, "\\r$1")
      .replace(/[\b](egin|inom|ar)/g, "\\b$1")
      .replace(/\t(frac|imes|ext)/g, "\\t$1");

    // A Solution heading must never be duplicated, and the AI must never
    // re-emit the label as body text.
    if (isSolutionBlock) content = stripLeadingSolutionLabel(content);

    // Single-column flow: math + prose interleaved. Figure directives resolve
    // wherever they are generated — this is the original single-diagram path.
    const questionBodyNodes = aiTextToNodes(content);


    // REGENERATE (and in-place EDIT): replace the section body, strictly
    // bounded by this section's range. Otherwise append at section end.
    const replaceBody = info.action === "regenerate" || isInPlaceEdit(info, prompt);

    /** Re-resolve the live end of this section, so we never delete across the
     *  next heading — and never leave the heading's own container (a free
     *  canvasFrame or a Solution cell). */
    const liveSectionEnd = (headingPos: number): number =>
      sectionEndWithin(editor.state.doc, headingPos);


    /** Position + size of the Solution heading already living inside this
     *  section, or null. The question body must always be inserted ABOVE it,
     *  and no second placeholder may ever be added. */
    const findSolutionHeading = (headingPos: number): { pos: number; size: number } | null => {
      const doc = editor.state.doc;
      const end = liveSectionEnd(headingPos);
      let found: { pos: number; size: number } | null = null;
      doc.nodesBetween(headingPos, Math.min(end, doc.content.size), (n, p) => {
        if (found) return false;
        if (p <= headingPos) return true;
        if (n.type.name === "heading" && isSolutionLabel(n.textContent)) {
          found = { pos: p, size: n.nodeSize };
          return false;
        }
        return true;
      });
      if (found) return found;
      // The teacher may have moved this question's Solution into its own free
      // frame anywhere on the page. The relationship survives the move, so look
      // it up document-wide by owner id instead of creating a second Solution.
      const owner = doc.nodeAt(headingPos);
      const qid = (owner?.attrs as any)?.sectionId as string | undefined;
      if (!qid) return null;
      let linked: { pos: number; size: number } | null = null;
      doc.descendants((n, p) => {
        if (linked) return false;
        if (
          n.type.name === "heading" &&
          isSolutionLabel(n.textContent) &&
          (n.attrs as any)?.ownerQuestionId === qid
        ) {
          linked = { pos: p, size: n.nodeSize };
          return false;
        }
        return true;
      });
      return linked;
    };


    /** The default Example/Exercise skeleton contains one empty paragraph
     *  before the pre-created Solution heading. Once AI generates the
     *  question, remove only that placeholder so the question sits directly
     *  under the section heading, exactly like the old pre-auto-Solution flow. */
    const hasOnlyEmptyParagraphs = (from: number, to: number): boolean => {
      if (to <= from) return false;
      const doc = editor.state.doc;
      let sawParagraph = false;
      let ok = true;
      doc.nodesBetween(from, Math.min(to, doc.content.size), (n) => {
        if (!ok) return false;
        if (n.type.name === "paragraph") {
          sawParagraph = true;
          if (n.textContent.trim()) ok = false;
          return false;
        }
        if (n.isText) {
          if (n.textContent.trim()) ok = false;
          return true;
        }
        if (n.type.name === "hardBreak") return true;
        ok = false;
        return false;
      });
      return ok && sawParagraph;
    };

    /** Reset the body under this section's Solution heading to a single empty
     *  paragraph, keeping the heading itself. Used on regenerate, where the
     *  old solution no longer matches the new question. */
    const clearSolutionBody = (): void => {
      const sol = findSolutionHeading(info.headingPos);
      if (!sol) return;
      const doc = editor.state.doc;
      const bodyStart = sol.pos + sol.size;
      const bodyEnd = Math.min(liveSectionEnd(info.headingPos), doc.content.size);
      if (bodyEnd <= bodyStart) return;
      editor.chain().focus()
        .deleteRange({ from: bodyStart, to: bodyEnd })
        .insertContentAt(bodyStart, { type: "paragraph" })
        .run();
    };



    /** Collect every geometryDiagram node attrs found in [from, to). */
    const collectDiagrams = (from: number, to: number) => {
      const found: Array<{ scene: unknown; topic: unknown; diagramId: unknown }> = [];
      if (to <= from) return found;
      editor.state.doc.nodesBetween(from, to, (n) => {
        if (n.type.name === "geometryDiagram") {
          found.push({ scene: n.attrs?.scene, topic: n.attrs?.topic, diagramId: n.attrs?.diagramId ?? newDiagramId() });
        }
        return true;
      });
      return found;
    };

    /** End position of the LAST geometryDiagram living inside this section, or
     *  -1. The diagram belongs to the QUESTION, so generated Solution content
     *  must always land BELOW it, never above it. */
    const lastDiagramEnd = (headingPos: number): number => {
      const doc = editor.state.doc;
      const end = Math.min(liveSectionEnd(headingPos), doc.content.size);
      let out = -1;
      doc.nodesBetween(headingPos, end, (n, p) => {
        if (n.type.name === "geometryDiagram") {
          out = Math.max(out, p + n.nodeSize);
          return false;
        }
        return true;
      });
      return out;
    };

    // The section already owns a Solution heading (inserted with the section,
    // or by an earlier generation) → reuse it instead of appending another.
    const existingSolution = isQuestionSectionKind(info.kind)
      ? findSolutionHeading(info.headingPos)
      : null;
    const trailingNodes = isQuestionSectionKind(info.kind) && !existingSolution
      ? solutionPlaceholderNodes(ensureOwnerQuestionId(editor, info.headingPos))
      : [];


    let insertFrom: number;
    // Position immediately AFTER the question body — this is where the
    // geometry diagram for the question must be inserted.
    let questionBodyEnd: number;
    // Diagrams preserved from the section before we wiped it; re-inserted
    // after the new body so they remain part of this section forever.
    let preservedDiagrams: Array<{ scene: unknown; topic: unknown; diagramId: unknown }> = [];
    if (replaceBody) {
      const headingNodeSize = editor.state.doc.nodeAt(info.headingPos)?.nodeSize ?? 0;
      const start = headingNodeSize ? info.headingPos + headingNodeSize : info.headingPos;
      insertFrom = start;
      // Clamp the delete range to the LIVE next-heading position so we
      // can never spill into the following section. When a Solution heading
      // exists, stop at it: the heading (and the structure below) survives a
      // regenerate — only the question body is replaced.
      const sectionEnd = liveSectionEnd(info.headingPos);
      const liveEnd = existingSolution ? Math.min(existingSolution.pos, sectionEnd) : sectionEnd;
      // Preserve diagrams BEFORE we wipe.
      preservedDiagrams = collectDiagrams(start, liveEnd);
      editor.chain().focus()
        .deleteRange({ from: start, to: liveEnd })
        .run();
      let bodyAt = start;
      // SOLUTION UNDER THE DIAGRAM: a diagram found in a Solution block belongs
      // to the question, so it is restored FIRST and the new solution text is
      // written below it. For question blocks the diagram stays at the end of
      // the question body (above the Solution heading).
      if (isSolutionBlock) {
        for (const d of preservedDiagrams) {
          const before = editor.state.doc.content.size;
          editor.chain().focus().insertContentAt(bodyAt, {
            type: "geometryDiagram",
            attrs: { scene: d.scene, topic: d.topic, diagramId: d.diagramId },
          }).run();
          bodyAt += editor.state.doc.content.size - before;
        }
      }
      const sizeBefore = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(bodyAt, questionBodyNodes).run();
      questionBodyEnd = bodyAt + (editor.state.doc.content.size - sizeBefore);
      insertFrom = bodyAt;
      // Re-insert preserved diagrams at the end of the new question body.
      if (!isSolutionBlock) for (const d of preservedDiagrams) {
        const insertAt = Math.min(questionBodyEnd, editor.state.doc.content.size);
        const before = editor.state.doc.content.size;
        editor.chain().focus().insertContentAt(insertAt, {
          type: "geometryDiagram",
          attrs: { scene: d.scene, topic: d.topic, diagramId: d.diagramId },
        }).run();
        questionBodyEnd += editor.state.doc.content.size - before;
      }
      if (trailingNodes.length) {
        editor.chain().focus().insertContentAt(questionBodyEnd, trailingNodes).run();
      } else if (existingSolution) {
        // The old solution belongs to the old question — reset its body to a
        // single empty paragraph, leaving the heading itself in place.
        clearSolutionBody();
      }
    } else {
      // Append path. Everything is anchored to THIS heading and clamped to its
      // own container, so generated content can never jump above the heading,
      // into another free frame, or to the end of the document.
      const liveEnd = liveSectionEnd(info.headingPos);
      const headingSize = editor.state.doc.nodeAt(info.headingPos)?.nodeSize ?? 0;
      const bodyStart = headingSize ? info.headingPos + headingSize : info.headingPos;
      // The question ALWAYS goes above an existing Solution heading, never at
      // the very end of the section (which would put it under the solution).
      insertFrom = existingSolution ? Math.min(existingSolution.pos, liveEnd) : liveEnd;
      const emptyTo = existingSolution ? Math.min(existingSolution.pos, liveEnd) : liveEnd;
      if (hasOnlyEmptyParagraphs(bodyStart, emptyTo)) {
        // Only placeholder paragraphs under the heading → replace them so the
        // body sits directly under its heading.
        editor.chain().focus().deleteRange({ from: bodyStart, to: emptyTo }).run();
        insertFrom = bodyStart;
      }
      // SOLUTION UNDER THE DIAGRAM: the diagram belongs to the question, so
      // solution text can never be written above it.
      if (isSolutionBlock) {
        const dEnd = lastDiagramEnd(info.headingPos);
        if (dEnd > insertFrom) insertFrom = dEnd;
      }
      insertFrom = clampInsideSection(editor.state.doc, info.headingPos, insertFrom);
      const sizeBefore = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(insertFrom, questionBodyNodes).run();
      questionBodyEnd = insertFrom + (editor.state.doc.content.size - sizeBefore);

      if (trailingNodes.length) {
        editor.chain().focus().insertContentAt(questionBodyEnd, trailingNodes).run();
      }
    }

    // THE ONE AUTHORITATIVE DIAGRAM. Nothing is ever "painted": this figure was
    // CONSTRUCTED from the Engine's mathematical program, solved into exact
    // coordinates and verified before it got here. It is inserted once, at the
    // end of the question body (never above a Solution heading), and stays
    // editable and owned by this question forever.
    if (
      engineScene &&
      !isSolutionBlock &&
      isQuestionSectionKind(info.kind) &&
      !ownedQuestionDiagram &&
      !preservedDiagrams.length
    ) {
      const at = Math.min(questionBodyEnd, editor.state.doc.content.size);
      editor.chain().focus().insertContentAt(at, {
        type: "geometryDiagram",
        attrs: {
          scene: engineScene,
          topic: contextAt(info.headingPos)?.subtopic ?? contextAt(info.headingPos)?.topic ?? null,
          diagramId: newDiagramId(),
          ownerQuestionId: ensureOwnerQuestionId(editor, info.headingPos),
        },
      }).run();
    }

    if (isQuestionSectionKind(info.kind)) return;


    await persistAndOfferFloating(generationKind, content, {
      from: insertFrom,
      to: editor.state.doc.content.size,
    }, solutionSource?.problemText);
  };

  // ── Step Animation: capture current selection (or current block) as a frame
  const captureStep = () => {
    if (!editor) return;
    const { state } = editor;
    let { from, to } = state.selection;
    if (from === to) {
      // No selection — fall back to the block containing the caret.
      const $from = state.doc.resolve(from);
      const start = $from.before($from.depth);
      const end = $from.after($from.depth);
      from = start; to = end;
    }
    const slice = state.doc.slice(from, to);
    const contentJson = (slice.content as any).toJSON?.() ?? [];
    if (!contentJson.length) {
      toast({ title: "Nothing to capture", description: "Select content (or place the caret in a block) first." });
      return;
    }

    // Walk outward from the selection: if we are already inside a stepAnimation
    // node, append; otherwise wrap the selection in a new one.
    let animPos = -1;
    let animNode: any = null;
    state.doc.descendants((node: any, pos: number) => {
      if (animPos !== -1) return false;
      if (node.type.name === "stepAnimation" && pos <= from && pos + node.nodeSize >= to) {
        animPos = pos; animNode = node; return false;
      }
      return true;
    });

    const newFrame: AnimationFrame = { id: crypto.randomUUID(), content: contentJson };

    if (animPos !== -1 && animNode) {
      const prev: AnimationFrame[] = Array.isArray(animNode.attrs.frames) ? animNode.attrs.frames : [];
      const next = [...prev, newFrame];
      const tr = state.tr.setNodeMarkup(animPos, undefined, {
        ...animNode.attrs,
        frames: next,
        currentFrame: next.length - 1,
      });
      editor.view.dispatch(tr);
      toast({ title: `Frame ${next.length} captured` });
      return;
    }

    // Wrap: insert a stepAnimation node at the selection start, then leave
    // original content in place so the teacher can keep editing it as the
    // "live" frame source. Future captures append to this node.
    editor.chain()
      .focus()
      .insertContentAt(from, {
        type: "stepAnimation",
        attrs: { frames: [newFrame], currentFrame: 0 },
      })
      .run();
    toast({ title: "Animation started", description: "Edit, then press Capture Step again to add the next frame." });
  };

  // ONE ENGINE: before anything reaches the editor, every line that carries
  // mathematics is re-grouped into a single full-line math object drawn by
  // `renderMathInline` — the AI Edit renderer. Legacy notes fragmented into
  // many atoms heal themselves here, so no seam-gaps and no raw markup.
  const normalizedDoc = useMemo(
    () =>
      // QUESTION + SOLUTION = ONE ITEM: orphaned Solutions are removed, drifted
      // ones re-homed, legacy ones adopted — before anything is rendered.
      enforceQuestionSolutionPairs(
        reconcileSolutionOwnership(
          repairDocumentMath(sanitizeLegacyCanvasAttrs(documentJson) ?? EMPTY_DOC).doc,
        ).doc,
      ).doc,
    [documentJson],
  );



  const [atState, setAtState] = useState<AtCommandState>({ active: false, query: "", from: 0, to: 0, coords: null });

  const [assetLibOpen, setAssetLibOpen] = useState(false);



  const editor = useEditor({
    editable: !viewOnly,
    extensions: [
      StarterKit.configure({ heading: false }),
      SectionHeading.configure({
        levels: [1, 2, 3],
        onGenerateSection: handleSectionAi,
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing — or use the AI button to draft a section.",
      }),
      MathInline,
      MathBlock,
      SolutionRow,
      SolutionMath,
      SolutionProse,
      GeometryDiagramNode,
      Scene3DDiagramNode,
      MathTableNode,
      SmartGraphNode,
      SmartCalcNode,
      MathObjectNode,
      StepAnimationNode,
      MathSlot,
      MathStructure,
      MathVisual,
      EmojiMedia,
      CanvasFrame,
      SessionSpacer,
      AtCommand.configure({ onChange: setAtState }),
      MathKeyShortcuts,
    ],
    content: normalizedDoc,
    editorProps: {
      attributes: {
        class: "lesson-doc max-w-none focus:outline-hidden min-h-[60vh]",
        spellcheck: "true",
      },
      // Keyboard copy/cut carry the mathematical OBJECT, exactly like the
      // selection toolbar: the range is first grown to structure boundaries,
      // then the schema markup (brackets, cells, nesting) goes on the
      // clipboard alongside a readable plain-text flavour.
      handleDOMEvents: {
        copy: (view, event) => writeMathClipboard(view, event as ClipboardEvent, false),
        cut: (view, event) => writeMathClipboard(view, event as ClipboardEvent, true),
      },
      // Paste inside the note rebuilds the object tree from our own markup,
      // so a copied 2×2 matrix pastes back as a 2×2 matrix. Everything else
      // (plain text, ChatGPT paste, foreign HTML) keeps its normal path.
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData("text/html");
        if (!isStructuralHtml(html)) return false;
        const slice = structuralHtmlToSlice(view.state.schema, html!);
        if (!slice) return false;
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
    },

    onUpdate: ({ editor }) => {
      // Problem 1 → Solution 1, Problem 2 → Solution 2 … kept correct while
      // the teacher adds, removes or reorders items.
      if (numberTimer.current) clearTimeout(numberTimer.current);
      numberTimer.current = setTimeout(() => {
        try { applyAutoNumbering(editor); } catch { /* never break typing */ }
      }, 400);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onDocChange(editor.getJSON()), 600);
    },
  });
  /* ─── 3D workspace: open fresh, or re-open a pasted scene for editing ─── */
  const open3DWorkspace = useCallback(() => {
    workspace3dApplyRef.current = null;
    setWorkspace3dScene(null);
    setWorkspace3dOpen(true);
  }, []);

  useEffect(() => onScene3DWorkspaceOpen(({ scene, onApply }) => {
    workspace3dApplyRef.current = onApply;
    setWorkspace3dScene(scene);
    setWorkspace3dOpen(true);
  }), []);

  const handle3DExport = useCallback((scene: Scene3D) => {
    if (workspace3dApplyRef.current) {
      workspace3dApplyRef.current(scene);
      workspace3dApplyRef.current = null;
      return;
    }
    if (!editor) return;
    editor.chain().focus().insertContent({ type: "scene3dDiagram", attrs: { scene } }).run();
  }, [editor]);

  // Sessions push each other down instead of overlapping; diagrams stay free.
  useEffect(() => {
    if (!editor) return;
    return attachSessionLayout(editor);
  }, [editor]);


  const geometryDraftRef = useRef<{ pos: number; pendingIds: string[] } | null>(null);
  const geometryToolRef = useRef<ToolId>(geometryTool);
  useEffect(() => {
    if (geometryToolRef.current !== geometryTool) geometryDraftRef.current = null;
    geometryToolRef.current = geometryTool;
  }, [geometryTool]);

  const selectGeometryAt = useCallback((pos: number) => {
    if (!editor) return;
    setTimeout(() => {
      editor.chain().focus().setNodeSelection(pos).run();
    }, 0);
  }, [editor]);

  const updateGeometrySceneAt = useCallback((pos: number, scene: GeometryScene) => {
    if (!editor) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "geometryDiagram") return;
    const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, scene });
    editor.view.dispatch(tr);
  }, [editor]);

  const locateGeometryNearPos = useCallback((docPos: number): number | null => {
    if (!editor) return null;
    let exact: number | null = null;
    let before: number | null = null;
    let after: number | null = null;
    editor.state.doc.descendants((node, nodePos) => {
      if (node.type.name !== "geometryDiagram") return true;
      if (docPos >= nodePos && docPos <= nodePos + node.nodeSize) {
        exact = nodePos;
        return false;
      }
      if (nodePos < docPos) before = nodePos;
      else if (after == null && nodePos > docPos) after = nodePos;
      return true;
    });
    return exact ?? after ?? before;
  }, [editor]);

  /** A figure the sensor is actually sitting on / immediately touching. Used so
   *  entering 2D reopens THAT diagram and never a distant one. */
  const locateGeometryExactlyAtPos = useCallback((docPos: number): number | null => {
    if (!editor) return null;
    let found: number | null = null;
    editor.state.doc.descendants((node, nodePos) => {
      if (found != null) return false;
      if (node.type.name !== "geometryDiagram") return true;
      if (docPos >= nodePos - 1 && docPos <= nodePos + node.nodeSize + 1) found = nodePos;
      return true;
    });
    return found;
  }, [editor]);

  /** Position of the temporary region opened by the last 2D activation, so
   *  leaving 2D can drop it again when nothing was drawn. */
  const geometryRegionRef = useRef<{ id: string } | null>(null);

  const findGeometryPosById = useCallback((id: string): number | null => {
    if (!editor) return null;
    let pos: number | null = null;
    editor.state.doc.descendants((node, nodePos) => {
      if (pos != null) return false;
      if (node.type.name === "geometryDiagram" && node.attrs?.diagramId === id) pos = nodePos;
      return true;
    });
    return pos;
  }, [editor]);

  /** Leaving 2D: an untouched region is temporary space, not content — remove
   *  it so the lesson note closes back up exactly as it was. */
  const discardEmptyGeometryRegion = useCallback(() => {
    const tracked = geometryRegionRef.current;
    geometryRegionRef.current = null;
    if (!editor || !tracked) return;
    const pos = findGeometryPosById(tracked.id);
    if (pos == null) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "geometryDiagram") return;
    const scene = (sanitizeScene(node.attrs.scene) as GeometryScene | null) ?? EMPTY_SCENE;
    if ((scene.objects?.length ?? 0) > 0) return;
    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
  }, [editor, findGeometryPosById]);

  /** Entering 2D opens a drawing region AT THE SENSOR, every time: reopen the
   *  figure the caret is on, otherwise insert a fresh temporary region there.
   *  The barriers are drawn by that block while 2D mode is on. */
  const ensureGeometryRegion = useCallback(() => {
    if (!editor) return;
    const at = editor.state.selection.to;
    const here = locateGeometryExactlyAtPos(at);
    if (here != null) { selectGeometryAt(here); return; }
    const id = `D-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const chain = editor.chain().focus();
    const $from = editor.state.selection.$from;
    // Caret inside a line: split it so the text before stays above the region
    // and the rest flows below it — the line itself is never moved.
    const midBlock = $from.parent.isTextblock
      && $from.parentOffset > 0
      && $from.parentOffset < $from.parent.content.size;
    if (midBlock) chain.splitBlock();
    chain.insertContent({ type: "geometryDiagram", attrs: { scene: EMPTY_SCENE, diagramId: id } }).run();
    geometryRegionRef.current = { id };
    const pos = findGeometryPosById(id);
    if (pos != null) selectGeometryAt(pos);
  }, [editor, findGeometryPosById, locateGeometryExactlyAtPos, selectGeometryAt]);

  const findGeometryAtDomPoint = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY) as Element | null;
    const wrap = el?.closest?.("[data-geometry-diagram-wrapper]") as HTMLElement | null;
    const raw = wrap?.dataset.geometryPos;
    if (!raw) return null;
    const pos = Number(raw);
    return Number.isFinite(pos) ? pos : null;
  }, []);

  const geometryWrapperForPos = useCallback((pos: number): HTMLElement | null => {
    return document.querySelector(`[data-geometry-pos="${pos}"]`) as HTMLElement | null;
  }, []);

  const insertGeometryAtPoint = useCallback((clientX: number, clientY: number): number | null => {
    if (!editor) return null;
    const view = editor.view;
    const coords = view.posAtCoords({ left: clientX, top: clientY });
    let pos = coords?.pos ?? editor.state.selection.to;
    pos = Math.max(0, Math.min(pos, editor.state.doc.content.size));
    // Open where the teacher clicked; only a figure already there is reused.
    const nearClick = locateGeometryNearPos(pos);
    if (nearClick != null) {
      selectGeometryAt(nearClick);
      return nearClick;
    }
    const beforeSize = editor.state.doc.content.size;
    editor.chain().focus().insertContentAt(pos, {
      type: "geometryDiagram",
      attrs: { scene: EMPTY_SCENE },
    }).run();
    const mappedPos = Math.min(pos, beforeSize);
    return locateGeometryNearPos(mappedPos);
  }, [editor, locateGeometryNearPos, selectGeometryAt]);

  const applyQuickGeometryTool = useCallback((scene: GeometryScene, tool: ToolId, x: number, y: number, pendingIds: string[]) => {
    const sn = snap(scene, x, y);
    const hitId = pickObject(scene, x, y, 10);
    const ensurePointLocal = (base: GeometryScene, px: number, py: number) => {
      const s = snap(base, px, py);
      if (s.pointId) return { id: s.pointId, scene: base };
      const op = addPoint(base, s.x, s.y);
      const id = op.addedIds[0];
      // Disaligned points (default): the construction point stays in the
      // geometry but is never drawn or lettered.
      const next = geometryShowPoints
        ? op.scene
        : {
            ...op.scene,
            objects: op.scene.objects.map((o) =>
              o.id === id && o.type === "point"
                ? { ...o, hidden: true, label: "", auto: true }
                : o,
            ),
          };
      return { id, scene: next };
    };

    if (tool === "point") {
      return { scene: addPoint(scene, sn.x, sn.y).scene, pendingIds: [] };
    }

    if (tool === "line") {
      const made = ensurePointLocal(scene, x, y);
      if (pendingIds.length === 0) return { scene: made.scene, pendingIds: [made.id] };
      const prev = pendingIds[pendingIds.length - 1];
      if (prev === made.id) return { scene: made.scene, pendingIds };
      const op = addSegment(made.scene, prev, made.id);
      return { scene: op.scene, pendingIds: [made.id] };
    }

    if (tool === "polygon") {
      const made = ensurePointLocal(scene, x, y);
      const nextIds = [...pendingIds, made.id];
      if (nextIds.length >= 3) {
        return { scene: closePolygon(made.scene, nextIds).scene, pendingIds: [] };
      }
      return { scene: made.scene, pendingIds: nextIds };
    }

    if (tool === "circle") {
      const made = ensurePointLocal(scene, x, y);
      const nextIds = [...pendingIds, made.id];
      if (nextIds.length >= 3) return { scene: addCircleThrough3(made.scene, nextIds[0], nextIds[1], nextIds[2]).scene, pendingIds: [] };
      return { scene: made.scene, pendingIds: nextIds };
    }

    if (tool === "arc") {
      const made = ensurePointLocal(scene, x, y);
      const nextIds = [...pendingIds, made.id];
      if (nextIds.length >= 3) {
        const a = pointById(made.scene, nextIds[0]);
        const m = pointById(made.scene, nextIds[1]);
        const b = pointById(made.scene, nextIds[2]);
        return { scene: a && m && b ? addArcThrough3(made.scene, a, m, b).scene : made.scene, pendingIds: [] };
      }
      return { scene: made.scene, pendingIds: nextIds };
    }

    if (tool === "compass") {
      const made = ensurePointLocal(scene, x, y);
      if (pendingIds.length === 0) return { scene: made.scene, pendingIds: [made.id] };
      const op = addCircleByRadius(made.scene, pendingIds[0], made.id);
      const circleId = op.addedIds[0];
      return { scene: circleId ? patchObject(op.scene, circleId, { dashed: true } as any).scene : op.scene, pendingIds: [] };
    }

    if (tool === "angle") {
      const made = ensurePointLocal(scene, x, y);
      const nextIds = [...pendingIds, made.id];
      if (nextIds.length >= 3) return { scene: addAngle(made.scene, nextIds[1], nextIds[0], nextIds[2]).scene, pendingIds: [] };
      return { scene: made.scene, pendingIds: nextIds };
    }

    if (tool === "midpoint") {
      if (!hitId) return { scene, pendingIds };
      return { scene: midpointOfSegment(scene, hitId).scene, pendingIds: [] };
    }

    if (tool === "rightAngle") {
      if (!hitId) return { scene, pendingIds };
      const obj = scene.objects.find((o) => o.id === hitId);
      if (obj?.type === "angle") return { scene: patchObject(scene, hitId, { marker: "right" } as any).scene, pendingIds: [] };
      if (obj?.type === "segment") return { scene: patchObject(scene, hitId, { marks: "right" } as any).scene, pendingIds: [] };
      return { scene, pendingIds };
    }

    if (tool === "equalMark" || tool === "parallel" || tool === "perpendicular") {
      if (!hitId) return { scene, pendingIds };
      const nextIds = pendingIds.includes(hitId) ? pendingIds : [...pendingIds, hitId];
      if (nextIds.length < 2) return { scene, pendingIds: nextIds };
      if (tool === "equalMark") return { scene: cycleEqualMarks(scene, nextIds).scene, pendingIds: [] };
      if (tool === "parallel") return { scene: markParallel(scene, nextIds).scene, pendingIds: [] };
      let s = scene;
      for (const id of nextIds) {
        const o = s.objects.find((obj) => obj.id === id);
        if (o?.type === "segment") s = patchObject(s, id, { marks: "right" } as any).scene;
      }
      return { scene: s, pendingIds: [] };
    }

    if (tool === "erase") {
      return { scene: hitId ? eraseObject(scene, hitId).scene : scene, pendingIds: [] };
    }

    return { scene, pendingIds };
  }, [geometryShowPoints]);

  const handleGeometryPaperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const targetEl = eventTargetElement(e.target);
    const isGeometryTarget = Boolean(targetEl?.closest("[data-geometry-diagram-wrapper],[data-geometry-live-canvas]"));
    if (!editor || !geometryMode || e.button !== 0 || (isEditorControlTarget(e.target) && !isGeometryTarget)) return false;
    const tool = geometryToolRef.current;

    const existingGeometry = findGeometryAtDomPoint(e.clientX, e.clientY);
    if (tool === "select") {
      if (existingGeometry != null) {
        selectGeometryAt(existingGeometry);
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
      return false;
    }

    const pageTools: ToolId[] = [
      "point", "line", "midpoint", "polygon", "circle", "arc", "compass", "angle",
      "rightAngle", "equalMark", "parallel", "perpendicular", "erase",
    ];
    if (!pageTools.includes(tool)) return false;

    let pos = existingGeometry;
    const activeDraft = geometryDraftRef.current;
    if (pos == null && activeDraft?.pendingIds.length) pos = activeDraft.pos;
    if (pos == null) pos = insertGeometryAtPoint(e.clientX, e.clientY);
    if (pos == null) return false;

    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "geometryDiagram") return false;
    const wrap = (document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-geometry-diagram-wrapper]") as HTMLElement | null)
      ?? geometryWrapperForPos(pos);
    const rect = wrap?.getBoundingClientRect();
    const scene = (sanitizeScene(node.attrs.scene) as GeometryScene) ?? EMPTY_SCENE;
    const W = scene.bounds.width + 48;
    const H = scene.bounds.height + 48;
    const localX = rect ? Math.max(0, Math.min(scene.bounds.width, ((e.clientX - rect.left) / rect.width) * W - 24)) : scene.bounds.width / 2;
    const localY = rect ? Math.max(0, Math.min(scene.bounds.height, ((e.clientY - rect.top) / rect.height) * H - 24)) : scene.bounds.height / 2;
    const draft = geometryDraftRef.current?.pos === pos ? geometryDraftRef.current : { pos, pendingIds: [] };
    const next = applyQuickGeometryTool(scene, tool, localX, localY, draft.pendingIds);
    updateGeometrySceneAt(pos, next.scene);
    geometryDraftRef.current = next.pendingIds.length ? { pos, pendingIds: next.pendingIds } : null;
    selectGeometryAt(pos);
    e.preventDefault();
    e.stopPropagation();
    return true;
  }, [editor, findGeometryAtDomPoint, geometryMode, geometryWrapperForPos, insertGeometryAtPoint, selectGeometryAt, updateGeometrySceneAt, applyQuickGeometryTool]);

  /** Replay a paper click on a diagram's live drawing canvas as soon as it
   *  mounts, so the very first click with a tool is never lost. */
  const replayClickOnLiveCanvas = useCallback((pos: number, clientX: number, clientY: number) => {
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      const wrap = geometryWrapperForPos(pos);
      const svg = wrap?.querySelector<SVGSVGElement>('[data-geometry-live-canvas="true"] > svg')
        ?? document.querySelector<SVGSVGElement>('[data-geometry-live-canvas="true"] > svg');
      if (!svg) {
        if (tries++ < 30) raf = window.requestAnimationFrame(attempt);
        return;
      }
      const r = svg.getBoundingClientRect();
      const inside =
        clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      const x = inside ? clientX : r.left + r.width / 2;
      const y = inside ? clientY : r.top + r.height / 2;
      const opts = {
        clientX: x, clientY: y, bubbles: true, cancelable: true,
        pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1,
      };
      svg.dispatchEvent(new PointerEvent("pointerdown", opts));
      svg.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }));
    };
    raf = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(raf);
  }, [geometryWrapperForPos]);

  /** A drawing / annotation tool is active and the teacher clicked the paper
   *  (not an existing live canvas). Construction tools draw straight away;
   *  annotation tools need the live canvas, so the diagram block is created
   *  in flow at that point and the click is replayed onto it. */
  const handleGeometryDrawStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || !geometryMode || e.button !== 0) return false;
    const tool = geometryToolRef.current;
    if (tool === "select") return false;

    const pageTools: ToolId[] = [
      "point", "line", "midpoint", "polygon", "circle", "arc", "compass", "angle",
      "rightAngle", "equalMark", "parallel", "perpendicular", "erase",
    ];
    if (pageTools.includes(tool)) return handleGeometryPaperClick(e);

    // Curve + annotation tools (Add Text / Distance / Angle / Area).
    let pos = findGeometryAtDomPoint(e.clientX, e.clientY);
    const activeDraft = geometryDraftRef.current;
    if (pos == null && activeDraft?.pendingIds.length) pos = activeDraft.pos;
    if (pos == null) pos = insertGeometryAtPoint(e.clientX, e.clientY);
    if (pos == null) return false;
    selectGeometryAt(pos);
    replayClickOnLiveCanvas(pos, e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
    return true;
  }, [editor, geometryMode, handleGeometryPaperClick, findGeometryAtDomPoint, insertGeometryAtPoint, selectGeometryAt, replayClickOnLiveCanvas]);



  // Push external doc updates only when editor isn't focused.
  useEffect(() => {
    if (!editor || !documentJson) return;
    if (editor.isDestroyed || !(editor as any).view?.dom) return;
    if (editor.isFocused) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(normalizedDoc);
    if (current !== next) editor.commands.setContent(normalizedDoc, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentJson]);

  // Self-healing pass on whatever is actually in the editor: any line still
  // fragmented into several math atoms is re-grouped into ONE full-line
  // object. Runs whenever the loaded document changes (including when the
  // editor received its content while focused), never while typing.
  useEffect(() => {
    if (!editor) return;
    const t = window.setTimeout(() => {
      if (!editor || editor.isDestroyed || !(editor as any).view?.dom) return;
      if (editor.isFocused) return;
      const repaired = repairDocumentMath(editor.getJSON());
      // Any solution that drifted away from its question is put back with it,
      // and a solution whose question was deleted goes with it.
      const paired = reconcileSolutionOwnership(repaired.doc);
      const linked = enforceQuestionSolutionPairs(paired.doc);
      if (repaired.changed || paired.changed || linked.changed) {
        editor.commands.setContent(linked.doc, { emitUpdate: true });
      }


    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentJson]);


  const insertMath = () => {
    editor?.chain().focus().insertContent({ type: "mathInline", attrs: { value: "" } }).run();
  };

  // Emoji Library dock panel (teacher-managed content).
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  // Matrix quick-access dock panel — shares the width, never overlays the note.
  const [matrixPanelOpen, setMatrixPanelOpen] = useState(false);
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);
  const [slidePanelOpen, setSlidePanelOpen] = useState(false);


  // Conversion tool.
  const [conversionOpen, setConversionOpen] = useState(false);

  const insertSymbolText = (s: string) => {
    editor?.chain().focus().insertContent(s).run();
  };
  const insertEmojiMedia = (src: string, kind: "image" | "video") => {
    editor?.chain().focus().insertContent({ type: "emojiMedia", attrs: { src, kind } }).run();
  };

  /** Toolbar → the SAME Smart Table the Asset Library inserts (never a new
   *  table system, and never the Maths Table reference picker). */
  const insertSmartTable = () => {
    if (!editor) return;
    const def = TABLES.find((a) => a.id === "smarttable");
    if (!def) return;
    insertAsset(editor, def);
  };

  /** Quick Symbols palette → a real editable structure at the caret. */
  const insertQuickSymbol = (item: QuickStructItem) => {
    if (!editor) return;
    if (item.prefix) editor.chain().focus().insertContent(item.prefix).run();
    insertAsset(editor, {
      id: `symbol-quick-${item.structure}`,
      label: item.label,
      category: "Structures",
      keywords: ["symbol", item.structure],
      render: { kind: "structure", structure: item.structure, slots: 1, attrs: item.attrs ?? {} },
    });
  };

  /** Quick Matrix palette → a REAL matrix structure (same object the full
   *  Matrix builder creates), never a raw code string. */
  const insertQuickMatrix = (spec: QuickMatrixSpec) => {
    if (!editor) return;
    const attrs: Record<string, unknown> = { rows: spec.rows, cols: spec.cols, br: spec.br };
    if (spec.fns.length) attrs.fns = spec.fns;
    insertAsset(editor, {
      id: `matrix-quick-${spec.rows}x${spec.cols}`,
      label: `${spec.rows}×${spec.cols} matrix`,
      category: "Structures",
      keywords: ["matrix"],
      render: { kind: "structure", structure: "matrix", slots: spec.rows * spec.cols, attrs },
    });
    if (spec.template) {
      const t = spec.template;
      window.setTimeout(() => {
        void import("@/lib/lessonnotes/matrixOps").then(({ applyTemplate }) => {
          applyTemplate(editor, t);
        });
      }, 0);
    }
  };


  /** ── THE MASTER SENSOR ───────────────────────────────────────────────────
   *  One sensor, one cursor, two capabilities. The sensor IS the real editor
   *  caret, so typing, Backspace, selection and arrow movement always behave
   *  like a proper text editor. Its freedom comes from free frames: parking it
   *  in open space creates a real, absolutely-positioned frame at that exact
   *  paper coordinate and drops the caret inside it — above a diagram, beside
   *  a diagram, in the extended area, anywhere. */
  const lastCaretRef = useRef<number | null>(null);
  const [sensorPos, setSensorPos] = useState<number | null>(null);
  const [editorFocused, setEditorFocused] = useState(false);
  /** ONE POINTER RULE: while the teacher is typing inside an object's own
   *  editor (a Smart Table cell, an inline math canvas), that editor owns the
   *  caret — the Master Sensor marker steps aside so there is never a second
   *  blinking pointer on the page. */
  const [objectEditorFocused, setObjectEditorFocused] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.activeElement as HTMLElement | null;
      setObjectEditorFocused(
        !!el?.closest?.(".smart-table-cell-editor, .math-inline-node, [data-object-editor]"),
      );
    };
    const onOut = () => window.setTimeout(check, 0);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  /** Document position of the empty free frame the sensor just created. It is
   *  removed again if the caret leaves it before anything is typed, so parking
   *  the sensor around never leaves stray blocks behind. */
  const pendingFrameRef = useRef<number | null>(null);

  const rememberSensor = useCallback((pos: number | null) => {
    lastCaretRef.current = pos;
    setSensorPos(pos);
  }, []);

  /** Remove the pending free frame when it is still empty and no longer holds
   *  the caret. */
  const dropEmptyPendingFrame = useCallback((force = false) => {
    if (!editor) return;
    const pos = pendingFrameRef.current;
    if (pos == null) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "canvasFrame") { pendingFrameRef.current = null; return; }
    const caret = editor.state.selection.to;
    const inside = caret > pos && caret < pos + node.nodeSize;
    if (inside && !force) return;
    pendingFrameRef.current = null;
    if (node.textContent.trim().length === 0) {
      editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const remember = () => {
      rememberSensor(editor.state.selection.to);
      window.setTimeout(() => dropEmptyPendingFrame(), 0);
    };
    const onFocus = () => { setEditorFocused(true); rememberSensor(editor.state.selection.to); };
    const onBlur = () => setEditorFocused(false);
    editor.on("selectionUpdate", remember);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("selectionUpdate", remember);
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
  }, [editor, rememberSensor, dropEmptyPendingFrame]);

  // Escape abandons an untouched free frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dropEmptyPendingFrame(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dropEmptyPendingFrame]);

  /** Insertion point: immediately after the block the sensor sits in — inside
   *  a free frame when the sensor is parked in one, otherwise at the top level
   *  of the note. Diagrams never move, and nothing jumps to the top. */
  const sectionInsertPosition = () => {
    if (!editor) return 0;
    const { doc, selection } = editor.state;
    const caret = lastCaretRef.current ?? selection.to;
    const anchor = Math.max(0, Math.min(caret, doc.content.size));
    const $pos = doc.resolve(anchor);
    if ($pos.depth === 0) return anchor;
    let depth = 1;
    for (let d = 1; d <= $pos.depth; d++) {
      if ($pos.node(d).type.name === "canvasFrame") depth = d + 1;
    }
    depth = Math.min(depth, $pos.depth);
    return Math.min($pos.after(depth), doc.content.size);
  };

  /** Insert a flowing block at the document position nearest a paper point.
   * Ordinary text is never absolutely positioned; it reserves real height and
   * pushes everything below it down. Diagrams keep their separate overlay. */
  const createFreeFrame = (
    x: number,
    y: number,
    nodes?: Record<string, unknown>[],
  ): number => {
    if (!editor) return 0;
    dropEmptyPendingFrame(true);
    const host = editor.view.dom as HTMLElement;
    const blocks = Array.from(host.children) as HTMLElement[];
    let index = blocks.findIndex((block) => block.offsetTop + block.offsetHeight / 2 > y);
    if (index < 0) index = blocks.length;
    let at = 0;
    editor.state.doc.forEach((node, offset, childIndex) => {
      if (childIndex === index) at = offset;
      else if (index === blocks.length) at = editor.state.doc.content.size;
    });
    const content = nodes && nodes.length ? nodes : [{ type: "paragraph" }];
    editor.chain().focus()
      .insertContentAt(at, content)
      .run();
    pendingFrameRef.current = null;
    const inner = Math.min(at + 1, editor.state.doc.content.size);
    editor.chain().focus().setTextSelection(inner).run();
    rememberSensor(editor.state.selection.to);
    return at;
  };

  /** Insert blocks AT THE SENSOR — the caret is the single source of truth, so
   *  content lands in the flow or inside the free frame the sensor sits in. */
  const insertAtSensor = (nodes: Record<string, unknown>[]): number => {
    if (!editor) return 0;
    const at = sectionInsertPosition();
    editor.chain().focus().insertContentAt(at, nodes).run();
    pendingFrameRef.current = null;
    return at;
  };


  /** Park the sensor inside the paragraph that follows a freshly inserted
   *  heading, so the next insertion continues downward. */
  const moveSensorAfterInsert = (insertAt: number, headingText: string) => {
    if (!editor) return;
    const pos = Math.min(insertAt + headingText.length + 3, editor.state.doc.content.size);
    editor.chain().focus().setTextSelection(pos).run();
    rememberSensor(pos);
  };



  const insertSection = (kind: SectionKind) => {
    if (!editor) return;
    // Question-style sections come with an empty Solution space by default so
    // the teacher can type both the problem and the solution manually. The
    // question id is minted HERE so the pair is linked from birth.
    const withSolutionArea = isQuestionSectionKind(kind) && kind !== "game_questions";
    const qid = withSolutionArea ? newQuestionId() : null;
    const trailing = qid ? solutionPlaceholderNodes(qid) : [];
    const insertAt = insertAtSensor([
      {
        type: "heading",
        attrs: { level: 2, ...(qid ? { sectionId: qid } : {}) },
        content: [{ type: "text", text: SECTION_LABELS[kind] }],
      },
      { type: "paragraph" },
      ...trailing,
    ]);

    moveSensorAfterInsert(insertAt, SECTION_LABELS[kind]);
  };


  /** Inline composers for the two structural controls under the section list. */
  const [sessionDraft, setSessionDraft] = useState<{ title: string; withSolution: boolean } | null>(null);
  const [subtopicDraft, setSubtopicDraft] = useState<string | null>(null);


  /** "+ Add Session" — a teacher-named section, optionally with a Solution
   *  area. Committed with Enter: the session is appended underneath the last
   *  existing content, the composer closes, and the AI generates the content
   *  using the typed title as its instruction. */
  const insertCustomSession = async (title: string, withSolution: boolean) => {
    if (!editor) return;
    const name = title.trim();
    if (!name) return;
    // At the sensor: in the flow, or in a free canvas frame when the sensor is
    // parked in open space.
    const sessionQid = withSolution ? newQuestionId() : null;
    const insertAt = insertAtSensor([
      {
        type: "heading",
        attrs: { level: 2, ...(sessionQid ? { sectionId: sessionQid } : {}) },
        content: [{ type: "text", text: name }],
      },
      { type: "paragraph" },
      ...(sessionQid ? solutionPlaceholderNodes(sessionQid) : []),
    ]);

    moveSensorAfterInsert(insertAt, name);



    // Locate the heading we just inserted and generate its content.
    let headingPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === "heading" &&
        (node.attrs.level ?? 6) === 2 &&
        node.textContent.trim() === name &&
        pos >= insertAt - 2
      ) headingPos = pos;
      return true;
    });
    if (headingPos == null) return;
    try {
      await handleSectionAi("", {
        kind: "custom_session",
        headingPos,
        sectionEndPos: editor.state.doc.content.size,
        headingText: name,
        sectionText: "",
        action: "generate",
        images: [],
      });
    } catch { /* handleSectionAi surfaces its own error toast */ }
  };

  /** Enter = commit: close the insertion controls, then insert + generate. */
  const commitSessionDraft = () => {
    const draft = sessionDraft;
    if (!draft || !draft.title.trim()) return;
    setSessionDraft(null);
    void insertCustomSession(draft.title, draft.withSolution);
  };




  /** "+ Add Subtopic" — structural heading. Everything added under it belongs
   *  to that subtopic, and the AI generates for it only. */
  /** Find an existing subtopic heading with this title. */
  const findSubtopicHeading = (name: string): { pos: number; title: string } | null => {
    if (!editor) return null;
    let hit: { pos: number; title: string } | null = null;
    editor.state.doc.descendants((n, p) => {
      if (hit) return false;
      if (n.type.name === "heading") {
        const role = headingRole(n.textContent, n.attrs?.level ?? 6);
        if (role?.role === "subtopic" && sameSubtopic(role.title, name)) hit = { pos: p, title: role.title };
      }
      return true;
    });
    return hit;
  };

  /** Confirm a subtopic. This is a CONTEXT SWITCH: the subtopic becomes the
   *  active AI context, the main topic is untouched, and earlier subtopics stay
   *  on the page. An existing subtopic is re-activated instead of duplicated. */
  const insertSubtopic = (title: string) => {
    if (!editor) return;
    const name = title.trim();
    if (!name) return;

    const existing = findSubtopicHeading(name);
    if (existing) {
      aiCtx.setActiveSubtopic(existing.title, existing.pos);
      moveSensorAfterInsert(existing.pos, existing.title);
      toast({ title: `Switched to "${existing.title}"`, description: "This subtopic already exists — it is now the active context." });
      return;
    }

    const insertAt = insertAtSensor([
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: name }] },
      { type: "paragraph" },
    ]);
    aiCtx.setActiveSubtopic(name, insertAt);
    moveSensorAfterInsert(insertAt, name);
    toast({ title: `Subtopic: ${name}`, description: "All new AI content will be generated for this subtopic." });
  };

  /** Switch back to a subtopic already present in the note. */
  const activateSubtopic = (name: string) => {
    const existing = findSubtopicHeading(name);
    aiCtx.setActiveSubtopic(name, existing?.pos ?? null);
    if (existing) moveSensorAfterInsert(existing.pos, existing.title);
  };





  /** Bridge so the floating Geometry Editor panel can list and insert into
   *  sections of this document. The panel dispatches window events; we reply
   *  via callbacks in the event detail. */
  useEffect(() => {
    if (!editor) return;
    const listSections = (e: Event) => {
      const detail = (e as CustomEvent<{ reply: (s: { id: string; title: string }[]) => void }>).detail;
      if (!detail?.reply) return;
      const out: { id: string; title: string }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading" && (node.attrs.level ?? 6) <= 2) {
          out.push({ id: String(pos), title: node.textContent || "(untitled)" });
        }
        return true;
      });
      detail.reply(out);
    };
    const insertInto = (e: Event) => {
      const detail = (e as CustomEvent<{ sectionId: string; scene: unknown }>).detail;
      if (!detail) return;
      const headingPos = Number(detail.sectionId);
      if (!Number.isFinite(headingPos)) return;
      const doc = editor.state.doc;
      const heading = doc.nodeAt(headingPos);
      if (!heading || heading.type.name !== "heading") return;
      // The Geometry panel may be opened while the cursor is under Solution.
      // Resolve that request back to its owning question; a Solution is never
      // an insertion target for an independent scene.
      const targetHeadingPos = isSolutionLabel(heading.textContent)
        ? ownerQuestionHeadingFor(doc, headingPos)?.pos
        : headingPos;
      if (targetHeadingPos == null) return;
      const targetHeading = doc.nodeAt(targetHeadingPos);
      if (!targetHeading || targetHeading.type.name !== "heading") return;
      const existing = diagramsOwnedByQuestion(doc, targetHeadingPos, isSolutionLabel)[0];
      if (existing) {
        editor.chain().focus().setNodeSelection(existing.pos).run();
        return;
      }
      const headingLevel = targetHeading.attrs.level ?? 2;
      // End of this section = position of next heading at same or higher level,
      // else end of doc.
      let endPos = doc.content.size;
      doc.descendants((node, pos) => {
        if (pos <= targetHeadingPos) return true;
        if (node.type.name === "heading" && (node.attrs.level ?? 6) <= headingLevel) {
          endPos = pos;
          return false;
        }
        return true;
      });
      editor.chain().focus().insertContentAt(endPos, {
        type: "geometryDiagram",
        attrs: {
          scene: detail.scene,
          diagramId: newDiagramId(),
          ownerQuestionId: ensureOwnerQuestionId(editor, targetHeadingPos + 1),
        },
      }).run();
    };
    window.addEventListener("geometry-editor:list-sections", listSections);
    window.addEventListener("geometry-editor:insert-into-section", insertInto);
    return () => {
      window.removeEventListener("geometry-editor:list-sections", listSections);
      window.removeEventListener("geometry-editor:insert-into-section", insertInto);
    };
  }, [editor]);

  /** Global AI: insert at cursor (single block) OR draft whole lesson. */
  const handleGlobalAi = async (
    prompt: string,
    mode: "cursor" | "whole",
    images: string[],
  ) => {
    if (!editor) return;

    // If teacher attached photos, run the existing scan mode and fold the
    // extracted problems into the teacher prompt.
    let scanned = "";
    if (images.length) {
      toast({ title: "Reading attached image(s)…" });
      const items = await scanImages(images);
      if (items.length) {
        scanned = `Use these problems extracted from attached image(s):\n` +
          items.map((s, i) => `${i + 1}. ${s}`).join("\n");
      }
    }
    const base = [prompt, scanned].filter(Boolean).join("\n\n");

    if (mode === "cursor") {
      // Detect nearest heading for the section context (legacy behaviour).
      const { from } = editor.state.selection;
      let kind: SectionKind = "explanation";
      editor.state.doc.nodesBetween(0, from, (n) => {
        if (n.type.name === "heading" && (n.attrs.level === 1 || n.attrs.level === 2)) {
          const k = detectSectionKind(n.textContent);
          if (k) kind = k;
        }
      });
      const content = (await aiGenerate({
        kind,
        teacherPrompt: base || "Write helpful content here.",
        ctx: contextAt(from),

        lessonContext: collectLessonContext(from, kind),
      })).trim();
      if (!content) { toast({ title: "No content returned" }); return; }
      const nodes = aiTextToNodes(content);
      const insertFrom = editor.state.selection.from;
      editor.chain().focus().insertContent(nodes).run();
      await persistAndOfferFloating(kind, content, {
        from: insertFrom,
        to: editor.state.doc.content.size,
      });
      return;
    }

    // Whole-lesson mode: loop the existing `generate` call per section.
    const docEnd = editor.state.doc.content.size;
    let cursor = docEnd;
    toast({ title: "Drafting whole lesson…", description: "Generating each section in turn." });
    for (const kind of WHOLE_LESSON_ORDER) {
      try {
        const content = (await aiGenerate({
          kind,
          teacherPrompt: base
            ? `${base}\n\nFocus this block on the ${SECTION_LABELS[kind]} section.`
            : `Generate the ${SECTION_LABELS[kind]} for this lesson.`,
          ctx: contextAt(cursor),
          lessonContext: collectLessonContext(cursor, kind),
        })).trim();
        if (!content) continue;
        const headingNode = {
          type: "heading", attrs: { level: 2 },
          content: [{ type: "text", text: SECTION_LABELS[kind] }],
        };
        const body = aiTextToNodes(content);
        const nodes = [headingNode, ...body];
        const insertFrom = cursor;
        editor.chain().focus().insertContentAt(cursor, nodes).run();
        cursor = editor.state.doc.content.size;
        await persistAndOfferFloating(kind, content, { from: insertFrom, to: cursor });
      } catch (e: any) {
        toast({ title: `Failed: ${SECTION_LABELS[kind]}`, description: String(e?.message ?? e), variant: "destructive" });
      }
    }
    toast({ title: "Lesson drafted", description: "Edit, rewrite or delete anything you like." });
  };

  // ── MyGPL Co-Pilot bridge ──────────────────────────────────────────────
  // The Co-Pilot never re-implements lesson-note behaviour: every action here
  // is a thin wrapper over the handler the editor already uses.
  const copilotEntries = (): { ref: string; headingPos: number; node: any; entry: CoPilotEntry }[] => {
    if (!editorAlive(editor)) return [];
    const doc = editor.state.doc;
    const { from } = editor.state.selection;
    const heads: { pos: number; node: any }[] = [];
    doc.descendants((n, p) => {
      if (n.type.name === "heading" && (n.attrs?.level ?? 6) <= 2 && detectSectionKind(n.textContent)) {
        heads.push({ pos: p, node: n });
      }
      return true;
    });
    return heads.map((h, i) => {
      const end = sectionEndWithin(doc, h.pos);
      const bodyStart = h.pos + h.node.nodeSize;
      let solPos: number | null = null;
      doc.nodesBetween(bodyStart, Math.min(end, doc.content.size), (n, p) => {
        if (solPos != null) return false;
        if (n.type.name === "heading" && isSolutionLabel(n.textContent)) solPos = p;
        return true;
      });
      const safe = (a: number, b: number) => {
        if (b <= a) return "";
        try { return serializeRangeAsMath(a, b).trim(); } catch { return ""; }
      };
      const questionText = safe(bodyStart, solPos ?? end);
      const solutionText = solPos == null ? "" : safe(solPos, end);
      const diagrams = diagramsOwnedByQuestion(doc, h.pos, isSolutionLabel);
      return {
        ref: `s${i + 1}`,
        headingPos: h.pos,
        node: h.node,
        entry: {
          ref: `s${i + 1}`,
          heading: h.node.textContent.trim(),
          kind: detectSectionKind(h.node.textContent) ?? null,
          pos: h.pos,
          questionText: questionText.slice(0, 900),
          solutionText: solutionText.slice(0, 900),
          hasDiagram: diagrams.length > 0,
          diagramSummary: diagrams.length ? `${diagrams.length} linked diagram(s)` : "",
          focused: from >= h.pos && from <= end,
        },
      };
    });
  };

  const copilotResolve = (ref: string) => {
    const all = copilotEntries();
    const hit = all.find((e) => e.ref === ref)
      ?? all.find((e) => e.entry.heading.toLowerCase() === ref.trim().toLowerCase())
      ?? all.find((e) => e.entry.focused);
    if (!hit) throw new Error("I could not find that section in the note any more.");
    return hit;
  };

  /**
   * The Solution heading that belongs to this question section. A solution is
   * ALWAYS written under it — never appended into the question block, which is
   * what used to restate the question a second time and leave Solution empty.
   */
  const copilotSolutionHeading = (
    questionHeadingPos: number,
  ): { pos: number; text: string } | null => {
    if (!editorAlive(editor)) return null;
    const doc = editor.state.doc;
    const end = Math.min(sectionEndWithin(doc, questionHeadingPos), doc.content.size);
    const hits: Array<{ pos: number; text: string }> = [];
    doc.nodesBetween(questionHeadingPos, end, (n, p) => {
      if (hits.length) return false;
      if (p <= questionHeadingPos) return true;
      if (n.type.name === "heading" && isSolutionLabel(n.textContent)) {
        hits.push({ pos: p, text: n.textContent });
        return false;
      }
      return true;
    });
    return hits[0] ?? null;
  };


  const copilotSectionAi = async (
    ref: string,
    instruction: string,
    action: SectionAction,
    signal?: AbortSignal,
    presetContent?: string,
  ) => {
    if (!editorAlive(editor)) throw new Error("The lesson note is not ready.");
    const hit = copilotResolve(ref);
    const doc = editor.state.doc;
    const end = sectionEndWithin(doc, hit.headingPos);
    const bodyStart = hit.headingPos + hit.node.nodeSize;
    let sectionText = "";
    try { sectionText = serializeRangeAsMath(bodyStart, Math.max(bodyStart, end)); } catch { sectionText = ""; }
    await handleSectionAi(instruction, {
      kind: (hit.entry.kind as SectionKind) ?? "example",
      headingPos: hit.headingPos,
      sectionEndPos: end,
      headingText: hit.entry.heading,
      sectionText,
      action,
      images: [],
      signal,
      presetContent,
      // The Co-Pilot runs unattended — a silent toast would let it report an
      // item as built when the block was left empty.
      throwOnFailure: true,
    });
  };

  /** Write the worked solution UNDER this question's own Solution heading. */
  const copilotSolutionAi = async (ref: string, instruction: string, signal?: AbortSignal) => {
    if (!editorAlive(editor)) throw new Error("The lesson note is not ready.");
    const hit = copilotResolve(ref);
    let sol = copilotSolutionHeading(hit.headingPos);
    if (!sol) {
      // The question kept its own Solution area in every normal flow; if it is
      // missing, create it here rather than appending the working into the
      // question block (which is what used to restate the question twice).
      const at = Math.min(
        sectionEndWithin(editor.state.doc, hit.headingPos),
        editor.state.doc.content.size,
      );
      editor.chain().focus().insertContentAt(
        at,
        solutionPlaceholderNodes(ensureOwnerQuestionId(editor, hit.headingPos)),
      ).run();

      sol = copilotSolutionHeading(hit.headingPos);
      if (!sol) throw new Error("That section has no Solution area to write into.");
    }
    const doc = editor.state.doc;
    const end = sectionEndWithin(doc, sol.pos);
    const bodyStart = sol.pos + (doc.nodeAt(sol.pos)?.nodeSize ?? 0);
    let sectionText = "";
    try { sectionText = serializeRangeAsMath(bodyStart, Math.max(bodyStart, end)); } catch { sectionText = ""; }
    await handleSectionAi(instruction, {
      kind: "solution" as SectionKind,
      headingPos: sol.pos,
      sectionEndPos: end,
      headingText: sol.text,
      sectionText,
      action: "generate",
      images: [],
      signal,
      throwOnFailure: true,
    });
  };

  /**
   * THE PROMISED FIGURE. When a question's mathematics only makes sense with a
   * figure, the figure is CONSTRUCTED by the Math Engine, solved into exact
   * coordinates and verified before it is placed — never painted, never faked.
   * It lands at the end of the question body, above the Solution heading, and
   * is owned by that question forever. Returns false when no figure is needed.
   */
  const copilotEnsureDiagram = async (
    ref: string,
    instruction?: string,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    if (!editorAlive(editor)) throw new Error("The lesson note is not ready.");
    const hit = copilotResolve(ref);
    const questionText = hit.entry.questionText.trim();
    const { figureNeeded } = await import("@/lib/lessonnotes/figureNeed");
    if (!figureNeeded(questionText, Boolean(instruction && /diagram|figure/i.test(instruction)))) {
      return false;
    }
    // One question owns one diagram: an existing figure is reused, never doubled.
    if (hit.entry.hasDiagram) return true;

    const ctx = contextAt(hit.headingPos);
    const { generateGeometry } = await import("@/lib/mathengine/client");
    const res = await generateGeometry({
      question: questionText,
      instruction: [
        "Construct the figure this question refers to, exactly as the question describes it.",
        "Every point, line, angle and mark the question names must be present and lettered.",
        instruction ?? "",
      ].filter(Boolean).join(" "),
      topic: ctx?.topic ?? "",
      subtopic: ctx?.subtopic ?? "",
      sectionKind: "geometry",
      signal,
    });
    if (!res.scene) throw new Error("The figure for this question could not be constructed and verified.");

    if (!editorAlive(editor)) throw new Error("The lesson note is not ready.");
    const fresh = copilotResolve(ref);
    const sol = copilotSolutionHeading(fresh.headingPos);
    const at = Math.min(
      sol ? sol.pos : sectionEndWithin(editor.state.doc, fresh.headingPos),
      editor.state.doc.content.size,
    );
    editor.chain().focus().insertContentAt(at, {
      type: "geometryDiagram",
      attrs: {
        scene: res.scene,
        topic: ctx?.subtopic ?? ctx?.topic ?? null,
        diagramId: newDiagramId(),
        ownerQuestionId: ensureOwnerQuestionId(editor, fresh.headingPos),
      },
    }).run();
    return true;
  };



  useEffect(() => {
    const ref = copilotBridgeRef;
    if (!ref) return;
    ref.current = {
      snapshot: () => {
        if (!editorAlive(editor)) return null;
        const ctx = activeContext();
        const rows = copilotEntries();
        const focused = rows.find((r) => r.entry.focused)?.ref ?? rows[rows.length - 1]?.ref ?? null;
        // Whatever the teacher highlighted is what "this" means to the Copilot.
        const sel = editor.state.selection;
        const selectionText = sel.empty
          ? ""
          : editor.state.doc.textBetween(sel.from, sel.to, "\n", "\n").trim();
        return {
          subject: ctx?.subject ?? "Mathematics",
          topic: ctx?.topic ?? "",
          activeSubtopic: ctx?.subtopic ?? "",
          sessionTitle: rows.find((r) => r.ref === focused)?.entry.heading ?? "",
          entries: rows.map((r) => r.entry),
          focusedRef: focused,
          hasAnyContent: rows.some((r) => r.entry.questionText || r.entry.solutionText),
          selectionText: selectionText.slice(0, 900),
        };
      },
      insertSection: async (kind: string) => {
        insertSection((SECTION_LABELS as any)[kind] ? (kind as SectionKind) : "example");
      },
      /** Insert a section and hand back the reference the Copilot can target. */
      insertSectionRef: async (kind: string) => {
        const safeKind = (SECTION_LABELS as any)[kind] ? (kind as SectionKind) : "example";
        insertSection(safeKind);
        await new Promise((r) => setTimeout(r, 60));
        if (!editorAlive(editor)) return null;
        const rows = copilotEntries();
        const ofKind = rows.filter((r) => r.entry.kind === safeKind);
        const pick = ofKind.length ? ofKind[ofKind.length - 1] : rows[rows.length - 1];
        return pick?.ref ?? null;
      },
      insertSubtopic: async (title: string) => {
        insertSubtopic(title);
      },

      generateQuestion: async (ref2, instruction, replace, signal) =>
        copilotSectionAi(ref2, instruction || "Generate this section.", replace ? "regenerate" : "generate", signal),
      /** Commit an already-approved question verbatim — no AI, no rewording. */
      writeQuestion: async (ref2, text, signal) =>
        copilotSectionAi(ref2, "Commit the approved question.", "regenerate", signal, text),
      generateSolution: async (ref2, instruction, signal) =>
        copilotSolutionAi(
          ref2,
          [instruction, "Write the full step-by-step solution for this question."].filter(Boolean).join(" "),
          signal,
        ),
      buildGeometryMap: async (ref2) => {
        if (!editorAlive(editor)) throw new Error("The lesson note is not ready.");
        const hit = copilotResolve(ref2);
        const doc = editor.state.doc;
        const end = sectionEndWithin(doc, hit.headingPos);
        offerGeometryMap({ from: hit.headingPos + hit.node.nodeSize, to: end });
      },
      ensureDiagram: async (ref2, instruction, signal) => copilotEnsureDiagram(ref2, instruction, signal),

      openGeometry2D: async (ref2) => {
        if (ref2 && editorAlive(editor)) {
          try {
            const hit = copilotResolve(ref2);
            editor!.chain().focus().setTextSelection(hit.headingPos + hit.node.nodeSize).run();
          } catch { /* fall through to just opening the tools */ }
        }
        setDiagramTabsOpen(true);
      },
      openSmartTable: async () => insertSmartTable(),
      openSlideCanvas: async () => setSlidePanelOpen(true),
      openAssetLibrary: async () => setAssetLibOpen(true),
      editBlock: async (ref2, instruction) =>
        copilotSectionAi(ref2, instruction || "Improve this section.", "regenerate"),
    };
    return () => { if (ref.current) ref.current = null; };
  });

  const handleExportDocx = async () => {
    if (!editor) return;
    try {
      await exportDocx(editor.getJSON(), exportFileName || "lesson-notes");
    } catch (e: any) {
      toast({ title: "DOCX export failed", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const paperOptions: PaperStyle[] = ["plain", "ruled", "math", "grid", "dotted"];

  // ── AI Edit (selection toolbar → AI panel) ─────────────────────────────
  const [aiEditTarget, setAiEditTarget] = useState<AiEditTarget | null>(null);
  const aiEditRangeRef = useRef<{ from: number; to: number; json: unknown } | null>(null);
  const [aiEditOpen, setAiEditOpen] = useState(false);

  /** Custom apply target, set when AI Edit was requested by an asset. */
  const aiEditBridgeApplyRef = useRef<((proposed: string) => void) | null>(null);

  const openAiEdit = (snap: SelectionSnapshot) => {
    aiEditBridgeApplyRef.current = null;
    aiEditRangeRef.current = { from: snap.from, to: snap.to, json: snap.json };
    setAiEditTarget({ text: snap.text, kind: snap.kind, json: snap.json });
    setAiEditOpen(true);
  };

  /** Asset-driven AI Edit (Smart Table cells, …) — same panel, own apply. */
  const requestAiEdit = useCallback((req: AiEditRequest) => {
    aiEditRangeRef.current = null;
    aiEditBridgeApplyRef.current = req.onApply;
    setAiEditTarget({
      text: req.text,
      kind: req.kind ?? detectSelectionKindFromText(req.text),
    });
    setAiEditOpen(true);
  }, []);

  const closeAiEdit = () => {
    setAiEditOpen(false);
    setAiEditTarget(null);
    aiEditRangeRef.current = null;
    aiEditBridgeApplyRef.current = null;
  };

  const runAiEdit = async (instruction: string, target: AiEditTarget): Promise<string> => {
    const selectionText = (target.text ?? "").trim();
    if (!selectionText) {
      toast({ title: "Nothing selected", description: "Highlight some text or a math object first.", variant: "destructive" });
      throw new Error("empty selection");
    }
    const { data, error } = await withTimeout(supabase.functions.invoke("notebook-ai", {
      body: {
        mode: "edit",
        kind: target.kind,
        instruction,
        selectionText,
        selectionJson: target.json ?? null,
        subject: activeContext()?.subject ?? "Mathematics",
        topic: activeContext()?.topic ?? "",
        subtopic: activeContext()?.subtopic ?? "",
        workspaceManifest: buildWorkspaceManifest(),

        forceAllStandards: instructionTriggersStandards(instruction),
      },
    }), 35_000, "AI editing took too long. Please try again.");
    if (error) throw error;
    return String((data as any)?.content ?? "").trim();
  };

  const applyAiEdit = (proposed: string): boolean => {
    const bridgeApply = aiEditBridgeApplyRef.current;
    if (bridgeApply) {
      bridgeApply(sanitizePresentation(proposed));
      return true;
    }
    const range = aiEditRangeRef.current;
    if (!editor || !range) return false;

    const structured = hasStructuredAiContent(proposed);
    const clean = sanitizePresentation(proposed).replace(/\s*\n\s*/g, " ").trim();
    if (!clean) return false;

    const docSize = editor.state.doc.content.size;
    if (range.from < 0 || range.to <= range.from || range.to > docSize) return false;

    // The panel owns the captured range while it is open. If another action
    // changed that content, never replace a now-unrelated range silently.
    const currentJson = editor.state.doc.slice(range.from, range.to).content.toJSON();
    if (JSON.stringify(currentJson) !== JSON.stringify(range.json)) {
      toast({
        title: "Highlight changed",
        description: "Highlight the content again, then apply the proposal.",
        variant: "destructive",
      });
      return false;
    }

    // Is the target an INLINE position (inside a single textblock)? Since a
    // line is now a single math object, that is the common case — and block
    // nodes cannot be inserted there, which is why Apply silently did nothing.
    let inline = false;
    try {
      const $from = editor.state.doc.resolve(range.from);
      const $to = editor.state.doc.resolve(Math.min(range.to, editor.state.doc.content.size));
      inline = $from.parent.isTextblock && $from.parent === $to.parent;
    } catch { inline = false; }

    let applied = false;
    if (inline && !structured) {
      const value = normalizeMathSource(clean);
      let content: unknown[];
      if (HAS_MATH(clean)) {
        // Validate the proposal as a real mathematical structure BEFORE
        // touching the document: parse it, and require the parse to be
        // lossless. An unparseable/lossy proposal leaves the original intact.
        let treeJson: string;
        try {
          const tree = latexToTree(value);
          const norm = (s: string) => s.replace(/\s+/g, "");
          if (norm(treeToLatex(tree)) !== norm(value)) throw new Error("lossy parse");
          treeJson = JSON.stringify(tree);
        } catch {
          toast({
            title: "Proposal not applied",
            description: "The suggested mathematics could not be read as a valid structure.",
            variant: "destructive",
          });
          return false;
        }
        // Commit value and tree together so the node never renders from a
        // stale tree that disagrees with its LaTeX.
        content = [{ type: "mathInline", attrs: { value, tree: treeJson } }];
      } else {
        content = [{ type: "text", text: clean }];
      }
      applied = editor.chain().focus()
        .insertContentAt({ from: range.from, to: range.to }, content as any)
        .run();

    } else if (structured && inline) {
      const $from = editor.state.doc.resolve(range.from);
      const depth = $from.depth;
      const generated = aiTextToNodes(proposed);

      // A single structured paragraph can replace the selection directly.
      // This preserves the exact untouched content on both sides—including
      // marks and inline math nodes—instead of flattening it through textBetween.
      if (generated.length === 1 && generated[0]?.type === "paragraph") {
        applied = editor.chain().focus()
          .insertContentAt(
            { from: range.from, to: range.to },
            (generated[0].content ?? []) as any,
          )
          .run();
      } else {
        const parentStart = $from.start(depth);
        const parentEnd = $from.end(depth);
        const parentJson = $from.parent.toJSON();
        const beforeContent = editor.state.doc.slice(parentStart, range.from).content.toJSON();
        const afterContent = editor.state.doc.slice(range.to, parentEnd).content.toJSON();
        const nodes = [
          ...(beforeContent.length ? [{ ...parentJson, content: beforeContent }] : []),
          ...generated,
          ...(afterContent.length ? [{ ...parentJson, content: afterContent }] : []),
        ];
        applied = editor.chain().focus()
          .insertContentAt({ from: $from.before(depth), to: $from.after(depth) }, nodes)
          .run();
      }
    } else {
      const nodes = aiTextToNodes(proposed);
      applied = editor.chain().focus()
        .insertContentAt({ from: range.from, to: range.to }, nodes)
        .run();
    }
    if (applied) aiEditRangeRef.current = null;
    return applied;
  };




  // ── Free-position text boxes (overlay layer) ──────────────────────────
  const [canvasBoxes, setCanvasBoxes] = useState<CanvasBox[]>(() => loadCanvasBoxes(storageId));
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  useEffect(() => {
    setCanvasBoxes(loadCanvasBoxes(storageId));
    setActiveBoxId(null);
  }, [storageId]);
  useEffect(() => { saveCanvasBoxes(storageId, canvasBoxes); }, [storageId, canvasBoxes]);

  const paperLayerRef = useRef<HTMLDivElement | null>(null);

  /** Place the sensor at a screen point.
   *  A point that lands on real text (within a small tolerance of a caret
   *  position) puts the normal text cursor there. Anything else — blank space
   *  beside a line, under or around a diagram, the Note Extend region, the far
    *  right of the sheet — inserts a normal flowing line at that vertical
    *  position. The browser then pushes every later text block down. */
  const placeSensorAtPoint = (clientX: number, clientY: number): "doc" | "free" => {
    if (!editor) return "free";
    const view = editor.view;
    const doc = editor.state.doc;

    const hit = view.posAtCoords({ left: clientX, top: clientY });
    if (hit) {
      const pos = Math.max(0, Math.min(hit.pos, doc.content.size));
      try {
        const c = view.coordsAtPos(pos);
        const near =
          clientX >= c.left - 44 && clientX <= c.right + 44 &&
          clientY >= c.top - 10 && clientY <= c.bottom + 10;
        if (near) {
          editor.chain().focus().setTextSelection(pos).run();
          rememberSensor(editor.state.selection.to);
          return "doc";
        }
      } catch { /* fall through to free placement */ }
    }

    // Blank-space placement becomes a normal document block. Horizontal clicks
    // do not create overlap-capable text; only diagrams use the overlay layer.
    const host = view.dom as HTMLElement;
    const r = host.getBoundingClientRect();
    const z = zoom || 1;
    createFreeFrame(
      Math.max(0, (clientX - r.left) / z),
      Math.max(0, (clientY - r.top) / z),
    );
    return "free";

  };

  /** Double-click anywhere on the canvas is the primary sensor gesture. */
  const handlePaperDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = eventTargetElement(e.target);
    if (el?.closest("[data-canvas-box]")) return;
    if (isEditorControlTarget(e.target)) return;
    // Active drawing tools own their own double-click (e.g. finishing a curve).
    if (geometryMode && geometryTool !== "select") return;
    if (!editor) return;
    // A double-click that lands on real text keeps the native word selection.
    const view = editor.view;
    const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (hit) {
      try {
        const c = view.coordsAtPos(Math.min(hit.pos, editor.state.doc.content.size));
        const onText =
          e.clientX >= c.left - 44 && e.clientX <= c.right + 44 &&
          e.clientY >= c.top - 10 && e.clientY <= c.bottom + 10;
        if (onText) return;
      } catch { /* noop */ }
    }
    e.preventDefault();
    e.stopPropagation();
    placeSensorAtPoint(e.clientX, e.clientY);
  };

  /** Single click on blank paper — including the Note Extend area and the space
   *  below/around a diagram — moves the sensor there. Clicks inside the note
   *  body stay native so text editing is unchanged. */
  const handlePaperMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = eventTargetElement(e.target);
    const isGeometryTarget = Boolean(el?.closest("[data-geometry-diagram-wrapper],[data-geometry-live-canvas]"));
    if (isEditorControlTarget(e.target) && !isGeometryTarget) return;

    // While a drawing tool is active the geometry tools own the click. A click
    // inside a live drawing canvas is handled there; anywhere else on the paper
    // starts (or continues) the construction in a diagram block placed in flow.
    if (geometryMode && geometryTool !== "select") {
      const inLive = Boolean(el?.closest("[data-geometry-live-canvas]"));
      if (!inLive) handleGeometryDrawStart(e);
      return;
    }


    // Grab a free canvas frame by its left gutter to move it. Object frames
    // (a detached diagram / solution) have no gutter — they are dragged from
    // the object itself, so they are skipped here.
    const frame = el?.closest("[data-canvas-frame]") as HTMLElement | null;
    if (frame && editor && !frame.hasAttribute("data-object-kind")) {
      const fr = frame.getBoundingClientRect();
      if (e.clientX - fr.left <= 18) {
        e.preventDefault();
        startFrameDrag(frame, e.clientX, e.clientY);
        return;
      }
    }

    // Inside the TipTap DOM: TipTap places the caret precisely on its own.
    const editorDom = editor?.view.dom;
    if (el && editorDom && (el === editorDom || editorDom.contains(el))) return;

    // Click on an existing canvas box → its own handlers take over.
    if (el && el.closest("[data-canvas-box]")) return;
    if (!editor) return;

    e.preventDefault();
    placeSensorAtPoint(e.clientX, e.clientY);
  };

  /** Free frames are moved by dragging their left gutter. The move is previewed
   *  on the DOM and committed as ONE document transaction, so a completed drag
   *  is exactly one entry in the same Undo history as text and diagrams. */
  const startFrameDrag = (frame: HTMLElement, startX: number, startY: number) => {
    if (!editor) return;
    startObjectDrag(editor, frame, startX, startY, { ghost: frame });
  };








  const updateBoxText = (id: string, text: string) =>
    setCanvasBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));

  const removeBox = (id: string) =>
    setCanvasBoxes((prev) => prev.filter((b) => b.id !== id));


  const [ribbonOpen, setRibbonOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("lesson-ribbon-open") !== "0";
  });
  const ribbonShellRef = useRef<HTMLDivElement | null>(null);
  const [ribbonSpacerHeight, setRibbonSpacerHeight] = useState(0);
  useEffect(() => {
    try { sessionStorage.setItem("lesson-ribbon-open", ribbonOpen ? "1" : "0"); } catch { /* noop */ }
  }, [ribbonOpen]);
  useEffect(() => {
    const shell = ribbonShellRef.current;
    if (!shell) return;
    // The shell also holds the persistent section navigation, so its real
    // height is reserved whether the toolbar is open or collapsed.
    const measure = () => setRibbonSpacerHeight(shell.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ribbonOpen]);

  return (
    <AssetSelectionProvider>
    <AiEditBridgeProvider requestAiEdit={requestAiEdit}>
    <div
      className="flex flex-col h-full"
      onClickCapture={(e) => {
        if (!viewOnly) return;
        e.preventDefault();
        e.stopPropagation();
        allowEdit();
      }}
      onKeyDownCapture={(e) => {
        if (!viewOnly) return;
        if (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          e.stopPropagation();
          allowEdit();
        }
      }}
    >


      {/* Word-style ribbon — fixed to the viewport so the center handle is always reachable */}
      <div ref={ribbonShellRef} className="lesson-ribbon-shell">
        <div
          className={cn(
            "bg-background/95 backdrop-blur border-b flex items-center gap-1 px-3 flex-wrap overflow-hidden transition-all duration-200",
            ribbonOpen ? "py-1.5 max-h-[400px]" : "py-0 max-h-0 border-b-0",
          )}
        >
        <Btn onClick={() => editor?.chain().focus().undo().run()} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Btn>
        <Btn onClick={() => editor?.chain().focus().redo().run()} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Btn>
        <Divider />
        <button
          type="button"
          onClick={extendNote}
          title="Note Extend — add more writing space at the bottom of the page"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <ChevronsDown className="h-4 w-4" /> Note Extend
        </button>
        <button
          type="button"
          onClick={shrinkNote}
          disabled={pageExtraMm <= 0}
          title={pageExtraMm <= 0
            ? "Note Shrink — the page is already tight against your last object"
            : "Note Shrink — remove empty space at the bottom (never crops content)"}
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronsUp className="h-4 w-4" /> Note Shrink
        </button>
        <Divider />

        <button
          type="button"
          onClick={() => setAssetLibOpen(true)}
          title="Asset Library — browse all symbols & structures"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <LayoutGrid className="h-4 w-4" /> Asset Library
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded hover:bg-foreground/10 inline-flex items-center gap-1 text-xs" title="Add a section">
              <PlusIcon className="h-4 w-4" /> Section
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Insert section</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(gameQuestionsOnly ? (["game_questions"] as SectionKind[]) : SECTION_OPTIONS).map((s) => (
              <DropdownMenuItem key={s} onClick={() => insertSection(s)}>{SECTION_LABELS[s]}</DropdownMenuItem>
            ))}
            {!gameQuestionsOnly && !hideSessionControls && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSubtopicDraft(null); setSessionDraft({ title: "", withSolution: true }); }}>
                  ＋ Add Session
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSessionDraft(null); setSubtopicDraft(""); }}>
                  ＋ Add Subtopic
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>

        </DropdownMenu>

        {sessionDraft && (
          <div className="inline-flex items-center gap-1 rounded border border-foreground/20 bg-background px-1.5 py-1 text-xs">
            <span className="text-muted-foreground">Add Session:</span>
            <input
              autoFocus
              value={sessionDraft.title}
              placeholder="e.g. Practice questions on adding fractions"
              onChange={(e) => setSessionDraft({ ...sessionDraft, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSessionDraft();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setSessionDraft(null);
                }
              }}
              className="w-56 bg-transparent px-1 py-0.5 outline-none"
            />
            <div className="inline-flex overflow-hidden rounded border border-foreground/20">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setSessionDraft({ ...sessionDraft, withSolution: v })}
                  className={cn(
                    "px-2 py-0.5",
                    sessionDraft.withSolution === v
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-foreground/10",
                  )}
                >
                  {v ? "With Solution" : "Without Solution"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={commitSessionDraft}
              disabled={!sessionDraft.title.trim()}
              title="Insert this session into the lesson note"
              className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-40"
            >
              Enter
            </button>
            <button type="button" onClick={() => setSessionDraft(null)} className="px-1 text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}


        {subtopicDraft !== null && (
          <div className="inline-flex items-center gap-1 rounded border border-foreground/20 bg-background px-1.5 py-1 text-xs">
            <span className="text-muted-foreground">Subtopic:</span>
            <input
              autoFocus
              value={subtopicDraft}
              placeholder="e.g. Adding Fractions with Different Denominators"
              onChange={(e) => setSubtopicDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!subtopicDraft.trim()) return;
                  insertSubtopic(subtopicDraft);
                  setSubtopicDraft(null);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setSubtopicDraft(null);
                }
              }}
              className="w-64 bg-transparent px-1 py-0.5 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!subtopicDraft.trim()) return;
                insertSubtopic(subtopicDraft);
                setSubtopicDraft(null);
              }}
              disabled={!subtopicDraft.trim()}
              title="Make this the active subtopic for all AI generation"
              className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-40"
            >
              Enter
            </button>
            {!subtopicDraft.trim() && (
              <span className="text-muted-foreground/70">Type a subtopic name</span>
            )}
            <button type="button" onClick={() => setSubtopicDraft(null)} className="px-1 text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}

        {/* Active AI context — the subtopic every new AI element is built for. */}
        {aiCtx.ctx.activeSubtopic && (
          <div
            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs"
            title="Active subtopic — all AI generation uses this context"
          >
            <span className="text-muted-foreground">Subtopic:</span>
            <span className="font-medium">{aiCtx.ctx.activeSubtopic}</span>
            {aiCtx.ctx.previousSubtopics.length > 0 && (
              <select
                value=""
                onChange={(e) => { if (e.target.value) activateSubtopic(e.target.value); }}
                title="Switch back to an earlier subtopic"
                className="ml-1 bg-transparent text-[11px] text-muted-foreground outline-none"
              >
                <option value="">switch…</option>
                {aiCtx.ctx.previousSubtopics.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
        )}


        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (geometryMode) {
                setGeometryMode(false);
                geometryDraftRef.current = null;
                discardEmptyGeometryRegion();
                setDiagramTabsOpen(false);
                return;
              }
              setDiagramTabsOpen((v) => !v);
            }}
            title="Diagram — choose 2D or 3D"
            className={cn(
              "p-1.5 rounded inline-flex items-center gap-1 text-xs transition-colors",
              geometryMode || diagramTabsOpen
                ? "bg-primary text-primary-foreground"
                : "hover:bg-foreground/10",
            )}
          >
            <Shapes className="h-4 w-4" /> Diagram
          </button>
          {(diagramTabsOpen || geometryMode) && (
            <div className="inline-flex items-center rounded border border-foreground/15 overflow-hidden">
              <button
                type="button"
                title="2D geometry editor"
                onClick={() => {
                  if (!editor) return;
                  if (geometryMode) {
                    setGeometryMode(false);
                    geometryDraftRef.current = null;
                  } else {
                    setGeometryMode(true);
                    ensureGeometryRegion();
                  }
                }}
                className={cn(
                  "px-2 py-1 text-xs transition-colors",
                  geometryMode ? "bg-primary text-primary-foreground" : "hover:bg-foreground/10",
                )}
              >
                2D
              </button>
              <button
                type="button"
                title="Open the 3D Geometry Workspace"
                onClick={() => {
                  setGeometryMode(false);
                  geometryDraftRef.current = null;
                  open3DWorkspace();
                }}
                className="px-2 py-1 text-xs border-l border-foreground/15 hover:bg-foreground/10 transition-colors"
              >
                3D
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={insertSmartTable}
          title="Insert a Smart Table — interactive teaching/activity table"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <Grid3X3 className="h-4 w-4" /> Smart Table
        </button>
        <button
          type="button"
          onClick={() => setTablesOpen(true)}
          title="Insert a mathematical reference table (logs, antilogs, sines, etc.)"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <TableIcon className="h-4 w-4" /> Maths Table
        </button>
        <button
          type="button"
          onClick={() => {
            if (!editor) return;
            editor.chain().focus().insertContent({ type: "smartGraph", attrs: { ...DEFAULT_GRAPH } }).run();
          }}
          title="Insert a smart graph workspace"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <LineChart className="h-4 w-4" /> Graph
        </button>
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          title="Open smart calculator"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <Calculator className="h-4 w-4" /> Calc
        </button>
        <button
          type="button"
          onClick={() => setConversionOpen(true)}
          title="Conversion — convert between units"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <ArrowLeftRight className="h-4 w-4" /> Conversion
        </button>
        {/* Erase lives in the Diagram tools panel only — not duplicated here. */}

        <Btn onClick={insertMath} title="Insert math (fraction, root, exponent)"><Sigma className="h-4 w-4" /></Btn>
        {/* Animate removed from the toolbar. */}
        {builderAi && <GlobalAiButton onGenerate={handleGlobalAi} />}
        <button
          type="button"
          onClick={() => { setSymbolPanelOpen((v) => !v); setMatrixPanelOpen(false); setEmojiPanelOpen(false); }}
          title="Symbols — quick access (click to insert at the cursor)"
          aria-pressed={symbolPanelOpen}
          className={`p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 ${symbolPanelOpen ? "bg-foreground/10" : ""}`}
        >
          <FunctionSquare className="h-4 w-4" /> {tLabel("editor_symbols")}
        </button>
        <button
          type="button"
          onClick={() => { setMatrixPanelOpen((v) => !v); setEmojiPanelOpen(false); setSymbolPanelOpen(false); }}
          title="Matrix — quick access (dimension + operation → Enter)"
          aria-pressed={matrixPanelOpen}
          className={`p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 ${matrixPanelOpen ? "bg-foreground/10" : ""}`}
        >
          <Grid3X3 className="h-4 w-4" /> {tLabel("editor_matrix")}
        </button>


        <button
          type="button"
          onClick={() => setSlidePanelOpen((v) => !v)}
          title="Slides — this lesson note's own slide workspace"
          aria-pressed={slidePanelOpen}
          className={`p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 ${slidePanelOpen ? "bg-foreground/10" : ""}`}
        >
          <LayoutGrid className="h-4 w-4" /> {tLabel("editor_slide")}
        </button>

        <button
          type="button"
          onClick={() => { setEmojiPanelOpen((v) => !v); setMatrixPanelOpen(false); setSymbolPanelOpen(false); }}
          title="Emoji library"
          aria-pressed={emojiPanelOpen}
          className={`p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 ${emojiPanelOpen ? "bg-foreground/10" : ""}`}
        >
          <span className="text-base leading-none">😊</span> {tLabel("editor_emojis")}
        </button>

        <Divider />
        <select
          value={paperSize}
          onChange={(e) => onPaperSizeChange(e.target.value as PaperSize)}
          className="text-xs bg-transparent border rounded px-1.5 py-1 hover:bg-foreground/5"
          title="Page size"
        >
          {Object.entries(PAPER_SIZES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={paperStyle}
          onChange={(e) => onPaperStyleChange(e.target.value as PaperStyle)}
          className="text-xs bg-transparent border rounded px-1.5 py-1 hover:bg-foreground/5"
          title="Paper appearance"
        >
          {paperOptions.map((k) => (
            <option key={k} value={k}>{PAPER_LABELS[k]}</option>
          ))}
        </select>
        <Divider />
        <Btn onClick={() => onZoomChange(Math.max(0.5, +(zoom - 0.1).toFixed(2)))} title="Zoom out"><Minus className="h-4 w-4" /></Btn>
        <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Btn onClick={() => onZoomChange(Math.min(2, +(zoom + 0.1).toFixed(2)))} title="Zoom in"><Plus className="h-4 w-4" /></Btn>
        <Divider />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded hover:bg-foreground/10 inline-flex items-center gap-1 text-xs" title="Export">
              <Download className="h-4 w-4" /> {tLabel("editor_export")}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportDocx}>
              <FileText className="h-4 w-4 mr-2" /> DOCX (Word, WPS, Google Docs)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-2" /> PDF (via Print)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onScanFromPhone && (
          <Btn onClick={onScanFromPhone} title="Scan a page from your phone">
            <Smartphone className="h-4 w-4" />
          </Btn>
        )}
        {onPresent && (
          <Btn onClick={onPresent} title="Present on Smartboard">
            <Presentation className="h-4 w-4" />
          </Btn>
        )}
        </div>
        {/* Persistent section navigation — always visible, even with the
            toolbar collapsed. Navigation only: no reload, no regeneration. */}
        <SectionNav editor={editor} />
        <button
          type="button"
          onClick={() => setRibbonOpen((v) => !v)}
          title={ribbonOpen ? "Hide toolbar" : "Show toolbar"}
          aria-label={ribbonOpen ? "Hide toolbar" : "Show toolbar"}
          className="lesson-ribbon-handle"
        >
          {ribbonOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div aria-hidden="true" style={{ height: ribbonSpacerHeight }} />

      <div
        className="flex-1 min-h-0 flex overflow-hidden"
        style={{
          paddingRight: "var(--properties-panel-width, 0px)",
          transition: "padding-right 160ms ease",
        }}
      >
        <div className="min-w-0 min-h-0 flex-1 overflow-auto overscroll-contain bg-[hsl(220_15%_94%)]">
          <PageFrame size={paperSize} style={paperStyle} zoom={zoom} extraMm={pageExtraMm} sheetRef={sheetElRef}>
            <div
              ref={paperLayerRef}
              style={{ cursor: "text", flex: 1, minHeight: "60vh", position: "relative" }}
              onMouseDown={handlePaperMouseDown}
              onDoubleClick={handlePaperDoubleClick}
            >
              <EditorContent editor={editor} />
              {/* Note Extend space lives INSIDE the interaction layer, so the
                  extended region is the same editable canvas: diagrams, text
                  boxes, sensors and objects all work there. */}
              {pageExtraMm > 0 && (
                <div
                  data-note-extend-spacer="true"
                  style={{ height: pageExtraMm * (96 / 25.4), flex: "0 0 auto" }}
                />
              )}
              <NotebookGeometryOverlay notebookId={storageId} paperLayerRef={paperLayerRef} tiptapEditor={editor} />

              {canvasBoxes.map((b) => (
                <CanvasBoxView
                  key={b.id}
                  box={b}
                  active={activeBoxId === b.id}
                  onActivate={() => setActiveBoxId(b.id)}
                  onChange={(text) => updateBoxText(b.id, text)}
                  onRemove={() => removeBox(b.id)}
                />
              ))}

              {/* The Master Sensor marker — one marker for the one caret. It
                  keeps the insertion point visible while the teacher uses the
                  ribbon, wherever the sensor is parked. */}
              <SensorCaret
                editor={editor}
                pos={sensorPos}
                hidden={editorFocused || objectEditorFocused}
                paperLayerRef={paperLayerRef}
                zoom={zoom}
              />


            </div>

          </PageFrame>
        </div>
        {emojiPanelOpen && (
        <Suspense fallback={null}>
        <EmojiPanel
          open={emojiPanelOpen}
          onClose={() => setEmojiPanelOpen(false)}
          onInsert={insertSymbolText}
          onInsertMedia={insertEmojiMedia}
        />
        </Suspense>
        )}
        <SymbolQuickPanel
          open={symbolPanelOpen}
          onClose={() => setSymbolPanelOpen(false)}
          onInsertText={insertSymbolText}
          onInsertStructure={insertQuickSymbol}
        />
        <MatrixQuickPanel
          open={matrixPanelOpen}
          onClose={() => setMatrixPanelOpen(false)}
          onInsert={insertQuickMatrix}
        />

        {slidePanelOpen && notebookId && (
          <SlidePanel
            notebookId={notebookId}
            sheetEl={sheetElRef.current}
            editor={editor}
            onClose={() => setSlidePanelOpen(false)}
          />
        )}
        <PropertiesPanel />

      </div>


      <SelectionToolbar
        editor={editor}
        suppressed={aiEditOpen}
        onAiEdit={openAiEdit}
      />
      <AiEditPanel
        open={aiEditOpen}
        target={aiEditTarget}
        onGenerate={runAiEdit}
        onApply={applyAiEdit}
        onClose={closeAiEdit}
        renderPreview={(t) => <span>{renderMathInline(t)}</span>}
      />
      <AtCommandMenu editor={editor} state={atState} onClose={() => setAtState({ active: false, query: "", from: 0, to: 0, coords: null })} />
      {assetLibOpen && (
        <Suspense fallback={null}>
          <AssetLibraryDialog editor={editor} open={assetLibOpen} onOpenChange={setAssetLibOpen} />
        </Suspense>
      )}

      <ProblemCheckDialog
        open={Boolean(problemCheck)}
        report={problemCheck?.report ?? null}
        heading={problemCheck?.heading}
        onCancel={() => { problemCheck?.resolve(false); setProblemCheck(null); }}
        onProceed={() => { problemCheck?.resolve(true); setProblemCheck(null); }}
      />

      <ConversionPanel open={conversionOpen} onOpenChange={setConversionOpen} onInsert={insertSymbolText} />
      <GeometryAiPanel />
      <GeometryToolbox />

      {workspace3dOpen && (
      <Suspense fallback={null}>
      <Workspace3DDialog
        open={workspace3dOpen}
        onOpenChange={(o) => {
          setWorkspace3dOpen(o);
          if (!o) workspace3dApplyRef.current = null;
        }}
        initialScene={workspace3dScene}
        onExport={handle3DExport}
      />
      </Suspense>
      )}
      {tablesOpen && (
      <Suspense fallback={null}>
      <MathTablesPicker
        open={tablesOpen}
        onOpenChange={setTablesOpen}
        onInsert={(attrs: MathTableAttrs) => {
          if (!editor) return;
          editor.chain().focus().insertContent({ type: "mathTable", attrs }).run();
        }}
      />
      </Suspense>
      )}
      {calcOpen && (
      <Suspense fallback={null}>
      <SmartCalculator
        open={calcOpen}
        onOpenChange={setCalcOpen}
        onInsertWorking={(attrs: SmartCalcAttrs) => {
          if (!editor) return;
          editor.chain().focus().insertContent({ type: "smartCalc", attrs }).run();
        }}
      />
      </Suspense>
      )}
      {objectsOpen && (
      <Suspense fallback={null}>
      <MathObjectsPicker
        open={objectsOpen}
        onOpenChange={setObjectsOpen}
        onInsert={(kind) => {
          if (!editor) return;
          editor.chain().focus().insertContent({ type: "mathObject", attrs: { kind, size: 32 } }).run();
        }}
      />
      </Suspense>
      )}
    </div>
    </AiEditBridgeProvider>
    </AssetSelectionProvider>

  );
}

/**
 * MIGRATION ONLY. Diagrams are document blocks now. Notes written under the
 * old page-overlay model stored their figures either as invisible `pageLayer`
 * carriers or in this browser's cache. On the first open of such a note the
 * figures are turned into normal in-flow diagram blocks at the place their
 * carrier already records, and the cache is dropped. Nothing is drawn here.
 */
function NotebookGeometryOverlay({
  notebookId,
  tiptapEditor,
}: {
  notebookId?: string;
  paperLayerRef: RefObject<HTMLDivElement | null>;
  tiptapEditor: Editor | null;
}) {
  const doneRef = useRef<string | null>(null);

  useEffect(() => { doneRef.current = null; }, [notebookId]);

  useEffect(() => {
    if (!tiptapEditor) return;
    const key = notebookId ?? "note";
    if (doneRef.current === key) return;
    const type = tiptapEditor.schema?.nodes?.geometryDiagram;
    if (!type) return;

    const run = () => {
      if (doneRef.current === key) return;
      const carriers: Array<{ pos: number; size: number; scene: GeometryScene }> = [];
      tiptapEditor.state.doc.descendants((node, pos) => {
        if (node.type.name !== "geometryDiagram" || !node.attrs?.pageLayer) return true;
        const scene = sanitizeScene(node.attrs.scene) as GeometryScene | null;
        carriers.push({ pos, size: node.nodeSize, scene: scene ?? EMPTY_SCENE });
        return true;
      });

      const cached = loadNotebookGeometry(notebookId);
      const hasCached = (cached.objects?.length ?? 0) > 0;
      if (!carriers.length && !hasCached) {
        doneRef.current = key;
        return;
      }
      doneRef.current = key;

      let tr = tiptapEditor.state.tr;
      const insert = (scene: GeometryScene, at: number) => {
        const groups = splitPageGeometryScene(scene);
        (groups.length ? groups : [scene]).forEach((group, index) => {
          if (!group.objects?.length) return;
          const pos = Math.min(at, tr.doc.content.size);
          tr = tr.insert(pos, type.create({
            scene: group,
            pageLayer: false,
            align: "center",
            diagramId: `dgm_flow_${notebookId ?? "note"}_${Date.now().toString(36)}_${index}`,
          }));
        });
      };

      // Carriers first, from the bottom up so earlier positions stay valid.
      for (const carrier of [...carriers].sort((a, b) => b.pos - a.pos)) {
        tr = tr.delete(carrier.pos, carrier.pos + carrier.size);
        insert(carrier.scene, carrier.pos);
      }
      // A cache-only note has nowhere recorded: the figures join the end of the
      // note, in the order they were drawn down the page.
      if (!carriers.length && hasCached) insert(cached, tr.doc.content.size);

      if (tr.docChanged) {
        closeHistory(tr);
        tiptapEditor.view.dispatch(tr);
      }
      saveNotebookGeometry(notebookId, EMPTY_SCENE);
    };

    // A migration hiccup must never break the note.
    const t = window.setTimeout(() => { try { run(); } catch { /* noop */ } }, 60);

    return () => window.clearTimeout(t);
  }, [tiptapEditor, notebookId]);

  // Toolbar Dustbin: wipe 2D objects the dustbin passes over, inside whichever
  // diagram block sits under the pointer.
  useEffect(() => {
    if (!tiptapEditor) return;
    registerNotebookGeometryEraser((clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY) as Element | null;
      const wrap = el?.closest?.("[data-geometry-diagram-wrapper]") as HTMLElement | null;
      const raw = wrap?.dataset.geometryPos;
      if (!wrap || !raw) return false;
      const pos = Number(raw);
      if (!Number.isFinite(pos)) return false;
      const node = tiptapEditor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== "geometryDiagram") return false;
      const scene = (sanitizeScene(node.attrs.scene) as GeometryScene | null) ?? EMPTY_SCENE;
      const rect = wrap.getBoundingClientRect();
      const W = scene.bounds.width + 48;
      const H = scene.bounds.height + 48;
      const x = ((clientX - rect.left) / (rect.width || 1)) * W - 24;
      const y = ((clientY - rect.top) / (rect.height || 1)) * H - 24;
      const id = pickObject(scene, x, y, 16);
      if (!id) return false;
      const next = (eraseObject(scene, id) as { scene?: GeometryScene }).scene;
      if (!next) return false;
      const tr = tiptapEditor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, scene: next });
      closeHistory(tr);
      tiptapEditor.view.dispatch(tr);
      return true;
    });
    return () => registerNotebookGeometryEraser(null);
  }, [tiptapEditor]);

  return null;
}


/* ─── Global AI button (whole-lesson or insert-at-cursor) ─── */
function GlobalAiButton({
  onGenerate,
}: { onGenerate: (prompt: string, mode: "cursor" | "whole", images: string[]) => Promise<void> }) {
  const [mode, setMode] = useState<"cursor" | "whole">("whole");
  return (
    <AiPopover
      title="AI assist"
      placeholder='e.g. "Create a lesson on quadratic equations for Year 10"'
      hint="Type, speak, or attach a textbook photo. Whole lesson drafts Intro → Assessment."
      allowAttachments
      topControls={
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("whole")}
            className={cn("px-2 py-0.5 rounded border", mode === "whole" ? "bg-foreground/10 border-foreground/30" : "border-foreground/15 text-foreground/60")}
          >
            Whole lesson
          </button>
          <button
            type="button"
            onClick={() => setMode("cursor")}
            className={cn("px-2 py-0.5 rounded border", mode === "cursor" ? "bg-foreground/10 border-foreground/30" : "border-foreground/15 text-foreground/60")}
          >
            Insert at cursor
          </button>
        </div>
      }
      onGenerate={(p, o) => onGenerate(p, mode, o.images)}
      trigger={
        <button
          className="p-1.5 rounded hover:bg-foreground/10 inline-flex items-center gap-1 text-xs"
          title="AI assist — draft a lesson or insert at cursor"
        >
          <Sparkles className="h-4 w-4" /> AI
        </button>
      }
    />
  );
}

function Btn({
  children, onClick, active, title,
}: { children: React.ReactNode; onClick?: () => void; active?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-foreground/10 transition-colors",
        active && "bg-foreground/10 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Divider() { return <span className="w-px h-5 bg-foreground/15 mx-1" />; }

/* ─── The Master Sensor marker ───
   A single marker that tracks the one caret — whether it sits in the flowing
   note body or inside a free-positioned frame — so the insertion point stays
   visible while the teacher works in the ribbon. */
function SensorCaret({
  editor, pos, hidden, paperLayerRef, zoom,
}: {
  editor: Editor | null;
  pos: number | null;
  hidden: boolean;
  paperLayerRef: RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const [box, setBox] = useState<{ top: number; left: number; height: number } | null>(null);

  useEffect(() => {
    if (!editor) { setBox(null); return; }
    const layer = paperLayerRef.current;
    if (!layer) { setBox(null); return; }
    let raf = 0;
    const measure = () => {
      try {
        const rect = layer.getBoundingClientRect();
        const z = zoom || 1;
        if (pos == null || hidden) { setBox(null); return; }
        const size = editor.state.doc.content.size;
        const at = Math.max(0, Math.min(pos, size));
        const c = editor.view.coordsAtPos(at);
        setBox({
          top: (c.top - rect.top) / z,
          left: (c.left - rect.left) / z,
          height: Math.max(18, (c.bottom - c.top) / z),
        });
      } catch { setBox(null); }
    };
    raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [editor, pos, hidden, paperLayerRef, zoom]);



  if (!box) return null;
  return (
    <div
      aria-hidden
      className="lesson-sensor-caret"
      style={{
        position: "absolute",
        top: box.top,
        left: box.left,
        width: 2.5,
        height: box.height,
        borderRadius: 2,
        pointerEvents: "none",
        zIndex: 6,
      }}
    />
  );
}



/* ─── Free-position text box (overlay, outside TipTap) ─── */
function CanvasBoxView({
  box, active, onActivate, onChange, onRemove,
}: {
  box: CanvasBox;
  active: boolean;
  onActivate: () => void;
  onChange: (text: string) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.focus({ preventScroll: true });
      const len = ref.current.value.length;
      try { ref.current.setSelectionRange(len, len); } catch { /* noop */ }
    }
  }, [active]);

  // Auto-grow height to fit content.
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [box.text]);

  const handleBlur = () => {
    if (!box.text.trim()) onRemove();
  };

  return (
    <div
      data-canvas-box
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        minWidth: 80,
        maxWidth: 520,
        zIndex: 5,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onActivate();
      }}
    >
      <textarea
        ref={ref}
        value={box.text}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onActivate}
        onBlur={handleBlur}
        rows={1}
        spellCheck
        placeholder=""
        className="lesson-doc"
        style={{
          width: "100%",
          minWidth: 80,
          background: "transparent",
          border: active ? "1px dashed hsl(220 40% 60% / 0.55)" : "1px dashed transparent",
          outline: "none",
          padding: "0 2px",
          resize: "none",
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "hsl(220 35% 18%)",
          fontFamily: "inherit",
          fontSize: 16,
          lineHeight: "28px",
        }}
      />
      {active && box.text && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
          title="Delete text"
          className="absolute -top-3 -right-3 h-5 w-5 inline-flex items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
