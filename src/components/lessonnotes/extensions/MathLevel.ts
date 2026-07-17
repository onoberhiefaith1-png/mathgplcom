// Natural inline superscript / subscript via a numeric "level" mark on
// ordinary prose. Not a container, not an atom — every character is
// individually editable, selectable, deletable. Unlimited nesting because
// levels are just integers.
//
//   level  0  → baseline
//   level +1  → superscript
//   level +2  → superscript of superscript
//   level -1  → subscript
//   level -n  → deeper subscripts
//
// Keyboard:
//   `#`     raise active level +1 (the `#` itself is never inserted)
//   `##`    from baseline: net −1 (subscript). Rule: a second `#` while
//           `pendingHash` is set drops the level by 2. Works recursively.
//   `↑`     raise +1 without typing
//   `↓`     lower −1 without typing
//   Space   if active level ≠ 0 → reset to 0 (space is consumed).
//           At baseline → normal space.
//
// Rendering: single `<span data-mlvl="{n}">` with inline font-size and
// translateY. Level 0 is stripped so we never wrap plain text.

import { Mark, mergeAttributes, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const LEVEL_SCALE = 0.75;   // font-size multiplier per level
const LEVEL_SHIFT = 0.45;   // em translateY per level (positive = up)

function styleFor(level: number): string {
  if (!level) return "";
  const size = Math.pow(LEVEL_SCALE, Math.abs(level));
  const shift = -LEVEL_SHIFT * level; // negative Y = up in CSS
  return `font-size:${size.toFixed(3)}em;display:inline-block;transform:translateY(${shift.toFixed(3)}em);line-height:1;`;
}

export const MathLevelMark = Mark.create<{}, { level: number }>({
  name: "mathLevel",
  inclusive: true,
  excludes: "",
  spanning: true,

  addAttributes() {
    return {
      level: {
        default: 0,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-mlvl");
          const n = raw == null ? 0 : parseInt(raw, 10);
          return Number.isFinite(n) ? n : 0;
        },
        renderHTML: (attrs) => {
          const level = Number(attrs.level) || 0;
          if (!level) return {};
          return { "data-mlvl": String(level), style: styleFor(level) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-mlvl]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

// -------------------------------------------------------------------------
// Input plugin: intercepts `#`, `Space`, `ArrowUp`, `ArrowDown`, applies the
// current active level to typed characters.

interface Session {
  activeLevel: number;
  pendingHash: boolean;
}

const key = new PluginKey<Session>("mathLevelInput");

function markType(schema: any) {
  return schema.marks.mathLevel;
}

/** Read the level of the mark on the character left of the caret. */
function levelAtCaret(state: any): number {
  const { $from, empty } = state.selection;
  if (!empty) return 0;
  const mt = markType(state.schema);
  if (!mt) return 0;
  // Marks stored to the left of the cursor:
  const marks = $from.nodeBefore?.marks ?? $from.marks();
  const m = marks.find((mk: any) => mk.type === mt);
  return m ? Number(m.attrs.level) || 0 : 0;
}

function applyLevelToNextInput(view: any, level: number) {
  const mt = markType(view.state.schema);
  if (!mt) return;
  const tr = view.state.tr;
  if (level === 0) {
    tr.removeStoredMark(mt);
  } else {
    tr.setStoredMark([mt.create({ level })]);
  }
  view.dispatch(tr);
}

export const MathLevelInput = Extension.create({
  name: "mathLevelInput",

  addProseMirrorPlugins() {
    return [
      new Plugin<Session>({
        key,
        state: {
          init: () => ({ activeLevel: 0, pendingHash: false }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(key);
            if (meta) return { ...prev, ...meta };
            // Selection change: refresh activeLevel from caret context.
            if (tr.selectionSet && !tr.docChanged) {
              return { ...prev, pendingHash: false };
            }
            return prev;
          },
        },
        props: {
          handleTextInput(view, from, to, text) {
            if (text.length !== 1) return false;
            const ch = text;
            const session = key.getState(view.state)!;
            const mt = markType(view.state.schema);
            if (!mt) return false;

            // `#` — level control key, never inserted.
            if (ch === "#") {
              let nextLevel: number;
              let nextPending: boolean;
              if (session.pendingHash) {
                // Second `#` in a row: drop by 2 (net effect vs baseline: −1).
                nextLevel = session.activeLevel - 2;
                nextPending = false;
              } else {
                nextLevel = session.activeLevel + 1;
                nextPending = true;
              }
              applyLevelToNextInput(view, nextLevel);
              view.dispatch(view.state.tr.setMeta(key, {
                activeLevel: nextLevel,
                pendingHash: nextPending,
              }));
              return true;
            }

            // Space at non-zero level → exit to baseline; consume the space.
            if (ch === " " && session.activeLevel !== 0) {
              applyLevelToNextInput(view, 0);
              view.dispatch(view.state.tr.setMeta(key, {
                activeLevel: 0,
                pendingHash: false,
              }));
              return true;
            }

            // Regular character: insert with current active mark applied via
            // stored mark. Let ProseMirror do the insertion (return false),
            // but first ensure storedMarks match activeLevel.
            const desired = session.activeLevel;
            const stored = view.state.storedMarks?.find((m) => m.type === mt);
            const storedLevel = stored ? Number(stored.attrs.level) || 0 : 0;
            if (storedLevel !== desired) {
              applyLevelToNextInput(view, desired);
            }
            if (session.pendingHash) {
              view.dispatch(view.state.tr.setMeta(key, { pendingHash: false }));
            }
            return false;
          },

          handleKeyDown(view, event) {
            const session = key.getState(view.state)!;

            if (event.key === "ArrowUp" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
              const next = session.activeLevel + 1;
              applyLevelToNextInput(view, next);
              view.dispatch(view.state.tr.setMeta(key, { activeLevel: next, pendingHash: false }));
              event.preventDefault();
              return true;
            }
            if (event.key === "ArrowDown" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
              const next = session.activeLevel - 1;
              applyLevelToNextInput(view, next);
              view.dispatch(view.state.tr.setMeta(key, { activeLevel: next, pendingHash: false }));
              event.preventDefault();
              return true;
            }

            // On horizontal caret motion, re-sync activeLevel to whatever the
            // caret now sits next to.
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              // Defer: read after browser applies the selection change.
              setTimeout(() => {
                const lvl = levelAtCaret(view.state);
                applyLevelToNextInput(view, lvl);
                view.dispatch(view.state.tr.setMeta(key, { activeLevel: lvl, pendingHash: false }));
              }, 0);
              return false;
            }

            if (event.key === "Enter") {
              applyLevelToNextInput(view, 0);
              view.dispatch(view.state.tr.setMeta(key, { activeLevel: 0, pendingHash: false }));
              return false;
            }

            return false;
          },
        },
      }),
    ];
  },
});
