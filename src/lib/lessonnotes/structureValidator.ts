// Structural validator for `mathStructure` nodes. Given a JSON snapshot of
// a `mathStructure` node (or a live PM node) it either passes or returns a
// repaired JSON node with the correct number of mathSlot children and the
// required decorative attrs (index for cube root, op for big ops, etc.).
//
// The validator NEVER touches slot CONTENT except to add empty slots or
// drop trailing slots that are outside the declared shape. Cell text the
// teacher typed is preserved.

import type { Node as PMNode } from "@tiptap/pm/model";

export interface SlotJson {
  type: "mathSlot";
  content?: Array<{ type: "text"; text: string }>;
}

export interface StructureJson {
  type: "mathStructure";
  attrs: {
    kind: string;
    attrs?: Record<string, unknown>;
  };
  content?: SlotJson[];
}

const BIGOP_ALLOWED = new Set(["∑", "∏", "∫", "∬", "∮", "⊕", "⊗", "⋃", "⋂"]);
const BRACKET_ALLOWED = new Set(["(", "[", "{", "|"]);

/** Slot count required for each fixed-shape structure. */
const FIXED_SLOTS: Record<string, number> = {
  fraction: 2, slanted: 2, mixed: 3,
  sqrt: 1, cuberoot: 1, nroot: 2,
  power: 2, sub: 2, subsup: 3,
  log: 2, ln: 1,
  paren: 1, sqbracket: 1, brace: 1,
  abs: 1, norm: 1, floor: 1, ceil: 1,
  vector: 1, accent: 1,
  bigop: 3, limit: 2,
  deriv: 2, partial: 2, evalbar: 3,
  binom: 2, longdiv: 3,
  poly: 1, func: 2,
};

/** Empty slot literal. */
const emptySlot = (): SlotJson => ({ type: "mathSlot" });

/** Clone slots to a target length, padding with empty slots and truncating. */
function reshapeSlots(slots: SlotJson[], target: number): SlotJson[] {
  const out = slots.slice(0, target);
  while (out.length < target) out.push(emptySlot());
  return out.map((s) => (s && s.type === "mathSlot" ? s : emptySlot()));
}

/** Convert a live PM node to a JSON-ish snapshot for validation. */
export function nodeToJson(node: PMNode): StructureJson {
  const content: SlotJson[] = [];
  node.forEach((slot) => {
    if (slot.type.name !== "mathSlot") return;
    const j: SlotJson = { type: "mathSlot" };
    const text = slot.textContent;
    if (text) j.content = [{ type: "text", text }];
    content.push(j);
  });
  return {
    type: "mathStructure",
    attrs: {
      kind: (node.attrs.kind as string) || "fraction",
      attrs: { ...((node.attrs.attrs as Record<string, unknown>) || {}) },
    },
    content,
  };
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; fix: StructureJson };

/**
 * Validate a mathStructure JSON. Returns {ok:true} if the shape is already
 * canonical, or {ok:false, fix} with a repaired node otherwise.
 */
