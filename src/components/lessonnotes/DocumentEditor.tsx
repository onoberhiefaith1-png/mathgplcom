// Word-style document editor for Lesson Notes. ONE editor for everything.
// Built on TipTap (ProseMirror). Page appearance (plain / ruled / math / grid /
// dotted) is purely visual — never changes behaviour. AI is an inline writing
// assistant; the teacher always owns the document.
//
// AI integration:
//  • Global ribbon AI button   → generates a WHOLE LESSON (or inserts at cursor)
//  • Per-section ✨ button      → generates ONE section, scoped to that heading
// Both reuse the existing notebook-ai edge function (modes: generate, floating).

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { MathInline } from "./extensions/MathInline";
import { MathBlock } from "./extensions/MathBlock";
import { SolutionRow, SolutionMath, SolutionProse } from "./extensions/SolutionRow";
import { SectionHeading, type SectionAiCallContext, type SectionAction } from "./extensions/SectionHeading";
import { GeometryDiagramNode } from "./extensions/GeometryDiagram";
import { Scene3DDiagramNode, onScene3DWorkspaceOpen } from "./extensions/Scene3DDiagram";
import { Workspace3DDialog } from "./geometry3d/Workspace3DDialog";
import type { Scene3D } from "@/lib/geometry3d/scene3d";
import { GeometryAiPanel } from "./GeometryAiPanel";
import { GeometryToolbox } from "./geometry-editor/GeometryToolbox";
import { GeometryModeProvider, useGeometryMode } from "./geometry-editor/GeometryModeContext";
import { GeometryCanvas } from "./geometry-editor/GeometryCanvas";
import { useGeometryEditor } from "./geometry-editor/useGeometryEditor";
import { SelectionInspector } from "./geometry-editor/SelectionInspector";
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
import { AssetLibraryDialog } from "./AssetLibraryDialog";
import { MatrixToolbar } from "./MatrixToolbar";
import { LayoutGrid } from "lucide-react";
import { StepAnimationNode, type AnimationFrame } from "./extensions/StepAnimation";
import { MathTablesPicker } from "./math-tools/MathTablesPicker";
import { SmartCalculator } from "./math-tools/SmartCalculator";
import { MathObjectsPicker } from "./math-objects/MathObjectsPicker";
import { EMPTY_SCENE, sanitizeScene, pointById, type GeometryScene } from "@/lib/geometry/scene";
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

import { MathSymbolPanel } from "./MathSymbolPanel";
import { SelectionToolbar, type SelectionSnapshot } from "./SelectionToolbar";
import { AiEditPanel, type AiEditTarget } from "./AiEditPanel";
import { AiEditBridgeProvider, type AiEditRequest } from "@/hooks/useAiEditBridge";
import { detectSelectionKindFromText } from "@/lib/lessonnotes/detectSelectionKind";
import { sanitizePresentation } from "@/lib/lessonnotes/outputHygiene";

