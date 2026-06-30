// FloatingNumberPanel — no background, lives INSIDE the scrolling board
// surface so it scrolls with the active example. Vertical drag only.
// Clamped between the final written line of the band and the band bottom.
// Visibility is controlled by the parent (mutual-exclusion with the other
// two assistants). Position is remembered per beat via parent storage.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import type { Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";

const WINDOW_SIZE = 5;

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
const ChipLabel = ({ label, color }: { label: string; color: string }) => {
  const safe = assertDisplaySafe(label).cleaned;
  const frac = parseFractionChip(label);
  if (!frac) {
    return <span>{renderMathInline(safe, `fn-chip-${safe}`)}</span>;
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
        <span style={{ padding: "0 4px", whiteSpace: "nowrap" }}>{frac.num}</span>
        <span
          style={{
            display: "block",
            height: 1.4,
            alignSelf: "stretch",
            background: color,
            margin: "1px 0",
          }}
        />
        <span style={{ padding: "0 4px", whiteSpace: "nowrap" }}>{frac.den}</span>
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
  /** Called when the tapped chip is a recognised stacked fraction; the parent
   *  inserts a real frac node so the board shows a proper bar (no slash). */
  onInsertFrac?: (parts: FractionParts) => void;
  activeLineIdx?: number;
  consumedAbsIdx?: Set<number>;
  /** Mark a fragment (by absolute index) as USED — the conveyor moves it to the
   *  grey "used" zone and Check Line trusts this state instead of re-parsing ink. */
  onUse?: (absIdx: number, label: string) => void;
  /** Un-mark a fragment — returns it from the USED zone back to ACTIVE. */
  onUnuse?: (absIdx: number) => void;
  /** Board-space x in pixels (left edge of band). */
  leftPx: number;
  /** Default board-space y (panel centre). */
  defaultYPx: number;
  /** Allowed vertical range (board pixels). */
  topYPx: number;
  bottomYPx: number;
  /** Last-written line bottom in board pixels — panel may not move above. */
  finalLineBottomPx: number;
  /** One physical-row pitch in board pixels (grid.LINE_HEIGHT). Used to
   *  enforce the 3-row clearance above the panel — the panel must always
   *  sit at least 3 rows below the bottom of the last completed Lesson
   *  Line so it never crowds a fraction's denominator or a tall radical. */
  rowHeightPx?: number;
  /** Remembered Y from parent (per beat); null = use default. */
  rememberedY: number | null;
  onCommitY: (y: number) => void;
  onPing: () => void;
  beatId?: string;
  /** 1-based current floating-line for the per-beat line navigator. */
  lineNumber?: number;
  lineCount?: number;
  onPrevLine?: () => void;
  onNextLine?: () => void;
  /** When set, the page-icon will write this notebook prose onto the board
   *  (as the next line under the last solved equation) instead of showing
   *  a side-note tooltip. Empty/undefined → page icon falls back to the
   *  current line's `explanation` text. */
  notebookText?: string;
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
}

export const FloatingNumberPanel = ({
  chromeFg,
  reservoirs, viewIdx, activeIdx, visible,
  onInsert, onInsertFrac, activeLineIdx, consumedAbsIdx, onUse, onUnuse,
  leftPx, defaultYPx, topYPx, bottomYPx, finalLineBottomPx, rowHeightPx,
  rememberedY, onCommitY, onPing, beatId,
  lineNumber, lineCount, onPrevLine, onNextLine,
  notebookText,
  onWriteNotebookToBoard,
  onNotebookRead,
  frozen = false,
  notebookPending = false,
}: Props) => {
  const initialY = rememberedY ?? defaultYPx;
  const [y, setY] = useState<number>(initialY);
  const dragRef = useRef<{ dy: number } | null>(null);
  const [offset, setOffset] = useState<number>(0);
  // How many already-USED numbers are currently revealed (green) on the left of
  // the single strip. 0 = pure forward view of unused numbers. Backward grows
  // this (revealing used numbers), Forward shrinks it back to 0.
  const [reveal, setReveal] = useState<number>(0);
  // Order in which numbers were tapped/used — drives which used number reappears
  // first when scrolling Backward (most-recently-relevant per the spec).
  const [usedOrder, setUsedOrder] = useState<number[]>([]);
  const [reentryOffset, setReentryOffset] = useState<number>(0);




  // Re-anchor when active beat changes.
  useEffect(() => { setY(rememberedY ?? defaultYPx); }, [beatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-anchor to the (viewport-aware) default whenever the panel is freshly
  // shown and the user hasn't dragged it for this beat yet. Guarantees the
  // first hash-click drops the strip inside the visible screen.
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !wasVisibleRef.current && rememberedY == null) {
      setY(defaultYPx);
    }
    wasVisibleRef.current = visible;
  }, [visible, rememberedY, defaultYPx]);


  // Clamp whenever bounds shift (writing barrier / band size).
  useEffect(() => {
    setY((prev) => {
      const clearance = (rowHeightPx ?? 0) > 0 ? rowHeightPx! * 3 : 8;
      const upper = Math.max(finalLineBottomPx + clearance, topYPx);
      return Math.min(bottomYPx, Math.max(upper, prev));
    });
  }, [topYPx, bottomYPx, finalLineBottomPx, rowHeightPx]);

  const reservoir = reservoirs[viewIdx];
  const fragments = reservoir?.fragments ?? [];
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
      return out;
    }
    return fragments.map((token, idx) => ({ token, absIdx: idx }));
  }, [fragments, useLineMode, activeLineIdx, lines]); // eslint-disable-line react-hooks/exhaustive-deps

  /** USED zone (left) — the active line's fragments already tapped/used. */
  const usedSlots = useMemo<Slot[]>(() => {
    if (fragments.length === 0) return [];
    if (useLineMode) {
      const k = activeLineIdx as number;
      return consumedOfLine(k).map((idx) => ({ token: fragments[idx], absIdx: idx }));
    }
    const consumed = consumedAbsIdx ?? new Set<number>();
    return fragments
      .map((token, idx) => ({ token, absIdx: idx }))
      .filter((s) => consumed.has(s.absIdx));
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

  /** 1-based line number that owns a fragment (for the tiny corner badge). */
  const lineNoOf = (absIdx: number): number | null => {
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      if (absIdx >= ln.fragmentStart && absIdx < ln.fragmentEnd) return li + 1;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dy: e.clientY - y };
    onPing();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const next = e.clientY - dragRef.current.dy;
    const clearance = (rowHeightPx ?? 0) > 0 ? rowHeightPx! * 3 : 8;
    const upper = Math.max(finalLineBottomPx + clearance, topYPx);
    setY(Math.min(bottomYPx, Math.max(upper, next)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) onCommitY(y);
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  if (!visible || reservoirs.length === 0) return null;

  return (
    <div
      data-sb-chrome
      data-floating-halo
      onPointerDown={(e) => { e.stopPropagation(); onPing(); }}
      onPointerUp={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); }}
      style={{
        position: "absolute",
        left: leftPx,
        top: y,
        transform: "translate(0, -50%)",
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        gap: 8,
        // Generous invisible halo so taps *near* the floating-number strip
        // never bleed through to the writing surface and reposition the
        // caret. The visible chrome stays inside; only the hit zone grows.
        padding: "28px 32px",
        margin: "-22px -24px",
        // No background — blends into the board.
      }}
    >
      {/* Leading column: ▲ line-up · drag grip · line badge · ▼ line-down */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
          color: chromeFg,
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (lineNumber && lineNumber > 1) { onPrevLine?.(); onPing(); } }}
          disabled={!lineNumber || lineNumber <= 1}
          title="Previous line"
          aria-label="Previous line"
          style={{
            background: "transparent", border: 0, color: chromeFg,
            padding: 0, opacity: lineNumber && lineNumber > 1 ? 1 : 0.25,
            cursor: lineNumber && lineNumber > 1 ? "pointer" : "default",
            display: "inline-flex", alignItems: "center",
          }}
        >
          <ChevronUp size={16} />
        </button>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Drag vertically"
          style={{
            width: 14, height: 28, borderRadius: 4,
            background: `color-mix(in oklab, ${chromeFg} 35%, transparent)`,
            cursor: "grab", touchAction: "none",
          }}
        />
        {lineNumber != null && lineCount != null && lineCount > 0 && (
          <div
            style={{
              minWidth: 18,
              padding: "0 4px",
              fontSize: 11,
              lineHeight: 1.4,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
              opacity: 0.8,
            }}
            title={`Line ${lineNumber} of ${lineCount}`}
          >
            {lineNumber}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (lineNumber && lineCount && lineNumber < lineCount) { onNextLine?.(); onPing(); } }}
          disabled={!lineNumber || !lineCount || lineNumber >= lineCount}
          title="Next line"
          aria-label="Next line"
          style={{
            background: "transparent", border: 0, color: chromeFg,
            padding: 0,
            opacity: lineNumber && lineCount && lineNumber < lineCount ? 1 : 0.25,
            cursor: lineNumber && lineCount && lineNumber < lineCount ? "pointer" : "default",
            display: "inline-flex", alignItems: "center",
          }}
        >
          <ChevronDown size={16} />
        </button>
        {(() => {
          // Notebook checkpoint icon — a larger, recognisable mini-notebook
          // SVG. When the current line has an unread teaching note, it
          // pulses to draw the teacher's attention. Tapping freezes the
          // floating numbers (handled by parent) and writes the prose
          // exactly as authored onto the board.
          const prose =
            (notebookText && notebookText.trim().length > 0)
              ? notebookText
              : (useLineMode && activeLineIdx != null
                  ? lines[activeLineIdx]?.explanation
                  : undefined);
          if (!prose || !prose.trim()) return null;
          const pulse = notebookPending;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWriteNotebookToBoard?.(prose);
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
                animation: pulse ? "fnp-notebook-pulse-once 1.4s ease-out 1" : "none",
                transition: "box-shadow 240ms ease, background 240ms ease, border-color 240ms ease",
              }}
            >
              <style>{`@keyframes fnp-notebook-pulse-once {
                0% { transform: scale(1); }
                40% { transform: scale(1.08); }
                100% { transform: scale(1); }
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
        })()}
      </div>
      {/* Side-note tooltip removed — prose is now written onto the board
          via onWriteNotebookToBoard. */}
      {(
      <div
        className="flex items-center select-none"
        style={{
          color: chromeFg,
          fontSize: 22,
          gap: 8,
          fontFamily: "ui-serif, Georgia, serif",
        }}
      >
        {/* ── ONE strip: ◀ Backward · 5 numbers · Forward ▶ ──
            Numbers outside this window are hidden. Used numbers only appear
            (green) when revealed via Backward; tapping one returns it. */}
        <div
          className="flex items-center"
          style={{
            gap: 6,
            padding: "2px 6px",
            borderRadius: 10,
            background: "#ffffff",
            border: frozen ? "1px solid #f59e0b" : "1px solid #d1d5db",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
            opacity: frozen ? 0.5 : 1,
            filter: frozen ? "grayscale(0.4)" : "none",
            pointerEvents: frozen ? "none" : "auto",
            transition: "opacity 160ms ease, filter 160ms ease",
          }}
          title={frozen ? "Notebook checkpoint — tap the notebook to continue" : "Floating numbers — tap to use"}
        >
          <button
            onClick={(e) => { e.stopPropagation(); if (canPrev) { goBackward(); onPing(); } }}
            disabled={!canPrev}
            title="Backward"
            aria-label="Backward"
            style={{
              background: "transparent", border: 0, color: "#374151",
              padding: 0, opacity: canPrev ? 1 : 0.25,
              cursor: canPrev ? "pointer" : "default",
              display: "inline-flex", alignItems: "center",
            }}
          >
            <ChevronLeft size={22} />
          </button>
          {windowSlots.length === 0 ? (
            <span style={{ opacity: 0.5, fontSize: 13, color: "#374151" }}>
              no floating numbers
            </span>
          ) : windowSlots.map(({ token, absIdx, used }, i) => {
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
                <ChipLabel label={label} color={ink} />
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
          <button
            onClick={(e) => { e.stopPropagation(); if (canNext) { goForward(); onPing(); } }}
            disabled={!canNext}
            title="Forward"
            aria-label="Forward"
            style={{
              background: "transparent", border: 0, color: "#374151",
              padding: 0, opacity: canNext ? 1 : 0.25,
              cursor: canNext ? "pointer" : "default",
              display: "inline-flex", alignItems: "center",
            }}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>
      )}

    </div>
  );
};

export default FloatingNumberPanel;
