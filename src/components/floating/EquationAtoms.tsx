// Clickable equation row for the Floating Number Highlight Generation system.
// Renders every atom of an equation as an individually-selectable span. The
// teacher taps atoms, then presses Enter (or the inline "Apply" button) to
// merge/split the line's Floating Numbers via the highlight engine.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { type Atom, parseAtoms } from "@/lib/floating/atoms";
import { type Chip, applySelection } from "@/lib/floating/highlightEngine";

interface Props {
  equation: string;
  lineId: string;
  /** Current chips for this line, derived from atoms + persisted fillers. */
  chips: Chip[];
  /** Called after Enter/Apply with the next chip set. */
  onApply: (nextChips: Chip[], atoms: Atom[]) => void;
  /** Optional: highlight ring for atoms whose chips the user is hovering. */
  hoveredChipIndex?: number | null;
  /** Optional: notify parent which chip an atom belongs to (for chip→atom hover). */
  onAtomHover?: (atomId: string | null) => void;
  /** Atoms whose chip should be ringed (driven by chip hover). */
  highlightedAtomIds?: Set<string>;
}

export const EquationAtoms = ({
  equation,
  lineId,
  chips,
  onApply,
  hoveredChipIndex,
  onAtomHover,
  highlightedAtomIds,
}: Props) => {
  const atoms = useMemo(() => parseAtoms(equation, lineId), [equation, lineId]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  // Reset selection when the equation changes.
  useEffect(() => { setSelected(new Set()); }, [equation, lineId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const commit = useCallback(() => {
    if (selected.size === 0) return;
    const next = applySelection(atoms, chips, selected);
    onApply(next, atoms);
    setSelected(new Set());
  }, [atoms, chips, selected, onApply]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setSelected(new Set()); }
  }, [commit]);

  // Global Enter: only when this row is the active focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!focused.current) return;
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); setSelected(new Set()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  // Which chip does each atom belong to? (for chip-hover ring)
  const atomChipIndex = useMemo(() => {
    const m = new Map<string, number>();
    chips.forEach((c, i) => c.atomIds.forEach((id) => m.set(id, i)));
    return m;
  }, [chips]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; }}
      onKeyDown={onKeyDown}
      className="inline-flex items-center flex-wrap gap-[1px] outline-none"
      style={{ color: "hsl(220 35% 18%)" }}
    >
      {atoms.map((a) => {
        const isSel = selected.has(a.id);
        const inHoveredChip = hoveredChipIndex != null && atomChipIndex.get(a.id) === hoveredChipIndex;
        const ringByChip = highlightedAtomIds?.has(a.id) ?? false;
        const style: React.CSSProperties = {
          padding: a.attachment ? "0 1px" : "0 2px",
          borderRadius: 4,
          cursor: "pointer",
          background: isSel
            ? "hsl(48 95% 70%)"
            : inHoveredChip || ringByChip
              ? "hsl(48 95% 88%)"
              : "transparent",
          outline: isSel ? "1px solid hsl(40 85% 42%)" : "none",
          fontSize: a.attachment ? "0.78em" : "1em",
          verticalAlign: a.kind === "exponent" ? "super" : a.kind === "subscript" ? "sub" : "baseline",
          lineHeight: 1,
          transition: "background 80ms",
        };
        return (
          <span
            key={a.id}
            data-atom-id={a.id}
            onClick={(e) => { e.stopPropagation(); toggle(a.id); containerRef.current?.focus(); }}
            onMouseEnter={() => onAtomHover?.(a.id)}
            onMouseLeave={() => onAtomHover?.(null)}
            style={style}
            title={`${a.kind} · ${a.value}`}
          >
            {a.value}
          </span>
        );
      })}

      {selected.size > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); commit(); }}
          className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md"
          style={{
            background: "hsl(220 35% 18%)",
            color: "hsl(38 38% 96%)",
          }}
          title="Apply selection (Enter)"
        >
          <CornerDownLeft className="h-3 w-3" /> Apply
        </button>
      )}
    </div>
  );
};

export default EquationAtoms;
