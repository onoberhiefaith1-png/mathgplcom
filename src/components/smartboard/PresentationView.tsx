// Smartboard Presentation View — an immersive, fullscreen classroom board.
// The screen itself is the frame. Surface fills edge-to-edge. Default is a
// whiteboard; a blackboard mode is available from Settings. UI chrome hides
// after a moment of inactivity so only mathematics remains present.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Settings as SettingsIcon,
  Eraser, Undo2, Redo2, ScanEye,
} from "lucide-react";

import { useNotebook } from "@/hooks/useNotebook";
import { buildBeats, buildReservoirs, beatNeedsFloatingMath, type Beat, type Reservoir } from "@/lib/smartboard/presentation";
import { mirrorLessonNoteRow, rowSignature } from "@/lib/smartboard/mirrorFromLessonNote";
import { SmartboardLessonText, containsForbiddenResidue } from "./SmartboardLessonText";

import { getPhase, phaseCapabilities } from "@/lib/smartboard/lessonPhase";
import { renderMathInline } from "@/lib/notebook/mathRender";

import {
  DEFAULT_PROFILE_ID, PROFILE_STORAGE_KEY, WRITING_PROFILES, WritingProfileId,
} from "@/lib/smartboard/writingProfiles";
import {
  DEFAULT_INK_COLOR, INK_COLOR_STORAGE_KEY, InkColorId, resolveInk,
} from "@/lib/smartboard/inkColors";
import { WritingSurface, WritingFilterDefs } from "./WritingSurface";
import { Inked } from "./Inked";
import { SettingsSheet } from "./SettingsSheet";
import { FreeWriteLayer, type FreeLineMap } from "./FreeWriteLayer";
import { StylesRail } from "./StylesRail";
import { BottomPanel, PANEL_HEIGHT, TAB_HEIGHT } from "./BottomPanel";
import { FloatingNumberPanel } from "./FloatingNumberPanel";
import { CursorScrollbar } from "./CursorScrollbar";
import { StructurePanel } from "./StructurePanel";
import { SymbolPanel } from "./SymbolPanel";
import { AssistantButtons, type Assistant } from "./AssistantButtons";
import { clampRowSpacing, getGrid, lineToY, snapToBaseline, type GridPoint } from "@/lib/smartboard/grid";
import {
  type Cursor, type Node, type Row,
  mkChar, mkSub, mkSup,
  mkFrac, mkSqrt, mkPower, mkBracket, mkAbs, mkBigOp, mkMatrix, mkAccent, mkBox,
  insertChar as treeInsertChar,
  insertNode as treeInsertNode,
  insertNodeWrapping as treeInsertNodeWrapping,
  exitCompletedScriptCursor,
  extractRunLeftOf,
  getRowAt,
  setRowAt,
  backspace as treeBackspace,
  moveLeft as treeMoveLeft,
  moveRight as treeMoveRight,
  nextEmptyRow as treeNextEmpty,
} from "@/lib/smartboard/mathTree";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";
import { rowToAscii, equationsMatch, equationsEquivalent } from "@/lib/smartboard/rowAscii";
import { type LineBulb } from "./LineStatusRail";
import { SmartLineLayer, type SmartLine, newSmartLine } from "./SmartLineLayer";
import { BoxLayer, type MagnetBox, newMagnetBox } from "./BoxLayer";
import { Minus as MinusIcon, Circle as CircleIcon, Square as SquareIcon } from "lucide-react";
import { useSmartboardSync } from "@/hooks/useSmartboardSync";
import ActiveStudentControl from "./ActiveStudentControl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { extractTermsFromAscii } from "@/lib/smartboard/floatingExtractor";
import { Check as CheckIcon, Loader2 } from "lucide-react";





type Surface = "whiteboard" | "blackboard";

const PRESENCE_SUP: Record<string, string> = {
  "⁰": "^0", "¹": "^1", "²": "^2", "³": "^3", "⁴": "^4",
  "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9",
};
const PRESENCE_SUP_DIGIT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};
const PRESENCE_SUB_DIGIT: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};
const fromPresenceDigits = (s: string, map: Record<string, string>): string =>
  [...s].map((ch) => map[ch] ?? ch).join("");

const normalizeFloatingPresence = (raw: string): string => {
  let s = String(raw ?? "");
  s = s.replace(
    /([+\-−])?([⁰¹²³⁴⁵⁶⁷⁸⁹]+)[⁄/]([₀₁₂₃₄₅₆₇₈₉]+)([a-zA-Z]*)/g,
    (_m, sign = "", num, den, tail = "") => `${sign}${fromPresenceDigits(num, PRESENCE_SUP_DIGIT)}${tail}/${fromPresenceDigits(den, PRESENCE_SUB_DIGIT)}`,
  );
  for (const [glyph, ascii] of Object.entries(PRESENCE_SUP)) s = s.split(glyph).join(ascii);
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷|⁄/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/\*\*/g, "^")
    .replace(/\(([^()]+)\)\/\(([^()]+)\)/g, "$1/$2")
    .replace(/\^\(([^()]{1,3})\)/g, "^$1");
};

const countTokenOccurrences = (haystack: string, needle: string): number => {
  if (!haystack || !needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count++;
    from = at + Math.max(1, needle.length);
  }
  return count;
};

const today = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/* ─────────────── Surface palettes ─────────────── */

const SURFACES: Record<Surface, {
  background: string;
  ink: string;
  accent: string;
  inset: string;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  hoverBg: string;
}> = {
  whiteboard: {
    background:
      "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.9) 0%, rgba(245,243,238,0.0) 55%)," +
      "radial-gradient(140% 100% at 80% 100%, rgba(225,228,232,0.55) 0%, rgba(245,243,238,0) 60%)," +
      "linear-gradient(160deg,#f6f4ef 0%,#eeece6 55%,#e8e6df 100%)",
    ink: "#1a2230",
    accent: "#8a6a1f",
    inset: "inset 0 0 120px rgba(40,45,55,0.18), inset 0 0 0 1px rgba(0,0,0,0.04)",
    chromeBg: "rgba(255,255,255,0.55)",
    chromeFg: "#2b3344",
    chromeBorder: "rgba(0,0,0,0.08)",
    hoverBg: "rgba(0,0,0,0.06)",
  },
  blackboard: {
    background:
      "radial-gradient(130% 90% at 30% 10%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 55%)," +
      "radial-gradient(140% 100% at 70% 100%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 60%)," +
      "linear-gradient(170deg,#1d2522 0%,#161c1a 55%,#111614 100%)",
    ink: "#eef1ec",
    accent: "#e8c98a",
    inset: "inset 0 0 160px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.03)",
    chromeBg: "rgba(0,0,0,0.35)",
    chromeFg: "rgba(255,255,255,0.85)",
    chromeBorder: "rgba(255,255,255,0.08)",
    hoverBg: "rgba(255,255,255,0.08)",
  },
};

/** SVG noise turned into a tileable data URL for surface micro-texture. */
const noiseUrl = (opacity: number) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>
    <filter id='n'>
      <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
      <feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${opacity} 0'/>
    </filter>
    <rect width='100%' height='100%' filter='url(#n)'/>
  </svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

const SURFACE_KEY = "smartboard:surface";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.12;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/* ─────── Floating-number usage check (Phase 1 of "Check line") ───────
   Normalises a chip so that the unicode display form ("−2", "×", "÷", "=")
   and the ascii term form ("-2", "*", "/", "=") compare equal — mirrors the
   server's normChip in grade-assessment. */
const normUsageChip = (raw: string): string => {
  let s = String(raw ?? "")
    .replace(/\u2212/g, "-") // unicode minus → hyphen
    .replace(/[–—]/g, "-")   // en/em dash → hyphen
    .replace(/\u00d7/g, "*") // × → *
    .replace(/\u00b7/g, "*") // · → *
    .replace(/\u00f7/g, "/") // ÷ → /
    .replace(/\s+/g, "")
    .trim();
  if (s.startsWith("+")) s = s.slice(1);
  return s;
};

