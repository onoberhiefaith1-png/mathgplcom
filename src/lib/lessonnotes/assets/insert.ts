// Shared insertion logic used by both the @-command menu and the Asset
// Library gallery. Keeping this in ONE place guarantees identical behaviour
// (cursor placement, slot creation, focus) regardless of entry point.

import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import type { AssetDef } from "./types";
import { requiredSlotCount, validateStructure } from "@/lib/lessonnotes/structureValidator";
import { pushRecent } from "./recents";

/**
 * Insert an asset into the editor. If `from`/`to` are provided the range is
 * replaced (used by @-command); otherwise the asset is inserted at the
 * current selection.
 */
export function insertAsset(editor: Editor, a: AssetDef, from?: number, to?: number) {
  try { pushRecent(a.id); } catch { /* noop */ }
  const r = a.render;
  const hasRange = typeof from === "number" && typeof to === "number";
  const chain = editor.chain().focus();

  if (r.kind === "symbol") {
    if (hasRange) chain.insertContentAt({ from: from!, to: to! }, r.char).run();
    else chain.insertContent(r.char).run();
    return;
  }

  if (r.kind === "structure") {
    // Slot count is derived from the structure kind + attrs (matrix uses
    // rows*cols, piecewise uses rows*2, etc.). The asset def's static
    // `slots` count is only used as a fallback.
    const needed = Math.max(1, requiredSlotCount(r.structure, r.attrs) || r.slots);
    const slots = Array.from({ length: needed }).map(() => ({ type: "mathSlot", content: [] }));
    let content: any = {
      type: "mathStructure",
      attrs: { kind: r.structure, attrs: r.attrs ?? {} },
      content: slots,
    };
    // Repair before dispatch — guarantees no malformed structure enters the doc.
    const check = validateStructure(content);
    if (check.ok === false) content = check.fix;
    const anchor = hasRange ? from! : editor.state.selection.from;
    if (hasRange) chain.insertContentAt({ from: from!, to: to! }, content).run();
    else chain.insertContent(content).run();

    // Deterministically land the caret inside the first slot. Do this
    // synchronously so a subsequent keystroke lands in the slot, not after
    // the structure.
    const { state, view } = editor;
    let target = anchor + 2; // enter structure + enter first slot
    let inSlot = false;
    try {
      const $pos = state.doc.resolve(Math.min(target, state.doc.content.size));
      for (let d = $pos.depth; d >= 0; d--) {
        if ($pos.node(d).type.name === "mathSlot") { inSlot = true; break; }
      }
    } catch { /* fall through */ }
    if (!inSlot) {
      state.doc.descendants((node, pos) => {
        if (inSlot) return false;
        if (pos >= anchor && node.type.name === "mathSlot") {
          target = pos + 1;
          inSlot = true;
          return false;
        }
        return true;
      });
    }
    try {
      const sel = TextSelection.create(state.doc, target);
      view.dispatch(state.tr.setSelection(sel).scrollIntoView());
      view.focus();
    } catch {
      editor.commands.setTextSelection(target);
    }
    return;
  }

  if (r.kind === "visual") {
    const content = {
      type: "mathVisual",
      attrs: { family: r.visual, attrs: r.attrs ?? {} },
    };
    if (hasRange) chain.insertContentAt({ from: from!, to: to! }, content).run();
    else chain.insertContent(content).run();
    return;
  }
  if (r.kind === "node") {
    // A saved Asset Library object: insert the stored node verbatim, so the
    // teacher gets back the exact same live diagram they saved.
    if (!r.node) return;
    const clone = JSON.parse(JSON.stringify(r.node));
    if (clone?.attrs?.attrs && typeof clone.attrs.attrs === "object") {
      // Drop the per-instance id so the copy gets a fresh one.
      delete clone.attrs.attrs.__instanceId;
    }
    if (hasRange) chain.insertContentAt({ from: from!, to: to! }, clone).run();
    else chain.insertContent(clone).run();
    return;
  }
}
