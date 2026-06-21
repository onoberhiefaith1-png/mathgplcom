// One Floating Workspace = one verified equation line.
// Renders: Fillers row + Containers row, with manual editing & per-line rearrange.
// Every chip is editable; every row always ends with an empty tagged entry box.

import { useEffect, useRef, useState } from "react";
import { Shuffle, X, Sparkles, CornerDownLeft } from "lucide-react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import {
  type ContainerKind,
  type FloatingLine,
  rearrangeIndices,
  applyArrangement,
} from "@/lib/lessonnotes/floatingCompile";
import {
  STRUCTURE_MARKUP,
  extractTermsFromAscii,
  renderTermLabel,
} from "@/lib/smartboard/floatingExtractor";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { promoteSelection } from "@/lib/smartboard/manualFloatingPromoter";
import { toast } from "@/hooks/use-toast";

interface Props {
  line: FloatingLine;
  index: number;
  onChange: (next: FloatingLine) => void;
  /** Scoring label (Marks / Points …). When set, a per-line marks box shows. */
  scoreLabel?: string;
  /** "equal" renders the marks box read-only; "individual" lets it be edited. */
  scoringMode?: "equal" | "individual";
  /** Opens the AI-Edit panel for this single line. */
  onAiEdit?: () => void;
}

const CONTAINER_KINDS: ContainerKind[] = [
  "fraction", "bracket", "radical", "power", "log",
  "integral", "matrix", "differential", "abs", "vector",
];

const parseContainerKind = (raw: string): ContainerKind | null => {
  const v = raw.trim().toLowerCase();
  return (CONTAINER_KINDS as string[]).includes(v) ? (v as ContainerKind) : null;
};

