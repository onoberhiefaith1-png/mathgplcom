// Word-style document editor for Lesson Notes. ONE editor for everything.
// Built on TipTap (ProseMirror). Page appearance (plain / ruled / math / grid /
// dotted) is purely visual — never changes behaviour. AI is an inline writing
// assistant; the teacher always owns the document.
//
// AI integration:
//  • Global ribbon AI button   → generates a WHOLE LESSON (or inserts at cursor)
//  • Per-section ✨ button      → generates ONE section, scoped to that heading
// Both reuse the existing notebook-ai edge function (modes: generate, floating).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { MathInline } from "./extensions/MathInline";
import { MathBlock } from "./extensions/MathBlock";
import { SolutionRow, SolutionMath, SolutionProse } from "./extensions/SolutionRow";
import { SectionHeading, type SectionAiCallContext, type SectionAction } from "./extensions/SectionHeading";
import { GeometryDiagramNode } from "./extensions/GeometryDiagram";
import { GeometryAiPanel } from "./GeometryAiPanel";
import { GeometryToolbox } from "./geometry-editor/GeometryToolbox";
import { GeometryModeProvider, useGeometryMode } from "./geometry-editor/GeometryModeContext";
import { MathTableNode, type MathTableAttrs } from "./extensions/MathTable";
import { SmartGraphNode, DEFAULT_GRAPH } from "./extensions/SmartGraph";
import { SmartCalcNode, type SmartCalcAttrs } from "./extensions/SmartCalc";
import { MathObjectNode } from "./extensions/MathObject";
import { MathStructure, MathSlot } from "./extensions/MathStructure";
import { MathVisual } from "./extensions/MathVisual";
import { AtCommand, type AtCommandState } from "./extensions/AtCommand";
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
import { MathSymbolPanel } from "./MathSymbolPanel";
import { SelectionToolbar, type SelectionSnapshot } from "./SelectionToolbar";
import { AiEditPanel, type AiEditTarget } from "./AiEditPanel";
import { instructionTriggersStandards } from "@/lib/lessonnotes/editSuggestions";
import { renderMathInline } from "@/lib/notebook/mathRender";
import {
  PAPER_LABELS, PAPER_SIZES,
  type PaperSize, type PaperStyle,
} from "@/lib/lessonnotes/paperThemes";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Undo2, Redo2, Sigma, Minus, Plus, Heading1, Heading2,
  Download, Sparkles, Plus as PlusIcon,
  FileText, Smartphone, Presentation, X,
  ChevronUp, ChevronDown, Shapes, Table as TableIcon, LineChart, Calculator,
  Film, Camera, Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { exportDocx } from "@/lib/lessonnotes/exportDocx";
import {
  SECTION_LABELS, WHOLE_LESSON_ORDER, aiSectionKind, blockKindFor,
  detectSectionKind, type SectionKind,
} from "@/lib/lessonnotes/sectionKinds";
import { persistGeneratedExample } from "@/lib/lessonnotes/persistGenerated";
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";

const SECTION_OPTIONS: SectionKind[] = [
  "introduction", "objectives", "explanation", "example",
  "exercise", "classwork", "homework", "assessment", "summary",
];

interface Props {
  documentJson: any | null;
  paperSize: PaperSize;
  paperStyle: PaperStyle;
  zoom: number;
  onZoomChange: (z: number) => void;
  onPaperSizeChange: (s: PaperSize) => void;
  onPaperStyleChange: (s: PaperStyle) => void;
  onDocChange: (json: any) => void;
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
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("notebook-ai", {
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
    },
  });
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

