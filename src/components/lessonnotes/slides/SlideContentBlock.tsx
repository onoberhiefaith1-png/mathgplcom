// Renders captured lesson-note content on a slide, using the very same node
// vocabulary as the note itself — equations, fractions, sub/superscripts,
// diagrams, tables and graphs render exactly as authored. When `editable` is
// true the teacher owns and can edit the captured mathematics in place.
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";
import { MathInline } from "../extensions/MathInline";
import { MathBlock } from "../extensions/MathBlock";
import { SolutionRow, SolutionMath, SolutionProse } from "../extensions/SolutionRow";
import { SectionHeading } from "../extensions/SectionHeading";
import { GeometryDiagramNode } from "../extensions/GeometryDiagram";
import { Scene3DDiagramNode } from "../extensions/Scene3DDiagram";
import { MathTableNode } from "../extensions/MathTable";
import { SmartGraphNode } from "../extensions/SmartGraph";
import { SmartCalcNode } from "../extensions/SmartCalc";
import { MathObjectNode } from "../extensions/MathObject";
import { StepAnimationNode } from "../extensions/StepAnimation";
import { MathStructure, MathSlot } from "../extensions/MathStructure";
import { MathVisual } from "../extensions/MathVisual";

interface Props {
  nodes: unknown;
  editable?: boolean;
  onChange?: (nodes: unknown[]) => void;
}

export function SlideContentBlock({ nodes, editable = false, onChange }: Props) {
  const content = {
    type: "doc",
    content: Array.isArray(nodes) && nodes.length ? nodes : [{ type: "paragraph" }],
  };

  const editor = useEditor(
    {
      editable,
      extensions: [
        StarterKit.configure({ heading: false }),
        SectionHeading.configure({ levels: [1, 2, 3] }),
        Underline,
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
      ],
      content,
      editorProps: {
        attributes: { class: "lesson-doc max-w-none focus:outline-hidden" },
      },
    },
    [nodes, editable],
  );

  useEffect(() => {
    if (!editor || !editable || !onChange) return;
    const handler = () => {
      const json = editor.getJSON() as { content?: unknown[] };
      onChange(json.content ?? []);
    };
    editor.on("blur", handler);
    return () => { editor.off("blur", handler); };
  }, [editor, editable, onChange]);

  return (
    <div className="h-full w-full overflow-hidden">
      <EditorContent editor={editor} />
    </div>
  );
}

export default SlideContentBlock;
