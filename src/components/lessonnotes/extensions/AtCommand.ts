// TipTap extension that watches for `@` in the document and exposes a
// live "at-command" state (query, coords, from, to) to a mounted
// AtCommandMenu component. We deliberately avoid @tiptap/suggestion to
// keep the surface small — a single ProseMirror plugin does the job.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface AtCommandState {
  active: boolean;
  query: string;
  from: number;
  to: number;
  coords: { left: number; top: number; bottom: number } | null;
}

export type AtCommandListener = (state: AtCommandState) => void;

const key = new PluginKey<AtCommandState>("atCommand");

export const AtCommand = Extension.create<{ onChange?: AtCommandListener }>({
  name: "atCommand",

  addOptions() { return { onChange: undefined }; },

  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin<AtCommandState>({
        key,
        state: {
          init: () => ({ active: false, query: "", from: 0, to: 0, coords: null }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(key);
            if (meta) return meta as AtCommandState;
            // If doc changed, invalidate.
            if (tr.docChanged && prev.active) {
              // Try to update range by mapping.
              const from = tr.mapping.map(prev.from);
              const to = tr.mapping.map(prev.to);
              return { ...prev, from, to };
            }
            return prev;
          },
        },
        view: (view) => {
          const emit = () => {
            const s = key.getState(view.state);
            if (s) opts.onChange?.(s);
          };
          return {
            update: (v, prev) => {
              if (v.state.doc.eq(prev.doc) && v.state.selection.eq(prev.selection)) {
                // still emit if plugin state changed
                if (key.getState(v.state) !== key.getState(prev)) emit();
                return;
              }
              // Detect an active @token immediately before the caret.
              const { $from } = v.state.selection;
              const textBefore = $from.parent.textBetween(
                Math.max(0, $from.parentOffset - 40),
                $from.parentOffset,
                undefined, "\ufffc",
              );
              const match = /(?:^|\s)@([\w-]*)$/.exec(textBefore);
              if (match) {
                const query = match[1];
                const to = $from.pos;
                const from = to - (query.length + 1);
                const coords = v.coordsAtPos(to);
                const tr = v.state.tr.setMeta(key, { active: true, query, from, to, coords });
                v.dispatch(tr);
                return;
              }
              const cur = key.getState(v.state);
              if (cur?.active) {
                v.dispatch(v.state.tr.setMeta(key, { active: false, query: "", from: 0, to: 0, coords: null }));
              }
            },
            destroy: () => { /* noop */ },
          };
        },
      }),
    ];
  },
});

export const atCommandPluginKey = key;
