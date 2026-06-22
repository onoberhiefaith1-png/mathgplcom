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

  /* ───────── Manual highlight → Enter ───────── */
  const eqRef = useRef<HTMLDivElement | null>(null);
  const [pendingText, setPendingText] = useState<string>("");
  const pendingRangeRef = useRef<Range | null>(null);

  // Watch for selection changes inside this line's equation, and bind Enter.
  useEffect(() => {
    const onSel = () => {
      const root = eqRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPendingText("");
        pendingRangeRef.current = null;
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setPendingText("");
        pendingRangeRef.current = null;
        return;
      }
      pendingRangeRef.current = range.cloneRange();
      setPendingText(sel.toString().trim());
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!pendingRangeRef.current && !pendingText) return;
      e.preventDefault();
      commitHighlightAsChip();
    };
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("keydown", onKey);
    };
  }); // re-bind every render so commitHighlightAsChip closes over latest state


  /* ─── Helpers shared by commit + glow ─── */
  const stripSign = (x: string) => x.replace(/^[+\-−]\s*/, "").trim();

  // Walk the cloned selection DOM to rebuild structured source markup
  // (\frac{a}{b}, \sqrt{x}, x^{2}) from the renderer's data-math-src markers.
  // Browser selection text flattens vertical math into `ab`; these markers are
  // the copy/paste truth for teacher-highlighted structure.
  const recoverSelectionSource = (range: Range): { src: string; containers: ContainerKind[] } => {
    const frag = range.cloneContents();
    const wrapper = document.createElement("div");
    wrapper.appendChild(frag);
    const containers: ContainerKind[] = [];

    const addContainer = (kind: ContainerKind) => {
      if (!containers.includes(kind)) containers.push(kind);
    };

    wrapper.querySelectorAll<HTMLElement>("[data-math-src]").forEach((el) => {
      const src = el.dataset.mathSrc?.trim();
      if (!src) return;
      const kind = el.dataset.mathKind;
      el.replaceChildren(document.createTextNode(src));
      if (kind === "fraction") addContainer("fraction");
      if (kind === "radical") addContainer("radical");
      if (kind === "superscript") addContainer("power");
    });

    const src = (wrapper.textContent || "").trim();
    return { src, containers };
  };

  const buildChip = (text: string, range: Range | null): { cleaned: string; containers: ContainerKind[]; label: string } | null => {
    const raw = (text || "").trim();
    if (!raw && !range) return null;

    let src = raw;
    let containers: ContainerKind[] = [];
    let label = "Added as floating chip";

    if (range) {
      // Trust the highlight verbatim. Recover real structure from the
      // KaTeX DOM, but do NOT apply heuristic promoter rewrites — what
      // the teacher highlighted is exactly what becomes the chip.
      const rec = recoverSelectionSource(range);
      src = rec.src || raw;
      containers = rec.containers;
      if (containers.length) label = `Added with ${containers[0]}`;
    } else if (raw) {
      // No DOM range (e.g. legacy callers) — fall back to the heuristic
      // promoter so adjacency rules still attach an empty exponent shell.
      const eq = line.equation ?? "";
      const idx = eq.indexOf(raw);
      const before = idx >= 0 ? eq.slice(0, idx) : "";
      const after = idx >= 0 ? eq.slice(idx + raw.length) : "";
      const result = promoteSelection(raw, before, after);
      if (result.payload) src = result.payload;
      if (result.container) containers = [result.container as ContainerKind];
      if (result.label) label = result.label;
    }

    // Trust the highlight: if the normalised form is "dirty", fall back
    // to the literal text. Enter never refuses.
    let cleaned = toUnicodeMath(src) || src || raw;
    if (!cleaned || isStillDirty(cleaned)) {
      cleaned = raw || cleaned;
    }
    if (!cleaned) return null;
    return { cleaned, containers, label };
  };

  // For glow: existing fillers that overlap the pending selection.
  const pendingPayload = pendingText || pendingRangeRef.current
    ? buildChip(pendingText, pendingRangeRef.current)
    : null;
  const pendingCleaned = pendingPayload?.cleaned ?? "";
  const overlapsPending = (originalIdx: number): boolean => {
    if (!pendingCleaned) return false;
    const fc = toUnicodeMath(line.fillers[originalIdx] ?? "");
    if (!fc) return false;
    const a = stripSign(pendingCleaned);
    const b = stripSign(fc);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  };

  const commitHighlightAsChip = () => {
    const payload = buildChip(pendingText, pendingRangeRef.current);
    if (!payload) return;
    const { cleaned, containers: newContainers, label } = payload;

    // OVERRIDE: drop any existing filler that is sub/superstring of the new
    // chip. Collapses scattered AI chips into the teacher's grouped chip,
    // or splits an over-grouped AI chip down to exactly what was highlighted.
    const a = stripSign(cleaned);
    const removeIdx = new Set<number>();
    line.fillers.forEach((f, i) => {
      const b = stripSign(toUnicodeMath(f) || f || "");
      if (a && b && (a === b || a.includes(b) || b.includes(a))) removeIdx.add(i);
    });
    const keptFillers = line.fillers.filter((_, i) => !removeIdx.has(i));
    const keptSel = padSel(line.fillersSelected, line.fillers.length).filter((_, i) => !removeIdx.has(i));

    const nextFillers = [...keptFillers, cleaned];
    const nextFillersSel = [...keptSel, false];

    let containers = line.containers;
    let containersSel = padSel(line.containersSelected, line.containers.length);
    newContainers.forEach((c) => {
      if (!containers.includes(c)) {
        containers = [...containers, c];
        containersSel = [...containersSel, false];
      }
    });

    onChange({
      ...line,
      fillers: nextFillers,
      fillersSelected: nextFillersSel,
      containers,
      containersSelected: containersSel,
      arrangement: rearrangeIndices(nextFillers.length),
    });
    window.getSelection()?.removeAllRanges();
    setPendingText("");
    pendingRangeRef.current = null;
    const removed = removeIdx.size;
    toast({
      title: label,
      description: removed > 0 ? `Replaced ${removed} existing chip${removed === 1 ? "" : "s"}.` : undefined,
      duration: 1600,
    });
  };

  return (
    <div className="pl-6 pr-2 py-3 border-l-2 border-foreground/10 ml-2 my-2">
      {/* Equation header */}
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/45">
          Line {lineNo}
        </span>
        <div ref={eqRef} className="text-[17px] select-text" style={{ color: "hsl(220 35% 18%)" }}>
          {renderMathInline(line.equation, `eq-${line.lineId}`)}
        </div>
        <div className={`flex items-center gap-1.5 shrink-0 ${scoreLabel ? "ml-auto" : "ml-auto"}`}>
          {/* The Enter, AI Edit, and Reason & Verify buttons were removed in
              favour of the always-on Floating Number AI Assistant on the
              right. Highlighting + Enter keyboard shortcut still works
              (see commitHighlightAsChip / Enter listener above). */}

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
              selected={!!fillersSelected[originalIdx] || overlapsPending(originalIdx)}
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