import { instructionTriggersStandards } from "@/lib/lessonnotes/editSuggestions";
import { AssetSelectionProvider, useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { PropertiesPanel } from "./PropertiesPanel";
import { EmojiPanel } from "./EmojiPanel";
import { ConversionPanel } from "./ConversionPanel";
import { renderMathInline } from "@/lib/notebook/mathRender";
import {
  PAPER_LABELS, PAPER_SIZES,
  type PaperSize, type PaperStyle,
} from "@/lib/lessonnotes/paperThemes";
import {
  Undo2, Redo2, Sigma, Minus, Plus,
  Download, Sparkles, Plus as PlusIcon,
  FileText, Smartphone, Presentation, X,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Shapes, Table as TableIcon, LineChart, Calculator,
  Film, Camera, Archive, ArrowLeftRight,

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
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import { buildWorkspaceManifest } from "@/lib/lessonnotes/ai/toolManifest";

const SECTION_OPTIONS: SectionKind[] = INSERT_SECTION_OPTIONS;


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

/** Call the notebook-ai edge function in `generate` mode. */
async function aiGenerate(opts: {
  kind: SectionKind;
  teacherPrompt: string;
  ctx?: Props["notebookContext"];
  context?: string;
  currentContent?: string;
  blockKind?: "problem" | "solution" | "text";
  activeQuestion?: string;
  inheritedContext?: boolean;
  lessonContext?: LessonTeachingContext;
}): Promise<string> {
  const { hasCreditsForGeneration, INSUFFICIENT_CREDITS_MESSAGE } = await import("@/lib/costs/creditGuard");
  if (!(await hasCreditsForGeneration())) throw new Error(INSUFFICIENT_CREDITS_MESSAGE);
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
      inheritedContext: opts.inheritedContext ?? false,
      lessonContext: opts.lessonContext ?? null,
      workspaceManifest: buildWorkspaceManifest(),
    },
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

const QUESTION_SECTION_KINDS: SectionKind[] = ["example", "exercise", "classwork", "homework", "assessment", "game_questions"];
const isQuestionSectionKind = (kind: SectionKind) => QUESTION_SECTION_KINDS.includes(kind);

const solutionPlaceholderNodes = () => ([
  { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Solution" }] },
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
  notebookContext, onPresent, onScanFromPhone, exportFileName, gameQuestionsOnly,
  pageExtraMm: pageExtraMmProp, onPageExtraMmChange,
}: Props) {
  const { mode: geometryMode, setMode: setGeometryMode, tool: geometryTool } = useGeometryMode();
  // When a school looks through a teacher's workspace the page is identical;
  // the paper simply refuses to change.
  const { viewOnly, allowEdit } = useViewAs();

  /* ─── Note Extend / Note Shrink ────────────────────────────────────────
   * The sheet grows in fixed 50 mm slabs. Shrinking is clamped so the page
   * bottom can never rise above the last rendered object on the page. */
  const NOTE_STEP_MM = 50;
  const sheetElRef = useRef<HTMLDivElement | null>(null);
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
  const [animateMode, setAnimateMode] = useState(false);
  const { id: notebookId } = useParams();
  const navigate = useNavigate();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctxRef = useRef(notebookContext);
  useEffect(() => { ctxRef.current = notebookContext; }, [notebookContext]);
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
  const persistAndOfferFloating = async (
    kind: SectionKind,
    content: string,
    range: { from: number; to: number } | null,
    problemOverride?: string,
  ) => {
    if (blockKindFor(kind) !== "solution" || !nbIdRef.current) return;
    try {
      const res = await persistGeneratedExample({
        notebookId: nbIdRef.current,
        kind,
        problem: problemOverride?.trim() || ctxRef.current?.topic || ctxRef.current?.subtopic || "",
        solution: content,
        subject: ctxRef.current?.subject,
        subtopic: ctxRef.current?.subtopic,
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

  const getSolutionSource = (headingPos: number) => {
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
    // Strip anything before the LAST section-label line ("Solution",
    // "Example", "Exercise"...) that appears as inline text rather than a
    // heading node. Without this, ACTIVE_QUESTION can leak the previous
    // question that lives above an inline "Solution" label.
    const lines = rawText.split("\n");
    let cutAt = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (detectSectionKind(lines[i])) { cutAt = i; break; }
    }
    const problemText = (cutAt >= 0 ? lines.slice(cutAt + 1) : lines).join("\n").trim();
    return {
      parentKind: isQuestionSectionKind(parentKind) ? parentKind : "example",
      problemText,
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

  /** Notebook context narrowed to the subtopic the insertion point sits under. */
  const contextAt = (beforePos: number): Props["notebookContext"] => {
    const sub = currentSubtopicAt(beforePos);
    if (!sub) return ctxRef.current;
    return { ...(ctxRef.current ?? {}), subtopic: sub.title };
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
    if (!editor) return;
    let info = infoIn;

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
    const finalPrompt = prefDirective ? `${built.prompt}\n\n${prefDirective}` : built.prompt;


    const isSolutionBlock = info.kind === "solution";
    const solutionSource = isSolutionBlock ? getSolutionSource(info.headingPos) : null;
    if (isSolutionBlock && !solutionSource?.hasInheritedQuestion) {
      toast({
        title: "No parent question found",
        description: "Add an Example (or Exercise / Classwork / Homework) question above this Solution, then try again.",
        variant: "destructive",
      });
      return;
    }
    const generationKind = solutionSource?.parentKind ?? info.kind;
    const generationBlockKind = isQuestionSectionKind(info.kind)
      ? "problem"
      : isSolutionBlock
        ? "solution"
        : undefined;

    let content: string;
    try {
      content = (await aiGenerate({
        kind: generationKind,
        teacherPrompt: finalPrompt,
        ctx: contextAt(info.headingPos),

        context: isSolutionBlock ? solutionSource?.problemText : info.sectionText,
        currentContent,
        blockKind: generationBlockKind,
        activeQuestion: isSolutionBlock ? solutionSource?.problemText : undefined,
        inheritedContext: isSolutionBlock ? true : undefined,
        lessonContext: collectLessonContext(info.headingPos, generationKind),
      })).trim();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
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
    if (!content) { toast({ title: "No content returned" }); return; }

    // A Solution heading must never be duplicated, and the AI must never
    // re-emit the label as body text.
    if (isSolutionBlock) content = stripLeadingSolutionLabel(content);

    // Single-column flow: math + prose interleaved.
    // For question-style sections the question body and the Solution
    // placeholder are inserted SEPARATELY so we have an exact position for
    // the geometry diagram (which must sit BELOW the question and ABOVE the
    // "Solution" heading — the diagram is part of the question).
    const questionBodyNodes = aiTextToNodes(content);

    // REGENERATE (and in-place EDIT): replace the section body, strictly
    // bounded by this section's range. Otherwise append at section end.
    const replaceBody = info.action === "regenerate" || isInPlaceEdit(info, prompt);

    /** Re-resolve the live end of this section, so we never delete across
     *  the next heading even if the doc mutated since `info` was captured. */
    const liveSectionEnd = (headingPos: number): number => {
      const doc = editor.state.doc;
      const headingNode = doc.nodeAt(headingPos);
      if (!headingNode || headingNode.type.name !== "heading") return headingPos;
      const level = headingNode.attrs?.level ?? 2;
      let endPos = doc.content.size;
      doc.descendants((n, p) => {
        if (p <= headingPos) return true;
        if (n.type.name === "heading" && (n.attrs.level ?? 6) <= level) {
          if (endPos === doc.content.size) endPos = p;
          return false;
        }
        return true;
      });
      return endPos;
    };

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
      return found;
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
      const found: Array<{ scene: unknown; topic: unknown }> = [];
      if (to <= from) return found;
      editor.state.doc.nodesBetween(from, to, (n) => {
        if (n.type.name === "geometryDiagram") {
          found.push({ scene: n.attrs?.scene, topic: n.attrs?.topic });
        }
        return true;
      });
      return found;
    };

    // The section already owns a Solution heading (inserted with the section,
    // or by an earlier generation) → reuse it instead of appending another.
    const existingSolution = isQuestionSectionKind(info.kind)
      ? findSolutionHeading(info.headingPos)
      : null;
    const trailingNodes = isQuestionSectionKind(info.kind) && !existingSolution
      ? solutionPlaceholderNodes()
      : [];

    let insertFrom: number;
    // Position immediately AFTER the question body — this is where the
    // geometry diagram for the question must be inserted.
    let questionBodyEnd: number;
    // Diagrams preserved from the section before we wiped it; re-inserted
    // after the new body so they remain part of this section forever.
    let preservedDiagrams: Array<{ scene: unknown; topic: unknown }> = [];
    if (replaceBody) {
      const headingNodeSize = editor.state.doc.nodeAt(info.headingPos)?.nodeSize ?? 0;
      const start = headingNodeSize ? info.headingPos + headingNodeSize : info.headingPos;
      insertFrom = start;
      // Clamp the delete range to the LIVE next-heading position so we
      // can never spill into the following section. When a Solution heading
      // exists, stop at it: the heading (and the structure below) survives a
      // regenerate — only the question body is replaced.
      const sectionEnd = Math.min(liveSectionEnd(info.headingPos), info.sectionEndPos);
      const liveEnd = existingSolution ? Math.min(existingSolution.pos, sectionEnd) : sectionEnd;
      // Preserve diagrams BEFORE we wipe.
      preservedDiagrams = collectDiagrams(start, liveEnd);
      editor.chain().focus()
        .deleteRange({ from: start, to: liveEnd })
        .run();
      const sizeBefore = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(start, questionBodyNodes).run();
      questionBodyEnd = start + (editor.state.doc.content.size - sizeBefore);
      // Re-insert preserved diagrams at the end of the new question body.
      for (const d of preservedDiagrams) {
        const insertAt = Math.min(questionBodyEnd, editor.state.doc.content.size);
        const before = editor.state.doc.content.size;
        editor.chain().focus().insertContentAt(insertAt, {
          type: "geometryDiagram",
          attrs: { scene: d.scene, topic: d.topic },
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
      // Append path: the question ALWAYS goes above an existing Solution
      // heading, never at the very end of the section (which would put the
      // question underneath the solution).
      insertFrom = existingSolution
        ? Math.min(existingSolution.pos, info.sectionEndPos)
        : info.sectionEndPos;
      if (existingSolution) {
        const headingNodeSize = editor.state.doc.nodeAt(info.headingPos)?.nodeSize ?? 0;
        const bodyStart = headingNodeSize ? info.headingPos + headingNodeSize : info.headingPos;
        if (hasOnlyEmptyParagraphs(bodyStart, existingSolution.pos)) {
          editor.chain().focus().deleteRange({ from: bodyStart, to: existingSolution.pos }).run();
          insertFrom = Math.min(bodyStart, editor.state.doc.content.size);
        }
      }
      const sizeBefore = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(insertFrom, questionBodyNodes).run();
      questionBodyEnd = insertFrom + (editor.state.doc.content.size - sizeBefore);
      if (trailingNodes.length) {
        editor.chain().focus().insertContentAt(questionBodyEnd, trailingNodes).run();
      }
    }


    // Whether the teacher explicitly asked for a new diagram. When they did
    // NOT and we already preserved one, skip the async geometry pass to
    // avoid silently replacing a teacher-tuned diagram.
    const promptAsksForDiagram = (() => {
      const p = (prompt || "").toLowerCase();
      if (!p) return false;
      return /\b(diagram|figure|redraw|sketch|draw|triangle|circle|polygon|angle|tangent|chord|arc|sector|parallel|perpendicular)\b/.test(p);
    })();
    const skipGeometryPass = replaceBody && preservedDiagrams.length > 0 && !promptAsksForDiagram;

    // Capture the heading position so we can re-resolve the section end at
    // the moment the async geometry pass returns — surviving any doc
    // mutations that happen in the meantime.
    const anchorHeadingPos = info.headingPos;

    // Automatic geometry diagram pass. Fire-and-forget: if the section is
    // geometric, this returns a GeometryScene which we insert IMMEDIATELY
    // BELOW the question body (and above the Solution heading, when present).
    // If the section isn't geometric, the backend returns null and we do
    // nothing. Errors here are non-fatal.
    if (!skipGeometryPass) void (async () => {

      try {
        const topic = ctxRef.current?.topic || notebookContext?.topic;
        const subtopic = contextAt(anchorHeadingPos)?.subtopic || ctxRef.current?.subtopic || notebookContext?.subtopic;
        const subject = ctxRef.current?.subject || notebookContext?.subject;
        const { data, error } = await withTimeout(supabase.functions.invoke("notebook-ai", {
          body: {
            mode: "geometry",
            sectionText: content,
            topic, subtopic, subject,
          },
        }), 30_000, "Diagram generation took too long.");
        if (error) return;
        const scene = sanitizeScene((data as any)?.scene);
        if (!scene || scene.objects.length === 0) return;
        // Re-resolve the question body end on the LIVE doc, scoped to the
        // original section heading. If the heading no longer exists (section
        // deleted), skip the insertion.
        const liveDoc = editor.state.doc;
        const headingNode = liveDoc.nodeAt(anchorHeadingPos);
        if (!headingNode || headingNode.type.name !== "heading") return;
        const sectionEnd = liveSectionEnd(anchorHeadingPos);
        // Insert right before any trailing Solution heading (i.e. at the
        // very end of the question body within this section).
        let insertAt = sectionEnd;
        // If there's already a geometryDiagram in this section, skip — the
        // section already owns its diagram and we don't want to duplicate.
        const existing = collectDiagrams(anchorHeadingPos, sectionEnd);
        if (existing.length > 0) return;
        // Walk backwards from sectionEnd to skip the inserted Solution
        // placeholder block so the diagram sits ABOVE Solution heading.
        liveDoc.nodesBetween(anchorHeadingPos, sectionEnd, (n, p) => {
          if (n.type.name === "heading" && p > anchorHeadingPos) {
            insertAt = Math.min(insertAt, p);
            return false;
          }
          return true;
        });
        insertAt = Math.min(insertAt, editor.state.doc.content.size);
        editor
          .chain()
          .focus()
          .insertContentAt(insertAt, {
            type: "geometryDiagram",
            attrs: { scene, topic },
          })
          .run();
      } catch (err) {
        console.warn("[geometry] auto-diagram skipped:", err);
      }
    })();


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
      AtCommand.configure({ onChange: setAtState }),
      MathKeyShortcuts,
    ],
    content: sanitizeLegacyCanvasAttrs(documentJson) ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        class: "lesson-doc max-w-none focus:outline-hidden min-h-[60vh]",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
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
    const beforeSize = editor.state.doc.content.size;
    editor.chain().focus().insertContentAt(pos, {
      type: "geometryDiagram",
      attrs: { scene: EMPTY_SCENE },
    }).run();
    const mappedPos = Math.min(pos, beforeSize);
    return locateGeometryNearPos(mappedPos);
  }, [editor, locateGeometryNearPos]);

  const applyQuickGeometryTool = useCallback((scene: GeometryScene, tool: ToolId, x: number, y: number, pendingIds: string[]) => {
    const sn = snap(scene, x, y);
    const hitId = pickObject(scene, x, y, 10);
    const ensurePointLocal = (base: GeometryScene, px: number, py: number) => {
      const s = snap(base, px, py);
      if (s.pointId) return { id: s.pointId, scene: base };
      const op = addPoint(base, s.x, s.y);
      return { id: op.addedIds[0], scene: op.scene };
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
  }, []);

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

  // Push external doc updates only when editor isn't focused.
  useEffect(() => {
    if (!editor || !documentJson) return;
    if (editor.isFocused) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(documentJson);
    if (current !== next) editor.commands.setContent(documentJson, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentJson]);

  const insertMath = () => {
    editor?.chain().focus().insertContent({ type: "mathInline", attrs: { value: "" } }).run();
  };

  // Emoji Library dock panel (teacher-managed content).
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);

  // Conversion tool + archived "Advanced tools" group.
  const [conversionOpen, setConversionOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);


  const insertSymbolText = (s: string) => {
    editor?.chain().focus().insertContent(s).run();
  };
  const insertMathStructure = (latex: string) => {
    editor?.chain().focus().insertContent({ type: "mathInline", attrs: { value: latex } }).run();
  };

  /** Ribbon section insertion must NEVER replace selected content. In
   *  particular, geometry diagrams are selectable atom nodes; if the diagram
   *  is still selected, plain `insertContent()` replaces it. A new H2 section
   *  belongs after the current top-level section, so any diagram owned by that
   *  section remains above the new heading. */
  const sectionInsertPosition = () => {
    if (!editor) return 0;
    const { doc, selection } = editor.state;
    const anchor = selection.to;
    let headingPos: number | null = null;
    let headingLevel = 2;

    doc.descendants((node, pos) => {
      if (pos > anchor) return false;
      if (node.type.name === "heading" && (node.attrs.level ?? 6) <= 2) {
        headingPos = pos;
        headingLevel = node.attrs.level ?? 2;
      }
      return true;
    });

    // No owning section yet: insert after the current selection, not over it.
    if (headingPos == null) return Math.min(anchor, doc.content.size);

    let endPos = doc.content.size;
    doc.descendants((node, pos) => {
      if (pos <= headingPos!) return true;
      if (node.type.name === "heading" && (node.attrs.level ?? 6) <= headingLevel) {
        endPos = pos;
        return false;
      }
      return true;
    });
    return Math.min(endPos, doc.content.size);
  };

  const insertSection = (kind: SectionKind) => {
    if (!editor) return;
    const insertAt = sectionInsertPosition();
    // Question-style sections come with an empty Solution space by default so
    // the teacher can type both the problem and the solution manually.
    const trailing = isQuestionSectionKind(kind) && kind !== "game_questions"
      ? solutionPlaceholderNodes()
      : [];
    editor.chain().focus()
      .insertContentAt(insertAt, [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: SECTION_LABELS[kind] }] },
        { type: "paragraph" },
        ...trailing,
      ])
      .run();
  };

  /** "+ Add Session" — a teacher-named section, optionally with a Solution
   *  area. It is its own section: never inside Summary or the previous
   *  session. The typed title also becomes the AI instruction. */
  const insertCustomSession = (title: string, withSolution: boolean) => {
    if (!editor) return;
    const name = title.trim();
    if (!name) return;
    const insertAt = sectionInsertPosition();
    editor.chain().focus()
      .insertContentAt(insertAt, [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: name }] },
        { type: "paragraph" },
        ...(withSolution ? solutionPlaceholderNodes() : []),
      ])
      .run();
  };

  /** "+ Add Subtopic" — structural heading. Everything added under it belongs
   *  to that subtopic, and the AI generates for it only. */
  const insertSubtopic = (title: string) => {
    if (!editor) return;
    const name = title.trim();
    if (!name) return;
    const insertAt = editor.state.doc.content.size;
    editor.chain().focus()
      .insertContentAt(insertAt, [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: name }] },
        { type: "paragraph" },
      ])
      .run();
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
      const headingLevel = heading.attrs.level ?? 2;
      // End of this section = position of next heading at same or higher level,
      // else end of doc.
      let endPos = doc.content.size;
      doc.descendants((node, pos) => {
        if (pos <= headingPos) return true;
        if (node.type.name === "heading" && (node.attrs.level ?? 6) <= headingLevel) {
          endPos = pos;
          return false;
        }
        return true;
      });
      editor.chain().focus().insertContentAt(endPos, {
        type: "geometryDiagram",
        attrs: { scene: detail.scene },
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
        ctx: ctxRef.current,
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
          ctx: ctxRef.current,
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
  const aiEditRangeRef = useRef<{ from: number; to: number } | null>(null);
  const [aiEditOpen, setAiEditOpen] = useState(false);

  /** Custom apply target, set when AI Edit was requested by an asset. */
  const aiEditBridgeApplyRef = useRef<((proposed: string) => void) | null>(null);

  const openAiEdit = (snap: SelectionSnapshot) => {
    aiEditBridgeApplyRef.current = null;
    aiEditRangeRef.current = { from: snap.from, to: snap.to };
    setAiEditTarget({ text: snap.text, kind: snap.kind });
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
        subject: ctxRef.current?.subject ?? "Mathematics",
        topic: ctxRef.current?.topic ?? "",
        subtopic: ctxRef.current?.subtopic ?? "",
        forceAllStandards: instructionTriggersStandards(instruction),
      },
    }), 35_000, "AI editing took too long. Please try again.");
    if (error) throw error;
    return String((data as any)?.content ?? "").trim();
  };

  const applyAiEdit = (proposed: string) => {
    const bridgeApply = aiEditBridgeApplyRef.current;
    if (bridgeApply) {
      bridgeApply(sanitizePresentation(proposed));
      return;
    }
    const range = aiEditRangeRef.current;
    if (!editor || !range) return;
    const nodes = aiTextToNodes(proposed);
    editor.chain().focus()
      .deleteRange({ from: range.from, to: range.to })
      .insertContentAt(range.from, nodes)
      .run();
  };



  // ── Free-position text boxes (overlay layer) ──────────────────────────
  const [canvasBoxes, setCanvasBoxes] = useState<CanvasBox[]>(() => loadCanvasBoxes(notebookId));
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  useEffect(() => {
    setCanvasBoxes(loadCanvasBoxes(notebookId));
    setActiveBoxId(null);
  }, [notebookId]);
  useEffect(() => { saveCanvasBoxes(notebookId, canvasBoxes); }, [notebookId, canvasBoxes]);

  const paperLayerRef = useRef<HTMLDivElement | null>(null);

  /** Click handler on the paper. If user clicked existing TipTap content,
   *  let TipTap handle it natively. If they clicked truly blank paper,
   *  drop a new free-position text box at that point. */
  const handlePaperMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = eventTargetElement(e.target);
    const isGeometryTarget = Boolean(el?.closest("[data-geometry-diagram-wrapper],[data-geometry-live-canvas]"));
    if (isEditorControlTarget(e.target) && !isGeometryTarget) return;

    // Geometry Mode turns the whole notebook page into a drawing surface.
    // The transparent notebook-wide SVG overlay owns all drawing clicks, so
    // text editing and free text boxes stay inactive until the teacher exits.
    if (geometryMode) return;

    // If the click was inside the actual TipTap editor DOM, do nothing —
    // TipTap will place the caret precisely on its own.
    const editorDom = editor?.view.dom;
    if (el && editorDom && (el === editorDom || editorDom.contains(el))) return;

    // Click on an existing canvas box → its own handlers take over.
    if (el && el.closest("[data-canvas-box]")) return;

    const layer = paperLayerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const z = zoom || 1;
    const x = Math.max(0, Math.min((e.clientX - rect.left) / z, rect.width / z - 40));
    const y = Math.max(0, (e.clientY - rect.top) / z - 14);

    e.preventDefault();
    const id = `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setCanvasBoxes((prev) => [...prev, { id, x, y, text: "" }]);
    setActiveBoxId(id);
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
    const measure = () => setRibbonSpacerHeight(ribbonOpen ? shell.getBoundingClientRect().height : 0);
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
            {!gameQuestionsOnly && (
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
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (geometryMode) {
                setGeometryMode(false);
                geometryDraftRef.current = null;
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
          onClick={() => setTablesOpen(true)}
          title="Insert a mathematical table (logs, sines, etc.)"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <TableIcon className="h-4 w-4" /> Tables
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
        {/* Archived / advanced tools — kept available, off the main toolbar. */}
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          title="Advanced tools — summation, animate, AI, symbols"
          aria-pressed={advancedOpen}
          className={cn(
            "p-1.5 rounded inline-flex items-center gap-1 text-xs transition-colors",
            advancedOpen ? "bg-foreground/10" : "hover:bg-foreground/10",
          )}
        >
          <Archive className="h-4 w-4" /> Advanced
        </button>
        {advancedOpen && (
          <>
            <Btn onClick={insertMath} title="Insert math (fraction, root, exponent)"><Sigma className="h-4 w-4" /></Btn>
            <button
              type="button"
              onClick={() => setAnimateMode((v) => !v)}
              title={animateMode ? "Exit Animation Mode" : "Step Animation Mode — capture each step of a solution"}
              className={cn(
                "p-1.5 rounded inline-flex items-center gap-1 text-xs transition-colors",
                animateMode ? "bg-primary text-primary-foreground" : "hover:bg-foreground/10",
              )}
            >
              <Film className="h-4 w-4" /> Animate
            </button>
            {animateMode && (
              <button
                type="button"
                onClick={captureStep}
                title="Capture the current selection (or current block) as a new animation frame"
                className="p-1.5 rounded inline-flex items-center gap-1 text-xs bg-primary/15 hover:bg-primary/25 text-primary"
              >
                <Camera className="h-4 w-4" /> Capture Step
              </button>
            )}
            <GlobalAiButton onGenerate={handleGlobalAi} />
            <MathSymbolPanel insertText={insertSymbolText} insertMath={insertMathStructure} />
          </>
        )}
        <button
          type="button"
          onClick={() => setEmojiPanelOpen((v) => !v)}
          title="Emoji library"
          aria-pressed={emojiPanelOpen}
          className={`p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 ${emojiPanelOpen ? "bg-foreground/10" : ""}`}
        >
          <span className="text-base leading-none">😊</span> Emojis
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
              <Download className="h-4 w-4" /> Export
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
        className="flex-1 min-h-0 flex"
        style={{
          paddingRight: "var(--properties-panel-width, 0px)",
          transition: "padding-right 160ms ease",
        }}
      >
        <div className="flex-1 overflow-auto bg-[hsl(220_15%_94%)]">
          <PageFrame size={paperSize} style={paperStyle} zoom={zoom} extraMm={pageExtraMm} sheetRef={sheetElRef}>
            <div
              ref={paperLayerRef}
              style={{ cursor: "text", flex: 1, minHeight: "60vh", position: "relative" }}
              onMouseDown={handlePaperMouseDown}
            >
              <EditorContent editor={editor} />
              <NotebookGeometryOverlay notebookId={notebookId} paperLayerRef={paperLayerRef} tiptapEditor={editor} />
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
            </div>
          </PageFrame>
        </div>
        <EmojiPanel
          open={emojiPanelOpen}
          onClose={() => setEmojiPanelOpen(false)}
          onInsert={insertSymbolText}
        />
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
      <AssetLibraryDialog editor={editor} open={assetLibOpen} onOpenChange={setAssetLibOpen} />
      <ConversionPanel open={conversionOpen} onOpenChange={setConversionOpen} onInsert={insertSymbolText} />
      <MatrixToolbar editor={editor} />
      <GeometryAiPanel />
      <GeometryToolbox />

      <Workspace3DDialog
        open={workspace3dOpen}
        onOpenChange={(o) => {
          setWorkspace3dOpen(o);
          if (!o) workspace3dApplyRef.current = null;
        }}
        initialScene={workspace3dScene}
        onExport={handle3DExport}
      />
      <MathTablesPicker
        open={tablesOpen}
        onOpenChange={setTablesOpen}
        onInsert={(attrs: MathTableAttrs) => {
          if (!editor) return;
          editor.chain().focus().insertContent({ type: "mathTable", attrs }).run();
        }}
      />
      <SmartCalculator
        open={calcOpen}
        onOpenChange={setCalcOpen}
        onInsertWorking={(attrs: SmartCalcAttrs) => {
          if (!editor) return;
          editor.chain().focus().insertContent({ type: "smartCalc", attrs }).run();
        }}
      />
      <MathObjectsPicker
        open={objectsOpen}
        onOpenChange={setObjectsOpen}
        onInsert={(kind) => {
          if (!editor) return;
          editor.chain().focus().insertContent({ type: "mathObject", attrs: { kind, size: 32 } }).run();
        }}
      />
    </div>
    </AiEditBridgeProvider>
    </AssetSelectionProvider>

  );
}

function NotebookGeometryOverlay({
  notebookId,
  paperLayerRef,
  tiptapEditor,
}: {
  notebookId?: string;
  paperLayerRef: RefObject<HTMLDivElement | null>;
  tiptapEditor: Editor | null;
}) {
  const { mode, tool } = useGeometryMode();
  const [storedScene, setStoredScene] = useState<GeometryScene>(() => loadNotebookGeometry(notebookId));
  const [paperSize, setPaperSize] = useState({ width: 720, height: 960 });
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    setStoredScene(loadNotebookGeometry(notebookId));
  }, [notebookId]);

  useEffect(() => {
    const layer = paperLayerRef.current;
    if (!layer) return;
    const measure = () => {
      const rect = layer.getBoundingClientRect();
      setPaperSize({
        width: Math.max(240, layer.scrollWidth || rect.width || 720),
        height: Math.max(240, layer.scrollHeight || rect.height || 960),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(layer);
    return () => ro.disconnect();
  }, [paperLayerRef]);

  useEffect(() => {
    if (!tiptapEditor) return;
    const bump = () => setDocTick((v) => v + 1);
    tiptapEditor.on("update", bump);
    return () => { tiptapEditor.off("update", bump); };
  }, [tiptapEditor]);

  useEffect(() => {
    const layer = paperLayerRef.current;
    if (!tiptapEditor || !layer) return;
    const paperRect = layer.getBoundingClientRect();
    const scaleX = paperRect.width && layer.offsetWidth ? paperRect.width / layer.offsetWidth : 1;
    const scaleY = paperRect.height && layer.offsetHeight ? paperRect.height / layer.offsetHeight : scaleX;
    const diagrams: Array<{ pos: number; size: number; scene: unknown; dx: number; dy: number }> = [];
    tiptapEditor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "geometryDiagram") return true;
      const wrap = document.querySelector(`[data-geometry-pos="${pos}"]`) as HTMLElement | null;
      const rect = wrap?.getBoundingClientRect();
      diagrams.push({
        pos,
        size: node.nodeSize,
        scene: node.attrs?.scene,
        dx: rect ? (rect.left - paperRect.left) / scaleX + 24 : 24,
        dy: rect ? (rect.top - paperRect.top) / scaleY + 24 : 24,
      });
      return true;
    });
    if (!diagrams.length) return;

    setStoredScene((prev) => {
      const next = diagrams.reduce(
        (acc, d) => mergeGeometrySceneAt(acc, d.scene, d.dx, d.dy),
        prev,
      );
      saveNotebookGeometry(notebookId, next);
      return next;
    });

    let tr = tiptapEditor.state.tr;
    for (const d of [...diagrams].sort((a, b) => b.pos - a.pos)) {
      tr = tr.delete(d.pos, d.pos + d.size);
    }
    if (tr.docChanged) tiptapEditor.view.dispatch(tr);
  }, [docTick, notebookId, paperLayerRef, tiptapEditor]);

  const scene = useMemo<GeometryScene>(() => ({
    ...storedScene,
    bounds: {
      width: Math.max(storedScene.bounds?.width ?? 0, paperSize.width),
      height: Math.max(storedScene.bounds?.height ?? 0, paperSize.height),
    },
  }), [storedScene, paperSize.width, paperSize.height]);

  const geometryEditor = useGeometryEditor(scene, (next) => {
    setStoredScene(next);
    saveNotebookGeometry(notebookId, next);
  });

  useEffect(() => {
    if (mode && geometryEditor.tool !== tool) geometryEditor.setTool(tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tool]);

  useEffect(() => {
    if (!mode) return;
    tiptapEditor?.commands.blur();
  }, [mode, tiptapEditor]);

  const selected = geometryEditor.selectedObjects[0] ?? null;
  const editorNode = useMemo(() => (
    <SelectionInspector
      scene={geometryEditor.scene}
      selected={geometryEditor.selectedObjects}
      kind={geometryEditor.selectionKind}
      onApply={(next) => geometryEditor.commit(next)}
      onSelect={(id, kind) => { geometryEditor.setSelectedIds([id]); geometryEditor.setSelectionKind(kind); }}
    />
  ), [geometryEditor.scene, geometryEditor.selectedObjects, geometryEditor.selectionKind]);
  const title = selected ? `${selected.type[0].toUpperCase()}${selected.type.slice(1)}` : "Geometry";
  useRegisterAssetEditor(mode, "notebook-geometry", title, editorNode);

  if (!mode && storedScene.objects.length === 0) return null;

  const overlayWidth = Math.max(scene.bounds.width ?? 0, paperSize.width) + 48;
  const overlayHeight = Math.max(scene.bounds.height ?? 0, paperSize.height) + 48;

  return (
    <div
      data-notebook-geometry-overlay="true"
      className="absolute"
      style={{
        left: -24,
        top: -24,
        width: overlayWidth,
        height: overlayHeight,
        overflow: "visible",
        zIndex: mode ? 8 : 4,
        pointerEvents: mode ? "auto" : "none",
      }}
    >
      {mode ? (
        <GeometryCanvas editor={geometryEditor} />
      ) : (
        <StaticGeometryDiagram
          scene={scene}
          explicitWidth={overlayWidth}
          explicitHeight={overlayHeight}
        />
      )}
    </div>
  );
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
