// Read-only renderer for a captured solution object (table, diagram, chart,
// 3D scene, …). It reuses the SAME TipTap node views the lesson note uses, so
// a Smart Table renders as a table and a geometry diagram as a diagram —
// never as a picture or a text approximation.

import { useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { GeometryDiagramNode, InlineGeometryDiagram } from "./extensions/GeometryDiagram";
import { ReviewableBoardDiagram } from "@/components/smartboard/ReviewableBoardDiagram";
import { sanitizeScene } from "@/lib/geometry/scene";
import { Scene3DDiagramNode, setScene3DPresentationMode } from "./extensions/Scene3DDiagram";
import { MathTableNode } from "./extensions/MathTable";
import { SmartGraphNode } from "./extensions/SmartGraph";
import { SmartCalcNode } from "./extensions/SmartCalc";
import { MathObjectNode } from "./extensions/MathObject";
import { StepAnimationNode } from "./extensions/StepAnimation";
import { MathStructure, MathSlot } from "./extensions/MathStructure";
import { MathVisual } from "./extensions/MathVisual";
import { MathInline } from "./extensions/MathInline";
import { MathBlock } from "./extensions/MathBlock";
import { INLINE_OBJECT_TYPES } from "@/lib/floating/solutionItems";

interface Props {
  nodeType: string;
  attrs: Record<string, any>;
  /** Smartboard presentation: render at full board scale and let 3D scenes
   *  mount themselves (the board is non-interactive, so nothing can click
   *  a "tap to explore" placeholder). */
  presentation?: boolean;
}

export const SolutionObjectView = ({ nodeType, attrs, presentation = false }: Props) => {
  // Set BEFORE the editor is created so the node views read it on first mount.
  if (presentation) setScene3DPresentationMode(true);

  const geometryScene = nodeType === "geometryDiagram"
    ? sanitizeScene(attrs?.scene)
    : null;

  if (geometryScene) {
    // One diagram engine, one renderer: the board strengthens ink, every other
    // read-only surface renders it at note scale, cropped to the figure.
    // On the board the same scene also becomes reviewable, so the teacher's
    // Geometry Properties attach to these exact objects.
    return presentation
      ? (
        <ReviewableBoardDiagram
          scene={geometryScene}
          diagramId={String(attrs?.diagramId ?? "")}
          pageLayer={attrs?.pageLayer === true}
        />
      )
      : <InlineGeometryDiagram scene={geometryScene} pageLayer={attrs?.pageLayer === true} />;
  }




  const content = useMemo(() => {
    // A page-layer diagram is invisible inside the note (the page overlay draws
    // it there), but on the board it IS the diagram — so render it normally.
    const clean = { ...(attrs ?? {}) };
    if (clean.pageLayer) clean.pageLayer = false;
    const node = { type: nodeType, attrs: clean };
    const inline = INLINE_OBJECT_TYPES.has(nodeType);
    return {
      type: "doc",
      content: [inline ? { type: "paragraph", content: [node] } : node],
    };
  }, [nodeType, attrs]);



  const editor = useEditor(
    {
      editable: false,
      extensions: [
        StarterKit,
        MathInline,
        MathBlock,
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
      ],
      content,
      editorProps: {
        attributes: { class: "lesson-doc max-w-none focus:outline-hidden" },
      },
    },
    [content],
  );

  if (!editor) {
    return <div className="text-xs text-foreground/50 py-4">Loading object…</div>;
  }

  return (
    <div className="pointer-events-none select-none">
      <EditorContent editor={editor} />
    </div>
  );
};

export default SolutionObjectView;
