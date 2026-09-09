// FloatingNumberPanel — fixed smartboard overlay. It stays at the bottom-left
// of the viewport, just to the right of the permanent hash/eraser tool column,
// so teachers always have clear writing space above it.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsTouchLayout } from "@/hooks/useBreakpoint";
import { useSmartboardRoot } from "./SmartboardRoot";
import { Table as TableIcon } from "lucide-react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import type { Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";
import { visiblePlaceholderColor } from "@/lib/smartboard/placeholderColor";
import { gridFromMatrixLatex } from "@/lib/floating/tableGrid";
import { matrixShellFromLatex } from "@/lib/floating/matrixChips";
import { FloatingDisplayFrame } from "./floatingDisplays";
import { sanitizeFloatingStyle, type FloatingDisplayStyleId } from "@/lib/smartboard/floatingDisplayStyles";

/** Background of the floating chip bar — placeholders must stay visible on it. */
const CHIP_SURFACE = "#ffffff";

import { SmartboardPlaceholderSlot } from "./SmartboardPlaceholderSlot";

const WINDOW_SIZE = 5;

/** Floating numbers are EXTRACTED, never rebuilt. The chip token that
 *  leaves Present Preview (Normal Mode) must reach the display byte-for-byte
 *  identical — structures (`\frac{a}{b}`, `\sqrt{x}`, `^{n}`, brackets) and
 *  their placeholder slots included.
 *
 *  A previous version stripped structure shells here, which silently mutated
 *  the master object (`x=\frac{□}{□}` arrived as `x=`). That was the leak.
 *  This function is now a pure pass-through with an internal validation
 *  guard: if any pass ever alters the structure, we keep the ORIGINAL and
 *  report it, rather than publishing a corrupted chip. */
export const structureSignature = (token: string): string => {
  const count = (re: RegExp) => (token.match(re) ?? []).length;
  return [
    count(/\\(?:d|t)?frac\b/g),
    count(/\\sqrt\b/g),
    count(/\^/g),
    count(/_/g),
    count(/[([]/g),
    count(/[)\]]/g),
    count(/□/g),
  ].join(":");
};

/** Internal validation stage — returns the token unchanged, but verifies the
 *  generated representation still matches the master object it came from. */
export const validateFloatingToken = (master: string, generated: string): string => {
  if (!master) return "";
  if (generated !== master && structureSignature(generated) !== structureSignature(master)) {
    if (import.meta.env.DEV) {
      console.warn("[floating] rejected altered chip; using master", { master, generated });
    }
    return master;
  }
  return generated;
};



const SUP_DIG: Record<string, string> = {
  "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9",
};
const SUB_DIG: Record<string, string> = {
  "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9",
};
const isSup = (c: string) => c in SUP_DIG;
const isSub = (c: string) => c in SUB_DIG;
const fromSup = (s: string) => [...s].map((c) => SUP_DIG[c] ?? c).join("");
const fromSub = (s: string) => [...s].map((c) => SUB_DIG[c] ?? c).join("");

export interface FractionParts {
  /** Leading sign char ("", "+", "−"). */
  sign: string;
  /** Numerator string with attached variable letters, normalised to plain digits. */
  num: string;
  /** Denominator string, normalised to plain digits. */
  den: string;
}

/** Detect a "stacked fraction" chip body. Supports BOTH the unicode form
 *  ¹⁰⁄₃x and the plain-ASCII form 10x/3. Returns null when the chip is
 *  something more complex (e.g. contains brackets, multiple slashes, √…). */
export const parseFractionChip = (label: string): FractionParts | null => {
  if (!label) return null;
  const m = label.match(/^([+\-−])?(.*)$/);
  const sign = m?.[1] ?? "";
  const body = (m?.[2] ?? label).trim();
  if (!body || /[()√∫|]/.test(body)) return null;

  // Unicode form: sup-digits + ⁄ (or /) + sub-digits + optional trailing letters.
  const uni = body.match(/^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)[⁄/]([₀₁₂₃₄₅₆₇₈₉]+)([a-zA-Z]*)$/);
  if (uni) {
    const num = fromSup(uni[1]) + uni[3];
    const den = fromSub(uni[2]);
    return { sign, num, den };
  }
  // Plain ASCII: "10x/3", "5/3" (single top-level slash).
  if (body.includes("/")) {
    const parts = body.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      // Only treat as fraction when neither side contains another operator.
      if (!/[+\-−×÷*]/.test(parts[0]) && !/[+\-−×÷*]/.test(parts[1])) {
        return { sign, num: parts[0], den: parts[1] };
      }
    }
  }
  return null;
};