/** Run the existing notebook-ai `scan` mode on each image and merge problems. */
async function scanImages(images: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const dataUrl of images) {
    try {
      const { data, error } = await supabase.functions.invoke("notebook-ai", {
        body: { mode: "scan", imageDataUrl: dataUrl },
      });
      if (error) continue;
      const items: string[] = (data as any)?.items ?? [];
      out.push(...items);
    } catch { /* skip */ }
  }
  return out;
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
}: Props) {
  const { mode: geometryMode, setMode: setGeometryMode, tool: geometryTool } = useGeometryMode();
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
      case "regenerate":
        return { prompt: prompt || `Rewrite the ${label} from scratch.`, currentContent: "" };
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
        // In-place EDIT: section already has content AND teacher typed an
        // instruction → revise this section only, never touch other sections.
        const hasExisting = opts.sectionText.trim().length > 0;
        if (hasExisting && prompt) {
          return {
            prompt:
              `Apply this teacher instruction to the ${label} below:\n` +
              `"""${prompt}"""\n\n` +
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

  /** True when a custom-prompt "generate" should behave as an in-place edit. */
  const isInPlaceEdit = (info: SectionAiCallContext, basePrompt: string) =>
    info.action === "generate" &&
    info.sectionText.trim().length > 0 &&
    basePrompt.trim().length > 0;

  /** Handle per-section AI button (passed into SectionHeading extension). */
  const handleSectionAi = async (prompt: string, info: SectionAiCallContext) => {
    if (!editor) return;

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

    const { prompt: finalPrompt, currentContent } = await buildPrompt({
      base: prompt, action: info.action, sectionText: info.sectionText,
      images: info.images, kind: info.kind,
    });

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
        ctx: ctxRef.current,
        context: isSolutionBlock ? solutionSource?.problemText : info.sectionText,
        currentContent,
        blockKind: generationBlockKind,
        activeQuestion: isSolutionBlock ? solutionSource?.problemText : undefined,
        inheritedContext: isSolutionBlock ? true : undefined,
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
      // Any other backend/network failure: show a friendly message instead of
      // letting the error bubble up into React (which triggers the full app
      // error overlay teachers and students were seeing).
      console.warn("[handleSectionAi] generation failed:", msg);
      toast({
        title: "Generation failed",
        description: "Something went wrong while generating. Please try again.",
        variant: "destructive",
      });
      return;
    }
    if (!content) { toast({ title: "No content returned" }); return; }

    // Single-column flow: math + prose interleaved.
    // For question-style sections we insert the question body and the
    // Solution placeholder SEPARATELY so we have an exact position for the
    // geometry diagram (which must sit BELOW the question and ABOVE the
    // "Solution" heading — the diagram is part of the question).
    const questionBodyNodes = aiTextToNodes(content);
    const trailingNodes = isQuestionSectionKind(info.kind) ? solutionPlaceholderNodes() : [];

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
      // can never spill into the following section.
      const liveEnd = Math.min(liveSectionEnd(info.headingPos), info.sectionEndPos);
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
      }
    } else {
      insertFrom = info.sectionEndPos;
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
        const subtopic = ctxRef.current?.subtopic || notebookContext?.subtopic;
        const subject = ctxRef.current?.subject || notebookContext?.subject;
        const { data, error } = await supabase.functions.invoke("notebook-ai", {
          body: {
            mode: "geometry",
            sectionText: content,
            topic, subtopic, subject,
          },
        });
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
      MathTableNode,
      SmartGraphNode,
      SmartCalcNode,
      MathObjectNode,
      StepAnimationNode,
      MathSlot,
      MathStructure,
      MathVisual,
      AtCommand.configure({ onChange: setAtState }),
    ],
    content: sanitizeLegacyCanvasAttrs(documentJson) ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        class: "lesson-doc max-w-none focus:outline-none min-h-[60vh]",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onDocChange(editor.getJSON()), 600);
    },
  });

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
    editor.chain().focus()
      .insertContentAt(insertAt, [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: SECTION_LABELS[kind] }] },
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

  const openAiEdit = (snap: SelectionSnapshot) => {
    aiEditRangeRef.current = { from: snap.from, to: snap.to };
    setAiEditTarget({ text: snap.text, kind: snap.kind });
    setAiEditOpen(true);
  };

  const closeAiEdit = () => {
    setAiEditOpen(false);
    setAiEditTarget(null);
    aiEditRangeRef.current = null;
  };

  const runAiEdit = async (instruction: string, target: AiEditTarget): Promise<string> => {
    const selectionText = (target.text ?? "").trim();
    if (!selectionText) {
      toast({ title: "Nothing selected", description: "Highlight some text or a math object first.", variant: "destructive" });
      throw new Error("empty selection");
    }
    const { data, error } = await supabase.functions.invoke("notebook-ai", {
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
    });
    if (error) throw error;
    return String((data as any)?.content ?? "").trim();
  };

  const applyAiEdit = (proposed: string) => {
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

    // Geometry Mode behaves like a drawing tool inside the lesson note:
    // choose Point/Line/Midpoint, then click the page. If the click is on an
    // existing live canvas, the canvas handles it; otherwise create/update a
    // plain geometry node at the clicked document position.
    if (geometryMode && !el?.closest("[data-geometry-live-canvas]") && handleGeometryPaperClick(e)) return;

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
    <div className="flex flex-col h-full">
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
        <Btn active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold"><Bold className="h-4 w-4" /></Btn>
        <Btn active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic"><Italic className="h-4 w-4" /></Btn>
        <Btn active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="h-4 w-4" /></Btn>
        <Divider />
        <Btn active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 className="h-4 w-4" /></Btn>
        <Btn active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 className="h-4 w-4" /></Btn>
        <Btn active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="h-4 w-4" /></Btn>
        <Btn active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
        <Divider />
        <Btn onClick={insertMath} title="Insert math (fraction, root, exponent)"><Sigma className="h-4 w-4" /></Btn>
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
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => {
            if (!editor) return;
            if (geometryMode) {
              setGeometryMode(false);
              geometryDraftRef.current = null;
              return;
            }
            setGeometryMode(true);
          }}
          title={geometryMode ? "Exit Geometry Mode" : "Geometry Mode — choose a tool, then click the lesson note"}
          className={cn(
            "p-1.5 rounded inline-flex items-center gap-1 text-xs transition-colors",
            geometryMode
              ? "bg-primary text-primary-foreground"
              : "hover:bg-foreground/10",
          )}
        >
          <Shapes className="h-4 w-4" /> Diagram
        </button>
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
          onClick={() => setObjectsOpen(true)}
          title="Insert a math object (cars, apples, dice, coins…)"
          className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10"
        >
          <Boxes className="h-4 w-4" /> Objects
        </button>
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

      <div className="flex-1 overflow-auto bg-[hsl(220_15%_94%)]">
        <PageFrame size={paperSize} style={paperStyle} zoom={zoom}>
          <div
            ref={paperLayerRef}
            style={{ cursor: "text", flex: 1, minHeight: "60vh", position: "relative" }}
            onMouseDown={handlePaperMouseDown}
          >
            <EditorContent editor={editor} />
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
      <GeometryAiPanel />
      <GeometryToolbox />
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
