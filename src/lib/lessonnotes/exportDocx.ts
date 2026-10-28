// Minimal but real DOCX export from a TipTap/ProseMirror JSON document.
// Produces Paragraphs, Headings, Bullet/Numbered lists, Bold/Italic/Underline
// runs, and inline math rendered as plain text (e.g. "x^2 + 3"). Opens
// cleanly in Microsoft Word, WPS Office, and Google Docs.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  LevelFormat, AlignmentType,
} from "docx";
import { toUnicodeMath } from "@/lib/notebook/unicodeMath";

type Node = any;

/** Math nodes export as classroom Unicode text — never raw LaTeX. */
function mathToText(value: string): string {
  // toUnicodeMath converts \frac{a}{b} → "a/b" with structural pieces gone,
  // ^{n} → superscript digits, \sqrt{x} → √x, etc. For exponents like
  // x^{m+n} that contain non-numeric content, the helper still produces
  // readable text (x^(m+n)).
  return toUnicodeMath(value) || value;
}

function runsFromInline(content: Node[] | undefined): TextRun[] {
  if (!content || !content.length) return [new TextRun("")];
  const runs: TextRun[] = [];
  for (const n of content) {
    if (n.type === "text") {
      const marks = (n.marks || []) as { type: string }[];
      runs.push(new TextRun({
        text: String(n.text ?? ""),
        bold: marks.some((m) => m.type === "bold"),
        italics: marks.some((m) => m.type === "italic"),
        underline: marks.some((m) => m.type === "underline") ? {} : undefined,
      }));
    } else if (n.type === "mathInline") {
      runs.push(new TextRun({ text: mathToText(String(n.attrs?.value ?? "")), italics: true }));
    } else if (n.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
    } else if (n.content) {
      runs.push(...runsFromInline(n.content));
    }
  }
  return runs;
}

function paraFromNode(n: Node, opts: { listRef?: string; level?: number } = {}): Paragraph[] {
  if (n.type === "heading") {
    const level = n.attrs?.level ?? 2;
    const heading = level === 1 ? HeadingLevel.HEADING_1
                   : level === 2 ? HeadingLevel.HEADING_2
                   : HeadingLevel.HEADING_3;
    return [new Paragraph({ heading, children: runsFromInline(n.content) })];
  }
  if (n.type === "paragraph") {
    return [new Paragraph({
      children: runsFromInline(n.content),
      ...(opts.listRef ? { numbering: { reference: opts.listRef, level: opts.level ?? 0 } } : {}),
    })];
  }
  if (n.type === "mathBlock") {
    return [new Paragraph({
      children: [new TextRun({ text: mathToText(String(n.attrs?.value ?? "")), italics: true })],
    })];
  }
  if (n.type === "bulletList") {
    const out: Paragraph[] = [];
    (n.content || []).forEach((li: Node) => {
      (li.content || []).forEach((child: Node) => {
        out.push(...paraFromNode(child, { listRef: "bullets", level: 0 }));
      });
    });
    return out;
  }
  if (n.type === "orderedList") {
    const out: Paragraph[] = [];
    (n.content || []).forEach((li: Node) => {
      (li.content || []).forEach((child: Node) => {
        out.push(...paraFromNode(child, { listRef: "numbers", level: 0 }));
      });
    });
    return out;
  }
  if (n.type === "blockquote") {
    return (n.content || []).flatMap((c: Node) => paraFromNode(c));
  }
  return [new Paragraph({ children: runsFromInline(n.content) })];
}

export async function exportDocx(doc: any, filename: string) {
  const paragraphs: Paragraph[] = [];
  (doc?.content || []).forEach((n: Node) => paragraphs.push(...paraFromNode(n)));
  if (paragraphs.length === 0) paragraphs.push(new Paragraph({ children: [new TextRun("")] }));

  const wordDoc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
        {
          reference: "numbers",
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^\w\- ]+/g, "").trim() || "lesson-notes"}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