export const FloatingWorkspace = ({ line, index, onChange, scoreLabel, scoringMode, onAiEdit }: Props) => {
  const fillers = applyArrangement(line.fillers, line.arrangement);
  const lineNo = index + 1;
  const fillersSelected = line.fillersSelected ?? line.fillers.map(() => false);
  const containersSelected = line.containersSelected ?? line.containers.map(() => false);

  const padSel = (arr: boolean[] | undefined, n: number): boolean[] => {
    const a = (arr ?? []).slice(0, n);
    while (a.length < n) a.push(false);
    return a;
  };

  const rearrange = () => {
    onChange({ ...line, arrangement: rearrangeIndices(line.fillers.length) });
  };

  const removeFiller = (visualIdx: number) => {
    const originalIdx = line.arrangement[visualIdx] ?? visualIdx;
    const nextFillers = line.fillers.filter((_, i) => i !== originalIdx);
    const nextSel = padSel(line.fillersSelected, line.fillers.length).filter((_, i) => i !== originalIdx);
    onChange({
      ...line,
      fillers: nextFillers,
      fillersSelected: nextSel,
      arrangement: rearrangeIndices(nextFillers.length),
    });
  };

  const updateFiller = (visualIdx: number, raw: string) => {
    const v = toUnicodeMath(raw.trim());
    if (!v || isStillDirty(v)) {
      removeFiller(visualIdx);
      return;
    }
    const originalIdx = line.arrangement[visualIdx] ?? visualIdx;
    const nextFillers = line.fillers.map((f, i) => (i === originalIdx ? v : f));
    onChange({ ...line, fillers: nextFillers, fillersSelected: padSel(line.fillersSelected, nextFillers.length) });
  };

  const toggleFiller = (visualIdx: number) => {
    const originalIdx = line.arrangement[visualIdx] ?? visualIdx;
    const current = padSel(line.fillersSelected, line.fillers.length);
    const next = current.map((s, i) => (i === originalIdx ? !s : s));
    onChange({ ...line, fillersSelected: next });
  };

  const addFiller = (raw: string) => {
    const v = toUnicodeMath(raw.trim());
    if (!v || isStillDirty(v)) return;
    const nextFillers = [...line.fillers, v];
    const nextSel = [...padSel(line.fillersSelected, line.fillers.length), false];
    onChange({
      ...line,
      fillers: nextFillers,
      fillersSelected: nextSel,
      arrangement: rearrangeIndices(nextFillers.length),
    });
  };

  const removeContainer = (idx: number) => {
    const nextSel = padSel(line.containersSelected, line.containers.length).filter((_, i) => i !== idx);
    onChange({
      ...line,
      containers: line.containers.filter((_, i) => i !== idx),
      containersSelected: nextSel,
    });
  };

  const updateContainer = (idx: number, raw: string) => {
    const k = parseContainerKind(raw);
    if (!k) { removeContainer(idx); return; }
    if (line.containers.includes(k) && line.containers[idx] !== k) {
      // Avoid duplicates: just drop this slot.
      removeContainer(idx);
      return;
    }
    onChange({
      ...line,
      containers: line.containers.map((c, i) => (i === idx ? k : c)),
      containersSelected: padSel(line.containersSelected, line.containers.length),
    });
  };

  const toggleContainer = (idx: number) => {
    const current = padSel(line.containersSelected, line.containers.length);
    const next = current.map((s, i) => (i === idx ? !s : s));
    onChange({ ...line, containersSelected: next });
  };

  const addContainer = (raw: string) => {
    const k = parseContainerKind(raw);
    if (!k) return;
    if (line.containers.includes(k)) return;
    onChange({
      ...line,
      containers: [...line.containers, k],
      containersSelected: [...padSel(line.containersSelected, line.containers.length), false],
    });
  };

  return (
    <div className="pl-6 pr-2 py-3 border-l-2 border-foreground/10 ml-2 my-2">
      {/* Equation header */}
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/45">
          Line {lineNo}
        </span>
        <div className="text-[17px]" style={{ color: "hsl(220 35% 18%)" }}>
          {renderMathInline(line.equation, `eq-${line.lineId}`)}
        </div>
        <div className={`flex items-center gap-1.5 shrink-0 ${scoreLabel ? "ml-auto" : "ml-auto"}`}>
          {onAiEdit && (
            <button
              type="button"
              onClick={onAiEdit}
              title="Regenerate or edit this line with AI"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-foreground/15 hover:bg-foreground/5"
              style={{ color: "hsl(220 35% 18%)" }}
            >
              <Sparkles className="h-3 w-3" /> AI Edit
            </button>
          )}
          {scoreLabel && (
            <>
              <input
                type="number"
                min={0}
                value={Number(line.marks ?? 0)}
                readOnly={scoringMode === "equal"}
                onChange={(e) => {
                  const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  onChange({ ...line, marks: n });
                }}
                title={scoringMode === "equal" ? "Set in the toolbar (equal mode)" : `${scoreLabel} for this line`}
                className="w-14 text-center text-[14px] tabular-nums rounded-md px-1.5 py-0.5 outline-none"
                style={{
                  background: scoringMode === "equal" ? "hsl(220 35% 18% / 0.05)" : "hsl(48 95% 68% / 0.25)",
                  border: "1px solid hsl(40 85% 42% / 0.5)",
                  color: "hsl(220 35% 18%)",
                }}
              />
              <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/40">{scoreLabel}</span>
            </>
          )}
        </div>
      </div>



      {/* Fillers row — always rendered, always ends with empty entry box */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/40 w-20 shrink-0">
          Fillers
        </span>
        {fillers.map((f, i) => {
          const cleaned = toUnicodeMath(f);
          if (isStillDirty(cleaned)) return null;
          const term = extractTermsFromAscii(cleaned)[0];
          const label = term ? renderTermLabel(term, { isFirst: false, prevWasEquals: false }) : cleaned;
          const originalIdx = line.arrangement[i] ?? i;
          return (
            <EditableChip
              key={`f-${i}-${f}`}
              value={cleaned}
              displayLabel={label}
              displayKey={`fc-${line.lineId}-${i}`}
              lineNo={lineNo}
              selected={!!fillersSelected[originalIdx]}
              onToggleSelected={() => toggleFiller(i)}
              onCommit={(v) => updateFiller(i, v)}
              onRemove={() => removeFiller(i)}
            />
          );
        })}
        <EmptyEntryBox
          lineNo={lineNo}
          placeholder="value"
          onCommit={addFiller}
          widthClass="w-24"
        />
        <button
          onClick={rearrange}
          title="Rearrange this line"
          className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-foreground/45 hover:text-foreground/70 px-1.5 py-0.5"
        >
          <Shuffle className="h-3 w-3" /> rearrange
        </button>
      </div>

      {/* Symbols / structures row — always rendered, always ends with empty entry box */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/40 w-20 shrink-0">
          Symbols
        </span>
        {line.containers.map((c, i) => (
          <EditableChip
            key={`c-${i}-${c}`}
            value={c}
            displayLabel={STRUCTURE_MARKUP[c]}
            displayKey={`cn-${line.lineId}-${c}`}
            lineNo={lineNo}
            variant="symbol"
            selected={!!containersSelected[i]}
            onToggleSelected={() => toggleContainer(i)}
            onCommit={(v) => updateContainer(i, v)}
            onRemove={() => removeContainer(i)}
          />
        ))}
        <EmptyEntryBox
          lineNo={lineNo}
          placeholder="fraction, bracket…"
          onCommit={addContainer}
          variant="symbol"
          widthClass="w-36"
        />
      </div>
    </div>
  );
};

/* ─────────────────────────── Editable chip ─────────────────────────── */

const EditableChip = ({
  value, displayLabel, displayKey, lineNo, onCommit, onRemove, variant = "filler",
  selected = false, onToggleSelected,
}: {
  value: string;
  displayLabel: string;
  displayKey: string;
  lineNo: number;
  onCommit: (raw: string) => void;
  onRemove: () => void;
  variant?: "filler" | "symbol";
  selected?: boolean;
  onToggleSelected?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => { setDraft(value); setEditing(true); };
  const commit = () => { setEditing(false); onCommit(draft); };
  const cancel = () => { setEditing(false); setDraft(value); };

  const baseStyle =
    variant === "symbol"
      ? {
          background: "hsl(220 35% 18% / 0.06)",
          border: "1px dashed hsl(220 35% 18% / 0.35)",
          color: "hsl(220 35% 18%)",
        }
      : {
          background: "hsl(38 38% 94%)",
          border: "1px solid hsl(220 15% 60% / 0.35)",
          color: "hsl(220 35% 18%)",
        };

  const selectedStyle = {
    background: "hsl(48 95% 68%)",
    border: "1.5px solid hsl(40 85% 42%)",
    color: "hsl(220 35% 18%)",
    boxShadow: "0 0 0 2px hsl(48 95% 68% / 0.35)",
  } as const;

  const chipStyle = selected ? selectedStyle : baseStyle;

  if (editing) {
    return (
      <span
        className="relative inline-flex items-center px-2 py-1 rounded-md"
        style={chipStyle}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
          className="bg-transparent outline-none text-[14px] w-24"
        />
        <TagBadge n={lineNo} />
      </span>
    );
  }

  return (
    <span
      className="group relative inline-flex items-center gap-1 px-2.5 py-1 rounded-md overflow-hidden cursor-pointer"
      style={chipStyle}
      onClick={() => onToggleSelected?.()}
      onDoubleClick={(e) => { e.preventDefault(); startEdit(); }}
      title={selected ? "Click to unhighlight · double-click to edit" : "Click to highlight · double-click to edit"}
    >
      <TagBadge n={lineNo} />
      <span className="text-[15px]">{renderMathInline(displayLabel, displayKey)}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-foreground/40 hover:text-destructive"
        aria-label="remove"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
};

/* ──────────────────────── Empty tagged entry box ──────────────────────── */

const EmptyEntryBox = ({
  lineNo, placeholder, onCommit, widthClass = "w-24", variant = "filler",
}: {
  lineNo: number;
  placeholder: string;
  onCommit: (raw: string) => void;
  widthClass?: string;
  variant?: "filler" | "symbol";
}) => {
  const [draft, setDraft] = useState("");

  const commit = () => {
    if (!draft.trim()) return;
    onCommit(draft);
    setDraft("");
  };

  const style =
    variant === "symbol"
      ? {
          background: "transparent",
          border: "1px dashed hsl(220 35% 18% / 0.30)",
          color: "hsl(220 35% 18%)",
        }
      : {
          background: "transparent",
          border: "1px dashed hsl(220 15% 60% / 0.45)",
          color: "hsl(220 35% 18%)",
        };

  return (
    <span
      className="relative inline-flex items-center px-2 py-1 rounded-md"
      style={style}
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(""); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder={placeholder}
        className={`bg-transparent outline-none text-[14px] placeholder:text-foreground/30 ${widthClass}`}
      />
      <TagBadge n={lineNo} />
    </span>
  );
};

const TagBadge = ({ n }: { n: number }) => (
  <span
    aria-hidden
    className="absolute pointer-events-none tabular-nums font-bold"
    style={{
      right: 3,
      bottom: -2,
      fontSize: 10,
      lineHeight: 1,
      opacity: 0.30,
      color: "hsl(220 35% 18%)",
    }}
  >
    {n}
  </span>
);

export default FloatingWorkspace;
