// Per-line math editor.
//
// Replaces the "raw textarea hidden under a math overlay" model. Every line
// is always rendered as real classroom math (stacked fractions, real
// radicals, true sub/superscripts). Clicking a line turns ONLY that single
// line into a one-row text input — and even that input shows the friendly
// form (1⁄2, √(x), ³√(x)) instead of LaTeX commands. On commit we convert
// the friendly text back to storage form so the renderer keeps drawing
// proper stacked math.
//
// Keyboard:
//   Enter       commit + split below (focus new line)
//   Shift+Enter commit (stay)
//   Backspace   merge with previous line when at column 0 of an empty/first-char
//   ArrowUp/Dn  commit + move active line
//   Escape      cancel edit + restore
//
// Click on the empty area below the last line: adds a new empty line and
// focuses it. This is the smartboard-feeling per-line workflow teachers
// asked for.

import { useEffect, useRef, useState, useCallback, useContext, createContext } from "react";
import { cn } from "@/lib/utils";
import { renderMathInline, mathLineMinHeight, HAS_MATH } from "@/lib/notebook/mathRender";
import { latexToFriendly, friendlyToLatex, stripLatexScaffolding } from "@/lib/notebook/mathFriendly";

/* ---------- font context (shared with the rest of the editor) ---------- */
export const HandwritingFontContext = createContext<string>(
  "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
);

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  italic?: boolean;
  /** Color applied to rendered + input text. */
  color?: string;
  /** When true, the component renders at least this many rows even if value is shorter. */
  minRows?: number;
  /** Extra className on the outer wrapper. */
  className?: string;
  /** Called when any line gains focus (parent uses this to track focus). */
  onAnyFocus?: () => void;
  /** Called when no line is active anymore. */
  onAnyBlur?: () => void;
};

const ROW_BASE = 32;
// Distance from the bottom of a row to where text should sit so its baseline
// lands exactly on the ruled paper line drawn at the bottom of each 32px slice.
const RULE_BOTTOM_PAD = 6;

