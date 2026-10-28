// @vitest-environment jsdom
//
// Structural copy & paste: a copied mathematical expression must come back
// as the same OBJECT — brackets, cells, nesting and values intact — never as
// the bare digits ("2134").

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { MathSlot, MathStructure } from "@/components/lessonnotes/extensions/MathStructure";
import {
  expandSelectionToStructures,
  isStructuralHtml,
  rangeToStructuralPayload,
  structuralHtmlToSlice,
} from "../structuralClipboard";

const schema = getSchema([Document, Paragraph, Text, MathSlot, MathStructure]) as Schema;

const slot = (text?: string) =>
  schema.nodes.mathSlot.create(null, text ? schema.text(text) : undefined);

const structure = (kind: string, attrs: Record<string, unknown>, cells: (string | undefined)[]) =>
  schema.nodes.mathStructure.create({ kind, attrs }, cells.map((c) => slot(c)));

const docWith = (...nodes: PMNode[]) =>
  schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, nodes));

/** Copy the whole document body, then paste it back — the round trip the
 *  teacher performs when moving a matrix from Solution into Example. */
const roundTrip = (doc: PMNode) => {
  const state = EditorState.create({ doc });
  const from = 1;
  const to = doc.content.size - 1;
  const payload = rangeToStructuralPayload(state, from, to);
  expect(isStructuralHtml(payload.html)).toBe(true);
  const slice = structuralHtmlToSlice(schema, payload.html);
  expect(slice).not.toBeNull();
  const pasted = EditorState.create({ doc: docWith() })
    .tr.replaceSelection(slice!)
    .doc;
  return { payload, pasted };
};

/** All `mathStructure` nodes in a doc, outermost first. */
const structures = (doc: PMNode) => {
  const out: PMNode[] = [];
  doc.descendants((n) => { if (n.type.name === "mathStructure") out.push(n); return true; });
  return out;
};

const cellTexts = (node: PMNode) => {
  const out: string[] = [];
  node.forEach((child) => { if (child.type.name === "mathSlot") out.push(child.textContent); });
  return out;
};

describe("structural copy & paste", () => {
  it("keeps a 2×2 matrix a 2×2 matrix with four separate cells", () => {
    const doc = docWith(
      schema.text("A = "),
      structure("matrix", { rows: 2, cols: 2, br: "[" }, ["2", "1", "3", "4"]),
    );
    const { payload, pasted } = roundTrip(doc);
    // Never the flattened digits.
    expect(payload.html).toContain('data-kind="matrix"');
    const [m] = structures(pasted);
    expect(m).toBeTruthy();
    expect(m.attrs.kind).toBe("matrix");
    expect(m.attrs.attrs).toMatchObject({ rows: 2, cols: 2, br: "[" });
    expect(m.childCount).toBe(4);
    expect(cellTexts(m)).toEqual(["2", "1", "3", "4"]);
  });

  it("preserves distinct 3×2 dimensions and cell order", () => {
    const doc = docWith(
      structure("matrix", { rows: 3, cols: 2 }, ["1", "2", "3", "4", "5", "6"]),
    );
    const { pasted } = roundTrip(doc);
    const [m] = structures(pasted);
    expect(m.attrs.attrs).toMatchObject({ rows: 3, cols: 2 });
    expect(cellTexts(m)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("round-trips a fraction as numerator / denominator", () => {
    const doc = docWith(structure("fraction", {}, ["y", "6"]));
    const { pasted } = roundTrip(doc);
    const [f] = structures(pasted);
    expect(f.attrs.kind).toBe("fraction");
    expect(cellTexts(f)).toEqual(["y", "6"]);
  });

  it("round-trips √(y/6) keeping the fraction inside the radical", () => {
    const inner = structure("fraction", {}, ["y", "6"]);
    const root = schema.nodes.mathStructure.create(
      { kind: "sqrt", attrs: {} },
      schema.nodes.mathSlot.create(null, inner),
    );
    const { pasted } = roundTrip(docWith(root));
    const all = structures(pasted);
    expect(all.map((n) => n.attrs.kind)).toEqual(["sqrt", "fraction"]);
    // The fraction is a descendant of the radical's slot, not a sibling.
    const sqrt = all[0];
    expect(sqrt.childCount).toBe(1);
    const frac = sqrt.child(0).child(0);
    expect(frac.type.name).toBe("mathStructure");
    expect(cellTexts(frac)).toEqual(["y", "6"]);
  });

  it("round-trips a power / superscript structure", () => {
    const doc = docWith(structure("power", {}, ["x", "2"]));
    const { pasted } = roundTrip(doc);
    const [p] = structures(pasted);
    expect(p.attrs.kind).toBe("power");
    expect(cellTexts(p)).toEqual(["x", "2"]);
  });

  it("keeps a matrix nested inside a radical connected", () => {
    const m = structure("matrix", { rows: 2, cols: 2 }, ["a", "b", "c", "d"]);
    const root = schema.nodes.mathStructure.create(
      { kind: "sqrt", attrs: {} },
      schema.nodes.mathSlot.create(null, m),
    );
    const { pasted } = roundTrip(docWith(root));
    const all = structures(pasted);
    expect(all.map((n) => n.attrs.kind)).toEqual(["sqrt", "matrix"]);
    expect(cellTexts(all[1])).toEqual(["a", "b", "c", "d"]);
  });
});

describe("selection boundaries", () => {
  it("grows a caret inside one matrix cell to the whole matrix", () => {
    const m = structure("matrix", { rows: 2, cols: 2 }, ["2", "1", "3", "4"]);
    const doc = docWith(schema.text("A = "), m);
    const state = EditorState.create({ doc });
    // Position of the matrix node itself: after "A = " inside the paragraph.
    let matrixPos = -1;
    doc.descendants((n, pos) => { if (n.type.name === "mathStructure") matrixPos = pos; return true; });
    const insideFirstCell = matrixPos + 2; // inside slot 0
    const grown = expandSelectionToStructures(state, insideFirstCell, insideFirstCell + 1);
    expect(grown.from).toBe(matrixPos);
    expect(grown.to).toBe(matrixPos + m.nodeSize);
  });

  it("grows from inside a nested fraction out to the enclosing radical", () => {
    const inner = structure("fraction", {}, ["y", "6"]);
    const root = schema.nodes.mathStructure.create(
      { kind: "sqrt", attrs: {} },
      schema.nodes.mathSlot.create(null, inner),
    );
    const doc = docWith(root);
    const state = EditorState.create({ doc });
    let sqrtPos = -1;
    doc.descendants((n, pos) => {
      if (sqrtPos < 0 && n.type.name === "mathStructure") sqrtPos = pos;
      return true;
    });
    const deep = sqrtPos + 4; // inside the fraction's numerator
    const grown = expandSelectionToStructures(state, deep, deep);
    expect(grown.from).toBe(sqrtPos);
    expect(grown.to).toBe(sqrtPos + root.nodeSize);
  });

  it("leaves an ordinary text selection untouched", () => {
    const doc = docWith(schema.text("plain words"));
    const state = EditorState.create({ doc });
    expect(expandSelectionToStructures(state, 2, 6)).toEqual({ from: 2, to: 6 });
  });
});