/** Multiset of normalised chips → { key: count }. Empty/blank chips dropped. */
const chipMultiset = (chips: string[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const c of chips) {
    const k = normUsageChip(c);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

/** How many of `expected`'s chips also appear in `used` (multiset overlap). */
const multisetOverlap = (expected: Map<string, number>, used: Map<string, number>): number => {
  let n = 0;
  for (const [k, want] of expected) n += Math.min(want, used.get(k) ?? 0);
  return n;
};

/* ─────────────── Page ─────────────── */

const PresentationView = ({
  notebookId: notebookIdProp,
  classId: classIdProp = null,
  role = "teacher",
  source = null,
  assessmentId = null,
}: {
  notebookId?: string | null;
  classId?: string | null;
  role?: "teacher" | "student";
  /** When provided, the board renders from this content instead of a notebook
   *  (used by the student Assessment workspace). */
  source?: { beats: Beat[]; reservoirs: Reservoir[]; title?: string } | null;
  /** Set together with `source` to enable server-graded assessment mode. */
  assessmentId?: string | null;
} = {}) => {
  const params = useParams<{ notebookId: string }>();
  const notebookId = notebookIdProp ?? params.notebookId;
  const navigate = useNavigate();
  // Assessment mode renders from an injected source and grades via the server.
  const assessmentMode = !!source && !!assessmentId;
  const { notebook, sections, loading } = useNotebook(assessmentMode ? undefined : (notebookId ?? undefined));

  // Live classroom mirroring (disabled in assessment mode).
  const { selfId, incoming, activeStudentId, pushSnapshot, setActiveStudent } =
    useSmartboardSync({ classId: assessmentMode ? null : classIdProp, role });
  const syncEnabled = !!classIdProp && !assessmentMode;
  // In assessment mode the student edits their OWN board (canEdit true) but no
  // teacher-only chrome is shown.
  const isTeacher = role === "teacher" && !assessmentMode;
  const isActiveStudent = role === "student" && !!selfId && activeStudentId === selfId;
  const canEdit = assessmentMode ? true : (isTeacher || isActiveStudent);
  const applyingRemoteRef = useRef(false);
  const notebookBeats = useMemo(() => buildBeats(sections, notebook), [sections, notebook]);
  const notebookReservoirs = useMemo(() => buildReservoirs(sections), [sections]);
  const beats = assessmentMode && source ? source.beats : notebookBeats;
  const reservoirs = assessmentMode && source ? source.reservoirs : notebookReservoirs;

  // ── Assessment grading state (assessment mode only) ──────────────────────
  // `solvedSlots` keys are `${questionId}:${lineId}`; the value is the marks
  // awarded. Score + total are derived from this map / the assessment payload.
  const [solvedSlots, setSolvedSlots] = useState<Record<string, number>>({});
  const [assessScore, setAssessScore] = useState(0);
  const [assessChecking, setAssessChecking] = useState(false);
  // Per-line "wrong" flash keyed by absolute board line number.
  const [wrongLine, setWrongLine] = useState<number | null>(null);
  const assessTotal = useMemo(
    () =>
      assessmentMode && source
        ? source.reservoirs.reduce(
            (sum, r) => sum + r.lines.reduce((s, l) => s + (Number(l.marks) || 0), 0),
            0,
          )
        : 0,
    [assessmentMode, source],
  );

  // Seed progress from the server on open + follow live updates.
  useEffect(() => {
    if (!assessmentMode || !assessmentId) return;
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data: prog } = await supabase
        .from("assessment_progress")
        .select("solved_lines, score")
        .eq("assessment_id", assessmentId)
        .eq("student_id", uid)
        .maybeSingle();
      if (cancelled) return;
      setSolvedSlots(((prog?.solved_lines as Record<string, number>) ?? {}));
      setAssessScore(Number(prog?.score ?? 0));
    })();
    return () => { cancelled = true; };
  }, [assessmentMode, assessmentId]);

  useEffect(() => {
    if (!assessmentMode || !assessmentId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-progress-${assessmentId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessment_progress", filter: `assessment_id=eq.${assessmentId}` },
          (payload) => {
            const row = payload.new as { solved_lines?: Record<string, number>; score?: number } | null;
            if (!row) return;
            setSolvedSlots(row.solved_lines ?? {});
            setAssessScore(Number(row.score ?? 0));
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentMode, assessmentId]);





  const LESSON_CURSOR_KEY = `smartboard:lessonCursor:${notebookId ?? "_"}`;
  const [beatCursor, setBeatCursor] = useState<number>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LESSON_CURSOR_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.beatCursor === "number" && parsed.beatCursor >= 0) return parsed.beatCursor;
      }
    } catch { /* noop */ }
    return 0;
  });
  const [bandExtra, setBandExtra] = useState<Record<string, number>>({});
  const [surface, setSurface] = useState<Surface>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(SURFACE_KEY) : null;
    return saved === "blackboard" ? "blackboard" : "whiteboard";
  });
  const [profileId, setProfileId] = useState<WritingProfileId>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PROFILE_STORAGE_KEY) : null;
    return (saved as WritingProfileId) && WRITING_PROFILES[saved as WritingProfileId]
      ? (saved as WritingProfileId)
      : DEFAULT_PROFILE_ID;
  });
  const [inkColorId, setInkColorId] = useState<InkColorId>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(INK_COLOR_STORAGE_KEY) : null;
    return (saved as InkColorId) || DEFAULT_INK_COLOR;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("smartboard:bottomPanelOpen") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("smartboard:bottomPanelOpen", panelOpen ? "1" : "0"); }
    catch { /* noop */ }
  }, [panelOpen]);
  const [eraseMode, setEraseMode] = useState(false);
  const isErasingRef = useRef(false);
  // Left-rail (undo/redo) auto-hide: invisible by default, revealed on
  // pointer activity in the hit-zone, fades out after 5s of inactivity.
  const [leftToolsVisible, setLeftToolsVisible] = useState(false);
  const leftToolsTimer = useRef<number | null>(null);
  const revealLeftTools = useCallback(() => {
    setLeftToolsVisible(true);
    if (leftToolsTimer.current) window.clearTimeout(leftToolsTimer.current);
    leftToolsTimer.current = window.setTimeout(() => setLeftToolsVisible(false), 5000);
  }, []);
  // Draggable eraser: lives at a home position; while dragging it follows the
  // pointer and wipes any line it crosses. On release it animates home.
  const [eraserDrag, setEraserDrag] = useState<{ x: number; y: number } | null>(null);
  // AI line-status verification — off by default. When off, no bulbs render.
  const [verifyOn, setVerifyOn] = useState(false);

  // Invisible-grid free-writing state.
  const FREEWRITE_KEY = `smartboard:freewrite:${notebookId ?? "_"}`;
  const SENSOR_KEY = `smartboard:sensor:${notebookId ?? "_"}`;
  const ZOOM_KEY = `smartboard:zoom:${notebookId ?? "_"}`;
  const ROW_SPACING_KEY = `smartboard:rowSpacingV1:${notebookId ?? "_"}`;
  const LEGACY_LINE_SPACING_KEY = `smartboard:lineSpacingV2:${notebookId ?? "_"}`;
  const TEXT_SCALE_KEY = `smartboard:textScale:${notebookId ?? "_"}`;

  const [zoom, setZoom] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(ZOOM_KEY);
      if (raw) {
        const z = parseFloat(raw);
        if (Number.isFinite(z) && z > 0) return clampZoom(z);
      }
    } catch { /* noop */ }
    return 1;
  });
  const [rowSpacing, setRowSpacing] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(ROW_SPACING_KEY)
        ?? localStorage.getItem(LEGACY_LINE_SPACING_KEY);
      if (raw) {
        const v = parseFloat(raw);
        if (Number.isFinite(v) && v >= 0) return clampRowSpacing(v);
      }
    } catch { /* noop */ }
    return 0;
  });
  const [textScale, setTextScale] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(TEXT_SCALE_KEY);
      if (raw) {
        const v = parseFloat(raw);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch { /* noop */ }
    return 1;
  });
  useEffect(() => {
    try { localStorage.setItem(ROW_SPACING_KEY, String(rowSpacing)); } catch { /* noop */ }
  }, [ROW_SPACING_KEY, rowSpacing]);
  useEffect(() => {
    try { localStorage.setItem(TEXT_SCALE_KEY, String(textScale)); } catch { /* noop */ }
  }, [TEXT_SCALE_KEY, textScale]);
  const grid = useMemo(
    () => getGrid(zoom, rowSpacing, textScale),
    [zoom, rowSpacing, textScale],
  );

  const [sensor, setSensor] = useState<GridPoint>(() => {
    try {
      const raw = localStorage.getItem(SENSOR_KEY);
      if (raw) return JSON.parse(raw) as GridPoint;
    } catch { /* noop */ }
    return { line: 0, x: 0 };
  });
  // Cursor lives inside the active line's math tree.
  const [cursor, setCursor] = useState<Cursor>({ path: [], index: 0 });
  const cursorRef = useRef<Cursor>({ path: [], index: 0 });
  const setLiveCursor = useCallback((next: Cursor | ((prev: Cursor) => Cursor)) => {
    const resolved = typeof next === "function" ? next(cursorRef.current) : next;
    cursorRef.current = resolved;
    setCursor(resolved);
  }, []);
  const [freeLines, setFreeLines] = useState<FreeLineMap>(() => {
    try {
      const raw = localStorage.getItem(FREEWRITE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const out: FreeLineMap = {};
          for (const k of Object.keys(parsed)) {
            const v = (parsed as Record<string, unknown>)[k];
            if (Array.isArray(v) && v.every((n) => n && typeof n === "object" && "kind" in (n as object))) {
              const row = v as Row;
              // Drop any persisted row whose flattened signature still
              // contains forbidden LaTeX residue (\frac, ^{, _{ …).
              const sig = rowSignature(row);
              if (containsForbiddenResidue(sig)) continue;
              out[Number(k)] = row;
            }
          }
          return out;
        }
      }
    } catch { /* noop */ }
    return {};
  });
  // Rows in `freeLines` that contain notebook (teaching-note) prose rather
  // than the teacher's own math. These rows are READ-ONLY narration: the
  // sensor must never anchor to them, and they don't count as a "line" when
  // stepping through guided lines. Reset whenever the active example changes
  // (handled alongside other per-example state below).
  const [notebookRowLines, setNotebookRowLines] = useState<Set<number>>(() => new Set());
  const OFFSETS_KEY = `smartboard:offsets:${notebookId ?? "_"}`;
  const [lineOffsets, setLineOffsets] = useState<Record<number, number>>(() => {
    try {
      const raw = localStorage.getItem(OFFSETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const out: Record<number, number> = {};
          for (const k of Object.keys(parsed)) {
            const v = Number((parsed as Record<string, unknown>)[k]);
            if (Number.isFinite(v)) out[Number(k)] = v;
          }
          return out;
        }
      }
    } catch { /* noop */ }
    return {};
  });
  useEffect(() => {
    try { localStorage.setItem(OFFSETS_KEY, JSON.stringify(lineOffsets)); } catch { /* noop */ }
  }, [lineOffsets, OFFSETS_KEY]);
  const lineWidthsRef = useRef<Record<number, number>>({});
  // Measured DOM height of each rendered line — drives structure-aware
  // advance so the cursor never lands inside the bottom half of a fraction,
  // matrix, root, etc. Updated by FreeWriteLayer onMeasure.
  const lineHeightsRef = useRef<Record<number, number>>({});
  // Auto-landing physical line for the active Lesson Line. ArrowDown is
  // limited to at most this + 3 physical rows of manual slack.
  const autoFloorRef = useRef<number>(0);
  // Trigger re-renders when measured heights mutate (used inside the
  // floating-panel bounds calculation).
  const [heightsTick, setHeightsTick] = useState(0);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const boardScrollRef = useRef<HTMLElement>(null);

  // Track the scroll host's visible height so assistant panels can default
  // to a position INSIDE the viewport (not the off-screen band bottom).
  const [viewportH, setViewportH] = useState(0);
  useEffect(() => {
    const host = boardScrollRef.current;
    if (!host) return;
    const update = () => setViewportH(host.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);


  // Smart Line overlay objects — free-floating draggable/extendable/rotatable
  // strokes that live above the writing surface (not in the math tree).
  // Used as wide fraction bars, division strokes, or cancel/strike-through.
  const SMARTLINES_KEY = `smartboard:smartlines:${notebookId ?? "_"}`;
  const [smartLines, setSmartLines] = useState<SmartLine[]>(() => {
    try {
      const raw = localStorage.getItem(SMARTLINES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as SmartLine[];
      }
    } catch { /* noop */ }
    return [];
  });
  useEffect(() => {
    try { localStorage.setItem(SMARTLINES_KEY, JSON.stringify(smartLines)); } catch { /* noop */ }
  }, [smartLines, SMARTLINES_KEY]);

  // Magnet boxes — drop-in labelled cells that snap to a SmartLine when
  // released near it (numerator above, denominator below).
  const BOXES_KEY = `smartboard:boxes:${notebookId ?? "_"}`;
  const [boxes, setBoxes] = useState<MagnetBox[]>(() => {
    try {
      const raw = localStorage.getItem(BOXES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Drop legacy boxes that lack the new line-anchored fields.
          return (parsed as MagnetBox[]).filter(
            (b) => b && typeof b.attachedLineId === "string" && (b.side === "top" || b.side === "bottom"),
          );
        }
      }
    } catch { /* noop */ }
    return [];
  });
  useEffect(() => {
    try { localStorage.setItem(BOXES_KEY, JSON.stringify(boxes)); } catch { /* noop */ }
  }, [boxes, BOXES_KEY]);

  // "Dot" polyline tool — arm to start a chain. Each board tap adds a
  // point; from the 2nd tap onwards a locked SmartLine is drawn from the
  // previous point to the new one. Chip toggles arm/disarm; chain never
  // auto-disarms. The anchor dot shows where the next segment will start.
  const [dotArmed, setDotArmed] = useState(false);
  const [dotFirst, setDotFirst] = useState<{ x: number; y: number } | null>(null);
  const armDot = () => { setDotArmed(true); };
  const disarmDot = () => { setDotArmed(false); setDotFirst(null); };

  // Box tool — armed for 5s; placement happens automatically on the next
  // tap of the chip itself, anchored to the SmartLine nearest the sensor.
  const [boxArmed, setBoxArmed] = useState(false);
  const [boxFlashError, setBoxFlashError] = useState(false);
  const boxTimerRef = useRef<number | null>(null);
  const armBox = () => {
    setBoxArmed(true);
    if (boxTimerRef.current) window.clearTimeout(boxTimerRef.current);
  };
  const disarmBox = () => {
    setBoxArmed(false);
    if (boxTimerRef.current) window.clearTimeout(boxTimerRef.current);
  };
  const flashBoxError = () => {
    setBoxFlashError(true);
    window.setTimeout(() => setBoxFlashError(false), 600);
  };


  // Active magnet box — when set, all keystrokes / chip taps that would
  // normally go to the writing sensor route into this box instead. The
  // box's own contentEditable raises this on focus / clears on blur.
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);



  // Bumped whenever board ink changes; SmartLineLayer reads it to refresh
  // occupancy hit-tests so drag/rotate chips hide once content lands above
  // or below a line.
  const [occupancyTick, setOccupancyTick] = useState(0);

  // Wake signal for the floating shell — kept for back-compat but no longer
  // driven by the writing sensor.
  const [floatingWakeSignal, setFloatingWakeSignal] = useState(0);

  // Mutually-exclusive workspace assistant (Floating Numbers / Structures /
  // Symbols). Triggered by the three permanent activation buttons. Auto-
  // hides after 5 s of inactivity.
  const [activeAssistant, setActiveAssistant] = useState<Assistant | null>(null);
  const lastAssistantActivityRef = useRef<number>(0);
  const pingAssistant = useCallback(() => { lastAssistantActivityRef.current = Date.now(); }, []);
  const toggleAssistant = useCallback((k: Assistant) => {
    setActiveAssistant((prev) => (prev === k ? null : k));
    lastAssistantActivityRef.current = Date.now();
  }, []);
  useEffect(() => {
    if (!activeAssistant) return;
    if (activeAssistant === "numbers") return;
    lastAssistantActivityRef.current = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - lastAssistantActivityRef.current > 5000) {
        setActiveAssistant(null);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [activeAssistant]);

  // Per-beat position memory for the three assistant panels.
  // Key shape: `${kind}:${beatId}` → board-pixel coordinate.
  const [assistantYByBeat, setAssistantYByBeat] = useState<Record<string, number>>({});
  const [assistantRightByBeat, setAssistantRightByBeat] = useState<Record<string, number>>({});
  const commitAssistantY = (kind: Assistant, beatId: string | undefined, yPx: number) => {
    if (!beatId) return;
    setAssistantYByBeat((m) => ({ ...m, [`${kind}:${beatId}`]: yPx }));
  };
  const commitAssistantRight = (beatId: string | undefined, r: number) => {
    if (!beatId) return;
    setAssistantRightByBeat((m) => ({ ...m, [`symbols:${beatId}`]: r }));
  };


  const spawnSmartLine = () => {
    const host = boardScrollRef.current;
    const cx = host ? host.clientWidth / 2 : 400;
    // Spawn within the active band if possible, otherwise at current sensor.
    const lineY = grid.MARGIN_TOP + sensor.line * grid.LINE_HEIGHT + grid.LINE_HEIGHT * 0.5;
    setSmartLines((prev) => [...prev, newSmartLine(cx, lineY, grid.LINE_HEIGHT * 2)]);
  };

  /** Per-node eraser. Hit-tests at viewport (cx, cy) and removes only the
   *  individual character / structure piece under the pointer — never the
   *  whole line. Works on stray digits dropped anywhere on the canvas. */
  const eraseAtPoint = useCallback((cx: number, cy: number) => {
    if (typeof document === "undefined") return;
    const stack = document.elementsFromPoint(cx, cy);
    let targetEl: Element | null = null;
    let lineEl: Element | null = null;
    let smartLineEl: Element | null = null;
    let boxEl: Element | null = null;
    for (const el of stack) {
      if (!boxEl && (el as HTMLElement).closest("[data-erase-box-id]")) {
        boxEl = (el as HTMLElement).closest("[data-erase-box-id]");
      }
      if (!smartLineEl && (el as HTMLElement).closest("[data-erase-line-id]")) {
        smartLineEl = (el as HTMLElement).closest("[data-erase-line-id]");
      }
      if (!targetEl && (el as HTMLElement).closest("[data-erase-path]")) {
        targetEl = (el as HTMLElement).closest("[data-erase-path]");
      }
      if (!lineEl && (el as HTMLElement).closest("[data-erase-line]")) {
        lineEl = (el as HTMLElement).closest("[data-erase-line]");
      }
      if (targetEl && lineEl && smartLineEl && boxEl) break;
    }
    // Magnet boxes: removed wholesale when touched.
    if (boxEl) {
      const id = boxEl.getAttribute("data-erase-box-id");
      if (id) {
        setBoxes((prev) => prev.filter((b) => b.id !== id));
        return;
      }
    }
    // Smart Lines: removed wholesale when touched.
    if (smartLineEl) {
      const id = smartLineEl.getAttribute("data-erase-line-id");
      if (id) {
        setSmartLines((prev) => prev.filter((l) => l.id !== id));
        return;
      }
    }

    if (!targetEl || !lineEl) return;
    const rawPath = targetEl.getAttribute("data-erase-path");
    const rawLine = lineEl.getAttribute("data-erase-line");
    if (!rawPath || !rawLine) return;
    let path: number[];
    try { path = JSON.parse(rawPath); } catch { return; }
    if (!Array.isArray(path) || path.length === 0) return;
    const line = Number(rawLine);
    if (!Number.isFinite(line)) return;
    const idx = path[path.length - 1];
    const prefix = path.slice(0, -1);
    setFreeLines((m) => {
      const row = m[line];
      if (!row) return m;
      const target = getRowAt(row, prefix);
      if (!target || idx < 0 || idx >= target.length) return m;
      const newTarget = [...target.slice(0, idx), ...target.slice(idx + 1)];
      const newRow = setRowAt(row, prefix, newTarget);
      const next = { ...m };
      if (newRow.length === 0) {
        delete next[line];
      } else {
        next[line] = newRow;
      }
      return next;
    });
  }, []);

  /** Hit-test occupancy of a SmartLine: returns true when any math glyph
   *  sits within ~cellPx above or below the stroke. Used by SmartLineLayer
   *  to hide drag/rotate chips once the teacher has written into it. */
  const isLineOccupied = useCallback((line: SmartLine): boolean => {
    if (typeof document === "undefined") return false;
    const el = document.querySelector(`[data-erase-line-id="${line.id}"]`);
    if (!el) return false;
    const lr = (el as HTMLElement).getBoundingClientRect();
    const band = grid.LINE_HEIGHT;
    const topZone = { top: lr.top - band, bottom: lr.top, left: lr.left, right: lr.right };
    const botZone = { top: lr.bottom, bottom: lr.bottom + band, left: lr.left, right: lr.right };
    const glyphs = document.querySelectorAll("[data-erase-path]");
    for (const g of Array.from(glyphs)) {
      const gr = (g as HTMLElement).getBoundingClientRect();
      const cy = (gr.top + gr.bottom) / 2;
      const cx = (gr.left + gr.right) / 2;
      const inX = cx >= lr.left && cx <= lr.right;
      if (!inX) continue;
      if (cy >= topZone.top && cy <= topZone.bottom) return true;
      if (cy >= botZone.top && cy <= botZone.bottom) return true;
    }
    return false;
  }, [grid.LINE_HEIGHT]);




  /* ── Undo / redo over board writing ──
     Snapshots are { freeLines, lineOffsets }. We push the PREVIOUS state
     onto `past` every time those change (unless the change was triggered by
     undo/redo itself, in which case we skip via the `skip` flag). */
  type Snap = { freeLines: FreeLineMap; lineOffsets: Record<number, number>; smartLines: SmartLine[]; boxes: MagnetBox[] };
  const histRef = useRef<{ past: Snap[]; future: Snap[]; skip: boolean; prev: Snap }>({
    past: [],
    future: [],
    skip: false,
    prev: { freeLines, lineOffsets, smartLines, boxes },
  });
  const [, setHistTick] = useState(0);
  const bumpHist = () => setHistTick((n) => n + 1);
  useEffect(() => {
    const h = histRef.current;
    const next: Snap = { freeLines, lineOffsets, smartLines, boxes };
    if (h.skip) { h.skip = false; h.prev = next; return; }
    if (JSON.stringify(h.prev) === JSON.stringify(next)) return;
    h.past.push(h.prev);
    if (h.past.length > 200) h.past.shift();
    h.future = [];
    h.prev = next;
    bumpHist();
  }, [freeLines, lineOffsets, smartLines, boxes]);

  const doUndo = () => {
    const h = histRef.current;
    if (h.past.length === 0) return;
    const snap = h.past.pop()!;
    h.future.push(h.prev);
    h.skip = true;
    setFreeLines(snap.freeLines);
    setLineOffsets(snap.lineOffsets);
    setSmartLines(snap.smartLines);
    setBoxes(snap.boxes);
    h.prev = snap;
    bumpHist();
  };
  const doRedo = () => {
    const h = histRef.current;
    if (h.future.length === 0) return;
    const snap = h.future.pop()!;
    h.past.push(h.prev);
    h.skip = true;
    setFreeLines(snap.freeLines);
    setLineOffsets(snap.lineOffsets);
    setSmartLines(snap.smartLines);
    setBoxes(snap.boxes);
    h.prev = snap;
    bumpHist();
  };
  const canUndo = histRef.current.past.length > 0;
  const canRedo = histRef.current.future.length > 0;

  /** Scroll the board one viewport down — the "nest" gesture. The board is
   *  already an infinite scroll surface (minHeight grows past the lowest used
   *  line), so this just smooth-scrolls the existing surface. */
  const scrollDownOneView = () => {
    const host = boardScrollRef.current;
    if (!host) return;
    host.scrollBy({ top: host.clientHeight * 0.85, behavior: "smooth" });
  };


  useEffect(() => {
    try { localStorage.setItem(SENSOR_KEY, JSON.stringify(sensor)); } catch { /* noop */ }
  }, [sensor, SENSOR_KEY]);
  useEffect(() => {
    try { localStorage.setItem(FREEWRITE_KEY, JSON.stringify(freeLines)); } catch { /* noop */ }
  }, [freeLines, FREEWRITE_KEY]);
  useEffect(() => { setOccupancyTick((n) => n + 1); }, [freeLines, smartLines]);
  useEffect(() => {
    try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch { /* noop */ }
  }, [zoom, ZOOM_KEY]);

  // ── Live mirroring: apply remote board snapshots authored by someone else. ──
  useEffect(() => {
    if (!syncEnabled || !incoming) return;
    if (incoming.author && selfId && incoming.author === selfId) return; // own echo
    applyingRemoteRef.current = true;
    if (typeof incoming.beatCursor === "number") setBeatCursor(incoming.beatCursor);
    if (incoming.bandExtra) setBandExtra(incoming.bandExtra);
    if (incoming.freeLines) setFreeLines(incoming.freeLines as FreeLineMap);
    if (incoming.lineOffsets) setLineOffsets(incoming.lineOffsets);
    if (incoming.smartLines) setSmartLines(incoming.smartLines as SmartLine[]);
    if (incoming.boxes) setBoxes(incoming.boxes as MagnetBox[]);
    if (incoming.sensor) setSensor(incoming.sensor);
    if (typeof incoming.zoom === "number") setZoom(incoming.zoom);
    if (incoming.surface) setSurface(incoming.surface as Surface);
    if (incoming.profileId) setProfileId(incoming.profileId as WritingProfileId);
    if (incoming.inkColorId) setInkColorId(incoming.inkColorId as InkColorId);
    const t = window.setTimeout(() => { applyingRemoteRef.current = false; }, 0);
    return () => window.clearTimeout(t);
  }, [incoming, syncEnabled, selfId]);

  // ── Live mirroring: broadcast local board state while we hold edit rights. ──
  useEffect(() => {
    if (!syncEnabled || !canEdit) return;
    if (applyingRemoteRef.current) return;
    pushSnapshot({
      beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
      sensor, zoom, surface, profileId, inkColorId,
    });
  }, [
    syncEnabled, canEdit, pushSnapshot,
    beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
    sensor, zoom, surface, profileId, inkColorId,
  ]);



  // Keep the hidden textarea focused so keystrokes flow into the board.
  useEffect(() => {
    const t = window.setTimeout(() => hiddenInputRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(t);
  }, [sensor.line]);

  // Re-anchor the 3-row manual-slack floor whenever the sensor jumps to a
  // new Lesson Line via auto-advance / programmatic placement (i.e., any
  // move that lands *above* the current slack ceiling or above the floor).
  // ArrowDown stays inside the cap, so this never fights manual slack.
  useEffect(() => {
    const floor = Math.floor(sensor.line);
    if (floor < autoFloorRef.current || floor > autoFloorRef.current + 3) {
      autoFloorRef.current = floor;
    }
  }, [sensor.line]);

  const handleLineMeasure = (line: number, width: number, height: number) => {
    lineWidthsRef.current[line] = width;
    const prev = lineHeightsRef.current[line] ?? 0;
    // Only re-render when height crosses a row boundary — avoids thrash.
    if (Math.abs(prev - height) > 2) {
      lineHeightsRef.current[line] = height;
      setHeightsTick((t) => (t + 1) & 0xffff);
    } else {
      lineHeightsRef.current[line] = height;
    }
  };

  /** Extra physical rows occupied by a Lesson Object on `line` beyond its
   *  baseline row. A simple fraction returns 1, a tall nested structure
   *  returns 2+. Computed from the measured DOM height vs. row pitch. */
  const extraRowsFor = (line: number): number => {
    const h = lineHeightsRef.current[line] ?? 0;
    if (h <= 0) return 0;
    const lh = grid.LINE_HEIGHT;
    return Math.max(0, Math.ceil((h - lh) / lh));
  };

  /** Structure-aware reflow: when ResizeObserver discovers a previously
   *  rendered row is taller than one physical row (a stacked fraction,
   *  radical, matrix…), every row written below it must shift down by the
   *  measured deficit so prose never overlaps a denominator. Runs whenever
   *  a measured height crosses a row boundary (`heightsTick`). Idempotent:
   *  walks lines in ascending order, recomputes each row's minimum row
   *  index from the row above, and only mutates state when a shift is
   *  needed. */
  useEffect(() => {
    const heights = lineHeightsRef.current;
    const usedLines = Object.keys(freeLines)
      .map(Number)
      .filter((n) => Number.isInteger(n) && (freeLines[n]?.length ?? 0) > 0)
      .sort((a, b) => a - b);
    if (usedLines.length < 2) return;

    const remap = new Map<number, number>();
    let prevLine = usedLines[0];
    let cursor = prevLine; // last assigned line index
    for (let i = 1; i < usedLines.length; i++) {
      const orig = usedLines[i];
      const prevH = heights[prevLine] ?? 0;
      const lh = grid.LINE_HEIGHT;
      const prevExtra = prevH > 0 ? Math.max(0, Math.ceil((prevH - lh) / lh)) : 0;
      const minLine = cursor + 1 + prevExtra;
      const target = Math.max(orig, minLine);
      if (target !== orig) remap.set(orig, target);
      cursor = target;
      prevLine = orig; // height keyed by original line index
    }
    if (remap.size === 0) return;

    setFreeLines((prev) => {
      const next: typeof prev = { ...prev };
      // Apply shifts from largest to smallest to avoid clobbering.
      const entries = Array.from(remap.entries()).sort((a, b) => b[0] - a[0]);
      for (const [from, to] of entries) {
        next[to] = prev[from];
        delete next[from];
      }
      return next;
    });
    setNotebookRowLines((prev) => {
      const ns = new Set<number>();
      for (const n of prev) ns.add(remap.get(n) ?? n);
      return ns;
    });
    // Remap measured heights too so the next reflow pass is stable.
    const nextHeights: Record<number, number> = {};
    for (const [k, v] of Object.entries(heights)) {
      const n = Number(k);
      nextHeights[remap.get(n) ?? n] = v;
    }
    lineHeightsRef.current = nextHeights;
    // Shift the sensor if it sat on a remapped line.
    setSensor((s) => {
      const f = Math.floor(s.line);
      const shift = remap.get(f);
      if (shift === undefined) return s;
      return { ...s, line: s.line + (shift - f) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heightsTick]);

  /** Edit the active line's tree via a fn that returns next root + cursor. */
  const editActive = (
    fn: (row: Row, c: Cursor) => { root: Row; cursor: Cursor },
  ) => {
    const line = sensor.line;
    // Notebook-prose rows are sensor-restricted: they render auto-generated
    // narration ("The quadratic formula is:") and must never be editable.
    // The sensor must also never settle on one — if it has, swallow the
    // edit. This is the partner of the click-gate on FreeWriteLayer below.
    const floorLine = Math.floor(line);
    if (notebookRowLines.has(floorLine) || notebookRowLines.has(line)) {
      hiddenInputRef.current?.focus({ preventScroll: true });
      return;
    }
    setFreeLines((prev) => {
      const row = prev[line] ?? [];
      const res = fn(row, cursorRef.current);
      setLiveCursor(res.cursor);
      const next = { ...prev };
      if (res.root.length === 0) delete next[line];
      else next[line] = res.root;
      return next;
    });
    hiddenInputRef.current?.focus({ preventScroll: true });
  };

  /** Append input into the active magnet box (if any) instead of the board.
   *  Returns true when handled. */
  const insertIntoActiveBox = (text: string, replace = false): boolean => {
    if (!activeBoxId) return false;
    setBoxes((prev) => prev.map((b) => b.id === activeBoxId ? { ...b, text: replace ? text : b.text + text } : b));
    return true;
  };

  const insertCharAtSensor = (ch: string, mode: "mid" | "top" | "bot" = "mid") => {
    if (mode === "mid" && insertIntoActiveBox(ch)) return;
    editActive((row, c) => {
      if (mode === "mid") return treeInsertChar(row, c, ch);
      const wrap = (mode === "top" ? mkSup() : mkSub()) as Extract<Node, { kind: "sup" | "sub" }>;
      wrap.rows[0] = [mkChar(ch)];
      const res = treeInsertNode(row, c, wrap, false);
      return res;
    });
  };

  const insertPlainTextAtSensor = (text: string) => {
    if (!text) return;
    if (insertIntoActiveBox(text)) return;
    editActive((row, c) => {
      let r = row;
      let cur = c;
      for (const ch of text) {
        const safeCursor = exitCompletedScriptCursor(r, cur);
        const res = treeInsertChar(r, safeCursor, ch);
        r = res.root;
        cur = res.cursor;
      }
      return { root: r, cursor: cur };
    });
  };

  const insertNodeAtSensor = (node: Node) => {
    if (node.kind === "char" && insertIntoActiveBox(node.ch)) return;
    editActive((row, c) => treeInsertNode(row, c, node, true));
  };

  /** Back-compat: FloatingMath calls this with a plain LaTeX-ish string.
   *  Never type that raw source onto the board: mirror it through the same
   *  Lesson Note renderer first so \frac / \sqrt / slash fractions become
   *  real stacked structures before the teacher sees them. */
  const insertTextAtSensor = (text: string) => {
    if (insertIntoActiveBox(text)) return;
    const mirror = mirrorLessonNoteRow(text);
    if (!mirror.ok || mirror.row.length === 0) return;
    editActive((row, c) => {
      let r = row;
      let cur = exitCompletedScriptCursor(r, c);
      for (const node of mirror.row) {
        const subRows = node.kind === "char" ? [] : (node as Extract<Node, { rows: Row[] }>).rows;
        const descend = subRows.length > 0 && subRows.every((sub) => sub.length === 0);
        const res = treeInsertNode(r, cur, node, descend);
        r = res.root; cur = res.cursor;
      }
      return { root: r, cursor: cur };
    });
  };

  /** Write a Lesson Note prose block onto the board as its own line, placed
   *  below the last currently-written line.
   *
   *  This is the Smartboard's MIRROR entry point. The Smartboard does not
   *  render, interpret, or validate mathematics: it just mirrors what
   *  Lesson Notes produces. The raw Lesson Note source is fed through the
   *  shared mirror pipeline (`mirrorLessonNoteText`) which:
   *    1. converts LaTeX scaffolding (\frac, \sqrt, ^{}, _{}) to the
   *       friendly form the Lesson Note editor itself shows,
   *    2. runs a parity gate that refuses display when forbidden LaTeX
   *       residue remains.
   *
   *  Idempotent — if the same text is already on a line, we do not
   *  duplicate it. */
  const writeProseLineOnBoard = useCallback((rawFromLessonNote: string) => {
    const src = (rawFromLessonNote ?? "").trim();
    if (!src) return;
    // Stage through the Lesson Note mirror — this is the ONLY entry point
    // for placing Lesson Note content on the Smartboard. It returns
    // Smartboard math-tree nodes (real stacked fractions, radicals, etc.)
    // identical to how Lesson Notes itself renders the same source, and
    // refuses if any forbidden LaTeX residue survives.
    const mirror = mirrorLessonNoteRow(src);
    if (!mirror.ok || mirror.row.length === 0) return;
    const sig = mirror.signature;
    setFreeLines((prev) => {
      let maxLine = -1;
      for (const k of Object.keys(prev)) {
        const n = Number(k);
        const row = prev[n];
        if (row && row.length > 0) {
          maxLine = Math.max(maxLine, Math.floor(n));
          // Idempotency: same prose already on a line → bail.
          if (rowSignature(row) === sig) return prev;
        }
      }
      // Structure-aware placement: if the row above holds a tall Lesson
      // Object (stacked fraction, radical, matrix…), its measured DOM
      // height already extends past its baseline row. Skip those extra
      // physical rows so the new prose never lands inside a denominator.
      const extra = maxLine >= 0 ? extraRowsFor(maxLine) : 0;
      const target = Math.max(maxLine + 1 + extra, sensor.line);
      const next = { ...prev, [target]: mirror.row };
      // Tag this row as notebook prose so the sensor-anchor logic skips it
      // when computing the K-th writable line. The sensor jumps to the row
      // BELOW the notebook so the teacher writes under the teaching note.
      setNotebookRowLines((prevSet) => {
        const ns = new Set(prevSet);
        ns.add(target);
        return ns;
      });
      setSensor((s) => ({ ...s, line: target + 1, x: 0 }));
      return next;
    });
  }, [sensor.line]);

  /** Insert a real stacked fraction at the sensor (no slash). Optional sign
   *  is typed first; the frac node is created with numerator/denominator
   *  rows pre-filled so the bar shows immediately. */
  const insertFractionAtSensor = (parts: { sign: string; num: string; den: string }) => {
    if (insertIntoActiveBox(`${parts.sign}${parts.num}/${parts.den}`)) return;
    editActive((row, c) => {
      let r = row, cur = c;
      if (parts.sign) {
        const sg = parts.sign === "-" ? "−" : parts.sign;
        const res = treeInsertChar(r, cur, sg);
        r = res.root; cur = res.cursor;
      }
      const numRow: Row = [...parts.num].map((ch) => mkChar(ch));
      const denRow: Row = [...parts.den].map((ch) => mkChar(ch));
      const fracNode: Node = { kind: "frac", rows: [numRow, denRow] };
      const res = treeInsertNode(r, cur, fracNode, false);
      return res;
    });
  };

  const makeStructureNode = (kind: ContainerKind): Node | null => {
    switch (kind) {
      case "fraction":     return mkFrac();
      case "radical":      return mkSqrt(false);
      case "bracket":      return mkBracket("(", ")");
      case "power":        return mkPower();
      case "abs":          return mkAbs();
      case "log":          return mkSub();
      case "integral":     return mkBigOp("int");
      case "matrix":       return mkMatrix(2, 2);
      case "differential": return mkFrac();
      case "vector":       return mkAccent("→");
      case "box":          return mkBox();
      default:             return null;
    }
  };


  /** Translate a FloatingShell structure (□/□, √□, …) into a real math-tree
   *  Node and insert it at the active sensor. Fractions are always inserted
   *  empty — they never absorb surrounding terms (the "group ×/÷ neighbours
   *  under the bar" rule was cancelled by the teacher). Radical and power
   *  still wrap the contiguous char run immediately left of the cursor as
   *  their first slot, so typing "3" then √ lifts the 3 into the radicand. */
  const handleStructureInsert = (kind: ContainerKind) => {
    const node = makeStructureNode(kind);
    if (!node) return;

    const canWrap = kind === "radical" || kind === "power";
    if (canWrap) {
      editActive((row, c) => {
        const localRow = getRowAt(row, c.path);
        const { start, end } = extractRunLeftOf(localRow, c.index);
        if (end > start) {
          return treeInsertNodeWrapping(row, c, node, start, end, 0);
        }
        return treeInsertNode(row, c, node, true);
      });
      return;
    }
    insertNodeAtSensor(node);
  };






  /* ── Carrier position/size/zoom (lifted from FloatingShell) ──
     Lifted so the parent can auto-dodge the writing sensor and so the
     toolbar zoom buttons can target the carrier when the pointer is over
     it. */
  const [carrierPos, setCarrierPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 600,
    y: typeof window !== "undefined" ? window.innerHeight * 0.7 : 500,
  }));
  const [carrierWidth, setCarrierWidth] = useState<number | null>(null);
  const [carrierZoom, setCarrierZoom] = useState<number>(1);
  const [zoomTarget, setZoomTarget] = useState<"board" | "carrier">("board");

  // Auto-dodge: nudge the carrier vertically away from the writing sensor
  // so it never sits on top of ink. Targets only Y; teacher can still drag
  // horizontally.
  useEffect(() => {
    const host = boardScrollRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const sensorScreenY =
      rect.top + 24 + lineToY(sensor.line, grid) - host.scrollTop + grid.CARET_HEIGHT * 0.5;
    const halfH = Math.round(28 * carrierZoom);
    const band = grid.CARET_HEIGHT * 1.6 + halfH;
    const dy = carrierPos.y - sensorScreenY;
    if (Math.abs(dy) < band) {
      const push = band - Math.abs(dy);
      const targetY = sensorScreenY + (dy >= 0 ? band : -band);
      // Prefer pushing DOWN unless that would clip the viewport bottom.
      const maxY = window.innerHeight - halfH - 24;
      const next = Math.min(maxY, dy >= 0 ? carrierPos.y + push : targetY);
      if (Math.abs(next - carrierPos.y) > 1) {
        setCarrierPos((p) => ({ x: p.x, y: next }));
      }
    }
  }, [sensor.line, grid, carrierZoom, carrierPos.y, carrierPos.x]);






  useEffect(() => { try { localStorage.setItem(SURFACE_KEY, surface); } catch { /* noop */ } }, [surface]);
  useEffect(() => { try { localStorage.setItem(PROFILE_STORAGE_KEY, profileId); } catch { /* noop */ } }, [profileId]);
  useEffect(() => { try { localStorage.setItem(INK_COLOR_STORAGE_KEY, inkColorId); } catch { /* noop */ } }, [inkColorId]);

  // Chrome is manual now — pull-tabs open/close the header and styles rail.
  // No auto-hide on activity; the board stays plain while typing.

  // Focal-point zoom: when the pointer is over the carrier the toolbar
  // buttons scale the carrier's chip font; otherwise scale the board.
  const applyZoom = (next: number) => {
    if (zoomTarget === "carrier") {
      // Interpret `next` relative to board `zoom`: equal → reset, > → in, < → out.
      if (next === 1 && zoom === 1) { setCarrierZoom(1); return; }
      const step = next - zoom;
      setCarrierZoom((z) => Math.max(0.5, Math.min(2.5, z + step)));
      return;
    }
    const z = clampZoom(next);
    setZoom((prev) => {
      const host = boardScrollRef.current;
      if (host) {
        const oldY = lineToY(sensor.line, getGrid(prev, rowSpacing, textScale));
        const newY = lineToY(sensor.line, getGrid(z, rowSpacing, textScale));
        const delta = newY - oldY;
        requestAnimationFrame(() => {
          host.scrollTop = Math.max(0, host.scrollTop + delta);
        });
      }
      return z;
    });
  };



  useEffect(() => {
    if (beatCursor > beats.length - 1) setBeatCursor(Math.max(0, beats.length - 1));
  }, [beats.length, beatCursor]);

  // When Next advances the beat, smoothly scroll the active beat into
  // view AND drop the writing sensor onto the first writable line of its
  // band. Older beats stay above for the teacher to scroll back to.
  useEffect(() => {
    if (beatCursor < 0) return;
    const host = boardScrollRef.current;
    if (!host) return;
    requestAnimationFrame(() => {
      const blocks = host.querySelectorAll<HTMLElement>("[data-sb-beat]");
      const last = blocks[blocks.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        host.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    // Land the sensor inside the new beat's band (if it has one).
    const L = layouts[layouts.length - 1];
    if (L && L.bandLines > 0) {
      setSensor({ line: L.startLine + L.captionLines, x: 0 });
      setLiveCursor({ path: [], index: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatCursor]);




  // Mirror of `guidedIncomplete` (declared further down) so the keydown
  // listener can read the latest value without re-binding every render.
  const guidedIncompleteRef = useRef<boolean>(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canEdit) return; // view-only mirror: ignore all keyboard control
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault(); doRedo(); return;
      }
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isHiddenKeyboardCapture = target === hiddenInputRef.current;
      const isFormField = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (
        !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 &&
        (isHiddenKeyboardCapture || !isFormField)
      ) {
        e.preventDefault();
        insertPlainTextAtSensor(e.key);
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        // Block Next while the active example still has unfinished lines.
        if (guidedIncompleteRef.current) return;
        setBeatCursor((c) => Math.min(beats.length - 1, c + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setBeatCursor((c) => Math.max(0, c - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beats.length, canEdit, insertPlainTextAtSensor]);

  const palette = SURFACES[surface];
  const isDark = surface === "blackboard";
  const profile = WRITING_PROFILES[profileId];
  const ink = resolveInk(inkColorId, surface);
  const current = beatCursor >= 0 ? beats[beatCursor] : undefined;
  const revealed = beatCursor >= 0 ? beats.slice(0, beatCursor + 1) : [];
  const phase = getPhase(current);
  const caps = phaseCapabilities(phase);
  const floatingVisible = !!current && beatNeedsFloatingMath(current) && caps.showFloatingMath;

  /* ── Continuous-canvas layout ──
     The whole lesson lives on one vertical scroll canvas. Each beat gets
     its own band on the invisible line grid: `captionLines` for the
     header / problem text, plus `bandLines` of writable space below it
     (auto-grown when the teacher writes past the bottom). All beats are
     positioned absolutely on the canvas at `lineToY(startLine, grid)`. */
  const beatShape = (b: Beat): { caption: number; band: number } => {
    if (b.id === "__cover__") return { caption: 8, band: 0 };
    if (b.kind === "text") {
      const lines = Math.max(4, Math.ceil((b.content?.length ?? 0) / 60) + 1);
      return { caption: lines, band: 0 };
    }
    if (b.kind === "problem" || b.kind === "exercise-prompt") {
      const problemTextLines = Math.max(1, b.content?.split(/\r?\n/).length ?? 1);
      // Reserve rows for: optional example caption, question text, the
      // auto-written “Solution” label, then one clear baseline below it.
      // The first writable row must begin below “Solution”, never in the
      // gap between the question and that label.
      return { caption: Math.max(4, problemTextLines + 3), band: 12 };
    }
    return { caption: 2, band: 0 };
  };
  interface BeatLayout {
    id: string;
    beat: Beat;
    startLine: number;
    captionLines: number;
    bandLines: number;
    totalLines: number;
  }
  const layouts = useMemo<BeatLayout[]>(() => {
    let cursor = 0;
    const arr: BeatLayout[] = [];
    for (const b of revealed) {
      const shape = beatShape(b);
      const band = shape.band + (shape.band > 0 ? (bandExtra[b.id] ?? 0) : 0);
      const total = shape.caption + band + 1; // 1 line breathing gap
      arr.push({
        id: b.id, beat: b,
        startLine: cursor,
        captionLines: shape.caption,
        bandLines: band,
        totalLines: total,
      });
      cursor += total;
    }
    return arr;
  }, [revealed, bandExtra]);
  const activeLayout = layouts[layouts.length - 1];
  const bandStart = (L?: BeatLayout) => L ? L.startLine + L.captionLines : 0;
  const bandEnd = (L?: BeatLayout) => L ? L.startLine + L.captionLines + Math.max(0, L.bandLines) - 1 : 0;

  // ── Solving mode ──────────────────────────────────────────────────
  // The Solution is always "being edited" — so the writing sensor +
  // Cursor Scrollbar are permanently visible whenever the active beat
  // has a writable Solution band. The # (Floating Number) button only
  // toggles the floating-number panel; it no longer gates the cursor.
  const solvingMode = !!(activeLayout && activeLayout.bandLines > 0);

  // First empty writable row inside the active beat's band, accounting
  // for tall structures (fractions / √ / matrices) that extend their
  // visual height into rows below the row they live on. The sensor
  // MUST anchor here — never on a row that already has ink, a note, or
  // is covered by a structure above. If the whole band is full, returns
  // `bandEnd(L) + 1` so the caller can grow the band.
  const firstEmptyBandRow = useCallback((L: BeatLayout): number => {
    const a = bandStart(L), b = bandEnd(L);
    let r = a;
    while (r <= b) {
      const row = freeLines[r];
      const hasInk = !!row && row.length > 0;
      const isNote = notebookRowLines.has(r);
      if (!hasInk && !isNote) return r;
      r = r + 1 + (hasInk ? extraRowsFor(r) : 0);
    }
    return b + 1;
  // extraRowsFor reads a ref so it doesn't need to be in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, notebookRowLines]);

  // Tracks a deliberate downward push of the sensor by the teacher via
  // the Cursor Scrollbar. While set, auto-snap stops moving the sensor
  // back to the first-empty row.
  const manualPushedRef = useRef<number | null>(null);

  // When the teacher presses # to enter solving mode, anchor the sensor
  // at the first EMPTY row of the active Solution band — below the
  // last written equation/note, not at the top under "Solution".
  const prevSolvingRef = useRef(false);
  useEffect(() => {
    const was = prevSolvingRef.current;
    prevSolvingRef.current = solvingMode;
    if (!solvingMode || was) return;
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    const r = Math.min(firstEmptyBandRow(activeLayout), bandEnd(activeLayout));
    setSensor({ line: r, x: 0 });
    setLiveCursor({ path: [], index: 0 });
    autoFloorRef.current = r;
    manualPushedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvingMode, activeLayout?.id]);

  // While solving, keep the sensor pinned to the running first-empty
  // row as the teacher writes — unless they explicitly pushed it lower
  // with the Cursor Scrollbar (manualPushedRef). The push is honored
  // until the auto floor catches up.
  useEffect(() => {
    if (!solvingMode || !activeLayout || activeLayout.bandLines <= 0) return;
    const auto = Math.min(firstEmptyBandRow(activeLayout), bandEnd(activeLayout));
    if (manualPushedRef.current !== null && auto >= manualPushedRef.current) {
      manualPushedRef.current = null;
    }
    if (manualPushedRef.current !== null) return;
    autoFloorRef.current = auto;
    if (Math.floor(sensor.line) === auto) return;
    setSensor((s) => ({ ...s, line: auto, x: 0 }));
    setLiveCursor({ path: [], index: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvingMode, activeLayout?.id, freeLines, notebookRowLines, firstEmptyBandRow]);

  // Leaving the current beat (Prev/Next Section, beat click) must close
  // solving mode — the teacher must explicitly re-press # on the new
  // beat to begin solving there.
  const prevBeatIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = activeLayout?.id ?? null;
    if (prevBeatIdRef.current !== null && prevBeatIdRef.current !== id) {
      setActiveAssistant(null);
    }
    prevBeatIdRef.current = id;
  }, [activeLayout?.id]);

  /** Lines the teacher is allowed to write on across the whole lesson. */
  const allowedLineSet = useMemo(() => {
    const s = new Set<number>();
    for (const L of layouts) {
      if (L.bandLines <= 0) continue;
      const a = bandStart(L), b = bandEnd(L);
      for (let i = a; i <= b; i++) s.add(i);
    }
    return s;
  }, [layouts]);
  /** Filter the global freeLines map down to lines that fall within
   *  some beat's writable band. Ink outside (e.g. left over from when
   *  the previous beat had a larger band) is hidden. */
  const visibleFreeLines = useMemo(() => {
    const out: FreeLineMap = {};
    for (const k of Object.keys(freeLines)) {
      const ln = Number(k);
      // Allow half-line positions (e.g. 4.5) when either neighbouring full
      // line is inside an active band — these carry centred mid-line ink.
      const ok = allowedLineSet.has(ln) ||
        allowedLineSet.has(Math.floor(ln)) ||
        allowedLineSet.has(Math.ceil(ln));
      if (ok) out[ln] = freeLines[ln];
    }
    return out;
  }, [freeLines, allowedLineSet]);
  /** Clamp a candidate line to the active beat's writable band. */
  const clampToActiveBand = (ln: number): number => {
    if (!activeLayout || activeLayout.bandLines <= 0) return ln;
    const a = bandStart(activeLayout), b = bandEnd(activeLayout);
    return Math.max(a, Math.min(b, ln));
  };
  /** Lesson-aware click gate: a row is accepted only when it falls
   *  inside the ACTIVE beat's writable band AND is not a locked
   *  notebook-prose row. Clicks on captions / questions / previous
   *  beats / future beats are ignored — the sensor stays put. */
  const isLineWritable = (ln: number): boolean => {
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
    const floor = Math.floor(ln);
    const a = bandStart(activeLayout), b = bandEnd(activeLayout);
    if (floor < a || floor > b) return false;
    if (notebookRowLines.has(floor) || notebookRowLines.has(ln)) return false;
    return true;
  };
  /** Grow the active band by one when the teacher needs more room. */
  const growActiveBand = () => {
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    setBandExtra((m) => ({ ...m, [activeLayout.id]: (m[activeLayout.id] ?? 0) + 1 }));
  };



  /** Dedicated cursor-up/down nudge for the CursorScrollbar.
   *  Constrained to EMPTY rows only:
   *   • ↑ can only step back as far as the auto first-empty row.
   *   • ↓ steps to the next empty writable row; when at band end, grows
   *     the band by one and steps onto the new row.
   *  Notebook-prose rows are always skipped. Master left margin (x=0)
   *  is enforced on every nudge. */
  const nudgeCursor = useCallback((dir: 1 | -1) => {
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    const a = bandStart(activeLayout);
    const b = bandEnd(activeLayout);
    const auto = Math.min(firstEmptyBandRow(activeLayout), b + 1);
    let cand = Math.floor(sensor.line) + dir;
    while (cand >= a && cand <= b && notebookRowLines.has(cand)) cand += dir;

    if (dir === -1) {
      if (cand < auto) return; // never above first-empty
    } else {
      if (cand > b) {
        // Grow band by one row so the teacher can keep going down.
        growActiveBand();
        cand = b + 1;
      }
    }
    setSensor((s) => ({ ...s, line: cand, x: 0 }));
    setLiveCursor({ path: [], index: 0 });
    manualPushedRef.current = cand > auto ? cand : null;
  }, [activeLayout, sensor.line, notebookRowLines, firstEmptyBandRow, setLiveCursor]);

  const canCursorUp = (() => {
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
    const b = bandEnd(activeLayout);
    const auto = Math.min(firstEmptyBandRow(activeLayout), b + 1);
    return Math.floor(sensor.line) > auto;
  })();
  const canCursorDown = (() => {
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
    // ↓ can always grow the band, so it's always enabled while solving.
    return true;
  })();




  // Carrier appears only for numbered-content beats (Example / Exercise /
  // Classwork / Homework). Stays hidden during cover, topic, intro,
  // explanation and summary.
  const carrierVisible = !!current && (
    current.sectionKind === "example" ||
    current.sectionKind === "exercise" ||
    current.sectionKind === "classwork" ||
    current.sectionKind === "homework"
  );
  // Which reservoir does the active beat belong to? (-1 = none)
  const activeReservoirIdx = useMemo(
    () => (current ? reservoirs.findIndex((r) => r.beatId === current.id) : -1),
    [current, reservoirs],
  );
  // What the carrier is currently SHOWING. Snaps to active on beat change;
  // teacher can peek up/down without losing lesson position.
  const [viewReservoirIdx, setViewReservoirIdx] = useState<number>(-1);
  useEffect(() => {
    if (activeReservoirIdx >= 0) setViewReservoirIdx(activeReservoirIdx);
  }, [activeReservoirIdx]);

  /* ── Line-by-line composer state ──
     For each active example reservoir, the teacher must reproduce every
     `reservoir.lines[k].equation` on the board IN ORDER before the Next
     button is allowed to advance. Detection compares the canonical ASCII
     of each written line against the target. Tokens belonging to a
     completed line get dimmed in the carrier; structures it required get
     dimmed in the structures strip. */
  const [activeLineIdx, setActiveLineIdx] = useState<number>(0);
  const [floatingLineIdx, setFloatingLineIdx] = useState<number>(0);
  // Teacher-controlled override of which floating-number line shows in the
  // FloatingNumberPanel (via the left-side line navigator). null = auto-follow.
  const [manualFloatingLineIdx, setManualFloatingLineIdx] = useState<number | null>(null);
  // Notebook-reveal gate: when non-null, the FloatingNumberPanel is showing
  // the prose "Notebook N" instead of Line N's fillers. A second Prev/Next
  // tap commits the reveal — marks N as shown and advances to Line N.
  const [notebookRevealIdx, setNotebookRevealIdx] = useState<number | null>(null);
  const [shownNotebookIdx, setShownNotebookIdx] = useState<Set<number>>(() => new Set());
  const [consumedAbsIdx, setConsumedAbsIdx] = useState<Set<number>>(() => new Set());
  const [consumedStructures, setConsumedStructures] = useState<Set<ContainerKind>>(() => new Set());
  const activeSensorLogicalIdxRef = useRef<number | null>(null);
  const activeSensorPhysicalLineRef = useRef<number | null>(null);

  // Persist "notebook already shown" per reservoir across reloads so the
  // teacher is never re-prompted to insert a notebook that's already on the
  // board.
  const SHOWN_NB_KEY = `smartboard:shownNotebooks:${notebookId ?? "_"}:${activeReservoirIdx}`;

  // Reset composer state every time the active example changes. We do NOT
  // force activeLineIdx back to 0: the resume effect below will scan the
  // board and place the teacher on the next unsolved lesson line.
  useEffect(() => {
    setActiveLineIdx(0);
    setFloatingLineIdx(0);
    setManualFloatingLineIdx(null);
    setNotebookRevealIdx(null);
    // Hydrate persisted "notebook shown" set for this reservoir.
    let restored: Set<number> = new Set();
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(SHOWN_NB_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) restored = new Set(parsed.filter((n: unknown) => typeof n === "number"));
      }
    } catch { /* noop */ }
    setShownNotebookIdx(restored);
    setConsumedAbsIdx(new Set());
    setConsumedStructures(new Set());
    setNotebookRowLines(new Set());
    activeSensorLogicalIdxRef.current = null;
    activeSensorPhysicalLineRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReservoirIdx]);

  // Persist shownNotebookIdx whenever it changes.
  useEffect(() => {
    if (activeReservoirIdx < 0) return;
    try {
      window.localStorage.setItem(SHOWN_NB_KEY, JSON.stringify(Array.from(shownNotebookIdx)));
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownNotebookIdx, activeReservoirIdx]);

  // Persist Lesson-Line cursor (beat + active logical line) so a reload
  // restores the teacher to the same teaching step.
  useEffect(() => {
    try {
      localStorage.setItem(
        LESSON_CURSOR_KEY,
        JSON.stringify({ beatCursor, activeLineIdx }),
      );
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatCursor, activeLineIdx]);

  // On first mount, restore activeLineIdx for the current beat from
  // localStorage so the floating-number strip and sensor pick up where
  // the teacher left off.
  const didRestoreLessonCursorRef = useRef(false);
  useEffect(() => {
    if (didRestoreLessonCursorRef.current) return;
    if (activeReservoirIdx < 0) return;
    didRestoreLessonCursorRef.current = true;
    try {
      const raw = localStorage.getItem(LESSON_CURSOR_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.activeLineIdx === "number" && parsed.activeLineIdx > 0) {
        setActiveLineIdx(parsed.activeLineIdx);
        setFloatingLineIdx(parsed.activeLineIdx);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReservoirIdx]);


  const activeReservoir = activeReservoirIdx >= 0 ? reservoirs[activeReservoirIdx] : undefined;
  const guidedLines = activeReservoir?.lines ?? [];
  const hasGuidedLines = guidedLines.length > 0;

  // ── LINE LOCKING (sensor follows Presentation) ───────────────────────
  // Whenever the Floating Number panel advances or rewinds to a different
  // lesson line, snap the writing-sensor onto that line automatically so
  // typing always lands on the line the teacher is presenting. This is the
  // partner of the click-gate on FreeWriteLayer.onCursorChange: together
  // they enforce "Presentation decides → cursor follows".
  useEffect(() => {
    if (!hasGuidedLines || !activeLayout) return;
    // Cursor follows ONLY the automatic floating-line index (driven by
    // sensor position). The Floating Number panel's ▲/▼ updates
    // `manualFloatingLineIdx` to change which chip set is shown, but it
    // must NEVER move the writing cursor — that is now the job of the
    // dedicated CursorScrollbar on the left rail.
    const idx = Math.min(
      floatingLineIdx,
      guidedLines.length - 1,
    );
    // A presentation "line" is NOT a board row — a single logical line may
    // span multiple physical rows (or be separated from neighbours by blank
    // rows the teacher left for spacing). Anchor the sensor to the K-th
    // OCCUPIED row inside the active band, so stepping up/down jumps to the
    // row where that line's math actually lives — not to row = K.
    const a = bandStart(activeLayout);
    const b = bandEnd(activeLayout);

    // Once the current presentation line has been anchored, do not keep
    // re-solving that anchor after every keystroke. Typing changes freeLines,
    // and the old effect treated that as a reason to snap the sensor again;
    // that reset the tree cursor to the beginning, so characters appeared in
    // reverse order. Re-anchor only when the logical presentation line changes
    // (or if the sensor somehow lands on a restricted notebook row/outside the
    // active band).
    if (
      activeSensorLogicalIdxRef.current === idx &&
      sensor.line >= a && sensor.line <= b &&
      (activeSensorPhysicalLineRef.current === null || sensor.line === activeSensorPhysicalLineRef.current) &&
      !notebookRowLines.has(Math.floor(sensor.line)) &&
      !notebookRowLines.has(sensor.line)
    ) {
      return;
    }

    const occupied: number[] = [];
    for (let r = a; r <= b; r++) {
      const row = freeLines[r];
      if (!row || row.length === 0) continue;
      // Notebook-prose rows are read-only narration — they must NOT count
      // as a writable line when anchoring the sensor.
      if (notebookRowLines.has(r)) continue;
      occupied.push(r);
    }
    let target: number;
    if (idx < occupied.length) {
      target = occupied[idx];
    } else {
      const lastOcc = occupied.length > 0 ? occupied[occupied.length - 1] : a - 1;
      // Skip past any notebook-prose rows when extending below the last
      // written line — the sensor must land on the first non-notebook row.
      let cand = lastOcc + 1 + (idx - occupied.length);
      while (cand <= b && notebookRowLines.has(cand)) cand += 1;
      target = Math.min(b, cand);
    }
    if (sensor.line !== target) {
      setSensor((s) => (s.line === target ? s : { ...s, line: target, x: 0 }));
      setLiveCursor({ path: [], index: 0 });
    }
    activeSensorLogicalIdxRef.current = idx;
    activeSensorPhysicalLineRef.current = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatingLineIdx, hasGuidedLines, guidedLines.length, activeLayout?.startLine, activeLayout?.captionLines, activeLayout?.bandLines, freeLines, notebookRowLines, sensor.line]);


  // Keep Used in sync with actual board ink. Used means "currently present on
  // the whiteboard", so deleting a chip immediately returns it to the white
  // conveyor ring in its original reservoir position.
  useEffect(() => {
    if (!activeReservoir || consumedAbsIdx.size === 0) return;
    const boardText = [
      ...Object.values(freeLines).map((row) => rowToAscii(row)),
      ...boxes.map((b) => b.text ?? ""),
    ].map(normalizeFloatingPresence).join("\n");

    setConsumedAbsIdx((prev) => {
      const next = new Set(prev);
      const usedByToken = new Map<string, number>();
      let changed = false;
      Array.from(prev).sort((a, b) => a - b).forEach((idx) => {
        const token = activeReservoir.fragments[idx];
        const key = normalizeFloatingPresence(token ?? "");
        if (!key) {
          if (next.delete(idx)) changed = true;
          return;
        }
        const available = countTokenOccurrences(boardText, key);
        const used = usedByToken.get(key) ?? 0;
        if (used >= available) {
          if (next.delete(idx)) changed = true;
        } else {
          usedByToken.set(key, used + 1);
        }
      });
      return changed ? next : prev;
    });
  }, [activeReservoir, freeLines, boxes, consumedAbsIdx.size]);

  // Strict sequential advance: ONLY check the physical board line that belongs
  // to the current queue step. No scan-ahead, no "best later line", no line 9.
  // If the expected line turns green, the sensor and floating queue move down
  // together by exactly one step for fast classroom flow.
  useEffect(() => {
    if (assessmentMode) return; // assessment lines are graded server-side
    if (!hasGuidedLines) return;
    if (activeLineIdx >= guidedLines.length) return;
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    const target = guidedLines[activeLineIdx];
    if (!target) return;
    if (target.notebookOnly) {
      if (target.notebook && !shownNotebookIdx.has(activeLineIdx)) return;
      const nextIdx = Math.min(activeLineIdx + 1, guidedLines.length);
      setActiveLineIdx(nextIdx);
      setFloatingLineIdx(nextIdx);
      return;
    }
    const expectedLineNum = bandStart(activeLayout) + activeLineIdx;
    const row = freeLines[expectedLineNum];
    if (!row || row.length === 0) return;
    const ascii = rowToAscii(row);
    const eqIdx = ascii.indexOf("=");
    const lhs = eqIdx >= 0 ? ascii.slice(0, eqIdx) : "";
    const rhs = eqIdx >= 0 ? ascii.slice(eqIdx + 1) : "";
    const dangling = /[+\-−*×/÷=^]/.test(ascii.slice(-1));
    if (eqIdx < 0 || !lhs || !rhs || dangling) return;
    if (!equationsMatch(ascii, target.equation) && !equationsEquivalent(ascii, target.equation)) return;
    setConsumedAbsIdx((prev) => {
      const next = new Set(prev);
      for (let i = target.fragmentStart; i < target.fragmentEnd; i++) next.add(i);
      return next;
    });
    setConsumedStructures((prev) => {
      const next = new Set(prev);
      for (const c of target.containers) next.add(c);
      return next;
    });
    if (target.notebook && !shownNotebookIdx.has(activeLineIdx)) {
      setManualFloatingLineIdx(activeLineIdx);
      setSensor({ line: clampToActiveBand(expectedLineNum), x: 0 });
      setLiveCursor({ path: [], index: 0 });
      return;
    }
    const nextIdx = Math.min(activeLineIdx + 1, guidedLines.length);
    setActiveLineIdx(nextIdx);
    setFloatingLineIdx(nextIdx);
    setSensor({ line: clampToActiveBand(expectedLineNum + 1), x: 0 });
    setLiveCursor({ path: [], index: 0 });
  }, [freeLines, hasGuidedLines, activeLineIdx, guidedLines, activeLayout, shownNotebookIdx]);

  // ── RESUME TO HIGHEST COMPLETED LESSON LINE ──────────────────────────
  // When the teacher reopens a lesson, scan the board for already-correct
  // lesson lines and place the active line on the FIRST UNSOLVED lesson
  // line. Runs once per (reservoir, layout) — gated by a ref so subsequent
  // typing doesn't keep snapping forwards.
  const resumedReservoirRef = useRef<number>(-1);
  useEffect(() => {
    if (!hasGuidedLines || !activeLayout || activeLayout.bandLines <= 0) return;
    if (resumedReservoirRef.current === activeReservoirIdx) return;
    resumedReservoirRef.current = activeReservoirIdx;
    const a = bandStart(activeLayout);
    let highestCompleted = -1;
    for (let k = 0; k < guidedLines.length; k++) {
      const target = guidedLines[k];
      if (!target) continue;
      if (target.notebookOnly) {
        if (highestCompleted === k - 1) highestCompleted = k;
        continue;
      }
      const row = freeLines[a + k];
      if (!row || row.length === 0) continue;
      const ascii = rowToAscii(row);
      if (equationsEquivalent(ascii, target.equation) || equationsMatch(ascii, target.equation)) {
        highestCompleted = k;
        // Mark its notebook (if any) as already-shown so we never re-prompt.
        if (target.notebook) {
          setShownNotebookIdx((prev) => {
            if (prev.has(k)) return prev;
            const next = new Set(prev);
            next.add(k);
            return next;
          });
        }
      } else {
        break; // strict sequential — stop at the first gap
      }
    }
    const resumeIdx = Math.min(highestCompleted + 1, guidedLines.length);
    if (resumeIdx > 0) {
      setActiveLineIdx(resumeIdx);
      setFloatingLineIdx(resumeIdx);
      // Mark all preceding fragments / structures as consumed so the
      // floating-number strip reflects the resumed state.
      setConsumedAbsIdx((prev) => {
        const next = new Set(prev);
        for (let k = 0; k < resumeIdx; k++) {
          const t = guidedLines[k];
          if (!t) continue;
          for (let i = t.fragmentStart; i < t.fragmentEnd; i++) next.add(i);
        }
        return next;
      });
      setConsumedStructures((prev) => {
        const next = new Set(prev);
        for (let k = 0; k < resumeIdx; k++) {
          const t = guidedLines[k];
          if (!t) continue;
          for (const c of t.containers) next.add(c);
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReservoirIdx, hasGuidedLines, activeLayout?.startLine, activeLayout?.bandLines, guidedLines.length]);

  // ── INTELLIGENT ERASE ────────────────────────────────────────────────
  // If the teacher erases ink, only rewind activeLineIdx when the line
  // they erased was the MOST RECENTLY completed one. Erasing an older line
  // (with later completed lines still on the board) is a no-op — the
  // lesson has already progressed past that point.
  const prevActiveLineIdxRef = useRef<number>(activeLineIdx);
  useEffect(() => {
    prevActiveLineIdxRef.current = activeLineIdx;
  }, [activeLineIdx]);
  useEffect(() => {
    if (!hasGuidedLines || !activeLayout || activeLayout.bandLines <= 0) return;
    const a = bandStart(activeLayout);
    // Find the highest k < activeLineIdx whose target row is now empty/wrong.
    let lostTop = -1;
    for (let k = activeLineIdx - 1; k >= 0; k--) {
      const target = guidedLines[k];
      if (!target || target.notebookOnly) continue;
      const row = freeLines[a + k];
      const ascii = row ? rowToAscii(row) : "";
      const ok = !!row && row.length > 0 &&
        (equationsEquivalent(ascii, target.equation) || equationsMatch(ascii, target.equation));
      if (!ok) { lostTop = k; break; }
    }
    if (lostTop < 0) return;
    // Only rewind if the lost line is the LATEST completed one (k === activeLineIdx-1).
    if (lostTop !== activeLineIdx - 1) return;
    setActiveLineIdx(lostTop);
    setFloatingLineIdx(lostTop);
    setManualFloatingLineIdx(null);
    activeSensorLogicalIdxRef.current = null;
    activeSensorPhysicalLineRef.current = null;
    // Drop the consumed fragments/structures that belonged to the erased line.
    const target = guidedLines[lostTop];
    if (target) {
      setConsumedAbsIdx((prev) => {
        const next = new Set(prev);
        for (let i = target.fragmentStart; i < target.fragmentEnd; i++) next.delete(i);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, hasGuidedLines, activeLayout?.startLine, activeLayout?.bandLines, guidedLines.length]);


  // Per-line bulb status for the right-edge traffic-light rail.
  // Computed after auto-advance so consumed lines correctly read as green.
  const lineStatusMap = useMemo<Record<number, LineBulb>>(() => {
    if (!hasGuidedLines) return {};
    const out: Record<number, LineBulb> = {};
    // Optional band clamp — when an active band exists we still constrain
    // bulbs to that band so other examples don't leak status dots. But we
    // do NOT require a band: as soon as the teacher writes the first
    // character anywhere in this band the bulb must appear (yellow).
    const a = activeLayout ? bandStart(activeLayout) : -Infinity;
    const b = activeLayout ? bandEnd(activeLayout) : Infinity;
    const ordered = Object.keys(freeLines)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= a && n <= b)
      .sort((x, y) => x - y);
    for (const ln of ordered) {
      const row = freeLines[ln];
      if (!row || row.length === 0) continue;
      const ascii = rowToAscii(row);
      const eqIdx = ascii.indexOf("=");
      const lhs = eqIdx >= 0 ? ascii.slice(0, eqIdx) : "";
      const rhs = eqIdx >= 0 ? ascii.slice(eqIdx + 1) : "";
      const lastCh = ascii.slice(-1);
      const dangling = /[+\-−*×/÷=^]/.test(lastCh);
      const completeShape = eqIdx >= 0 && lhs.length > 0 && rhs.length > 0 && !dangling;
      if (!completeShape) {
        // ANY ink on the line → yellow ("solution in progress"). This is
        // the signal the teacher sees the instant they press the first key.
        out[ln] = "yellow";
        continue;
      }
      const expectedIdx = ln - a;
      const target = Number.isInteger(expectedIdx) ? guidedLines[expectedIdx] : undefined;
      const green = !!target && equationsEquivalent(ascii, target.equation);
      out[ln] = green ? "green" : "red";
    }
    return out;
  }, [freeLines, hasGuidedLines, guidedLines, activeLayout, activeLineIdx]);

  // ── Assessment line status + per-line server grading ─────────────────────
  const slotFor = (k: number): string | null => {
    const ln = guidedLines[k];
    if (!current || !ln?.lineId) return null;
    return `${current.id}:${ln.lineId}`;
  };

  // Bulb status for the rail in assessment mode: green = graded correct,
  // red = last check wrong, yellow = ink present and not yet correct.
  const assessLineStatusMap = useMemo<Record<number, LineBulb>>(() => {
    if (!assessmentMode || !hasGuidedLines || !current) return {};
    const out: Record<number, LineBulb> = {};
    const a = activeLayout ? bandStart(activeLayout) : 0;
    for (let k = 0; k < guidedLines.length; k++) {
      const ln = a + k;
      const slot = slotFor(k);
      const solved = slot ? slot in solvedSlots : false;
      if (solved) { out[ln] = "green"; continue; }
      if (wrongLine === ln) { out[ln] = "red"; continue; }
      const row = freeLines[ln];
      if (row && row.length > 0) out[ln] = "yellow";
    }
    return out;
  }, [assessmentMode, hasGuidedLines, current, activeLayout, guidedLines, solvedSlots, wrongLine, freeLines]);

  // How many lines of the CURRENT question are solved (for the progress strip).
  const currentSolvedCount = useMemo(() => {
    if (!assessmentMode || !current) return 0;
    let n = 0;
    for (let k = 0; k < guidedLines.length; k++) {
      const slot = slotFor(k);
      if (slot && slot in solvedSlots) n++;
    }
    return n;
  }, [assessmentMode, current, guidedLines, solvedSlots]);

  const checkActiveLine = async () => {
    if (!assessmentMode || !assessmentId || !current || !activeLayout) return;
    if (activeLineIdx >= guidedLines.length) {
      toast({ title: "All lines done", description: "You've solved every line in this question." });
      return;
    }
    const target = guidedLines[activeLineIdx];
    if (!target?.lineId) return;

    // This line's OWN floating numbers (its tag): the fragments reserved for it.
    const expectedFrags = (activeReservoir?.fragments ?? [])
      .slice(target.fragmentStart, target.fragmentEnd)
      .filter(Boolean);
    const expectedSet = chipMultiset(expectedFrags);
    const showIncomplete = (unused: string[], lineNum?: number) => {
      if (typeof lineNum === "number") setWrongLine(lineNum);
      toast({
        title: `⚠ Line ${activeLineIdx + 1} incomplete`,
        description: unused.length > 0
          ? `Unused floating numbers: ${unused.join("  ")}`
          : `Values from line ${activeLineIdx + 1} have not yet been entered.`,
        variant: "destructive",
      });
    };

    // Locate the student's row by TAG MATCH, not physical position: scan every
    // written row in the active band and pick the one whose chips overlap this
    // line's expected floating numbers the most. This lets the student write
    // the line anywhere on the board and still be recognised.
    const fallbackLineNum = clampToActiveBand(bandStart(activeLayout) + activeLineIdx);
    const writtenRows = Object.keys(freeLines)
      .map(Number)
      .filter((n) => Number.isInteger(n) && !!freeLines[n] && freeLines[n].length > 0)
      .sort((x, y) => x - y);
    if (writtenRows.length === 0) {
      showIncomplete(expectedFrags.map((frag) => String(frag).trim()).filter(Boolean), fallbackLineNum);
      return;
    }

    let expectedLineNum = fallbackLineNum;
    if (expectedSet.size > 0) {
      let bestRow = -1, bestScore = -1;
      for (const n of writtenRows) {
        const used = chipMultiset(extractTermsFromAscii(rowToAscii(freeLines[n])).map((t) => t.ascii));
        const score = multisetOverlap(expectedSet, used);
        if (score > bestScore) { bestScore = score; bestRow = n; }
      }
      if (bestRow >= 0) expectedLineNum = bestRow;
    }

    const row = freeLines[expectedLineNum];
    if (!row || row.length === 0) {
      showIncomplete(expectedFrags.map((frag) => String(frag).trim()).filter(Boolean), expectedLineNum);
      return;
    }
    const ascii = rowToAscii(row);
    const arrangement = extractTermsFromAscii(ascii).map((t) => t.ascii).filter(Boolean);

    // ── Phase 1: floating-number usage check (state-driven) ───────────────
    // The conveyor records each token as USED the moment it is tapped onto the
    // board (consumedAbsIdx). Check Line simply trusts that record: any of this
    // line's fragments not yet marked used means the line is incomplete. No ink
    // re-parsing — the tap itself is the proof the token was used.
    {
      const unused: string[] = [];
      for (let i = target.fragmentStart; i < target.fragmentEnd; i++) {
        if (consumedAbsIdx.has(i)) continue;
        const frag = (activeReservoir?.fragments ?? [])[i];
        const glyph = String(frag ?? "").trim();
        if (glyph) unused.push(glyph); // keep display glyph
      }
      if (unused.length > 0) {
        showIncomplete(unused, expectedLineNum);
        return;
      }
    }


    // ── Phase 2: mathematical validation (server-authoritative) ───────────
    const eqIdx = ascii.indexOf("=");
    const lhs = eqIdx >= 0 ? ascii.slice(0, eqIdx) : "";
    const rhs = eqIdx >= 0 ? ascii.slice(eqIdx + 1) : "";
    const dangling = /[+\-−*×/÷=^]/.test(ascii.slice(-1));
    if (eqIdx < 0 || !lhs || !rhs || dangling) {
      toast({ title: "Finish the line", description: "Make sure it's a complete equation (both sides of =).", variant: "destructive" });
      return;
    }
    if (arrangement.length === 0) return;
    setAssessChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-assessment", {
        body: { assessmentId, questionId: current.id, lineId: target.lineId, arrangement, studentAscii: ascii },
      });
      if (error) throw error;
      const res = data as { correct: boolean; score: number; solvedLines: Record<string, number> };
      if (res.correct) {
        setSolvedSlots(res.solvedLines ?? {});
        setAssessScore(Number(res.score ?? 0));
        setWrongLine((w) => (w === expectedLineNum ? null : w));
        const nextIdx = Math.min(activeLineIdx + 1, guidedLines.length);
        setActiveLineIdx(nextIdx);
        setFloatingLineIdx(nextIdx);
        setSensor({ line: clampToActiveBand(expectedLineNum + 1), x: 0 });
        setLiveCursor({ path: [], index: 0 });
        toast({ title: "✓ Line verified", description: `+${target.marks ?? 0} marks` });
      } else {
        setWrongLine(expectedLineNum);
        toast({ title: "Error in your solution", description: "Please check your arrangement.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Could not check", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setAssessChecking(false);
    }
  };



  // Structures the carrier should expose — current line first, then anything
  // still needed in upcoming lines. Used structures stay visible (just dim)
  // because the same fraction bar / radical may recur many times.
  const requiredStructures = useMemo<ContainerKind[]>(() => {
    const seen = new Set<ContainerKind>();
    const out: ContainerKind[] = [];
    // Box is always available — it's the manual numerator-cell that magnets
    // to a Smart Line to read as a fraction.
    out.push("box"); seen.add("box");
    if (hasGuidedLines) {
      const startFrom = Math.min(activeLineIdx, guidedLines.length - 1);
      for (let i = startFrom; i < guidedLines.length; i++) {
        for (const c of guidedLines[i].containers) {
          if (!seen.has(c)) { seen.add(c); out.push(c); }
        }
      }
      for (const c of consumedStructures) {
        if (!seen.has(c)) { seen.add(c); out.push(c); }
      }
    }
    return out;
  }, [hasGuidedLines, activeLineIdx, guidedLines, consumedStructures]);


  // Next is NEVER blocked. The teacher decides when to move on, whether or
  // not they have finished solving the current example. Guided line-by-line
  // verification still runs in the background so consumed tokens dim, but it
  // does not lock navigation.
  const guidedIncomplete = false;
  const canAdvanceBeat = beatCursor < beats.length - 1;
  useEffect(() => { guidedIncompleteRef.current = guidedIncomplete; }, [guidedIncomplete]);



  if (loading && !assessmentMode) {
    return (
      <div
        className="h-screen w-screen grid place-items-center text-sm"
        style={{ background: palette.background, color: palette.ink }}
      >
        Loading notebook…
      </div>
    );
  }
  if (!notebook && !assessmentMode) {
    return (
      <div
        className="h-screen w-screen grid place-items-center text-sm flex-col gap-3"
        style={{ background: palette.background, color: palette.ink }}
      >
        <p>Notebook not found.</p>
        <button
          onClick={() => navigate("/smartboard")}
          className="px-3 py-1.5 rounded-md"
          style={{ background: palette.hoverBg, color: palette.ink }}
        >
          Back to shelf
        </button>
      </div>
    );
  }

  const chromeStyle: React.CSSProperties = {
    background: palette.chromeBg,
    color: palette.chromeFg,
    borderColor: palette.chromeBorder,
    backdropFilter: "blur(10px)",
  };

  // Surface bg as a single solid colour for sub-previews inside settings.
  const surfaceFlatBg = surface === "whiteboard" ? "#f1efe9" : "#181d1b";

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{
        background: palette.background,
        color: palette.ink,
      }}
    >
      <WritingFilterDefs />

      {/* Micro-surface texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: noiseUrl(isDark ? 0.06 : 0.04),
          backgroundSize: "220px 220px",
          mixBlendMode: isDark ? "screen" : "multiply",
          opacity: isDark ? 0.55 : 0.5,
        }}
      />
      {/* Recessed inner shadow — screen edge becomes the frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: palette.inset }}
      />

      {/* Top chrome — narrow centered pill, slides out of view by default.
          Pull-tab at top-center reveals it. */}
      <header
        data-sb-chrome
        data-sb-teacher-only
        className="absolute z-20 flex items-center gap-3 px-4 py-2 border rounded-b-2xl transition-transform duration-500"
        style={{
          ...chromeStyle,
          top: 0,
          left: "50%",
          transform: `translate(-50%, ${topOpen ? "0" : "-110%"})`,
          maxWidth: "min(880px, 92vw)",
          width: "max-content",
        }}
      >
        <button
          onClick={() => navigate("/smartboard")}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
          style={{ color: palette.chromeFg }}
          aria-label="Back to shelf"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Shelf
        </button>

        <div className="flex items-baseline justify-center gap-2 text-[12px] px-2 max-w-[420px] truncate">
          <span className="font-medium truncate">{notebook?.title ?? "Untitled"}</span>
          {notebook?.subtopic && (
            <span className="opacity-60 truncate">· {notebook.subtopic}</span>
          )}
          <span className="opacity-40 tabular-nums whitespace-nowrap">· {today()}</span>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <button
            onClick={() => {
              setBeatCursor(0);
              setFreeLines({});
              lineWidthsRef.current = {};
              setSensor({ line: 0, x: 0 });
              setLiveCursor({ path: [], index: 0 });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5"
            title="Clear board"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Live zoom controls — focal point is the writing sensor. */}
          <div className="inline-flex items-center gap-0.5 ml-1 rounded-md" style={{ background: palette.hoverBg }}>
            <button
              onClick={() => applyZoom(zoom - ZOOM_STEP)}
              className="px-2 py-1 text-base leading-none"
              aria-label="Zoom out writing"
              title="Zoom out (around sensor)"
            >−</button>
            <button
              onClick={() => applyZoom(1)}
              className="px-2 py-1 tabular-nums text-[10px]"
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => applyZoom(zoom + ZOOM_STEP)}
              className="px-2 py-1 text-base leading-none"
              aria-label="Zoom in writing"
              title="Zoom in (writing gets larger)"
            >+</button>
          </div>

          <span className="px-2 opacity-50 tabular-nums">
            {beats.length === 0
              ? "0 / 0"
              : beatCursor < 0
                ? `– / ${beats.length}`
                : `${beatCursor + 1} / ${beats.length}`}
          </span>
          <button
            onClick={() => setBeatCursor((c) => Math.max(0, c - 1))}
            disabled={beatCursor <= 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md disabled:opacity-30"
            style={{ color: palette.chromeFg }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={() => canAdvanceBeat && setBeatCursor((c) => Math.min(beats.length - 1, c + 1))}
            disabled={!canAdvanceBeat}
            title={guidedIncomplete ? "Finish the current example first" : "Next"}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md disabled:opacity-30"
            style={{ background: palette.hoverBg, color: palette.chromeFg }}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Soft-glow pull-tab — TOP. Drag the header down/up. */}
      <button
        data-sb-chrome
        data-sb-teacher-only
        onClick={() => setTopOpen((v) => !v)}
        aria-label={topOpen ? "Hide top bar" : "Show top bar"}
        className="absolute z-30 top-0 left-1/2 -translate-x-1/2 grid place-items-center rounded-b-full transition-all"
        style={{
          width: 44,
          height: 18,
          marginTop: topOpen ? 44 : 0,
          color: palette.chromeFg,
          background: "transparent",
          boxShadow: `0 0 14px 2px ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          opacity: 0.55,
        }}
      >
        {topOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* RIGHT edge — Next-section button. Advances the lesson beat cursor.
          Does NOT solve, write, or fill anything on the board; equations
          stay unsolved for human interaction. Independent of the top Next. */}
      <button
        data-sb-chrome
        data-sb-teacher-only
        onClick={() => canAdvanceBeat && setBeatCursor((c) => Math.min(beats.length - 1, c + 1))}
        disabled={!canAdvanceBeat}
        aria-label="Next section"
        title={guidedIncomplete ? "Finish the current example first" : "Next section (does not solve)"}
        className="absolute z-30 top-1/2 -translate-y-1/2 grid place-items-center rounded-l-full border transition-all disabled:opacity-25"
        style={{
          right: 0,
          width: 36,
          height: 64,
          color: palette.chromeFg,
          background: palette.chromeBg,
          borderColor: palette.chromeBorder,
          boxShadow: `0 2px 14px rgba(0,0,0,0.18)`,
          backdropFilter: "blur(10px)",
        }}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Tiny styles-rail toggle, moved out of the way so the right edge
          belongs entirely to the Next-section button. */}
      <button
        data-sb-chrome
        onClick={() => setRailOpen((v) => !v)}
        aria-label={railOpen ? "Hide styles" : "Show styles"}
        className="absolute z-30 grid place-items-center rounded-l-full transition-all"
        style={{
          right: railOpen ? 168 : 0,
          top: "calc(50% + 70px)",
          width: 16,
          height: 28,
          color: palette.chromeFg,
          background: "transparent",
          boxShadow: `0 0 10px 1px ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          opacity: 0.4,
        }}
      >
        {railOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>



      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        surface={surface}
        setSurface={setSurface}
        profile={profile}
        setProfileId={setProfileId}
        inkColorId={inkColorId}
        setInkColorId={setInkColorId}
        chromeBg={palette.chromeBg}
        chromeFg={palette.chromeFg}
        chromeBorder={palette.chromeBorder}
        surfaceBg={surfaceFlatBg}
        rowSpacing={rowSpacing}
        setRowSpacing={setRowSpacing}
        textScale={textScale}
        setTextScale={setTextScale}
      />

      {/* Board body — pure surface, fills edge-to-edge. Tapping anywhere
          places the writing sensor on the nearest invisible baseline. */}
      <main
        ref={boardScrollRef}
        className="relative z-10 h-full w-full overflow-y-auto"
        style={{
          paddingTop: 24,
          // Reserve only the COLLAPSED bottom-tab height. Expanding the
          // Writing Lab no longer reflows the canvas — the panel floats
          // above as an overlay (see BottomPanel mount below).
          paddingBottom: 24 + TAB_HEIGHT,
          paddingRight: 0,
          cursor: eraseMode ? "cell" : undefined,
        }}
        onPointerDown={(e) => {
          if (!canEdit) return; // view-only mirror: no board interaction
          // The board is read-only until the teacher activates solving
          // mode via the # button. Eraser still works (handled below).
          if (!solvingMode && !eraseMode && !boxArmed && !dotArmed) return;
          if ((e.target as HTMLElement).closest("[data-sb-chrome]")) return;
          if ((e.target as HTMLElement).closest("[data-slot-idx]")) return;
          // Taps that land inside an existing math-tree row are handled by
          // the inner RowView/NodeView pointer handlers (which set the
          // cursor to a precise path, including sub-rows of √, brackets,
          // fractions). Do NOT fall through to the sensor-reset code below
          // — that would force the caret back to the row root and prevent
          // entering containers on the active line.
          if ((e.target as HTMLElement).closest("[data-erase-line]")) return;
          if (!(e.target as HTMLElement).closest("[data-erase-box-id]")) setActiveBoxId(null);
          const host = boardScrollRef.current;
          if (!host) return;
          const rect = host.getBoundingClientRect();
          const y = e.clientY - rect.top + host.scrollTop - 24;
          const x = e.clientX - rect.left;
          const snapped = snapToBaseline({ x, y }, grid);
          // Half-line snap: if the tap lands close to the gap between two
          // baselines, park the sensor at line+0.5 so operators land at the
          // mid-Y (used to centre × between two stacked fractions).
          const rawLine = (y - grid.MARGIN_TOP) / grid.LINE_HEIGHT - grid.BASELINE_OFFSET + 1;
          const frac = rawLine - Math.floor(rawLine);
          let halfLine = snapped.line;
          if (frac > 0.30 && frac < 0.70) halfLine = Math.floor(rawLine) + 0.5;

          if (eraseMode) {
            isErasingRef.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            eraseAtPoint(e.clientX, e.clientY);
            return;
          }

          // Box tool — tap near a SmartLine to drop a magnet box on the
          // side of the line where the tap landed. No nearby line → flash.
          if (boxArmed) {
            e.preventDefault();
            const MAGNET = grid.LINE_HEIGHT * 1.2;
            let best: { line: SmartLine; dist: number; cx: number; cy: number; side: "top" | "bottom" } | null = null;
            for (const l of smartLines) {
              const rad = (l.angle * Math.PI) / 180;
              const ux = Math.cos(rad), uy = Math.sin(rad);
              const half = l.length / 2;
              const ax = l.x - ux * half, ay = l.y - uy * half;
              const bx = l.x + ux * half, by = l.y + uy * half;
              const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (l.length * l.length)));
              const cx = ax + t * (bx - ax);
              const cy = ay + t * (by - ay);
              const ddx = x - cx, ddy = y - cy;
              const dist = Math.hypot(ddx, ddy);
              const cross = ux * ddy - uy * ddx;
              if (dist <= MAGNET && (!best || dist < best.dist)) {
                best = { line: l, dist, cx, cy, side: cross >= 0 ? "bottom" : "top" };
              }
            }
            if (!best) { flashBoxError(); return; }
            // Anchor is the closest point ON the line; BoxLayer offsets the
            // slot above/below by a fixed gap so digits sit clean off the rule.
            const nb = newMagnetBox(best.cx, best.cy, best.side, best.line.id);
            setBoxes((prev) => [...prev, nb]);
            setActiveBoxId(nb.id);
            disarmBox();
            return;
          }

          // Dot polyline tool — each tap drops a point and connects it
          // to the previous one with a locked SmartLine. Chip toggles
          // arm/disarm; chain continues until the teacher disarms.
          if (dotArmed) {
            e.preventDefault();
            if (!dotFirst) {
              setDotFirst({ x, y });
            } else {
              const dx = x - dotFirst.x, dy = y - dotFirst.y;
              const length = Math.hypot(dx, dy);
              if (length > 4) {
                const cx = (dotFirst.x + x) / 2;
                const cy = (dotFirst.y + y) / 2;
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                setSmartLines((prev) => [
                  ...prev,
                  newSmartLine(cx, cy, length, angle, true),
                ]);
                setDotFirst({ x, y }); // anchor moves to the new point
              }
            }
            return;
          }





          // Lesson-aware click gate: ignore taps outside the active
          // beat's writable band, on locked notebook-prose rows, and on
          // the question / caption / future beats. The sensor stays
          // exactly where it was — no silent clamping into the
          // Working Area.
          if (!isLineWritable(halfLine)) return;
          const targetLine = halfLine;
          const row = freeLines[targetLine] ?? [];
          // Master left margin rule: every Lesson Line begins at x = 0
          // (the page's MARGIN_LEFT). Clicks never introduce an
          // accidental horizontal offset — the cursor snaps back to the
          // master left margin so all rows align like a textbook.
          if (row.length === 0) {
            setLineOffsets((m) => {
              if (!(targetLine in m)) return m;
              const next = { ...m };
              delete next[targetLine];
              return next;
            });
          }
          setSensor({ line: targetLine, x: 0 });
          setLiveCursor({ path: [], index: row.length });
          hiddenInputRef.current?.focus({ preventScroll: true });


        }}
        onPointerMove={(e) => {
          if (!eraseMode || !isErasingRef.current) return;
          eraseAtPoint(e.clientX, e.clientY);
        }}
        onPointerUp={() => { isErasingRef.current = false; }}
        onPointerCancel={() => { isErasingRef.current = false; }}
        onWheel={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          applyZoom(zoom - Math.sign(e.deltaY) * ZOOM_STEP);
        }}
      >
        <WritingSurface
          profile={profile}
          inkColor={ink}
          surface={surface}
          zoom={zoom}
          className="relative mx-auto"
          style={{
            // Continuous-canvas height: enough for every revealed beat
            // plus a few empty baselines below the last band.
            minHeight: `${grid.MARGIN_TOP + grid.LINE_HEIGHT * (
              (layouts.length > 0
                ? layouts[layouts.length - 1].startLine + layouts[layouts.length - 1].totalLines
                : 10) + 10
            )}px`,
            width: "100%",
          }}
        >
          {/* All revealed beats — cover, intro, problems, summary — render
              inline on the continuous canvas, each anchored to its own
              startLine. Scrolling up reveals the previous sessions. */}
          {layouts.map((L, i) => (
            <div
              key={L.id}
              data-sb-beat
              style={{
                position: "absolute",
                top: grid.MARGIN_TOP + L.startLine * grid.LINE_HEIGHT,
                left: 0,
                right: 0,
                paddingLeft: grid.MARGIN_LEFT,
                paddingRight: 32,
                pointerEvents: "none",
              }}
            >
              <div style={{ pointerEvents: "auto", maxWidth: "64rem" }}>
                <BeatBlock
                  beat={L.beat}
                  isCurrent={i === layouts.length - 1}
                  ink={ink}
                  accent={palette.accent}
                  jitter={profile.strokeJitter}
                  notebookTitle={notebook?.title ?? "Untitled"}
                  topic={notebook?.subject ?? ""}
                  subtopic={notebook?.subtopic ?? ""}
                  dateLabel={today()}
                />
              </div>
            </div>
          ))}

          {/* Invisible-grid free-writing overlay. Filtered to lines that
              fall inside some beat's writable band, so solution ink can
              never bleed above the section line into the cover / previous
              sessions. */}
          <FreeWriteLayer
            lines={visibleFreeLines}
            offsets={lineOffsets}
            grid={grid}
            activeLine={!solvingMode ? null : (activeBoxId ? null : sensor.line)}
            cursor={cursor}
            caretColor={ink}
            onMeasure={handleLineMeasure}
            onCursorChange={(line, c) => {
              if (!solvingMode) return;
              // Lesson-aware click gate: only writable rows inside the
              // active beat's working area accept caret placement.
              // Clicks on locked content (captions, question, notebook
              // prose, previous/future beats) are swallowed — the
              // sensor and live caret stay exactly where they were.
              if (!isLineWritable(line)) return;
              if (hasGuidedLines && activeLayout) {
                // The anchor effect has already placed sensor.line on the
                // correct K-th-occupied (non-notebook) row for the current
                // lesson line. Reject clicks that try to leave it.
                if (Math.floor(sensor.line) !== Math.floor(line)) return;
              }
              if (line !== sensor.line) setSensor((s) => ({ ...s, line }));
              setLiveCursor(c);
              hiddenInputRef.current?.focus({ preventScroll: true });
            }}
          />





          {/* Smart Line overlay — sits above the writing layer so teachers
              can drop wide fraction bars / division strokes / strikes
              anywhere on the canvas. */}
          <SmartLineLayer
            lines={smartLines}
            onChange={setSmartLines}
            ink={ink}
            cellPx={grid.LINE_HEIGHT}
            isLineOccupied={isLineOccupied}
            occupancyTick={occupancyTick}
          />

          <BoxLayer
            boxes={boxes}
            onChange={setBoxes}
            ink={ink}
            smartLines={smartLines}
            activeBoxId={activeBoxId}
            onActivate={setActiveBoxId}
            fontPx={grid.FONT_PX}
          />

          {/* Dot-tool first-point marker — shown after tap 1 until tap 2. */}
          {dotFirst && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: dotFirst.x - 4,
                top: dotFirst.y - 4,
                width: 8, height: 8,
                borderRadius: "50%",
                background: ink,
                boxShadow: `0 0 8px ${ink}`,
                pointerEvents: "none",
                zIndex: 27,
              }}
            />
          )}



          {/* Workspace assistants — mounted INSIDE the scrolling surface so
              they translate with the lesson content. Each lives in board
              pixels, scoped to the active example's writable band. */}
          {(() => {
            if (!activeLayout || activeLayout.bandLines <= 0 || !current) return null;
            if (!carrierVisible) return null;
            const bandTopPx = grid.MARGIN_TOP + bandStart(activeLayout) * grid.LINE_HEIGHT;
            const bandBotPx = grid.MARGIN_TOP + (bandEnd(activeLayout) + 1) * grid.LINE_HEIGHT;
            // Final written line within this band — drives the upper drag clamp.
            // Use measured DOM heights so tall structures (fractions, roots,
            // matrices) contribute their *full* vertical extent — never just
            // their first row. Falls back to one row pitch if unmeasured.
            let finalLineBottomPx = grid.MARGIN_TOP + bandStart(activeLayout) * grid.LINE_HEIGHT;
            for (const k of Object.keys(freeLines)) {
              const ln = Number(k);
              if (!freeLines[ln] || freeLines[ln].length === 0) continue;
              const flr = Math.floor(ln);
              if (flr < bandStart(activeLayout) || flr > bandEnd(activeLayout)) continue;
              const topPx = grid.MARGIN_TOP + ln * grid.LINE_HEIGHT;
              const measured = lineHeightsRef.current[ln] ?? grid.LINE_HEIGHT;
              const botPx = topPx + Math.max(grid.LINE_HEIGHT, measured);
              if (botPx > finalLineBottomPx) finalLineBottomPx = botPx;
            }
            // Reference `heightsTick` so this block re-runs when measurements update.
            void heightsTick;
            // Band-bottom anchor (original behaviour) — may sit below the fold.
            const bandDefaultY = bandBotPx - grid.LINE_HEIGHT * 0.6;
            // Viewport-aware default: drop the panel near the bottom of the
            // currently VISIBLE writable space so it's always on-screen when
            // first activated. Clamped inside the band / above the last line.
            const host = boardScrollRef.current;
            const visH = viewportH || host?.clientHeight || 0;
            const padBot = 24 + (panelOpen ? PANEL_HEIGHT : TAB_HEIGHT);
            const upperBound = Math.max(finalLineBottomPx + 8, bandTopPx + 8);
            let defaultY = bandDefaultY;
            if (host && visH > 0) {
              const visibleBottom = host.scrollTop + visH - padBot;
              const onScreenDefault = visibleBottom - grid.LINE_HEIGHT * 1.1;
              defaultY = Math.min(bandDefaultY, onScreenDefault);
              defaultY = Math.max(upperBound, Math.min(defaultY, bandDefaultY));
            }

            // Structure panel anchors to the same viewport-aware spot as the
            // floating-number strip, lifted ~1.6 lines so it never collides
            // with the fixed bottom-right Check button. It is clamped inside
            // the VISIBLE band (not below the last written line) so tapping the
            // structure (F) icon always drops it on-screen, inside the work area.
            const structureDefaultY = Math.max(
              bandTopPx + 8,
              Math.min(bandBotPx - 8, defaultY - grid.LINE_HEIGHT * 1.6),
            );

            const beatKey = current.id;
            const stY = assistantYByBeat[`structures:${beatKey}`] ?? null;
            const syY = assistantYByBeat[`symbols:${beatKey}`] ?? null;
            const syR = assistantRightByBeat[`symbols:${beatKey}`] ?? null;
            const curLineIdx = hasGuidedLines
              ? Math.min(manualFloatingLineIdx ?? floatingLineIdx, guidedLines.length - 1)
              : 0;
            const lineCount = guidedLines.length;
            const notebookFor = (k: number): string => {
              const nb = (guidedLines[k] as { notebook?: string } | undefined)?.notebook;
              return (nb ?? "").trim();
            };
            // Cursor movement: teacher may freely traverse every line up to
            // the last one. The down-chevron naturally disables at the bottom
            // (cur >= total) so the teacher sees the line is blocked.
            const maxReachable = lineCount - 1;
            const stepTo = (target: number) => {
              if (!hasGuidedLines) return;
              if (target < 0 || target >= lineCount) return;
              if (target > maxReachable) return; // out of reach — block the jump
              const currentPending = notebookFor(curLineIdx) && !shownNotebookIdx.has(curLineIdx);
              if (target > curLineIdx && currentPending) return;
              const nb = notebookFor(target);
              if (nb && !shownNotebookIdx.has(target)) {
                // Reveal Notebook N first; do NOT advance activeLineIdx yet.
                setNotebookRevealIdx(target);
              } else {
                setManualFloatingLineIdx(target);
              }
            };
            const goPrev = () => {
              if (!hasGuidedLines) return;
              if (notebookRevealIdx != null) {
                // Cancel notebook reveal — stay on current line, no advance.
                setNotebookRevealIdx(null);
                return;
              }
              stepTo(Math.max(0, curLineIdx - 1));
            };
            const goNext = () => {
              if (!hasGuidedLines) return;
              if (notebookRevealIdx != null) {
                // Commit reveal: mark notebook shown and advance to its line.
                const k = notebookRevealIdx;
                setShownNotebookIdx((prev) => {
                  const next = new Set(prev);
                  next.add(k);
                  return next;
                });
                setNotebookRevealIdx(null);
                setManualFloatingLineIdx(k);
                return;
              }
              const pending = notebookFor(curLineIdx);
              if (pending && !shownNotebookIdx.has(curLineIdx)) return;
              stepTo(Math.min(lineCount - 1, curLineIdx + 1));
            };
            const lineContainers = hasGuidedLines ? (guidedLines[curLineIdx]?.containers ?? []) : [];
            const currentNotebookText = notebookFor(curLineIdx);
            const currentNotebookPending = currentNotebookText.length > 0 && !shownNotebookIdx.has(curLineIdx);
            const revealNotebookText =
              notebookRevealIdx != null ? notebookFor(notebookRevealIdx) : currentNotebookText;
            const markCurrentNotebookRead = () => {
              const k = notebookRevealIdx ?? curLineIdx;
              setShownNotebookIdx((prev) => {
                const next = new Set(prev);
                next.add(k);
                return next;
              });
              if (notebookRevealIdx != null) {
                setNotebookRevealIdx(null);
                setManualFloatingLineIdx(k);
              }
            };
            return (
              <>
                <FloatingNumberPanel
                  chromeFg={palette.chromeFg}
                  reservoirs={reservoirs}
                  viewIdx={viewReservoirIdx >= 0 ? viewReservoirIdx : Math.max(0, activeReservoirIdx)}
                  activeIdx={activeReservoirIdx}
                  visible={activeAssistant === "numbers" && reservoirs.length > 0}
                  onInsert={(t) => insertTextAtSensor(t)}
                  onInsertFrac={(p) => insertFractionAtSensor(p)}
                  activeLineIdx={hasGuidedLines ? curLineIdx : undefined}
                  consumedAbsIdx={consumedAbsIdx}
                  onUse={(absIdx) =>
                    setConsumedAbsIdx((prev) => {
                      const next = new Set(prev);
                      next.add(absIdx);
                      return next;
                    })
                  }
                  onUnuse={(absIdx) =>
                    setConsumedAbsIdx((prev) => {
                      const next = new Set(prev);
                      next.delete(absIdx);
                      return next;
                    })
                  }
                  leftPx={grid.MARGIN_LEFT + 8}
                  viewportBottomInset={panelOpen ? PANEL_HEIGHT : TAB_HEIGHT}
                  onPing={pingAssistant}
                  beatId={beatKey}
                  lineNumber={hasGuidedLines ? curLineIdx + 1 : undefined}
                  lineCount={hasGuidedLines ? lineCount : undefined}
                  onPrevLine={goPrev}
                  onNextLine={goNext}
                  notebookText={revealNotebookText}
                  onWriteNotebookToBoard={writeProseLineOnBoard}
                  onNotebookRead={markCurrentNotebookRead}
                  frozen={false}
                  notebookPending={
                    hasGuidedLines &&
                    notebookFor(curLineIdx).length > 0 &&
                    !shownNotebookIdx.has(curLineIdx)
                  }
                />


                <StructurePanel
                  chromeFg={palette.chromeFg}
                  visible={activeAssistant === "structures"}
                  requiredStructures={lineContainers}
                  consumedStructures={consumedStructures}
                  onStructureInsert={(k) => { handleStructureInsert(k); pingAssistant(); }}
                  rightPx={64}
                  defaultYPx={structureDefaultY}
                  topYPx={bandTopPx + 8}
                  bottomYPx={bandBotPx - 8}
                  finalLineBottomPx={finalLineBottomPx}
                  rememberedY={stY}
                  onCommitY={(y) => commitAssistantY("structures", beatKey, y)}
                  onPing={pingAssistant}
                  beatId={beatKey}
                  lineNumber={hasGuidedLines ? curLineIdx + 1 : undefined}
                  lineCount={hasGuidedLines ? lineCount : undefined}
                  onPrevLine={goPrev}
                  onNextLine={goNext}
                />
                <SymbolPanel
                  chromeFg={palette.chromeFg}
                  visible={activeAssistant === "symbols"}
                  onInsert={(ch) => insertCharAtSensor(ch, "mid")}
                  rightPx={16}
                  minRightPx={16}
                  maxRightPx={400}
                  defaultYPx={(bandTopPx + bandBotPx) / 2}
                  topYPx={bandTopPx + 8}
                  bottomYPx={bandBotPx - 8}
                  finalLineBottomPx={finalLineBottomPx}
                  rememberedY={syY}
                  rememberedRight={syR}
                  onCommitY={(y) => commitAssistantY("symbols", beatKey, y)}
                  onCommitRight={(r) => commitAssistantRight(beatKey, r)}
                  onPing={pingAssistant}
                  beatId={beatKey}
                />
              </>
            );
          })()}

          {/* Per-line status bulbs removed — the top progress tracker is the
              single source of line status (no duplicate left-edge indicators). */}


          {/* Left-side line navigator REMOVED — the Floating Number panel's
              own ▲/▼ is now the single control for switching floating-number
              sets. Cursor movement lives in <CursorScrollbar/> below. */}



        </WritingSurface>
      </main>



      {/* Invisible keyboard capture. Omitted in view-only mirror mode. */}
      {canEdit && (
      <textarea
        ref={hiddenInputRef}
        aria-hidden
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value=""
        onChange={(e) => {
          const txt = e.currentTarget.value;
          e.currentTarget.value = "";
          if (!txt) return;
          // Reading the lesson must never write to the board. The sensor
          // is only active while the teacher has pressed the # button on
          // a beat with a Solution band.
          if (!solvingMode) return;
          insertPlainTextAtSensor(txt);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
            e.preventDefault(); applyZoom(zoom + ZOOM_STEP); return;
          }
          if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
            e.preventDefault(); applyZoom(zoom - ZOOM_STEP); return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "0") {
            e.preventDefault(); applyZoom(1); return;
          }
          // All other keys (Enter, arrows, Tab, plain typing) only act
          // while the teacher is in solving mode.
          if (!solvingMode) return;

          if (e.key === "Tab") {
            e.preventDefault();
            const row = freeLines[sensor.line] ?? [];
            const next = treeNextEmpty(row, cursor, e.shiftKey ? -1 : 1);
            if (next) setLiveCursor(next);
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();
            // Structure-aware advance: if the current Lesson Line holds a
            // tall math object (fraction / root / matrix / etc.) the next
            // Lesson Line must start BELOW the structure's full bounding
            // box, never inside it. We add `extraRowsFor(base)` so a
            // 2-row fraction skips its denominator.
            const base = Number.isInteger(sensor.line) ? sensor.line : Math.floor(sensor.line);
            const extra = extraRowsFor(base);
            const nextLine = base + 1 + extra;
            // Gate: don't allow advancing past the current expected guided
            // line until that line has turned green.
            if (hasGuidedLines && activeLayout) {
              const expectedLineNum = bandStart(activeLayout) + activeLineIdx;
              if (nextLine > expectedLineNum && lineStatusMap[expectedLineNum] !== "green") {
                return;
              }
            }
            if (activeLayout && nextLine > bandEnd(activeLayout)) growActiveBand();
            const snapLine = clampToActiveBand(nextLine);
            // Master-margin rule: new Lesson Lines never inherit the
            // previous line's horizontal position. Clear any stale
            // offset so the cursor snaps to MARGIN_LEFT.
            setLineOffsets((m) => {
              if (!(snapLine in m)) return m;
              const next = { ...m };
              delete next[snapLine];
              return next;
            });
            setSensor({ line: snapLine, x: 0 });
            setLiveCursor({ path: [], index: 0 });
            // Reset the 3-row manual slack anchor to the new auto-landing.
            autoFloorRef.current = Math.floor(snapLine);
            return;
          }

          if (e.key === "Backspace") {
            e.preventDefault();
            if (activeBoxId) {
              const activeText = boxes.find((b) => b.id === activeBoxId)?.text ?? "";
              insertIntoActiveBox(activeText.slice(0, -1), true);
              return;
            }
            const row = freeLines[sensor.line] ?? [];
            const minLine = activeLayout ? bandStart(activeLayout) : 0;
            // Lesson-line lock: Backspace cannot cross out of the active
            // lesson line into an earlier (now read-only) one.
            const activeAnchor = activeSensorPhysicalLineRef.current;
            const canCrossUp =
              !hasGuidedLines ||
              activeAnchor === null ||
              sensor.line - 0.5 >= activeAnchor;
            if (
              row.length === 0 &&
              cursor.path.length === 0 &&
              sensor.line > minLine &&
              canCrossUp
            ) {
              const prevLine = sensor.line - 0.5;
              const prevRow = freeLines[prevLine] ?? [];
              setSensor({ line: prevLine, x: 0 });
              setLiveCursor({ path: [], index: prevRow.length });
              return;
            }
            editActive((r, c) => treeBackspace(r, c));
            return;
          }

          if (e.key === "ArrowLeft") {
            e.preventDefault();
            const row = freeLines[sensor.line] ?? [];
            setLiveCursor((c) => treeMoveLeft(row, c));
            return;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            const row = freeLines[sensor.line] ?? [];
            setLiveCursor((c) => treeMoveRight(row, c));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            // Lesson-line lock: Up-arrow cannot leave the active lesson line.
            if (hasGuidedLines && activeSensorPhysicalLineRef.current !== null) {
              const anchor = activeSensorPhysicalLineRef.current;
              if (sensor.line - 0.5 < anchor) return;
            }
            let cand = clampToActiveBand(sensor.line - 0.5);
            const minL = activeLayout ? bandStart(activeLayout) : 0;
            while (cand > minL && notebookRowLines.has(Math.floor(cand))) cand -= 0.5;
            setSensor((s) => ({ ...s, line: cand, x: 0 }));
            setLiveCursor({ path: [], index: 0 });
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextLine = sensor.line + 0.5;
            if (hasGuidedLines && activeLayout) {
              const expectedLineNum = bandStart(activeLayout) + activeLineIdx;
              if (nextLine > expectedLineNum && lineStatusMap[expectedLineNum] !== "green") {
                return;
              }
            }
            if (activeLayout && nextLine > bandEnd(activeLayout)) growActiveBand();
            let cand = clampToActiveBand(nextLine);
            const maxL = activeLayout ? bandEnd(activeLayout) : cand;
            // Hop over notebook-prose rows so the sensor never parks on one.
            while (cand < maxL && notebookRowLines.has(Math.floor(cand))) cand += 0.5;
            // 3-row manual slack cap: the teacher can step the cursor at
            // most 3 physical rows below where it auto-landed for the
            // current Lesson Line. Prevents the sensor from wandering off
            // and breaking lesson structure.
            const slackCap = autoFloorRef.current + 3;
            if (cand > slackCap) cand = slackCap;
            setSensor({ line: cand, x: 0 });
            setLiveCursor({ path: [], index: 0 });
            return;
          }

          // Desktop keyboards should advance the math-tree cursor directly on
          // keydown. Relying only on the hidden textarea's input event made the
          // visible sensor feel rigid when React immediately cleared the
          // controlled textarea, and repeated typing could be applied against a
          // stale cursor. Prevent the native text edit and insert the printable
          // character through the board model instead.
          if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
            e.preventDefault();
            insertPlainTextAtSensor(e.key);
            return;
          }

        }}
        style={{
          position: "fixed",
          opacity: 0.01,
          width: 2,
          height: 2,
          bottom: 0,
          left: 0,
          border: 0,
          padding: 0,
          background: "transparent",
          color: "transparent",
          caretColor: "transparent",
          resize: "none",
          zIndex: -1,
        }}
      />
      )}

      {canEdit && (
      <StylesRail
        profileId={profileId}
        setProfileId={setProfileId}
        inkColorId={inkColorId}
        setInkColorId={setInkColorId}
        surface={surface}
        visible={railOpen}
        chromeBg={palette.chromeBg}
        chromeFg={palette.chromeFg}
        chromeBorder={palette.chromeBorder}
      />
      )}



      {/* Draggable eraser. Press the icon to lift it; while held it follows
          the pointer and wipes any line it crosses. Releasing it sends it
          back to its home position. No toggle, no mode. */}
      {(() => {
        const HOME_LEFT = 12;
        // Stack above the bottom-left Floating Numbers AssistantButton so the
        // eraser never sits under (or near) any right-edge control.
        const HOME_BOTTOM = (panelOpen ? PANEL_HEIGHT : TAB_HEIGHT) + 12 + 52;
        const wiping = !!eraserDrag;
        const startEraserDrag = (e: React.PointerEvent) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setEraserDrag({ x: e.clientX, y: e.clientY });
          const wipeAt = (cx: number, cy: number) => {
            const host = boardScrollRef.current;
            if (!host) return;
            const rect = host.getBoundingClientRect();
            if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;
            eraseAtPoint(cx, cy);
          };
          wipeAt(e.clientX, e.clientY);
          const onMove = (ev: PointerEvent) => {
            setEraserDrag({ x: ev.clientX, y: ev.clientY });
            wipeAt(ev.clientX, ev.clientY);
          };
          const onUp = () => {
            setEraserDrag(null);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        };
        const style: React.CSSProperties = wiping
          ? {
              position: "fixed",
              left: eraserDrag!.x - 22,
              top: eraserDrag!.y - 22,
              width: 44, height: 44,
              background: palette.accent,
              color: "#fff",
              borderColor: palette.chromeBorder,
              boxShadow: `0 0 22px 4px ${palette.accent}aa`,
              transition: "none",
            }
          : {
              left: HOME_LEFT,
              bottom: HOME_BOTTOM,
              position: "absolute",
              width: 44, height: 44,
              background: palette.chromeBg,
              color: palette.chromeFg,
              borderColor: palette.chromeBorder,
              boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
              backdropFilter: "blur(10px)",
              transition: "left 280ms ease, top 280ms ease, right 280ms ease, bottom 280ms ease",
            };
        return (
          <button
            data-sb-chrome
            onPointerDown={startEraserDrag}
            aria-label="Eraser — drag across the board to wipe"
            title="Drag me across the board to erase"
            className="z-40 grid place-items-center rounded-full border touch-none"
            style={style}
          >
            <Eraser className="h-5 w-5" />
          </button>
        );
      })()}

      {/* LEFT-edge — invisible hit zone reveals Undo / Redo for 5 s, then
          they fade out so the board stays plain. Nest button removed (the
          board is already infinite; advancing a section appears below). */}
      <div
        data-sb-chrome
        onPointerEnter={revealLeftTools}
        onPointerDown={revealLeftTools}
        className="absolute z-30"
        style={{
          left: 0,
          top: "30%",
          width: 56,
          height: "40%",
        }}
      />
      <div
        data-sb-chrome
        className="absolute z-30 flex flex-col items-center gap-2 transition-opacity duration-300"
        style={{
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: leftToolsVisible ? 1 : 0,
          pointerEvents: leftToolsVisible ? "auto" : "none",
        }}
        onPointerMove={revealLeftTools}
      >
        <button
          onClick={() => { doUndo(); revealLeftTools(); }}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          className="grid place-items-center rounded-full border transition-all"
          style={{
            width: 40, height: 40,
            background: palette.chromeBg,
            color: palette.chromeFg,
            borderColor: palette.chromeBorder,
            boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
            backdropFilter: "blur(10px)",
            opacity: canUndo ? 0.95 : 0.3,
            cursor: canUndo ? "pointer" : "not-allowed",
          }}
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          onClick={() => { doRedo(); revealLeftTools(); }}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="grid place-items-center rounded-full border transition-all"
          style={{
            width: 40, height: 40,
            background: palette.chromeBg,
            color: palette.chromeFg,
            borderColor: palette.chromeBorder,
            boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
            backdropFilter: "blur(10px)",
            opacity: canRedo ? 0.95 : 0.3,
            cursor: canRedo ? "pointer" : "not-allowed",
          }}
        >
          <Redo2 className="h-5 w-5" />
        </button>
        {/* Prev / Next section — stay on the LEFT rail next to Undo/Redo.
            These four together are the top group. */}
        <button
          onClick={() => { setBeatCursor((c) => Math.max(0, c - 1)); revealLeftTools(); }}
          disabled={beatCursor <= 0}
          aria-label="Previous section"
          title="Previous section"
          className="grid place-items-center rounded-full border transition-all disabled:opacity-30"
          style={{
            width: 40, height: 40,
            background: palette.chromeBg,
            color: palette.chromeFg,
            borderColor: palette.chromeBorder,
            boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
            backdropFilter: "blur(10px)",
            opacity: beatCursor <= 0 ? 0.3 : 0.95,
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => { if (canAdvanceBeat) setBeatCursor((c) => Math.min(beats.length - 1, c + 1)); revealLeftTools(); }}
          disabled={!canAdvanceBeat}
          aria-label="Next section"
          title="Next section"
          className="grid place-items-center rounded-full border transition-all disabled:opacity-30"
          style={{
            width: 40, height: 40,
            background: palette.chromeBg,
            color: palette.chromeFg,
            borderColor: palette.chromeBorder,
            boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
            backdropFilter: "blur(10px)",
            opacity: !canAdvanceBeat ? 0.3 : 0.95,
          }}
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Below the four-button top group: the dedicated Cursor Scrollbar
            replaces the three relocated tools (Smart Line, Dot, Box). It
            ONLY moves the writing sensor — never the floating-number panel. */}
        {solvingMode && (
          <CursorScrollbar
            inline
            onUp={() => { nudgeCursor(-1); revealLeftTools(); }}
            onDown={() => { nudgeCursor(1); revealLeftTools(); }}
            chromeBg={palette.chromeBg}
            chromeFg={palette.chromeFg}
            chromeBorder={palette.chromeBorder}
            canUp={canCursorUp}
            canDown={canCursorDown}
          />
        )}
      </div>

      {/* RIGHT rail — relocated theory tools: Smart Line, Two-point line, Box. */}
      {canEdit && carrierVisible && (
        <div
          data-sb-chrome
          className="absolute z-30 flex flex-col items-center gap-2"
          style={{
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            userSelect: "none",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { spawnSmartLine(); }}
            aria-label="Drop line"
            title="Drop a line (fraction bar / strike-through)"
            className="grid place-items-center rounded-full border transition-all"
            style={{
              width: 40, height: 40,
              background: palette.chromeBg,
              color: palette.chromeFg,
              borderColor: palette.chromeBorder,
              boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
              backdropFilter: "blur(10px)",
              opacity: 0.95,
            }}
          >
            <MinusIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => { if (dotArmed) disarmDot(); else armDot(); }}
            aria-label="Two-point line"
            title="Tap to arm, then tap two points to draw a line"
            className="grid place-items-center rounded-full border transition-all"
            style={{
              width: 40, height: 40,
              background: palette.chromeBg,
              color: dotArmed ? ink : palette.chromeFg,
              borderColor: dotArmed ? ink : palette.chromeBorder,
              boxShadow: dotArmed
                ? `0 0 14px ${ink}, 0 2px 10px rgba(0,0,0,0.14)`
                : "0 2px 10px rgba(0,0,0,0.14)",
              backdropFilter: "blur(10px)",
              opacity: 0.95,
            }}
          >
            <CircleIcon className="h-3 w-3" fill="currentColor" />
          </button>
          <button
            onClick={() => { if (boxArmed) disarmBox(); else armBox(); }}
            aria-label="Arm box tool — tap near a line to drop a magnet box"
            title="Arm box tool, then tap near a SmartLine to drop a box above or below it"
            className="grid place-items-center rounded-full border transition-all"
            style={{
              width: 40, height: 40,
              background: palette.chromeBg,
              color: boxFlashError ? "#e11d48" : (boxArmed ? ink : palette.chromeFg),
              borderColor: boxFlashError ? "#e11d48" : (boxArmed ? ink : palette.chromeBorder),
              boxShadow: boxFlashError
                ? "0 0 14px #e11d48, 0 2px 10px rgba(0,0,0,0.14)"
                : (boxArmed
                  ? `0 0 14px ${ink}, 0 2px 10px rgba(0,0,0,0.14)`
                  : "0 2px 10px rgba(0,0,0,0.14)"),
              backdropFilter: "blur(10px)",
              opacity: 0.95,
            }}
          >
            <SquareIcon className="h-4 w-4" />
          </button>
        </div>
      )}








      {/* Permanent activation buttons for the three workspace assistants. */}
      {canEdit && carrierVisible && (
        <AssistantButtons
          active={activeAssistant}
          onToggle={toggleAssistant}
          chromeBg={palette.chromeBg}
          chromeFg={palette.chromeFg}
          chromeBorder={palette.chromeBorder}
          ink={ink}
          bottomInset={panelOpen ? PANEL_HEIGHT : TAB_HEIGHT}
          liftRightBottom={hasGuidedLines ? 64 : 0}
        />
      )}

      {/* AI line-status verification toggle. Off by default; when on, the
          left-edge bulbs render (yellow → in progress, green → correct,
          red → mismatch, blue → whole problem solved). */}
      {canEdit && carrierVisible && (
        <button
          data-sb-chrome
          data-sb-teacher-only
          onClick={(e) => { e.stopPropagation(); setVerifyOn((v) => !v); }}
          aria-label="Toggle AI line verification"
          title={verifyOn ? "AI verification on — tap to turn off" : "AI verification off — tap to turn on"}
          className="fixed z-40 grid place-items-center rounded-full border transition-all"
          style={{
            right: 12,
            top: `calc(50% + 56px)`,
            width: 44,
            height: 44,
            background: palette.chromeBg,
            color: verifyOn ? palette.accent : palette.chromeFg,
            borderColor: verifyOn ? palette.accent : palette.chromeBorder,
            boxShadow: verifyOn
              ? `0 0 14px ${palette.accent}, 0 2px 10px rgba(0,0,0,0.18)`
              : "0 2px 10px rgba(0,0,0,0.18)",
            backdropFilter: "blur(10px)",
            opacity: 0.95,
          }}
        >
          <ScanEye className="h-5 w-5" />
        </button>
      )}



      {canEdit && (
        <BottomPanel
          open={panelOpen}
          onToggle={() => setPanelOpen((v) => !v)}
          onInsertChar={insertCharAtSensor}
          onInsertNode={insertNodeAtSensor}
          chromeBg={palette.chromeBg}
          chromeFg={palette.chromeFg}
          chromeBorder={palette.chromeBorder}
          isDark={isDark}
        />
      )}

      {/* Teacher-only: hand live editing rights to one approved student. */}
      {isTeacher && syncEnabled && classIdProp && (
        <ActiveStudentControl
          classId={classIdProp}
          activeStudentId={activeStudentId}
          onSelect={setActiveStudent}
          chromeBg={palette.chromeBg}
          chromeFg={palette.chromeFg}
          chromeBorder={palette.chromeBorder}
          accent={palette.accent}
        />
      )}

      {/* ── Assessment mode: top progress strip + per-line Check button ── */}
      {assessmentMode && (
        <>
          <div
            className="fixed left-1/2 top-3 z-[60] -translate-x-1/2 flex max-w-[94vw] items-center gap-3 rounded-2xl border px-4 py-2 shadow-lg backdrop-blur"
            style={{ background: palette.chromeBg, color: palette.chromeFg, borderColor: palette.chromeBorder }}
          >
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-black/5"
              aria-label="Back"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <span className="truncate text-sm font-semibold max-w-[34vw]">{source?.title ?? "Assignment"}</span>

            {beats.length > 1 && (
              <div className="flex items-center gap-1">
                {beats.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => setBeatCursor(i)}
                    className="grid h-6 min-w-6 place-items-center rounded-full border px-2 text-[11px] font-medium transition"
                    style={i === beatCursor
                      ? { background: palette.accent, color: palette.chromeBg, borderColor: palette.accent }
                      : { borderColor: palette.chromeBorder }}
                    title={`Question ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Per-line ticks for the current question */}
            {hasGuidedLines && (
              <div className="flex items-center gap-1">
                {guidedLines.map((ln, k) => {
                  const slot = slotFor(k);
                  const solved = !!slot && slot in solvedSlots;
                  return (
                    <span
                      key={k}
                      className="grid h-5 w-5 place-items-center rounded-full border text-[10px]"
                      style={solved
                        ? { background: "rgba(34,197,94,0.18)", color: "#16a34a", borderColor: "rgba(34,197,94,0.5)" }
                        : { borderColor: palette.chromeBorder, opacity: 0.55 }}
                      title={`Line ${k + 1}${solved ? " · solved" : ""}`}
                    >
                      {solved ? <CheckIcon className="h-3 w-3" /> : k + 1}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="ml-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums" style={{ background: palette.hoverBg }}>
              {assessScore} <span className="opacity-60">/ {assessTotal}</span>
            </div>

            {/* Zoom controls */}
            <div className="inline-flex items-center gap-0.5 rounded-md" style={{ background: palette.hoverBg }}>
              <button
                onClick={() => applyZoom(zoom - ZOOM_STEP)}
                className="px-2 py-1 text-base leading-none"
                aria-label="Zoom out"
                title="Zoom out"
              >−</button>
              <button
                onClick={() => applyZoom(1)}
                className="px-2 py-1 tabular-nums text-[10px]"
                aria-label="Reset zoom"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => applyZoom(zoom + ZOOM_STEP)}
                className="px-2 py-1 text-base leading-none"
                aria-label="Zoom in"
                title="Zoom in"
              >+</button>
            </div>
          </div>

          {/* Per-line Check button — grades the current line server-side. */}
          {hasGuidedLines && (
            <button
              onClick={checkActiveLine}
              disabled={assessChecking || activeLineIdx >= guidedLines.length}
              className="fixed bottom-6 right-6 z-[60] inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold shadow-xl backdrop-blur transition disabled:opacity-50"
              style={{ background: palette.accent, color: palette.chromeBg, borderColor: palette.accent }}
            >
              {assessChecking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckIcon className="h-4 w-4" />}
              {activeLineIdx >= guidedLines.length ? "All lines solved" : `Check line ${activeLineIdx + 1}`}
            </button>
          )}
        </>
      )}

      {/* Student status indicator — visible to live-mirror students only. */}
      {role === "student" && !assessmentMode && (
        <div
          className="fixed left-1/2 top-3 z-[60] -translate-x-1/2 select-none rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur"
          style={
            isActiveStudent
              ? { background: "rgba(34,197,94,0.15)", color: "#16a34a", borderColor: "rgba(34,197,94,0.45)" }
              : { background: palette.chromeBg, color: palette.chromeFg, borderColor: palette.chromeBorder }
          }
        >
          {isActiveStudent ? "Editing Enabled by Teacher" : "View Only Mode"}
        </div>
      )}

      {/* View-only mirror: hide every editing/control affordance. */}
      {!canEdit && (
        <style>{`[data-sb-chrome]{display:none !important;}`}</style>
      )}

      {/* Active student / assessment editor: enable board tools but keep all
          teacher-exclusive controls hidden. */}
      {((role === "student" && canEdit) || assessmentMode) && (
        <style>{`[data-sb-teacher-only]{display:none !important;}`}</style>
      )}
    </div>
  );
};


/* ─────────────── Beat renderer ─────────────── */

const BeatBlock = ({
  beat, isCurrent, ink, accent, jitter,
  notebookTitle, topic, subtopic, dateLabel,
}: {
  beat: Beat;
  isCurrent: boolean;
  ink: string;
  accent: string;
  jitter: number;
  notebookTitle?: string;
  topic?: string;
  subtopic?: string;
  dateLabel?: string;
}) => {
  const opacityClass = isCurrent ? "opacity-100" : "opacity-75";
  const revealClass = isCurrent ? "sb-writing-in" : "";

  // Synthetic cover beat — title / topic / subtopic / date.
  if (beat.id === "__cover__") {
    return (
      <div data-sb-beat className={`transition-opacity duration-300 ${opacityClass} ${revealClass}`}>
        <div className="text-center" style={{ color: ink }}>
          <div className="text-xs uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            {dateLabel}
          </div>
          <div className="text-4xl md:text-5xl font-light leading-tight mb-3">
            <Inked jitter={jitter * 0.6} seed={1}>{notebookTitle ?? beat.content}</Inked>
          </div>
          {topic && (
            <div className="text-lg md:text-xl opacity-80 mb-1">
              <Inked jitter={jitter * 0.5} seed={2}>{topic}</Inked>
            </div>
          )}
          {subtopic && (
            <div className="text-sm md:text-base opacity-55">
              <Inked jitter={jitter * 0.5} seed={3}>{subtopic}</Inked>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (beat.kind === "text") {
    return (
      <div data-sb-beat className={`transition-opacity duration-300 ${opacityClass} ${revealClass}`}>
        <div style={{ color: ink, fontSize: "1em" }}>
          <SmartboardLessonText jitter={jitter} seed={beat.id.length}>
            {beat.content}
          </SmartboardLessonText>
        </div>
      </div>
    );
  }


  if (beat.kind === "problem" || beat.kind === "exercise-prompt") {
    return (
      <div data-sb-beat className={`transition-opacity duration-300 ${opacityClass} ${revealClass}`}>
        {beat.caption && (
          <div
            className="uppercase tracking-[0.25em] mb-2"
            style={{ color: accent, fontSize: "0.4em" }}
          >
            {beat.caption}
          </div>
        )}
        <div style={{ color: ink, fontSize: "1em" }}>
          <SmartboardLessonText jitter={jitter * 0.6} seed={beat.id.length + 11}>
            {beat.content}
          </SmartboardLessonText>
        </div>
        {/* Auto-write the "Solution" header beneath the question, then stop.
            The teacher solves the rest by hand using the carrier. */}
        <div
          className="mt-3"
          style={{ color: ink, fontSize: "0.55em", fontStyle: "italic", opacity: 0.85 }}
        >
          <Inked jitter={jitter * 0.8} seed={beat.id.length + 7}>Solution</Inked>
        </div>
      </div>
    );
  }


  // solution-step
  return (
    <div data-sb-beat className={`transition-opacity duration-300 ${opacityClass} ${revealClass} flex items-end gap-6`}>

      <div
        className="flex-1 relative"
        style={{ color: ink, fontSize: "1em" }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <SmartboardLessonText jitter={jitter * 0.6} seed={beat.id.length + 23}>
            {beat.content}
          </SmartboardLessonText>
        </span>
      </div>
      {beat.reasoning && (
        <div
          className="flex-none max-w-[40%] pt-2"
          style={{ color: accent, fontStyle: "italic", fontSize: "0.55em" }}
        >
          → <SmartboardLessonText jitter={jitter * 0.7} seed={beat.id.length + 1}>
            {beat.reasoning}
          </SmartboardLessonText>
        </div>
      )}
    </div>
  );
};

export default PresentationView;