export function LineEditableMath({
  value,
  onChange,
  placeholder,
  italic,
  color = "hsl(220 35% 18%)",
  minRows = 1,
  className,
  onAnyFocus,
  onAnyBlur,
}: Props) {
  const font = useContext(HandwritingFontContext);
  const [active, setActive] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  // For end-caret-vs-home awareness when handling backspace merges.
  const lines = value === "" ? [] : value.split("\n");
  const displayCount = Math.max(lines.length, minRows);

  // When entering a line, seed draft with the friendly form of that line.
  useEffect(() => {
    if (active === null) return;
    const raw = lines[active] ?? "";
    setDraft(latexToFriendly(raw));
    // Focus on next tick so the input exists.
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        try { el.setSelectionRange(end, end); } catch { /* noop */ }
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const writeLines = useCallback(
    (next: string[]) => {
      // Trim purely-trailing empty lines to avoid drift.
      while (next.length > 1 && next[next.length - 1] === "") next.pop();
      onChange(next.join("\n"));
    },
    [onChange],
  );

  /** Convert the draft (friendly form) to storage form and write back. */
  const commitDraft = useCallback(
    (rowIndex: number, friendlyText: string): string[] => {
      const stored = friendlyToLatex(friendlyText);
      const next = lines.slice();
      while (next.length <= rowIndex) next.push("");
      next[rowIndex] = stored;
      writeLines(next);
      return next;
    },
    [lines, writeLines],
  );

  const handleEnter = (rowIndex: number, splitBelow: boolean) => {
    const next = commitDraft(rowIndex, draft);
    if (splitBelow) {
      next.splice(rowIndex + 1, 0, "");
      writeLines(next);
      setActive(rowIndex + 1);
    } else {
      setActive(null);
      onAnyBlur?.();
    }
  };

  const handleBackspaceMerge = (rowIndex: number) => {
    if (rowIndex === 0) return false;
    // Commit current draft first.
    const merged = lines.slice();
    while (merged.length <= rowIndex) merged.push("");
    const prev = merged[rowIndex - 1];
    const here = friendlyToLatex(draft);
    merged.splice(rowIndex - 1, 2, prev + here);
    writeLines(merged);
    setActive(rowIndex - 1);
    return true;
  };

  const moveTo = (target: number) => {
    if (active === null) return;
    commitDraft(active, draft);
    setActive(target);
  };

  const handleBlur = () => {
    if (active === null) return;
    commitDraft(active, draft);
    setActive(null);
    onAnyBlur?.();
  };

  const onContainerClickEmpty = () => {
    // Click on empty rows below the content → append a new line and activate.
    const newIndex = lines.length;
    const next = lines.slice();
    next.push("");
    writeLines(next);
    onAnyFocus?.();
    setActive(newIndex);
  };

  return (
    <div className={cn("relative flex flex-col h-full min-h-full", className)}>

      {Array.from({ length: displayCount }).map((_, i) => {
        const raw = lines[i] ?? "";
        const nextRaw = lines[i + 1] ?? "";
        const isActive = active === i;
        const rowHeight = Math.max(mathLineMinHeight(raw, ROW_BASE, nextRaw), ROW_BASE);
        if (isActive) {
          return (
            <div
              key={i}
              className="relative"
              style={{ minHeight: `${rowHeight}px`, lineHeight: `${ROW_BASE}px` }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => onAnyFocus?.()}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEnter(i, !e.shiftKey);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDraft(latexToFriendly(lines[i] ?? ""));
                    setActive(null);
                    onAnyBlur?.();
                    return;
                  }
                  if (e.key === "ArrowUp" && i > 0) {
                    e.preventDefault();
                    moveTo(i - 1);
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (i + 1 < lines.length) moveTo(i + 1);
                    else {
                      const next = commitDraft(i, draft);
                      next.push("");
                      writeLines(next);
                      setActive(i + 1);
                    }
                    return;
                  }
                  if (e.key === "Backspace") {
                    const el = inputRef.current;
                    const atStart = el && el.selectionStart === 0 && el.selectionEnd === 0;
                    if (atStart) {
                      if (handleBackspaceMerge(i)) e.preventDefault();
                    }
                  }
                }}
                placeholder={i === 0 ? placeholder : undefined}
                className={cn(
                  "w-full bg-transparent border-0 outline-hidden focus:ring-0 focus-visible:ring-0",
                  "text-[16px] placeholder:opacity-40",
                  italic && "italic",
                )}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: `${RULE_BOTTOM_PAD}px`,
                  color,
                  caretColor: color,
                  fontFamily: font,
                  lineHeight: `${ROW_BASE}px`,
                  height: `${ROW_BASE}px`,
                  padding: 0,
                }}
              />
            </div>
          );
        }
        // Rendered (read-only) line — click to edit.
        return (
          <div
            key={i}
            role="textbox"
            tabIndex={0}
            onClick={() => {
              onAnyFocus?.();
              setActive(i);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAnyFocus?.();
                setActive(i);
              }
            }}
            className={cn(
              "relative cursor-text select-text",
              "rounded-sm hover:bg-foreground/[0.025] transition-colors",
              italic && "italic",
            )}
            style={{
              minHeight: `${rowHeight}px`,
              lineHeight: `${ROW_BASE}px`,
              color,
              fontFamily: font,
              fontSize: 16,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${RULE_BOTTOM_PAD}px`,
                lineHeight: `${ROW_BASE}px`,
                display: "block",
              }}
            >
              {raw ? (
                HAS_MATH(raw) ? (
                  <span className="inline-flex items-baseline whitespace-pre-wrap">
                    {renderMathInline(stripLatexScaffolding(raw), `r${i}`)}
                  </span>
                ) : (
                  <span className="whitespace-pre-wrap">{raw}</span>
                )
              ) : (
                <span className="opacity-40">
                  {i === 0 && placeholder ? placeholder : "\u00A0"}
                </span>
              )}
            </span>
          </div>
        );
      })}
      {/* Empty hit-zone — fills remaining parent height so the teacher can
          click anywhere on the blank ruled space below the content to start a
          new line, like Word / WPS Writer. */}
      <div
        onClick={onContainerClickEmpty}
        className="flex-1 min-h-[32px] cursor-text"
        aria-label="Add a new line"
      />
    </div>
  );
}

export default LineEditableMath;
