// Keyboard productivity for math typing.
//
//   `#`  after a valid parent object converts the term on the left into a
//        `mathStructure kind="subsup"` with editable base/subscript/power slots.
//        The `#` itself is consumed and the cursor lands in the power slot.
//
//   `##` immediately after creating that empty power slot moves the cursor to
//        the subscript slot instead. Neither trigger appears in the note.
//
//   `#`  with no valid parent (start of line, after a space/operator, etc.) is
//        inserted as literal text.
//
//   `(`, `[`, `{`, `|`  auto-pair a closing bracket and drop the caret between
//        them; typing the matching closer just before it skips over. Backspace
//        immediately after an autopair deletes both.
//
//   `/`  converts the last mathematical term into the numerator of an editable
//        `mathStructure kind="fraction"`.
//
// We do NOT intercept Shift/Ctrl. Those keys have too many OS, browser, and
// editor bindings. `#` is the trigger, but only when there is something to
// attach the new mathematical workspace to.

import { Extension } from "@tiptap/core";
import { mkChar, mkSubSup, type Row } from "@/lib/smartboard/mathTree";
import { treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import { Plugin, PluginKey, Selection, TextSelection } from "@tiptap/pm/state";


const OPEN_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "|": "|",
};

const key = new PluginKey("mathKeyShortcuts");

interface PluginState {
  lastPair: { closerPos: number; closer: string } | null;
}

/** Walk backwards to find the last "mathematical term" ending at `pos`. */
function findLastTermStart(text: string, endInText: number): number {
  let i = endInText;
  let parenDepth = 0;
  while (i > 0) {
    const ch = text[i - 1];
    if (ch === ")" || ch === "]") { parenDepth++; i--; continue; }
    if (ch === "(" || ch === "[") {
      if (parenDepth === 0) break;
      parenDepth--; i--; continue;
    }
    if (parenDepth > 0) { i--; continue; }
    if (/[A-Za-z0-9._]/.test(ch)) { i--; continue; }
    break;
  }
  return i;
}

/** True when `ch` is a mathematical object that a superscript/subscript can
 *  legally attach to. */
function isValidParentChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9)\]}]/.test(ch);
}

function slotContext(state: any) {
  const { $from, empty } = state.selection;
  if (!empty) return null;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name !== "mathSlot") continue;
    const structDepth = d - 1;
    if (structDepth < 0 || $from.node(structDepth).type.name !== "mathStructure") return null;
    return {
      $from,
      slotDepth: d,
      structDepth,
      slotIndex: $from.index(structDepth),
      structNode: $from.node(structDepth),
      slotNode: $from.node(d),
      structStart: $from.before(structDepth),
    };
  }
  return null;
}

function slotInnerPos(structStart: number, structNode: any, slotIndex: number): number {
  let pos = structStart + 1;
  for (let i = 0; i < slotIndex; i++) pos += structNode.child(i).nodeSize;
  return pos + 1;
}

function setSelectionNear(view: any, tr: any, pos: number) {
  try {
    tr.setSelection(TextSelection.create(tr.doc, pos));
  } catch {
    tr.setSelection(Selection.near(tr.doc.resolve(Math.max(0, Math.min(pos, tr.doc.content.size))), 1));
  }
  view.dispatch(tr.scrollIntoView());
}

function moveToSlot(view: any, ctx: NonNullable<ReturnType<typeof slotContext>>, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= ctx.structNode.childCount) return false;
  const pos = slotInnerPos(ctx.structStart, ctx.structNode, slotIndex);
  const tr = view.state.tr;
  setSelectionNear(view, tr, pos);
  return true;
}

