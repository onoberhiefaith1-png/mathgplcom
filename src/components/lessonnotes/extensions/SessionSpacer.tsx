// SessionSpacer — invisible flow block that reserves the vertical space of a
// session that has been lifted out of the flow into its own canvas frame.
//
// Why it exists: a moved session is absolutely positioned, so the page flow no
// longer knows how tall it is and the sessions underneath would be covered by
// it. The spacer stays behind at the exact place the session came from and its
// height mirrors the frame's real measured height, so every session below is
// pushed down by the browser itself — automatically, cascading, and with no
// fixed coordinates anywhere.

import { Node, mergeAttributes } from "@tiptap/core";

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const SessionSpacer = Node.create({
  name: "sessionSpacer",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      /** Measured height of the frame this spacer reserves room for. */
      h: { default: 0, parseHTML: (el) => num(el.getAttribute("data-h")) },
      /** Link to the frame: canvasFrame.spacerId === sessionSpacer.spacerId. */
      spacerId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-spacer-id"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-session-spacer]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const h = Math.max(0, num(node.attrs.h));
    const id = (node.attrs.spacerId as string | null) ?? null;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-session-spacer": "",
        "data-h": String(Math.round(h)),
        ...(id ? { "data-spacer-id": id } : {}),
        class: "lesson-session-spacer",
        style: `height:${Math.round(h)}px;`,
        contenteditable: "false",
      }),
    ];
  },
});

export default SessionSpacer;
