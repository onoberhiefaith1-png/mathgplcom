// Clickable equation row for the Floating Number Highlight Generation system.
//
// Renders the parsed node tree as REAL mathematics — stacked fractions, real
// radicals, raised exponents, lowered subscripts, paired brackets. Raw LaTeX
// commands (\frac, \sqrt, ^, _, \left, \right …) MUST NEVER reach the screen.
//
// Each leaf atom is an independently clickable span with a stable id. Bracket
// pairs are a single structural unit — clicking either side selects the pair.

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
      padding: "6px 0",
      margin: "-5px 0",
      cursor: "pointer",
      background: "transparent",
    }}
    title="fraction bar"
  >
    <span
      style={{
        display: "block",
        width: "100%",
        height: isSelected ? 2.5 : 1.5,
        background: isSelected
          ? "hsl(40 85% 42%)"
          : isRingHover
            ? "hsl(40 85% 50%)"
            : "currentColor",
        borderRadius: 1,
      }}
    />
  </span>
);

/** Paired bracket glyph — clicking either side selects BOTH atoms. */
interface PairedBracketProps {
  open: Atom;
  close: Atom;
  isSelected: boolean;
  isRingHover: boolean;
  togglePair: () => void;
  onHover?: (id: string | null) => void;
  focus: () => void;
  hasStructure: boolean;
  side: "open" | "close";
}

const PairedBracket = ({ open, close, isSelected, isRingHover, togglePair, onHover, focus, hasStructure, side }: PairedBracketProps) => {
  const atom = side === "open" ? open : close;
  const partnerId = side === "open" ? close.id : open.id;
  return (
    <span
      data-atom-id={atom.id}
      onClick={(e) => { e.stopPropagation(); togglePair(); focus(); }}
      onMouseEnter={() => { onHover?.(atom.id); onHover?.(partnerId); }}
      onMouseLeave={() => onHover?.(null)}
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        cursor: "pointer",
        padding: "0 2px",
        borderRadius: 4,
        background: isSelected ? "hsl(48 95% 70%)" : isRingHover ? "hsl(48 95% 88%)" : "transparent",
        outline: isSelected ? "1px solid hsl(40 85% 42%)" : "none",
        transition: "background 80ms",
      }}
      title={`bracket pair · ${atom.value}`}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: hasStructure ? "1.5em" : "1em",
          fontFamily: "Cambria Math, STIX Two Math, serif",
          lineHeight: 1,
          fontWeight: 300,
        }}
      >
        {atom.value}
      </span>
    </span>
  );
};

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
  const [clickOrder, setClickOrder] = useState<string[]>(() => []);
  const containerRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  useEffect(() => { setSelected(new Set()); setClickOrder([]); }, [equation, lineId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setClickOrder((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const togglePair = useCallback((idA: string, idB: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = next.has(idA) || next.has(idB);
      if (on) { next.delete(idA); next.delete(idB); }
      else { next.add(idA); next.add(idB); }
      return next;
    });
    setClickOrder((prev) => {
      const on = prev.includes(idA) || prev.includes(idB);
      if (on) return prev.filter((x) => x !== idA && x !== idB);
      return [...prev, idA, idB];
    });
  }, []);

  const focus = useCallback(() => { containerRef.current?.focus(); }, []);

  const commit = useCallback(() => {
    if (selected.size === 0) return;
    const next = applySelection(tree, atoms, chips, selected, clickOrder);
    onApply(next, atoms);
    setSelected(new Set());
    setClickOrder([]);
  }, [tree, atoms, chips, selected, clickOrder, onApply]);


  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setSelected(new Set()); setClickOrder([]); }

  }, [commit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!focused.current) return;
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); setSelected(new Set()); setClickOrder([]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  const ringFor = (id: string) => highlightedAtomIds?.has(id) === true;

  const hasStructureNodes = (nodes: Node[]): boolean =>
    nodes.some((n) => n.kind !== "leaf");

  const renderNodes = (nodes: Node[]): React.ReactNode =>
    nodes.map((n, i) => renderNode(n, i));

  const renderNode = (n: Node, key: number): React.ReactNode => {
    if (n.kind === "leaf") {
      return (
        <Leaf
          key={n.atom.id}
          atom={n.atom}
          isSelected={selected.has(n.atom.id)}
          isRingHover={ringFor(n.atom.id)}
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
    if (n.kind === "bracket") {
      const pairSelected = selected.has(n.open.id) || selected.has(n.close.id);
      const pairHover = ringFor(n.open.id) || ringFor(n.close.id);
      const tall = hasStructureNodes(n.body);
      return (
        <span
          key={`b-${key}-${n.open.id}`}
          className="inline-flex items-stretch align-middle"
          style={{ margin: "0 0" }}
        >
          <PairedBracket
            open={n.open}
            close={n.close}
            side="open"
            isSelected={pairSelected}
            isRingHover={pairHover}
            togglePair={() => togglePair(n.open.id, n.close.id)}
            onHover={onAtomHover}
            focus={focus}
            hasStructure={tall}
          />
          <span className="inline-flex items-center" style={{ padding: "0 1px" }}>
            {renderNodes(n.body)}
          </span>
          <PairedBracket
            open={n.open}
            close={n.close}
            side="close"
            isSelected={pairSelected}
            isRingHover={pairHover}
            togglePair={() => togglePair(n.open.id, n.close.id)}
            onHover={onAtomHover}
            focus={focus}
            hasStructure={tall}
          />
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