/** Render a chip's label as JSX. When the chip is a recognised fraction,
 *  draw a real stacked fraction with the variable riding on the numerator
 *  (so `¹⁰⁄₃x` reads as "10x over 3", never as "10 over 3 x"). */
/** A matrix chip is a STRUCTURE chip: it shows the empty bracketed grid it will
 *  insert (dimensions + brackets only), never any cell value. */
const matrixChipShell = (raw: string) => matrixShellFromLatex(raw);

const ChipLabel = ({ label, color, placeholderColor }: { label: string; color: string; placeholderColor?: string }) => {
  const safe = assertDisplaySafe(label).cleaned;
  const matrixShell = matrixChipShell(label);
  const frac = parseFractionChip(label);
  // The chip bar is WHITE. The board's placeholder colour is near-white
  // cream, so slots painted with it disappear here — which is why every
  // placeholder (√□, □^□, the two fraction cells) looked "removed". Always
  // resolve a colour that stays visible on this surface.
  const slotColor = visiblePlaceholderColor(placeholderColor, CHIP_SURFACE);
  const partNode = (value: string, key: string) =>
    value.trim() === "□"
      ? <SmartboardPlaceholderSlot key={key} color={slotColor} size="panel" source="floating-number" />
      : <span key={key} style={{ padding: "0 4px", whiteSpace: "nowrap" }}>{value}</span>;
  if (matrixShell) {
    // Empty structure preview: brackets + one placeholder slot per cell.
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 800 }}>
        {matrixShell.left && <span>{matrixShell.left}</span>}
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: matrixShell.rows }, (_, r) => (
            <span key={`mr-${r}`} style={{ display: "inline-flex", gap: 3 }}>
              {Array.from({ length: matrixShell.cols }, (_, c) => (
                <SmartboardPlaceholderSlot
                  key={`mc-${r}-${c}`}
                  color={slotColor}
                  size="panel"
                  source="floating-number"
                />
              ))}
            </span>
          ))}
        </span>
        {matrixShell.right && <span>{matrixShell.right}</span>}
        <span style={{ fontSize: "0.7em", opacity: 0.7, marginLeft: 3 }}>
          {matrixShell.rows} × {matrixShell.cols}
        </span>
      </span>
    );
  }
  if (!frac) {
    return <span>{renderMathInline(safe, `fn-chip-${safe}`, { placeholderColor: slotColor })}</span>;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {frac.sign && <span style={{ marginRight: 2 }}>{frac.sign}</span>}
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 1,
          fontSize: "0.95em",
          verticalAlign: "middle",
        }}
      >
        {partNode(frac.num, "n")}
        <span
          style={{
            display: "block",
            height: 1.4,
            alignSelf: "stretch",
            background: color,
            margin: "1px 0",
          }}
        />
        {partNode(frac.den, "d")}
      </span>
    </span>
  );
};


interface Props {
  chromeFg: string;
  reservoirs: Reservoir[];
  viewIdx: number;
  activeIdx: number;
  visible: boolean;
  onInsert?: (token: string) => void;
  /** Called when the tapped chip is a full LaTeX matrix environment; the
   *  parent inserts a real matrix node instead of writing raw LaTeX. */
  onInsertMatrix?: (latex: string) => void;
  /** Called when the tapped chip is a recognised stacked fraction; the parent
   *  inserts a real frac node so the board shows a proper bar (no slash). */
  onInsertFrac?: (parts: FractionParts) => void;
  activeLineIdx?: number;
  consumedAbsIdx?: Set<number>;
  /** Mark a fragment (by absolute index) as USED — the conveyor moves it to the
   *  grey "used" zone and automatic marking trusts it instead of re-parsing ink. */
  onUse?: (absIdx: number, label: string) => void;
  /** Un-mark a fragment — returns it from the USED zone back to ACTIVE. */
  onUnuse?: (absIdx: number) => void;
  /** Board-space x in pixels (left edge of band). */
  leftPx: number;
  /** Viewport-space bottom inset reserved by the collapsed/open bottom panel. */
  viewportBottomInset?: number;
  onPing: () => void;
  beatId?: string;
  /** 1-based current floating-line for the per-beat line navigator. */
  lineNumber?: number;
  lineCount?: number;
  /** Overrides the counter text (e.g. "T2" while a Smart Table is active). */
  lineLabel?: string;
  /** Resolves a reservoir line index to its own tag ("T7" inside a table, the
   *  lesson step number outside). The single tag authority for chip badges. */
  tagOfLineIdx?: (lineIdx: number) => string;