export function validateStructure(input: StructureJson): ValidationResult {
  const kind = input.attrs?.kind || "fraction";
  const rawAttrs = { ...(input.attrs?.attrs || {}) };
  const slots = (input.content ?? []).filter((c) => c?.type === "mathSlot");
  let changed = false;

  // Matrix: slot count MUST equal rows*cols.
  if (kind === "matrix") {
    let rows = Math.max(1, Math.floor(Number(rawAttrs.rows) || 0));
    let cols = Math.max(1, Math.floor(Number(rawAttrs.cols) || 0));

    // Derive missing dims from the slot count if attrs are stale.
    if (!rawAttrs.rows || !rawAttrs.cols) {
      const n = slots.length || 1;
      // Fall back to a 1×n row vector; caller supplies real dims on insert.
      if (!rawAttrs.rows) rows = 1;
      if (!rawAttrs.cols) cols = n;
      changed = true;
    }
    rows = Math.max(1, Math.min(64, rows));
    cols = Math.max(1, Math.min(64, cols));

    const needed = rows * cols;
    if (slots.length !== needed) changed = true;
    const nextSlots = reshapeSlots(slots, needed);

    let br = String(rawAttrs.br || "(");
    if (!BRACKET_ALLOWED.has(br)) { br = "("; changed = true; }

    const nextAttrs: Record<string, unknown> = { rows, cols, br };
    if (typeof rawAttrs.divider === "number") {
      const d = Math.max(1, Math.min(cols - 1, Math.floor(rawAttrs.divider)));
      if (cols >= 2) nextAttrs.divider = d;
      if (d !== rawAttrs.divider) changed = true;
    }
    if (rawAttrs.locked) nextAttrs.locked = true;
    if (rawAttrs.template) nextAttrs.template = rawAttrs.template;

    if (rawAttrs.rows !== rows || rawAttrs.cols !== cols) changed = true;

    if (!changed) return { ok: true };
    return {
      ok: false,
      fix: {
        type: "mathStructure",
        attrs: { kind, attrs: nextAttrs },
        content: nextSlots,
      },
    };
  }

  // Big operator: preserve op, enforce 3 slots.
  if (kind === "bigop") {
    let op = String(rawAttrs.op || "∑");
    if (!BIGOP_ALLOWED.has(op)) { op = "∑"; changed = true; }
    const needed = 3;
    if (slots.length !== needed) changed = true;
    const nextSlots = reshapeSlots(slots, needed);
    if (!changed) return { ok: true };
    return {
      ok: false,
      fix: {
        type: "mathStructure",
        attrs: { kind, attrs: { ...rawAttrs, op } },
        content: nextSlots,
      },
    };
  }

  // Cube root: force attrs.index === "3".
  if (kind === "cuberoot") {
    if (rawAttrs.index !== "3") { rawAttrs.index = "3"; changed = true; }
  }
  // Square root: strip any leftover index.
  if (kind === "sqrt" && "index" in rawAttrs) {
    delete rawAttrs.index;
    changed = true;
  }

  // Piecewise / system: rows attr drives slot count (rows*2 for piecewise,
  // rows*1 for a system) — we treat missing rows as 2.
  if (kind === "piecewise") {
    const r = Math.max(1, Math.min(12, Math.floor(Number(rawAttrs.rows) || 2)));
    const needed = r * 2;
    if (r !== rawAttrs.rows) { rawAttrs.rows = r; changed = true; }
    if (slots.length !== needed) changed = true;
    const nextSlots = reshapeSlots(slots, needed);
    if (!changed) return { ok: true };
    return {
      ok: false,
      fix: {
        type: "mathStructure",
        attrs: { kind, attrs: rawAttrs },
        content: nextSlots,
      },
    };
  }
  if (kind === "system") {
    const r = Math.max(1, Math.min(12, Math.floor(Number(rawAttrs.rows) || 2)));
    const needed = r;
    if (r !== rawAttrs.rows) { rawAttrs.rows = r; changed = true; }
    if (slots.length !== needed) changed = true;
    const nextSlots = reshapeSlots(slots, needed);
    if (!changed) return { ok: true };
    return {
      ok: false,
      fix: {
        type: "mathStructure",
        attrs: { kind, attrs: rawAttrs },
        content: nextSlots,
      },
    };
  }

  // Fixed-shape structures.
  const need = FIXED_SLOTS[kind];
  if (typeof need === "number") {
    if (slots.length !== need) changed = true;
    const nextSlots = reshapeSlots(slots, need);
    if (!changed) return { ok: true };
    return {
      ok: false,
      fix: {
        type: "mathStructure",
        attrs: { kind, attrs: rawAttrs },
        content: nextSlots,
      },
    };
  }

  // Unknown kind: leave content alone but keep it non-empty.
  if (slots.length === 0) {
    return {
      ok: false,
      fix: {
        type: "mathStructure",
        attrs: { kind, attrs: rawAttrs },
        content: [emptySlot()],
      },
    };
  }
  return { ok: true };
}

/**
 * Return the required slot count for a given structure kind + attrs. Used
 * by insertAsset to build the right number of slots up front.
 */
export function requiredSlotCount(kind: string, attrs: Record<string, unknown> | undefined): number {
  if (kind === "matrix") {
    const r = Math.max(1, Math.floor(Number(attrs?.rows) || 0));
    const c = Math.max(1, Math.floor(Number(attrs?.cols) || 0));
    if (r && c) return r * c;
  }
  if (kind === "piecewise") {
    const r = Math.max(1, Math.floor(Number(attrs?.rows) || 2));
    return r * 2;
  }
  if (kind === "system") {
    const r = Math.max(1, Math.floor(Number(attrs?.rows) || 2));
    return r;
  }
  const n = FIXED_SLOTS[kind];
  return typeof n === "number" ? n : 1;
}
