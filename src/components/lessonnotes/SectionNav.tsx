// Persistent Lesson Note section navigation.
//
// This is navigation ONLY. Clicking an entry scrolls the note to that heading
// and parks the caret there. It never reloads the editor, never rewrites the
// document, never touches the Co-Pilot session and never triggers generation,
// so it can never pause or lock the workspace.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { detectSectionKind, SECTION_LABELS } from "@/lib/lessonnotes/sectionKinds";
import { cn } from "@/lib/utils";

interface Entry {
  pos: number;
  label: string;
}

/** Read the note's real outline: every top-level heading in document order. */
function readOutline(editor: Editor | null): Entry[] {
  if (!editor || editor.isDestroyed) return [];
  const seen = new Map<string, number>();
  const out: Entry[] = [];
  try {
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "heading") return true;
      const text = (node.textContent || "").trim();
      if (!text) return false;
      const kind = detectSectionKind(text);
      const base = kind ? SECTION_LABELS[kind] : text;
      const short = base.length > 22 ? `${base.slice(0, 21)}…` : base;
      const n = (seen.get(short) ?? 0) + 1;
      seen.set(short, n);
      out.push({ pos, label: n > 1 ? `${short} ${n}` : short });
      return false;
    });
  } catch {
    return out;
  }
  return out;
}

export function SectionNav({ editor }: { editor: Editor | null }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      if (raf.current) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = 0;
        setEntries(readOutline(editor));
      });
    };
    refresh();
    // "transaction" (not "update") so a programmatic setContent — how a saved
    // note is loaded — also refreshes the outline.
    editor.on("transaction", refresh);
    return () => {
      editor.off("transaction", refresh);
      if (raf.current) window.cancelAnimationFrame(raf.current);
    };
  }, [editor]);

  // Highlight the section the caret currently sits in.
  useEffect(() => {
    if (!editor) return;
    const onSel = () => {
      const at = editor.state.selection.from;
      let current: number | null = null;
      for (const e of entries) {
        if (e.pos <= at) current = e.pos;
        else break;
      }
      setActivePos(current);
    };
    onSel();
    editor.on("selectionUpdate", onSel);
    return () => { editor.off("selectionUpdate", onSel); };
  }, [editor, entries]);

  const goTo = useCallback((pos: number) => {
    if (!editor || editor.isDestroyed) return;
    try {
      const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
      (dom ?? editor.view.domAtPos(pos).node as HTMLElement | null)
        ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      editor.chain().focus().setTextSelection(pos + 1).run();
      setActivePos(pos);
    } catch { /* navigation must never break the workspace */ }
  }, [editor]);

  const items = useMemo(() => entries, [entries]);
  if (!items.length) return null;

  return (
    <nav
      aria-label="Lesson note sections"
      className="flex items-center gap-1 overflow-x-auto border-b border-foreground/10 bg-background/95 px-3 py-1 backdrop-blur"
    >
      <span className="shrink-0 pr-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        Sections
      </span>
      {items.map((e) => (
        <button
          key={e.pos}
          type="button"
          onClick={() => goTo(e.pos)}
          title={`Go to ${e.label}`}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            activePos === e.pos
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
          )}
        >
          {e.label}
        </button>
      ))}
    </nav>
  );
}

export default SectionNav;