  onPrevLine?: () => void;
  onNextLine?: () => void;
  /** The current line's teaching note, read through the single note
   *  source (noteForLine). This is the ONLY input that can render the
   *  notebook icon — empty/undefined means NO icon. There is no
   *  fallback to `explanation` or any other text. */
  notebookText?: string;
  /** Number of notes-layer objects (diagrams) attached to the current line's
   *  note. A note exists when there is prose OR at least one object, so a
   *  diagram-only note still shows the notebook icon. */
  noteObjectCount?: number;
  /** Reveals the note's diagrams at classroom scale on the board. */
  onShowNoteObjects?: () => void;
  /** Writes a prose line onto the smartboard surface itself. Provided by
   *  the parent (PresentationView) so the FloatingNumberPanel never has to
   *  touch the writing-tree directly. */
  onWriteNotebookToBoard?: (text: string) => void;
  onNotebookRead?: () => void;
  /** When true, chip selection is disabled (e.g. while a Notebook
   *  checkpoint is being revealed). Chips render dimmed and ignore taps. */
  frozen?: boolean;
  /** True when the current line has an unread notebook checkpoint — the
   *  Notebook icon pulses to draw the teacher's eye. */
  notebookPending?: boolean;
  placeholderColor?: string;
  /** Set when the active lesson line IS a Smart Table. The strip then shows a
   *  single table-icon chip instead of equation fragments. */
  tableChip?: { objId: string; label: string; placed: boolean; isMatrix?: boolean } | null;
  /** Places (or re-places) the table on the board at the teacher's cursor. */
  onPlaceTable?: (objId: string) => void;
  /** Selected presentation design. Presentation only — the mathematics,
   *  conveyor and navigation behaviour are identical for every design. */
  displayStyle?: FloatingDisplayStyleId;
  /** Phone/tablet only: reports the workspace's real rendered height and its
   *  distance from the board bottom, so the parent can suspend the eraser and
   *  the # control directly above it whatever the chosen design measures. */
  onMeasure?: (m: { height: number; bottom: number } | null) => void;

}

