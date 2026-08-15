// CanvasFrame — free-positioned block of lesson content.
//
// The Sensor is the master of the lesson-note canvas: when it is parked in
// free space (not inside the flowing note body) everything it inserts — typed
// text, a section, a session, a subtopic — is created inside one of these
// frames at that exact paper coordinate.
//
// It is a real ProseMirror node (not an overlay), so the caret, selection,
// math nodes, history, autosave, AI context and DOCX export all keep working
// with no new storage. Rendering is absolute, so a frame never pushes or
// compresses the flowing content around it.

import { Node, mergeAttributes } from "@tiptap/core";

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const CanvasFrame = Node.create({
  name: "canvasFrame",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      x: { default: 0, parseHTML: (el) => num(el.getAttribute("data-x")) },
      y: { default: 0, parseHTML: (el) => num(el.getAttribute("data-y")) },
      w: { default: 420, parseHTML: (el) => num(el.getAttribute("data-w"), 420) },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-canvas-frame]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const x = num(node.attrs.x);
    const y = num(node.attrs.y);
    const w = num(node.attrs.w, 420);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-canvas-frame": "",
        "data-x": String(x),
        "data-y": String(y),
        "data-w": String(w),
        class: "lesson-canvas-frame",
        style: `position:absolute;left:${x}px;top:${y}px;width:${w}px;`,
      }),
      0,
    ];
  },
});

export default CanvasFrame;
