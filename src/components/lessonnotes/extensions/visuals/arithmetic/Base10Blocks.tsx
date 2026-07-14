// Base-10 Blocks — one/ten/hundred/thousand tiles with add / remove and
// a live count of the represented value.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";

interface Attrs {
  ones?: number;
  tens?: number;
  hundreds?: number;
  thousands?: number;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): Required<Attrs> {
  const clamp = (n: unknown, d: number) => {
    const v = Number(n); return Number.isFinite(v) && v >= 0 ? Math.min(50, Math.floor(v)) : d;
  };
  return {
    ones: clamp(a.ones, 3),
    tens: clamp(a.tens, 2),
    hundreds: clamp(a.hundreds, 1),
    thousands: clamp(a.thousands, 0),
  };
}

export function Base10Blocks({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);
  const total = m.ones + m.tens * 10 + m.hundreds * 100 + m.thousands * 1000;

  const Slot = ({ label, count, kind, value, onAdd, onDel }: {
    label: string; count: number; kind: "one"|"ten"|"hundred"|"thousand"; value: number;
    onAdd: () => void; onDel: () => void;
  }) => (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] uppercase tracking-widest text-foreground/60">{label}</div>
      <div className="min-h-[64px] flex flex-wrap items-end justify-center gap-1 max-w-[140px]">
        {Array.from({ length: count }).map((_, i) => <Block key={i} kind={kind} />)}
      </div>
      <div className="flex items-center gap-1">
        <Chip onClick={onDel}><Minus className="h-3 w-3"/></Chip>
        <span className="text-[10px] tabular-nums text-foreground/60 w-8 text-center">{count}×{value}</span>
        <Chip onClick={onAdd}><Plus className="h-3 w-3"/></Chip>
      </div>
    </div>
  );

  return (
    <div className="not-prose inline-block relative text-foreground">
      {selected && (
        <div className="absolute -top-6 right-0 text-[10px] text-foreground/60">
          Total: <span className="font-bold text-foreground">{total}</span>
        </div>
      )}
      <div className="flex items-end gap-4">
        <Slot label="Thousands" count={m.thousands} kind="thousand" value={1000}
          onAdd={() => patch({ thousands: m.thousands + 1 })}
          onDel={() => patch({ thousands: Math.max(0, m.thousands - 1) })} />
        <Slot label="Hundreds" count={m.hundreds} kind="hundred" value={100}
          onAdd={() => patch({ hundreds: m.hundreds + 1 })}
          onDel={() => patch({ hundreds: Math.max(0, m.hundreds - 1) })} />
        <Slot label="Tens" count={m.tens} kind="ten" value={10}
          onAdd={() => patch({ tens: m.tens + 1 })}
          onDel={() => patch({ tens: Math.max(0, m.tens - 1) })} />
        <Slot label="Ones" count={m.ones} kind="one" value={1}
          onAdd={() => patch({ ones: m.ones + 1 })}
          onDel={() => patch({ ones: Math.max(0, m.ones - 1) })} />
      </div>
    </div>
  );
}

function Block({ kind }: { kind: "one"|"ten"|"hundred"|"thousand" }) {
  const s = "currentColor";
  if (kind === "one") {
    return (
      <svg width={12} height={12} viewBox="0 0 10 10"><rect x={0.5} y={0.5} width={9} height={9} stroke={s} fill="none" strokeWidth={1}/></svg>
    );
  }
  if (kind === "ten") {
    return (
      <svg width={12} height={62} viewBox="0 0 10 100">
        <rect x={0.5} y={0.5} width={9} height={99} stroke={s} fill="none" strokeWidth={1}/>
        {Array.from({length:9}).map((_,i)=><line key={i} x1={0.5} y1={(i+1)*10} x2={9.5} y2={(i+1)*10} stroke={s} strokeWidth={0.5}/>)}
      </svg>
    );
  }
  if (kind === "hundred") {
    return (
      <svg width={40} height={40} viewBox="0 0 100 100">
        <rect x={0.5} y={0.5} width={99} height={99} stroke={s} fill="none" strokeWidth={1}/>
        {Array.from({length:9}).map((_,i)=><line key={"v"+i} x1={(i+1)*10} y1={0.5} x2={(i+1)*10} y2={99.5} stroke={s} strokeWidth={0.5}/>)}
        {Array.from({length:9}).map((_,i)=><line key={"h"+i} x1={0.5} y1={(i+1)*10} x2={99.5} y2={(i+1)*10} stroke={s} strokeWidth={0.5}/>)}
      </svg>
    );
  }
  return (
    <svg width={54} height={54} viewBox="0 0 100 100">
      <path d="M10 30 H70 V90 H10 Z" stroke={s} fill="none" strokeWidth={1.5}/>
      <path d="M10 30 L30 10 H90 L70 30" stroke={s} fill="none" strokeWidth={1.5}/>
      <path d="M70 90 L90 70 V10" stroke={s} fill="none" strokeWidth={1.5}/>
    </svg>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-0.5 rounded border border-foreground/30 bg-background/60 px-1.5 py-0.5 text-[10px] hover:bg-foreground/10"
    >{children}</button>
  );
}

export default Base10Blocks;