export const FloatingNumberPanel = ({
  chromeFg,
  reservoirs, viewIdx, activeIdx, visible,
  onInsert, onInsertMatrix, onInsertFrac, activeLineIdx, consumedAbsIdx, onUse, onUnuse,
  leftPx,
  viewportBottomInset = 0,
  onPing, beatId,
  lineNumber, lineCount, lineLabel, tagOfLineIdx, onPrevLine, onNextLine,
  notebookText,
  noteObjectCount = 0,
  onShowNoteObjects,
  onWriteNotebookToBoard,
  onNotebookRead,
  frozen = false,
  notebookPending = false,
  placeholderColor,
  tableChip = null,
  displayStyle,
  onPlaceTable,
  onMeasure,

}: Props) => {
  const sbRoot = useSmartboardRoot();
  const touchLayout = useIsTouchLayout();
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<number>(0);
  // How many already-USED numbers are currently revealed (green) on the left of
  // the single strip. 0 = pure forward view of unused numbers. Backward grows
  // this (revealing used numbers), Forward shrinks it back to 0.
  const [reveal, setReveal] = useState<number>(0);
  // Order in which numbers were tapped/used — drives which used number reappears
  // first when scrolling Backward (most-recently-relevant per the spec).
  const [usedOrder, setUsedOrder] = useState<number[]>([]);
  const [reentryOffset, setReentryOffset] = useState<number>(0);
  const reservoir = reservoirs[viewIdx];
  const fragments = useMemo<string[]>(
    // Extraction only — the master token from Present Preview passes through
    // the internal validation stage and reaches the display unchanged.
    () => (reservoir?.fragments ?? []).map((t) => validateFloatingToken(t, t)),
    [reservoir],
  );
  const lines: ReservoirLine[] = reservoir?.lines ?? [];

  const viewingActive = viewIdx === activeIdx;
  const useLineMode =
    viewingActive && lines.length > 0 && activeLineIdx != null && activeLineIdx < lines.length;

  const unconsumedOfLine = (k: number): number[] => {
    const line = lines[k];
    if (!line) return [];
    const consumed = consumedAbsIdx ?? new Set<number>();
    const out: number[] = [];
    for (let i = line.fragmentStart; i < line.fragmentEnd; i++) if (!consumed.has(i)) out.push(i);
    return out;
  };

  const consumedOfLine = (k: number): number[] => {
    const line = lines[k];
    if (!line) return [];
    const consumed = consumedAbsIdx ?? new Set<number>();
    const out: number[] = [];
    for (let i = line.fragmentStart; i < line.fragmentEnd; i++) if (consumed.has(i)) out.push(i);
    return out;
  };

  type Slot = { token: string; absIdx: number };

  /** Full ordered slot list for the active line — ALL fragments (used +
   *  unused) in the teacher's saved order. The rotation cycles the entire
   *  equation; chips already consumed reappear as plain white when they
   *  loop back from the right (still tappable for re-use). */
  const allSlots = useMemo<Slot[]>(() => {
    if (fragments.length === 0) return [];
    if (useLineMode) {
      const line = lines[activeLineIdx as number];
      if (!line) return [];
      const out: Slot[] = [];
      for (let i = line.fragmentStart; i < line.fragmentEnd; i++) {
        out.push({ token: fragments[i], absIdx: i });
      }
      return out.filter((s) => s.token.trim().length > 0);
    }
    return fragments
      .map((token, idx) => ({ token, absIdx: idx }))
      .filter((s) => s.token.trim().length > 0);
  }, [fragments, useLineMode, activeLineIdx, lines]); // eslint-disable-line react-hooks/exhaustive-deps

  /** USED zone (left) — the active line's fragments already tapped/used. */
  const usedSlots = useMemo<Slot[]>(() => {
    if (fragments.length === 0) return [];
    if (useLineMode) {
      const k = activeLineIdx as number;
      return consumedOfLine(k)
        .map((idx) => ({ token: fragments[idx], absIdx: idx }))
        .filter((s) => s.token.trim().length > 0);
    }
    const consumed = consumedAbsIdx ?? new Set<number>();
    return fragments
      .map((token, idx) => ({ token, absIdx: idx }))
      .filter((s) => consumed.has(s.absIdx) && s.token.trim().length > 0);
  }, [fragments, useLineMode, activeLineIdx, consumedAbsIdx]); // eslint-disable-line react-hooks/exhaustive-deps


  /** REMAINING (unused) flow — allSlots in teacher's saved order with
   *  consumed chips removed. It is not repeated while used chips exist: the
   *  conveyor must exhaust this hidden queue, then pull from Used oldest-first. */
  const remaining = useMemo<Slot[]>(() => {
    const consumed = consumedAbsIdx ?? new Set<number>();
    return allSlots.filter((s) => !consumed.has(s.absIdx));
  }, [allSlots, consumedAbsIdx]);

  // Reset window position whenever beat or active line changes — the panel
  // always opens on the first chip of the new line, showing no used numbers.
  useEffect(() => { setOffset(0); setReveal(0); setReentryOffset(0); }, [beatId, activeLineIdx]);

  // Wrap offset within the active flow length so the strip rotates forever.
  useEffect(() => {
    const len = remaining.length > 0 ? remaining.length : allSlots.length;
    if (len === 0) { setOffset(0); return; }
    setOffset((o) => ((o % len) + len) % len);
  }, [remaining.length, allSlots.length]);

  useEffect(() => {
    const len = Math.max(1, usedOrder.length || allSlots.length);
    setReentryOffset((o) => ((o % len) + len) % len);
  }, [usedOrder.length, allSlots.length]);

  // Keep `usedOrder` reconciled with the parent's consumed set: drop numbers no
  // longer used, append any newly-consumed ones (the tap handler already appends
  // in tap order; this effect covers resets/undo/external changes).
  useEffect(() => {
    const consumed = consumedAbsIdx ?? new Set<number>();
    setUsedOrder((prev) => {
      const kept = prev.filter((i) => consumed.has(i));
      const present = new Set(kept);
      const added: number[] = [];
      consumed.forEach((i) => { if (!present.has(i)) added.push(i); });
      added.sort((a, b) => a - b);
      return added.length === 0 && kept.length === prev.length ? prev : [...kept, ...added];
    });
  }, [consumedAbsIdx]);

  // Used numbers for the active line, ordered MOST-RECENT FIRST so the last
  // chip the teacher tapped sits leftmost in the used zone (reversed view).
  const revealedUsed = useMemo<Slot[]>(() => {
    const inScope = new Set(usedSlots.map((s) => s.absIdx));
    return usedOrder
      .filter((i) => inScope.has(i))
      .slice()
      .reverse()
      .map((i) => ({ token: fragments[i], absIdx: i }));
  }, [usedOrder, usedSlots, fragments]);

  const oldestUsedFlow = useMemo<Slot[]>(() => {
    const inScope = new Set(usedSlots.map((s) => s.absIdx));
    return usedOrder
      .filter((i) => inScope.has(i))
      .map((i) => ({ token: fragments[i], absIdx: i }));
  }, [usedOrder, usedSlots, fragments]);

  // Clamp reveal to the number of used numbers available.
  const clampedReveal = Math.min(reveal, revealedUsed.length);
  useEffect(() => {
    if (reveal > revealedUsed.length) setReveal(revealedUsed.length);
  }, [reveal, revealedUsed.length]);

  // ── The single visible strip ──────────────────────────────────────────────
  // Left zone: `clampedReveal` used chips, newest-first. Right zone: a fixed
  // five-slot window. It first consumes the hidden unused queue exactly once;
  // only when that queue cannot fill the window do oldest used chips re-enter
  // as white. This prevents "remaining list" rotation from skipping the Used
  // section.
  type StripSlot = Slot & { used: boolean };
  const windowSlots = useMemo<StripSlot[]>(() => {
    const leftUsed: StripSlot[] = revealedUsed
      .slice(0, clampedReveal)
      .map((s) => ({ ...s, used: true }));
    const needed = Math.max(0, WINDOW_SIZE - leftUsed.length);
    const rightUnused: StripSlot[] = [];

    if (remaining.length > 0) {
      const take = Math.min(needed, remaining.length);
      for (let i = 0; i < take; i++) {
        const idx = ((offset + i) % remaining.length + remaining.length) % remaining.length;
        rightUnused.push({ ...remaining[idx], used: false });
      }
    }

    const stillNeeded = needed - rightUnused.length;
    if (stillNeeded > 0) {
      const reentry = oldestUsedFlow.length > 0 ? oldestUsedFlow : (remaining.length > 0 ? remaining : allSlots);
      if (reentry.length > 0) {
        for (let i = 0; i < stillNeeded; i++) {
          const idx = ((reentryOffset + i) % reentry.length + reentry.length) % reentry.length;
          rightUnused.push({ ...reentry[idx], used: false });
        }
      }
    }
    return [...leftUsed, ...rightUnused];
  }, [revealedUsed, clampedReveal, remaining, oldestUsedFlow, allSlots, offset, reentryOffset]);

  const canPrev = clampedReveal < revealedUsed.length || remaining.length > 0 || allSlots.length > 0;
  const canNext = clampedReveal > 0 || remaining.length > 0 || allSlots.length > 0;

  /** Backward ◀ — first reveal one more used chip (newest-first), then
   *  rotate the active flow backwards. */
  const goBackward = () => {
    if (clampedReveal < revealedUsed.length) { setReveal((r) => r + 1); return; }
    const flow = remaining.length > 0 ? remaining : (oldestUsedFlow.length > 0 ? oldestUsedFlow : allSlots);
    if (flow.length > 0) {
      if (remaining.length > 0) setOffset((o) => ((o - 1) % flow.length + flow.length) % flow.length);
      else setReentryOffset((o) => ((o - 1) % flow.length + flow.length) % flow.length);
    }
  };
  /** Forward ▶ — first hide any revealed used chip, then rotate the active
   *  flow forwards. Cycles indefinitely. */
  const goForward = () => {
    if (clampedReveal > 0) { setReveal((r) => Math.max(0, r - 1)); return; }
    const flow = remaining.length > 0 ? remaining : (oldestUsedFlow.length > 0 ? oldestUsedFlow : allSlots);
    if (flow.length > 0) {
      if (remaining.length > 0) setOffset((o) => (o + 1) % flow.length);
      else setReentryOffset((o) => (o + 1) % flow.length);
    }
  };

  /** Tap an UNUSED chip: insert it on the board AND mark it used so it slides
   *  out of the strip (the next unused number flows in from the right). */
  const handleActiveTap = (label: string, absIdx: number) => {
    if (!label) return;
    if (frozen) { onPing(); return; }
    setReveal(0); // collapse any revealed used numbers so the strip compacts
    setUsedOrder((prev) => (prev.includes(absIdx) ? prev : [...prev, absIdx]));
    // Preserve the five-slot window's left anchor. If the teacher taps a
    // middle chip, earlier visible chips stay in place and only the next hidden
    // chip enters from the right. If the first chip is tapped, its successor
    // becomes the anchor. This is conveyor-belt movement, not list rotation.
    const firstSurvivor = windowSlots.find((s) => !s.used && s.absIdx !== absIdx);
    const nextRemaining = remaining.filter((s) => s.absIdx !== absIdx);
    if (nextRemaining.length > 0 && firstSurvivor) {
      const anchorPos = nextRemaining.findIndex((s) => s.absIdx === firstSurvivor.absIdx);
      setOffset(anchorPos >= 0 ? anchorPos : 0);
    } else if (nextRemaining.length > 0) {
      setOffset(0);
    } else {
      const reentryLen = Math.max(1, oldestUsedFlow.length || usedOrder.length || allSlots.length);
      setReentryOffset((o) => (o + 1) % reentryLen);
    }
    if (gridFromMatrixLatex(label) && onInsertMatrix) {
      onInsertMatrix(label);
      onUse?.(absIdx, label);
      onPing();
      return;
    }
    const frac = parseFractionChip(label);
    if (frac && onInsertFrac) {
      onInsertFrac(frac);
      onUse?.(absIdx, label);
      onPing();
      return;
    }
    const op = /^[+\-−×÷=]/.test(label);
    onInsert?.(op ? ` ${label} ` : label);
    onUse?.(absIdx, label);
    onPing();
  };

  /** Tap a USED (green) chip: un-mark it so it returns to the unused flow. */
  const handleUsedTap = (absIdx: number) => {
    if (frozen) { onPing(); return; }
    setUsedOrder((prev) => prev.filter((i) => i !== absIdx));
    onUnuse?.(absIdx);
    onPing();
  };

  /** Resolve a slot token to its display label (null = skip dirty chips). */
  const slotLabel = (token: string): string | null => {
    const gated = assertDisplaySafe(String(token ?? ""));
    if (!gated.safe || !gated.cleaned.trim()) return null;
    return gated.cleaned;
  };

  /** THE tag of the line owning a fragment (for the tiny corner badge).
   *  Never a raw reservoir index: the parent's tag authority decides, so a
   *  table row reads `T7` and a lesson line reads its step number. */
  const lineNoOf = (absIdx: number): string | null => {
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      if (absIdx >= ln.fragmentStart && absIdx < ln.fragmentEnd) {
        return tagOfLineIdx ? tagOfLineIdx(li) : String(li + 1);
      }
    }
    return null;
  };

  // New fallback positioning rule: the floating-number display is a fixed
  // viewport overlay at the bottom-left, just to the right of the hash/eraser
  // tool column. It no longer depends on vertical dragging to stay usable.
  // PHONE/TABLET: the workspace instead spans the full usable width along the
  // bottom edge, respecting safe-area insets, so the writing area keeps every
  // pixel above it. Desktop values are unchanged.
  const fixedLeft = Math.max(76, leftPx);
  const fixedBottom = Math.max(8, viewportBottomInset + 8);
  const shown = visible && reservoirs.length > 0;

  // Report the real rendered box so the parent can hang the eraser and the #
  // control immediately above it — tall designs push them up, short designs
  // let them settle down, always with the same gap.
  useEffect(() => {
    if (!touchLayout || !shown || !panelEl) { onMeasure?.(null); return; }
    const report = () =>
      onMeasure?.({ height: panelEl.getBoundingClientRect().height, bottom: fixedBottom });
    report();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(report);
      ro.observe(panelEl);
    }
    window.addEventListener("resize", report);
    window.addEventListener("orientationchange", report);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", report);
      window.removeEventListener("orientationchange", report);
    };
  }, [touchLayout, shown, panelEl, fixedBottom, onMeasure]);

  if (!shown) return null;

  // ── Presentation-agnostic pieces ────────────────────────────────────────
  // The engine builds them; the selected design only arranges them.
  const notebookNode = (() => {
    // Notebook checkpoint icon — renders IFF the line's own saved
    // note (notebookText, from the single note source) is non-empty.
    // NO fallback: a line without a real note never shows an icon
    // and can never write solution text onto the board.
    const prose = (notebookText ?? "").trim();
    // DIAGRAM LAW: a diagram is note content. The icon shows for prose
    // OR for an attached diagram — a diagram-only note is still a note.
    if (!prose && noteObjectCount === 0) return null;
    const pulse = notebookPending;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (prose) onWriteNotebookToBoard?.(prose);
          if (noteObjectCount > 0) onShowNoteObjects?.();
          onNotebookRead?.();
          onPing();
        }}
        title="Teaching note — tap to place on board"
        aria-label="Teaching note — tap to place on board"
        style={{
          background: pulse ? "#fef3c7" : "rgba(255,255,255,0.6)",
          border: pulse ? "1.5px solid #f59e0b" : "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
          padding: 5,
          marginTop: 4,
          lineHeight: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: pulse
            ? "0 0 0 3px rgba(245,158,11,0.35), 0 0 14px 4px rgba(245,158,11,0.45)"
            : "0 1px 2px rgba(0,0,0,0.08)",
          // Continuous pulse while the gate is blocked — a single
          // brief pulse was too easy to miss. It keeps glowing until
          // the teacher taps the note onto the board.
          animation: pulse ? "fnp-notebook-pulse 1.2s ease-in-out infinite" : "none",
          transition: "box-shadow 240ms ease, background 240ms ease, border-color 240ms ease",
        }}
      >
        <style>{`@keyframes fnp-notebook-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 3px rgba(245,158,11,0.35), 0 0 14px 4px rgba(245,158,11,0.45); }
          50% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(245,158,11,0.5), 0 0 22px 8px rgba(245,158,11,0.65); }
          100% { transform: scale(1); box-shadow: 0 0 0 3px rgba(245,158,11,0.35), 0 0 14px 4px rgba(245,158,11,0.45); }
        }`}</style>
        {/* Fancy notebook: hard cover + binder rings + ruled lines +
            red bookmark ribbon. Clearly reads as "Read lesson note". */}
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
          {/* back cover shadow */}
          <rect x="6.5" y="3.5" width="21" height="25" rx="2.5"
            fill={pulse ? "#fde68a" : "#e7e3d6"} stroke={pulse ? "#b45309" : "#7a6a3a"} strokeWidth="1.2"/>
          {/* front page */}
          <rect x="9" y="5" width="18" height="22" rx="1.8"
            fill={pulse ? "#fffbeb" : "#fdfcf5"} stroke={pulse ? "#b45309" : "#7a6a3a"} strokeWidth="1.1"/>
          {/* ruled lines */}
          <g stroke={pulse ? "#b45309" : "#9b8b5a"} strokeWidth="0.9" strokeLinecap="round">
            <line x1="12" y1="10" x2="24" y2="10" />
            <line x1="12" y1="13.5" x2="24" y2="13.5" />
            <line x1="12" y1="17" x2="22" y2="17" />
            <line x1="12" y1="20.5" x2="24" y2="20.5" />
            <line x1="12" y1="24" x2="20" y2="24" />
          </g>
          {/* binder rings */}
          <g fill="none" stroke={pulse ? "#92400e" : "#5a4a25"} strokeWidth="1.3">
            <circle cx="9" cy="9" r="1.1" />
            <circle cx="9" cy="16" r="1.1" />
            <circle cx="9" cy="23" r="1.1" />
          </g>
          {/* bookmark ribbon */}
          <path d="M21 5 V13 L23 11 L25 13 V5 Z"
            fill={pulse ? "#dc2626" : "#b91c1c"} stroke="#7a1010" strokeWidth="0.6" strokeLinejoin="round"/>
        </svg>
      </button>
    );
  })();

  const chipsNode = tableChip ? (
    /* This lesson line IS a Smart Table / Matrix. It shows one chip —
       instead of equation fragments. Tapping it places the object on
       the board at the teacher's cursor. The object is
       permanent: removing it from the board never removes this chip. */
    <button
      onClick={(e) => { e.stopPropagation(); onPlaceTable?.(tableChip.objId); onPing(); }}
      className="transition-transform hover:scale-110 active:scale-95"
      title={tableChip.placed
        ? `${tableChip.label} — on board. Tap to place it again at the cursor.`
        : `${tableChip.label} — tap to place it on the board at your cursor`}
      aria-label={`${tableChip.label} — tap to place on board`}
      style={{
        background: tableChip.placed ? "#d1fae5" : "transparent",
        border: tableChip.placed ? "1px solid #6ee7b7" : "1px solid rgba(0,0,0,0.12)",
        borderRadius: 8,
        padding: "2px 8px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: tableChip.placed ? "#065f46" : "#111827",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: 15,
      }}
    >
      {tableChip.isMatrix ? <span style={{ fontWeight: 800, fontSize: 17 }}>[ ]</span> : <TableIcon size={20} />}
      <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tableChip.label}
      </span>
    </button>
  ) : windowSlots.length === 0 ? (
    <span style={{ opacity: 0.5, fontSize: 13, color: "#374151" }}>
      no floating numbers
    </span>
  ) : (
    <>
      {windowSlots.map(({ token, absIdx, used }, i) => {
        const label = slotLabel(token);
        if (label == null) return null;
        const lineNo = lineNoOf(absIdx);
        const ink = used ? "#065f46" : "#111827";
        return (
          <button
            key={`fn-${viewIdx}-${absIdx}-${i}`}
            onClick={(e) => {
              e.stopPropagation();
              if (used) handleUsedTap(absIdx);
              else handleActiveTap(label, absIdx);
            }}
            className="transition-transform hover:scale-110 active:scale-95 relative"
            style={{
              background: used ? "#d1fae5" : "transparent",
              border: used ? "1px solid #6ee7b7" : "1px solid transparent",
              borderRadius: 8,
              color: ink,
              padding: "0 4px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
            title={used ? "Already used — tap to return it" : "Tap to use"}
          >
            <ChipLabel label={label} color={ink} placeholderColor={placeholderColor} />
            {lineNo != null && (
              <span
                aria-hidden
                style={{
                  position: "absolute", right: -2, bottom: -6,
                  fontSize: 10, lineHeight: 1, opacity: used ? 0.5 : 0.4,
                  color: ink, fontWeight: 700,
                  pointerEvents: "none", fontFamily: "ui-sans-serif, system-ui",
                }}
              >
                {lineNo}
              </span>
            )}
          </button>
        );
      })}
    </>
  );

  const canUp = Boolean(lineNumber && lineNumber > 1);
  const canDown = Boolean(lineNumber && lineCount && lineNumber < lineCount);
  const showLine = lineNumber != null && lineCount != null && lineCount > 0;

  const panel = (
    <div
      ref={setPanelEl}
      data-sb-chrome
      data-floating-halo
      onPointerDown={(e) => { e.stopPropagation(); onPing(); }}
      onClick={(e) => { e.stopPropagation(); }}
      style={{
        position: "absolute",
        zIndex: 39,
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: 0,
        cursor: "default",
        touchAction: "manipulation",
        ...(touchLayout
          ? {
              left: "max(8px, env(safe-area-inset-left))",
              right: "max(8px, env(safe-area-inset-right))",
              bottom: `calc(${fixedBottom}px + env(safe-area-inset-bottom))`,
              padding: "8px 8px",
              maxWidth: "none",
            }
          : {
              left: fixedLeft,
              bottom: fixedBottom,
              padding: "10px 12px",
              maxWidth: `calc(100% - ${fixedLeft + 12}px)`,
            }),
      }}
    >
      <FloatingDisplayFrame
        style={sanitizeFloatingStyle(displayStyle)}
        chromeFg={chromeFg}
        frozen={frozen}
        frozenTitle={frozen ? "Notebook checkpoint — tap the notebook to continue" : "Floating numbers — tap to use"}
        chips={chipsNode}
        extras={notebookNode}
        left={{ enabled: canPrev, label: "Backward", onTap: () => { goBackward(); onPing(); } }}
        right={{ enabled: canNext, label: "Forward", onTap: () => { goForward(); onPing(); } }}
        up={{ enabled: canUp, label: "Previous line", onTap: () => { onPrevLine?.(); onPing(); } }}
        down={{ enabled: canDown, label: "Next line", onTap: () => { onNextLine?.(); onPing(); } }}
        lineText={showLine ? String(lineLabel ?? lineNumber) : null}
        lineTitle={lineLabel ? `${lineLabel} of ${lineCount}` : `Line ${lineNumber} of ${lineCount}`}
      />
    </div>
  );
  return typeof document === "undefined" ? panel : createPortal(panel, sbRoot ?? document.body);

};

export default FloatingNumberPanel;
