// Clickable equation row for the Floating Number Highlight Generation system.
//
// Renders the parsed node tree as REAL mathematics — stacked fractions, real
// radicals, raised exponents, lowered subscripts. Raw LaTeX commands (\frac,
// \sqrt, ^, _, \left, \right …) MUST NEVER reach the screen.
//
// Each leaf atom is an independently clickable span with a stable id, so the
// highlight engine still operates on the flat atom list (see atoms.ts and
// highlightEngine.ts). Pressing Enter merges the current selection into chips.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import {
  type Atom,
  type Node,
  flattenAtoms,
  parseNodes,
} from "@/lib/floating/atoms";
import { type Chip, applySelection } from "@/lib/floating/highlightEngine";

interface Props {
  equation: string;
  lineId: string;
  /** Current chips for this line. */
  chips: Chip[];
  /** Called after Enter / Apply with the next chip set. */
  onApply: (nextChips: Chip[], atoms: Atom[]) => void;
  /** Optional: external chip-hover index — atoms of that chip get a ring. */
  hoveredChipIndex?: number | null;
  onAtomHover?: (atomId: string | null) => void;
  highlightedAtomIds?: Set<string>;
}

interface LeafProps {
  atom: Atom;
  isSelected: boolean;
  isRingHover: boolean;
  toggle: (id: string) => void;
  onHover?: (id: string | null) => void;
  focus: () => void;
}

const Leaf = ({ atom, isSelected, isRingHover, toggle, onHover, focus }: LeafProps) => {
  const style: React.CSSProperties = {
    padding: atom.attachment ? "0 1px" : "0 2px",
    borderRadius: 4,
    cursor: "pointer",
    background: isSelected
      ? "hsl(48 95% 70%)"
      : isRingHover
        ? "hsl(48 95% 88%)"
        : "transparent",
    outline: isSelected ? "1px solid hsl(40 85% 42%)" : "none",
    fontSize: atom.attachment ? "0.72em" : undefined,
    verticalAlign:
      atom.kind === "exponent" ? "super" :
      atom.kind === "subscript" ? "sub" :
      "baseline",
    lineHeight: 1,
    transition: "background 80ms",
    fontStyle:
      atom.kind === "variable" && atom.value.length === 1 && /[a-z]/i.test(atom.value)
        ? "italic"
        : undefined,
    fontFamily:
      atom.kind === "function-name" ? "inherit" : undefined,
  };
  return (
    <span
      data-atom-id={atom.id}
      onClick={(e) => { e.stopPropagation(); toggle(atom.id); focus(); }}
      onMouseEnter={() => onHover?.(atom.id)}
      onMouseLeave={() => onHover?.(null)}
      style={style}
      title={`${atom.kind} · ${atom.value}`}
    >
      {atom.value}
    </span>
  );
};

interface FracBarProps {
  atom: Atom;
  isSelected: boolean;
  isRingHover: boolean;
  toggle: (id: string) => void;
  onHover?: (id: string | null) => void;
  focus: () => void;
}

const FracBar = ({ atom, isSelected, isRingHover, toggle, onHover, focus }: FracBarProps) => (
  <span
    data-atom-id={atom.id}
    onClick={(e) => { e.stopPropagation(); toggle(atom.id); focus(); }}
    onMouseEnter={() => onHover?.(atom.id)}
    onMouseLeave={() => onHover?.(null)}
    style={{
      display: "block",
      width: "100%",
      height: isSelected ? 2.5 : 1.5,
      background: isSelected
        ? "hsl(40 85% 42%)"
        : isRingHover
          ? "hsl(40 85% 50%)"
          : "currentColor",
      margin: "1px 0",
      borderRadius: 1,
      cursor: "pointer",
    }}
    title="fraction bar"
  />
);

export const EquationAtoms = ({
  equation,
  lineId,
  chips,
  onApply,
  onAtomHover,
  highlightedAtomIds,
}: Props) => {
  const tree = useMemo(() => parseNodes(equation, lineId), [equation, lineId]);
  const atoms = useMemo(() => flattenAtoms(tree), [tree]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  useEffect(() => { setSelected(new Set()); }, [equation, lineId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const focus = useCallback(() => { containerRef.current?.focus(); }, []);

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

  // Global Enter when this row is the active focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!focused.current) return;
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); setSelected(new Set()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  // Map atom id → owning chip index, for hover-ring synchronization.
  const atomChipIndex = useMemo(() => {
    const m = new Map<string, number>();
    chips.forEach((c, i) => c.atomIds.forEach((id) => m.set(id, i)));
    return m;
  }, [chips]);

  const ringFor = (id: string) =>
    highlightedAtomIds?.has(id) === true;

  const renderNodes = (nodes: Node[]): React.ReactNode =>
    nodes.map((n, i) => renderNode(n, i));

  const renderNode = (n: Node, key: number): React.ReactNode => {
    if (n.kind === "leaf") {
      return (
        <Leaf
          key={n.atom.id}
          atom={n.atom}
          isSelected={selected.has(n.atom.id)}
          isRingHover={ringFor(n.atom.id) || atomChipIndex.has(n.atom.id) === false ? ringFor(n.atom.id) : ringFor(n.atom.id)}
          toggle={toggle}
          onHover={onAtomHover}
          focus={focus}
        />
      );
    }
    if (n.kind === "frac") {
      return (
        <span
          key={`f-${key}-${n.bar.id}`}
          className="inline-flex flex-col items-center align-middle"
          style={{ margin: "0 2px", lineHeight: 1, verticalAlign: "middle" }}
        >
          <span className="inline-flex items-center" style={{ padding: "0 4px 1px" }}>
            {renderNodes(n.num)}
          </span>
          <FracBar
            atom={n.bar}
            isSelected={selected.has(n.bar.id)}
            isRingHover={ringFor(n.bar.id)}
            toggle={toggle}
            onHover={onAtomHover}
            focus={focus}
          />
          <span className="inline-flex items-center" style={{ padding: "1px 4px 0" }}>
            {renderNodes(n.den)}
          </span>
        </span>
      );
    }
    if (n.kind === "sqrt") {
      return (
        <span
          key={`r-${key}-${n.sign.id}`}
          className="inline-flex items-stretch align-middle"
          style={{ margin: "0 1px" }}
        >
          {n.degree && (
            <span style={{ fontSize: "0.6em", alignSelf: "flex-start", marginRight: -3 }}>
              {renderNodes(n.degree)}
            </span>
          )}
          <Leaf
            atom={n.sign}
            isSelected={selected.has(n.sign.id)}
            isRingHover={ringFor(n.sign.id)}
            toggle={toggle}
            onHover={onAtomHover}
            focus={focus}
          />
          <span
            className="inline-flex items-center"
            style={{
              borderTop: "1.5px solid currentColor",
              paddingTop: 1,
              paddingLeft: 2,
              paddingRight: 2,
            }}
          >
            {renderNodes(n.radicand)}
          </span>
        </span>
      );
    }
    return null;
  };

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
      {renderNodes(tree)}

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