function moveVerticalSlot(view: any, dir: -1 | 1): boolean {
  const ctx = slotContext(view.state);
  if (!ctx) return false;
  const kind = String(ctx.structNode.attrs.kind || "");
  const attrs = ctx.structNode.attrs.attrs || {};
  let target = -1;

  if (kind === "subsup") {
    const order = [2, 0, 1]; // visual: power → base → subscript
    const i = order.indexOf(ctx.slotIndex);
    if (i >= 0) target = order[i + dir] ?? -1;
  } else if (kind === "fraction") {
    target = ctx.slotIndex + dir;
  } else if (kind === "power") {
    const order = [1, 0];
    const i = order.indexOf(ctx.slotIndex);
    if (i >= 0) target = order[i + dir] ?? -1;
  } else if (kind === "sub") {
    const order = [0, 1];
    const i = order.indexOf(ctx.slotIndex);
    if (i >= 0) target = order[i + dir] ?? -1;
  } else if (kind === "matrix") {
    const rows = Math.max(1, Math.floor(Number(attrs.rows) || 1));
    const cols = Math.max(1, Math.floor(Number(attrs.cols) || ctx.structNode.childCount || 1));
    const row = Math.floor(ctx.slotIndex / cols);
    const col = ctx.slotIndex % cols;
    const nextRow = row + dir;
    if (nextRow >= 0 && nextRow < rows) target = nextRow * cols + col;
  } else {
    target = ctx.slotIndex + dir;
  }

  if (target < 0 || target >= ctx.structNode.childCount) return false;
  return moveToSlot(view, ctx, target);
}

function exitOneMathBranch(view: any): boolean {
  const ctx = slotContext(view.state);
  if (!ctx) return false;
  const afterStruct = ctx.structStart + ctx.structNode.nodeSize;
  const tr = view.state.tr;
  setSelectionNear(view, tr, afterStruct);
  return true;
}

function moveEmptyPowerToSubscript(view: any): boolean {
  const ctx = slotContext(view.state);
  if (!ctx) return false;
  if (ctx.structNode.attrs.kind !== "subsup") return false;
  if (ctx.slotIndex !== 2) return false;
  if (ctx.slotNode.content.size !== 0) return false;
  return moveToSlot(view, ctx, 1);
}

/** `#` while the caret sits in a script branch.
 *  Empty branch  → switch to the sibling branch (this is the `##` gesture).
 *  Filled branch → return false so the normal wrap runs and the script nests,
 *  which is what lets `x #2 #5 #n` build a tree of unlimited depth. */
function hashInsideScript(view: any): boolean {
  const ctx = slotContext(view.state);
  if (!ctx) return false;
  const kind = String(ctx.structNode.attrs.kind || "");
  if (kind !== "subsup" && kind !== "power" && kind !== "sub") return false;
  if (ctx.slotIndex < 1) return false; // base slot → normal wrap is fine
  if (ctx.slotNode.content.size !== 0) return false; // has content → allow nesting
  if (kind === "subsup") {
    return moveToSlot(view, ctx, ctx.slotIndex === 2 ? 1 : 2);
  }
  // power / sub have a single script branch — nothing to switch to.
  return true;
}



function termRangeLeftOfSelection(state: any): { from: number; to: number } | null {
  const { $from, empty } = state.selection;
  if (!empty) return null;
  const parent = $from.parent;
  const parentOffset = $from.parentOffset;
  if (parentOffset <= 0) return null;

  const before = parent.childBefore(parentOffset);
  if (!before.node) return null;
  const parentStart = $from.start();
  const offsetInsideNode = parentOffset - before.offset;

  if (before.node.isText) {
    const text = (before.node.text || "").slice(0, offsetInsideNode);
    if (!isValidParentChar(text[text.length - 1])) return null;
    const startInText = findLastTermStart(text, text.length);
    if (startInText >= text.length) return null;
    return {
      from: parentStart + before.offset + startInText,
      to: $from.pos,
    };
  }

  if (before.node.isInline) {
    return {
      from: parentStart + before.offset,
      to: parentStart + before.offset + before.node.nodeSize,
    };
  }

  return null;
}

function wrapLeftTermInStructure(view: any, kind: "subsup" | "fraction", targetSlot: number): boolean {
  const { state } = view;
  const schema = state.schema;
  const mathStructure = schema.nodes.mathStructure;
  const mathSlot = schema.nodes.mathSlot;
  if (!mathStructure || !mathSlot) return false;

  const range = termRangeLeftOfSelection(state);
  if (!range) return false;

  const slice = state.doc.slice(range.from, range.to);
  const baseOrNumerator = mathSlot.create(null, slice.content);
  const children = kind === "subsup"
    ? [baseOrNumerator, mathSlot.create(), mathSlot.create()]
    : [baseOrNumerator, mathSlot.create()];

  const node = mathStructure.create({ kind, attrs: {} }, children);
  const tr = state.tr.replaceWith(range.from, range.to, node);
  const targetPos = slotInnerPos(range.from, node, targetSlot);
  setSelectionNear(view, tr, targetPos);
  return true;
}

