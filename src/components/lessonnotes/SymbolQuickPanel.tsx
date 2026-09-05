// Symbols quick-access palette — a docked right-hand panel in the lesson note.
import { useT } from "@/lib/i18n/LanguageProvider";
//
// Same shell as the Matrix panel and the Emoji Library: it SHARES the editor
// width instead of covering the page. One click inserts at the caret and the
// panel stays open, so a teacher never leaves the writing flow.

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterSymbolCategories,
  type QuickStructItem,
  type QuickSymbolItem,
} from "@/lib/lessonnotes/symbolQuick";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Plain characters inserted at the caret. */
  onInsertText: (value: string) => void;
  /** Real editable structure inserted at the caret. */
  onInsertStructure: (item: QuickStructItem) => void;
}

export function SymbolQuickPanel({ open, onClose, onInsertText, onInsertStructure }: Props) {
  const [q, setQ] = useState("");
  if (!open) return null;

  const cats = filterSymbolCategories(q);

  const t = useT();
  const click = (it: QuickSymbolItem) => {
    if (it.kind === "text") onInsertText(it.value);
    else onInsertStructure(it);
  };

  return (
    <aside
      aria-label="Symbols quick access"
      className="shrink-0 border-l border-border bg-background flex flex-col min-h-0 h-full self-stretch overscroll-contain"
      style={{ width: "clamp(280px, 30%, 420px)" }}
    >
      <div className="h-11 px-3 flex items-center justify-between border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          {t("editor_symbols")}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close symbols panel"
          aria-label="Close symbols panel"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted/60 text-foreground/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a symbol…"
          className="w-full h-8 rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
        {cats.map((c) => (
          <section key={c.id} className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {c.name}
            </p>
            <div className="flex flex-wrap gap-1">
              {c.items.map((it, i) => (
                <button
                  key={`${c.id}-${i}`}
                  type="button"
                  title={it.title ?? it.label}
                  onClick={() => click(it)}
                  className={cn(
                    "rounded border border-border bg-background px-2 h-8 min-w-8",
                    "text-sm leading-none text-foreground hover:bg-muted",
                  )}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </section>
        ))}
        {cats.length === 0 && (
          <p className="text-xs text-muted-foreground">No symbol matches that search.</p>
        )}
      </div>
    </aside>
  );
}
