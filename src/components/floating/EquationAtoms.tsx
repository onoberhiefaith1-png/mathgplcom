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
import { ConnectedRadical } from "@/components/math/ConnectedRadical";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { EMOJI_STYLE, hasEmoji } from "@/lib/text/graphemes";

interface Props {
  equation: string;
  lineId: string;
  /** Current chips for this line. */
  chips: Chip[];
  /** Called after Enter / Apply with the next chip set. */
  onApply: (nextChips: Chip[], atoms: Atom[]) => void;
  /** Game mode: where an applied selection is sent. Defaults to floating. */
  destination?: "floating" | "vault";
  /** Called instead of onApply when destination is "vault". The expression is
   *  built by the SAME selection engine, so structure (fractions, roots,
   *  exponents) is preserved exactly as a Floating Number would be. */
  onApplyVault?: (expression: string) => void;
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
      title={atom.kind === "structure" ? "structure" : `${atom.kind} · ${atom.value}`}
    >
      {atom.kind === "structure"
        ? renderMathInline(atom.value, `st-${atom.id}`)
        : hasEmoji(atom.value)
          ? <span style={EMOJI_STYLE}>{atom.value}</span>
          : atom.value}
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
  destination = "floating",
  onApplyVault,
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
    if (destination === "vault" && onApplyVault) {
      // Same engine, empty chip set: the result is purely this selection.
      const built = applySelection(tree, atoms, [], selected, clickOrder);
      const expression = built.map((c) => c.value).join(" ").trim();
      if (expression) onApplyVault(expression);
    } else {
      const next = applySelection(tree, atoms, chips, selected, clickOrder);
      onApply(next, atoms);
    }
    setSelected(new Set());
    setClickOrder([]);
  }, [tree, atoms, chips, selected, clickOrder, onApply, destination, onApplyVault]);


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
    if (n.kind === "structure") {
      const isSelected=selected.has(n.shell.id), isRing=ringFor(n.shell.id);
      const handle=(glyph: React.ReactNode, suffix="") => (
        <button type="button" data-atom-id={n.shell.id}
          aria-label={n.spec.label+suffix} title={n.spec.label+suffix}
          onClick={e=>{e.stopPropagation();toggle(n.shell.id);focus();}}
          onMouseEnter={()=>onAtomHover?.(n.shell.id)} onMouseLeave={()=>onAtomHover?.(null)}
          style={{border:0,padding:"1px 3px",cursor:"pointer",borderRadius:4,color:"inherit",display:"inline-flex",alignItems:"center",justifyContent:"center",alignSelf:"stretch",
            background:isSelected?"hsl(48 95% 70%)":isRing?"hsl(48 95% 88%)":"transparent",
            outline:isSelected?"1px solid hsl(40 85% 42%)":"none",fontFamily:"Cambria Math, serif"}}>
          {glyph}
        </button>
      );
      const slot=(index:number) => n.slots[index]?.nodes.length
        ? renderNodes(n.slots[index].nodes) : <span aria-hidden="true">□</span>;
      const matrixBracket=(side:"left"|"right") => {
        const glyph=side==="left"?n.spec.left:n.spec.right;
        if(glyph==="["||glyph==="]") return <span aria-hidden="true" style={{alignSelf:"stretch",width:"0.3em",borderTop:"1.5px solid",borderBottom:"1.5px solid",[side==="left"?"borderLeft":"borderRight"]:"1.5px solid"}} />;
        return <span aria-hidden="true" style={{fontSize:`${Math.max(1.8,(n.spec.rows??1)*1.2)}em`}}>{glyph||"▦"}</span>;
      };
      if(n.spec.layout === "matrix") return (
        <span key={n.shell.id} className="inline-flex items-stretch align-middle" style={{margin:"0 3px"}}>
          <span className="inline-flex items-stretch">{handle(matrixBracket("left"))}</span>
          <span style={{display:"inline-grid",gridTemplateColumns:`repeat(${n.spec.cols}, max-content)`,gap:"6px 14px",padding:"4px 3px",alignItems:"center"}}>
            {n.slots.map((value,index)=><span key={value.boundary.id} data-structure-slot={n.spec.roles[index]} style={{display:"inline-flex",justifyContent:"center",alignItems:"center"}}>{slot(index)}</span>)}
          </span>
          {n.spec.right && <span className="inline-flex items-stretch">{handle(matrixBracket("right")," right bracket")}</span>}
        </span>
      );
      if(n.spec.layout === "bounds") {
        const upper=n.spec.roles.indexOf("upper"),lower=n.spec.roles.indexOf("lower");
        return <span key={n.shell.id} className="inline-flex flex-col items-center align-middle" style={{margin:"0 3px",lineHeight:1.2}}>
          {upper>=0 && <span data-structure-slot="upper" style={{fontSize:"0.72em"}}>{slot(upper)}</span>}
          <span style={{fontSize:n.spec.glyph?.startsWith("lim")?"1em":"1.6em"}}>{handle(n.spec.glyph)}</span>
          {lower>=0 && <span data-structure-slot="lower" style={{fontSize:"0.72em"}}>{slot(lower)}</span>}
        </span>;
      }
      if(n.spec.layout === "group") return <span key={n.shell.id} className="inline-flex items-center align-middle">
        {handle(n.spec.left || "▦")}<span data-structure-slot="body" className="inline-flex items-center">{slot(0)}</span>
        {n.spec.right && handle(n.spec.right," right bracket")}
      </span>;
      if(n.spec.layout === "binomial") return <span key={n.shell.id} className="inline-flex items-stretch align-middle">
        <span className="inline-flex items-center" style={{fontSize:"1.8em"}}>{handle("(")}</span>
        <span className="inline-flex flex-col items-center" style={{gap:3}}>{slot(0)}{slot(1)}</span>
        <span className="inline-flex items-center" style={{fontSize:"1.8em"}}>{handle(")"," right bracket")}</span>
      </span>;
      return <span key={n.shell.id} className="inline-flex flex-col items-center align-middle" style={{lineHeight:1.05,margin:"0 2px"}}>
        {n.spec.glyph!=="_" && <span style={{fontSize:"0.8em"}}>{handle(n.spec.glyph)}</span>}
        <span data-structure-slot="body" className="inline-flex items-center">{slot(0)}</span>
        {n.spec.glyph==="_" && <span style={{fontSize:"0.8em"}}>{handle("_")}</span>}
      </span>;
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
      const isSel = selected.has(n.sign.id);
      const isRing = ringFor(n.sign.id);
      return (
        <ConnectedRadical
          key={`r-${key}-${n.sign.id}`}
          degree={n.degree ? renderNodes(n.degree) : undefined}
          hookDataAtomId={n.sign.id}
          hookTitle={`radical · ${n.sign.value}`}
          onHookClick={(e) => { e.stopPropagation(); toggle(n.sign.id); focus(); }}
          onHookMouseEnter={() => onAtomHover?.(n.sign.id)}
          onHookMouseLeave={() => onAtomHover?.(null)}
          svgStyle={{
            color: isSel
              ? "hsl(40 85% 42%)"
              : isRing
                ? "hsl(48 95% 45%)"
                : undefined,
            background: isSel
              ? "hsl(48 95% 70%)"
              : isRing
                ? "hsl(48 95% 88%)"
                : "transparent",
            borderRadius: 4,
            transition: "background 80ms, color 80ms",
          }}
          overlineStyle={{
            borderTopColor: isSel ? "hsl(40 85% 42%)" : undefined,
          }}
        >
          {renderNodes(n.radicand)}
        </ConnectedRadical>
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
      className="inline-flex items-center flex-wrap gap-[1px] outline-hidden"
      style={{ color: "hsl(220 35% 18%)" }}
    >
      {renderNodes(tree)}

      {selected.size > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); commit(); }}
          className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md"
          style={{
            background: destination === "vault" ? "hsl(40 85% 42%)" : "hsl(220 35% 18%)",
            color: "hsl(38 38% 96%)",
          }}
          title={destination === "vault"
            ? "Apply selection to Vault (Enter)"
            : "Apply selection (Enter)"}
        >
          <CornerDownLeft className="h-3 w-3" />
          {destination === "vault" ? "Apply → Vault" : "Apply"}
        </button>
      )}
    </div>
  );
};

export default EquationAtoms;
