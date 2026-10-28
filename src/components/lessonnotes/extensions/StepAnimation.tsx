// Step Animation node — wraps a sequence of "frames" (each a serialized
// fragment of editor content). During editing, the teacher sees the most
// recent frame as the live preview plus a strip of captured frames they can
// navigate, edit, delete, reorder, or replace.
//
// During presentation, each press of Next advances `currentFrame` by one,
// revealing exactly one captured step — giving teachers per-click control
// over how a solution unfolds on the smartboard.
//
// Frames are JSON arrays of ProseMirror node JSON; this keeps math, geometry,
// and other rich nodes intact and editable.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, EditorContent, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Trash2, Plus, ArrowLeft, ArrowRight, Pencil } from "lucide-react";

import { MathInline } from "./MathInline";
import { MathBlock } from "./MathBlock";
import { SolutionRow, SolutionMath, SolutionProse } from "./SolutionRow";
import { GeometryDiagramNode } from "./GeometryDiagram";
import { MathTableNode } from "./MathTable";
import { SmartGraphNode } from "./SmartGraph";
import { SmartCalcNode } from "./SmartCalc";
import { MathObjectNode } from "./MathObject";
import { cn } from "@/lib/utils";

export interface AnimationFrame {
  id: string;
  /** Array of ProseMirror block JSON. */
  content: any[];
}

export interface StepAnimationAttrs {
  frames: AnimationFrame[];
  currentFrame: number;
}

/** Shared extension set used by frame preview sub-editors. Note: we deliberately
 *  omit the StepAnimation node itself to avoid recursion. */
function frameExtensions() {
  return [
    StarterKit.configure({ heading: false }),
    Underline,
    MathInline, MathBlock,
    SolutionRow, SolutionMath, SolutionProse,
    GeometryDiagramNode,
    MathTableNode, SmartGraphNode, SmartCalcNode,
    MathObjectNode,
  ];
}

function FramePreview({ frame }: { frame: AnimationFrame }) {
  const doc = useMemo(
    () => ({ type: "doc", content: frame.content?.length ? frame.content : [{ type: "paragraph" }] }),
    [frame.id, frame.content],
  );
  const editor = useEditor({
    extensions: frameExtensions(),
    content: doc,
    editable: false,
  }, [frame.id]);

  useEffect(() => () => { editor?.destroy(); }, [editor]);
  return (
    <div className="step-animation-frame prose prose-sm max-w-none">
      <EditorContent editor={editor} />
    </div>
  );
}

function StepAnimationView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const framesRaw = node.attrs.frames as AnimationFrame[];
  const frames: AnimationFrame[] = Array.isArray(framesRaw) ? framesRaw : [];
  const current = Math.max(0, Math.min(frames.length - 1, Number(node.attrs.currentFrame) || 0));

  const setFrames = (next: AnimationFrame[], focusIndex?: number) => {
    updateAttributes({
      frames: next,
      currentFrame: typeof focusIndex === "number"
        ? Math.max(0, Math.min(next.length - 1, focusIndex))
        : Math.max(0, Math.min(next.length - 1, current)),
    });
  };
  const setCurrent = (i: number) => updateAttributes({ currentFrame: Math.max(0, Math.min(frames.length - 1, i)) });

  const removeFrame = (i: number) => {
    if (frames.length <= 1) { deleteNode(); return; }
    const next = frames.filter((_, idx) => idx !== i);
    setFrames(next, Math.max(0, Math.min(next.length - 1, i)));
  };
  const insertBlank = (i: number) => {
    const blank: AnimationFrame = { id: crypto.randomUUID(), content: [{ type: "paragraph" }] };
    const next = [...frames.slice(0, i + 1), blank, ...frames.slice(i + 1)];
    setFrames(next, i + 1);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= frames.length) return;
    const next = frames.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setFrames(next, j);
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "step-animation my-3 rounded-lg border bg-card/40",
        selected ? "ring-2 ring-primary/40" : "",
      )}
      contentEditable={false}
      data-step-animation=""
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-muted-foreground">Step Animation</span>
          <span className="text-muted-foreground/70">
            Frame {current + 1} / {frames.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30"
            disabled={current <= 0}
            onClick={() => setCurrent(current - 1)}
            title="Previous frame"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30"
            disabled={current >= frames.length - 1}
            onClick={() => setCurrent(current + 1)}
            title="Next frame"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Active frame preview */}
      <div className="px-4 py-3">
        {frames[current] ? <FramePreview frame={frames[current]} /> : <p className="text-xs text-muted-foreground">No frames captured yet.</p>}
      </div>

      {/* Frame strip */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t overflow-x-auto bg-muted/30">
        {frames.map((f, i) => (
          <div
            key={f.id}
            className={cn(
              "flex items-center gap-1 shrink-0 rounded border bg-background px-1.5 py-0.5",
              i === current ? "border-primary" : "border-transparent",
            )}
          >
            <button
              type="button"
              className="text-[11px] tabular-nums px-1 hover:underline"
              onClick={() => setCurrent(i)}
              title={`Show frame ${i + 1}`}
            >
              {i + 1}
            </button>
            <button type="button" className="p-0.5 rounded hover:bg-foreground/10" onClick={() => move(i, -1)} title="Move left">
              <ArrowLeft className="h-3 w-3" />
            </button>
            <button type="button" className="p-0.5 rounded hover:bg-foreground/10" onClick={() => move(i, +1)} title="Move right">
              <ArrowRight className="h-3 w-3" />
            </button>
            <button type="button" className="p-0.5 rounded hover:bg-foreground/10" onClick={() => insertBlank(i)} title="Insert blank frame after">
              <Plus className="h-3 w-3" />
            </button>
            <button type="button" className="p-0.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => removeFrame(i)} title="Delete frame">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground pr-2 inline-flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Use the toolbar "Capture Step" to add the current editor selection.
        </span>
      </div>
    </NodeViewWrapper>
  );
}

export const StepAnimationNode = Node.create({
  name: "stepAnimation",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      frames: {
        default: [] as AnimationFrame[],
        parseHTML: (el) => {
          try { return JSON.parse(el.getAttribute("data-frames") ?? "[]"); }
          catch { return []; }
        },
        renderHTML: (a) => ({ "data-frames": JSON.stringify(a.frames ?? []) }),
      },
      currentFrame: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-current")) || 0,
        renderHTML: (a) => ({ "data-current": String(a.currentFrame ?? 0) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-step-animation]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-step-animation": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepAnimationView);
  },
});
