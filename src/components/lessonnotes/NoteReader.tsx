// Read-only lesson note renderer. Same node vocabulary as the editor — the
// diagrams, tables, graphs and math structures render exactly as authored —
// but the document cannot be changed. Used by the MathGPL Community preview.

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { MathInline } from "./extensions/MathInline";
import { MathBlock } from "./extensions/MathBlock";
import { SolutionRow, SolutionMath, SolutionProse } from "./extensions/SolutionRow";
import { SectionHeading } from "./extensions/SectionHeading";
import { GeometryDiagramNode } from "./extensions/GeometryDiagram";
import { Scene3DDiagramNode } from "./extensions/Scene3DDiagram";
import { MathTableNode } from "./extensions/MathTable";
import { SmartGraphNode } from "./extensions/SmartGraph";
import { SmartCalcNode } from "./extensions/SmartCalc";
import { MathObjectNode } from "./extensions/MathObject";
import { StepAnimationNode } from "./extensions/StepAnimation";
import { MathStructure, MathSlot } from "./extensions/MathStructure";
import { MathVisual } from "./extensions/MathVisual";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function NoteReader({ documentJson }: { documentJson: unknown }) {
  const editor = useEditor(
    {
      editable: false,
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
      content: (documentJson as object) ?? EMPTY_DOC,
      editorProps: {
        attributes: { class: "lesson-doc max-w-none focus:outline-hidden" },
      },
    },
    [documentJson],
  );

  return <EditorContent editor={editor} />;
}

export default NoteReader;