/** Prose-level `#`: turn the plain-text term left of the caret into a real
 *  `mathInline` node whose base holds that term, opening with the caret in
 *  the (empty) power slot. `##` is then handled inside the math canvas. */
function wrapProseTermInMathNode(view: any): boolean {
  const { state } = view;
  const mathInline = state.schema.nodes.mathInline;
  if (!mathInline) return false;

  const range = termRangeLeftOfSelection(state);
  if (!range) return false;

  const text = state.doc.textBetween(range.from, range.to, "");
  if (!text) return false;

  const base: Row = [...text].map((c) => mkChar(c));
  const root: Row = [{ ...(mkSubSup() as Extract<ReturnType<typeof mkSubSup>, { kind: "subsup" }>), rows: [base, [], []] }];

  const node = mathInline.create({
    value: treeToLatex(root),
    tree: JSON.stringify(root),
    autoEdit: true,
    entry: JSON.stringify({ path: [0, 2], index: 0 }),
  });

  view.dispatch(state.tr.replaceWith(range.from, range.to, node));
  return true;
}

export const MathKeyShortcuts = Extension.create({
  name: "mathKeyShortcuts",

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key,
        state: {
          init: (): PluginState => ({ lastPair: null }),
          apply: (tr, prev): PluginState => {
            const meta = tr.getMeta(key);
            let next = prev;
            if (meta) next = { ...next, ...meta };
            if (tr.docChanged && !meta && next.lastPair) {
              next = { ...next, lastPair: null };
            }
            return next;
          },
        },
        props: {
          handleKeyDown(view, event) {
            const s = key.getState(view.state) as PluginState;

            const ch = event.key;

            // Bracket pairing.
            if (OPEN_CLOSE[ch] && !event.ctrlKey && !event.metaKey && !event.altKey) {
              const { from, to, empty } = view.state.selection;
              const opener = ch;
              const closer = OPEN_CLOSE[ch];
              const tr = view.state.tr;
              if (empty) {
                tr.insertText(opener + closer, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
                tr.setMeta(key, { lastPair: { closerPos: from + 1, closer } });
              } else {
                const before = view.state.doc.textBetween(from, to, "\ufffc");
                tr.insertText(opener + before + closer, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + 1, from + 1 + before.length));
                tr.setMeta(key, { lastPair: null });
              }
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // Overtype matching closer.
            if ((ch === ")" || ch === "]" || ch === "}" || ch === "|") &&
                !event.ctrlKey && !event.metaKey && !event.altKey) {
              const { from, empty } = view.state.selection;
              if (empty) {
                const next = view.state.doc.textBetween(
                  from,
                  Math.min(from + 1, view.state.doc.content.size),
                );
                if (next === ch) {
                  view.dispatch(view.state.tr.setSelection(
                    TextSelection.create(view.state.doc, from + 1),
                  ));
                  event.preventDefault();
                  return true;
                }
              }
            }

            // Backspace immediately after an autopair → delete both.
            if (event.key === "Backspace" && s.lastPair) {
              const { from, empty } = view.state.selection;
              if (empty && from === s.lastPair.closerPos) {
                const tr = view.state.tr.delete(from - 1, from + 1);
                tr.setMeta(key, { lastPair: null });
                view.dispatch(tr);
                event.preventDefault();
                return true;
              }
            }

            // Space exits one editable math branch. At prose level it remains
            // a real space.
            if (ch === " " && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
              if (exitOneMathBranch(view)) {
                event.preventDefault();
                return true;
              }
            }

            // Up/down move between sibling branches of the current structure.
            if ((ch === "ArrowUp" || ch === "ArrowDown") && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
              if (moveVerticalSlot(view, ch === "ArrowUp" ? -1 : 1)) {
                event.preventDefault();
                return true;
              }
            }

            // `#` creates or re-enters editable script branches.
            if (ch === "#" && !event.ctrlKey && !event.metaKey && !event.altKey) {
              if (moveEmptyPowerToSubscript(view) ||
                  hashInsideScript(view) ||
                  wrapLeftTermInStructure(view, "subsup", 2) ||
                  wrapProseTermInMathNode(view)) {
                event.preventDefault();
                return true;
              }
              return false;
            }

            // `/` → smart fraction on the last term.
            if (ch === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
              if (!wrapLeftTermInStructure(view, "fraction", 1)) return false;
              event.preventDefault();
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
