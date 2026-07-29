// Reusable Smart Cell — click to edit, type a number OR expression
// (52×5, 12/4, 3^2, √9). Press Enter → evaluates and stores the result.
// Escape → cancel. Used by every arithmetic structure (place-value,
// long division, division ladder, base conversion, …) and the smart table.

import { useEffect, useRef, useState } from "react";
import { evaluate, formatNumber } from "./evaluator";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  align?: "left" | "center" | "right";
  className?: string;
  minWidth?: number | string;
  ariaLabel?: string;
}

export function SmartCell({
  value,
  onChange,
  placeholder,
  align = "center",
  className = "",
  minWidth = "2ch",
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(value);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  const commit = () => {
    const raw = buffer.trim();
    if (!raw) { onChange(""); setEditing(false); return; }
    // Try to evaluate as an expression. If it succeeds, store the
    // numeric result. If not, keep the raw text (allows labels, "r1", etc).
    const r = evaluate(raw);
    onChange(r.ok ? formatNumber(r.value) : raw);
    setEditing(false);
  };

  const cancel = () => { setBuffer(value); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={ref}
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
        className={
          "bg-transparent outline-hidden border-b border-primary px-1 py-0 tabular-nums " +
          className
        }
        style={{ textAlign: align, minWidth, width: `${Math.max(2, buffer.length + 1)}ch` }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setBuffer(value); setEditing(true); }}
      aria-label={ariaLabel}
      className={
        "bg-transparent cursor-text hover:bg-foreground/5 rounded px-1 py-0 tabular-nums " +
        className
      }
      style={{ textAlign: align, minWidth, minHeight: "1.4em", display: "inline-block" }}
    >
      {value || <span className="text-foreground/25">{placeholder ?? "·"}</span>}
    </button>
  );
}

export default SmartCell;
