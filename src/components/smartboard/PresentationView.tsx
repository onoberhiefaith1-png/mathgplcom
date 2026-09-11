// Smartboard Presentation View — an immersive, fullscreen classroom board.
// The screen itself is the frame. Surface fills edge-to-edge. Default is a
// whiteboard; a blackboard mode is available from Settings. UI chrome hides
// after a moment of inactivity so only mathematics remains present.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Settings as SettingsIcon,
  Eraser, Undo2, Redo2, PanelLeftOpen, X as XIcon, Hash, Maximize2, Minimize2,
} from "lucide-react";
import PresenterPreviewPanel from "./PresenterPreviewPanel";
import AskAssessmentQuestion from "@/components/assessments/AskAssessmentQuestion";
import TableActivityStage from "./TableActivityStage";
import {
  buildTableGroups,
  groupForLine,
  groupAnchor,
  firstOpenCell,
  cellKeysForLine,
  isRetained,
  isLineComplete,
  isGroupComplete,
  nextOpenLine,
  tableValidation,
  lessonSteps,
  stepIdxForLine,
  tSeriesFor,
  tagForLine,
  mainTagForStep,
  nextMainStepAfter,

  editableCellsForLine,
  expectedCellValue,
  isCellCorrect,
  trackLabel,


  type TableEntries,
  type TableValidation,
} from "@/lib/smartboard/tableActivity";
import { SmartboardRootContext } from "./SmartboardRoot";
import AiEditWorkspace from "./AiEditWorkspace";
import type { EditTarget, MirrorUiStatus } from "@/lib/smartboard/manualEdit/types";
import { BackButton } from "@/components/common/BackButton";

import { useNotebook } from "@/hooks/useNotebook";
import { buildBeats, buildReservoirs, beatNeedsFloatingMath, type Beat, type Reservoir } from "@/lib/smartboard/presentation";
import { applyPlan, loadPlan } from "@/lib/smartboard/presentationPlan";
import { startSession, freezeSession, cancelSession, type EditingSession } from "@/lib/smartboard/editingSession";
import { ReasoningEngine, introducedTerms as introducedTermsOf } from "@/lib/smartboard/reasoningEngine";
import { buildBoardScope, boardKey, type BoardWorkspace } from "@/lib/smartboard/boardScope";


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
import {
  DEFAULT_PLACEHOLDER_COLOR,
  PLACEHOLDER_COLOR_STORAGE_KEY,
  PlaceholderColorId,
  resolvePlaceholderColor,
  sanitizePlaceholderColorId,
} from "@/lib/smartboard/placeholderColor";
import { WritingSurface, WritingFilterDefs } from "./WritingSurface";
import { Inked } from "./Inked";
import { SettingsSheet } from "./SettingsSheet";
import { FreeWriteLayer, type FreeLineMap } from "./FreeWriteLayer";
import { graphemes } from "@/lib/text/graphemes";

import { StylesRail } from "./StylesRail";
import { FloatingNumberPanel } from "./FloatingNumberPanel";
import { useFloatingDisplayStyle } from "@/hooks/useFloatingDisplayStyle";

import { SensorDPad } from "./SensorDPad";
import { StructurePanel } from "./StructurePanel";
import { SymbolPanel } from "./SymbolPanel";
import { AssistantButtons, type Assistant } from "./AssistantButtons";
import { useMobileStudentBoard } from "@/hooks/useMobileStudentBoard";
import { useBreakpoint, useIsTouchLayout } from "@/hooks/useBreakpoint";
import { useBoardNativeKeyboard } from "@/hooks/useBoardNativeKeyboard";
import { clampRowSpacing, normalizeRowSpacing, getGrid, lineToY, snapToBaseline, type GridPoint } from "@/lib/smartboard/grid";
import { matrixShellFromLatex } from "@/lib/floating/matrixChips";
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
  moveUp as treeMoveUp,
  moveDown as treeMoveDown,

  nextEmptyRow as treeNextEmpty,
  rowHasTallStructure,
  isPlaceholderOnly,
} from "@/lib/smartboard/mathTree";
import { latexToTree } from "@/lib/smartboard/mathTreeLatex";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";
import type { BoardSnapshot } from "@/lib/smartboard/boardWriter/ledger";
import { parkRowBelow } from "@/lib/smartboard/boardWriter/parkSensor";
import type { WritePlan } from "@/lib/smartboard/boardWriter/directWrite";
import type { CommitOptions } from "@/lib/smartboard/boardWriter/host";
import type { PreviewChannelHost } from "@/lib/smartboard/boardWriter/previewChannel";
import {
  floatingWriteNote,
  type FloatingChannelHost,
} from "@/lib/smartboard/boardWriter/floatingChannel";
import { noteForLine, noteObjectsForLine } from "@/lib/smartboard/boardWriter/noteSource";
import { rowToAscii, rowHasVisibleInk, equationsMatch, equationsEquivalent } from "@/lib/smartboard/rowAscii";
import { type LineBulb } from "./LineStatusRail";
import { SmartLineLayer, type SmartLine, newSmartLine } from "./SmartLineLayer";
import { BoxLayer, type MagnetBox, newMagnetBox } from "./BoxLayer";
import { BoardToolLayer } from "./BoardToolLayer";
import { InteractiveBoard } from "./InteractiveBoard";
import { FloatingToolLayer } from "./FloatingToolLayer";
import { MathTablesPicker } from "@/components/lessonnotes/math-tools/MathTablesPicker";
import { SmartCalculatorBody } from "@/components/lessonnotes/math-tools/SmartCalculator";
import { ConversionBody } from "@/components/lessonnotes/ConversionPanel";
import type { MathTableAttrs } from "@/components/lessonnotes/extensions/MathTable";
import {
  sanitizeBoardDiagrams, newBoardDiagram2D, newBoardDiagram3D,
  newBoardGraph, newBoardTable, type BoardDiagram,
} from "@/lib/smartboard/boardDiagrams";
import Workspace3DDialog from "@/components/lessonnotes/geometry3d/Workspace3DDialog";

import type { GeometryScene } from "@/lib/geometry/scene";
import type { Scene3D } from "@/lib/geometry3d/scene3d";
import { Circle as CircleIcon,
  Table as TableIcon, LineChart as LineChartIcon, Calculator as CalculatorIcon,
  ArrowLeftRight as ArrowLeftRightIcon, Columns2 } from "lucide-react";

import { useSmartboardSync, type FloatingShared } from "@/hooks/useSmartboardSync";
import {
  buildFloatingLines,
  chipIdsForAbsIdx,
  reservoirFromShared,
  sharedConsumedSet,
  sharedUsedOrderIdx,
} from "@/lib/smartboard/floatingShared";

import { useAssessmentBoardSession, type AssessBoardState } from "@/hooks/useAssessmentBoardSession";
import { studentGradingKey } from "@/lib/assessments/studentGrading";
import { useQuestionTimerAttempt, formatAttemptTime } from "@/hooks/useQuestionTimerAttempt";
import { getQuestionWindow, lineCarriesMarkState, questionTabState } from "@/lib/smartboard/touchUi";

import ActiveStudentControl from "./ActiveStudentControl";
import StudentAccessControl from "./StudentAccessControl";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { localLiveChannel, publishLocalLive } from "@/lib/smartboard/localLiveBridge";

import { extractTermsFromAscii } from "@/lib/smartboard/floatingExtractor";
import { sanitizePresentation } from "@/lib/lessonnotes/outputHygiene";
import { Check as CheckIcon, LayoutGrid as LayoutGridIcon } from "lucide-react";
import { listSlides, type Slide } from "@/lib/lessonnotes/slides";
import { SlidePlayer } from "@/components/lessonnotes/slides/SlidePlayer";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";
import { BoardRelationshipView } from "@/components/smartboard/BoardRelationshipView";
import { reviewProperties, useReviewProperties } from "@/lib/smartboard/reviewProperties";
import { ReviewPropertiesPanel } from "@/components/smartboard/ReviewPropertiesPanel";
import { PresentationGeometryDiagram } from "@/components/lessonnotes/extensions/GeometryDiagram";
import { itemObjectIds } from "@/lib/geometry/map/model";
import { sortByPlacement } from "@/lib/floating/solutionItems";
import type { SolutionObject } from "@/lib/floating/solutionItems";





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
const ZOOM_STEP = 0.1;
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
  boardStudentId = null,
  boardQuestionId = null,
  workspace = "assignment",
  gameId = null,
  viewOnly = false,
  smartCardSlug = null,
  guestSlug = null,
  guestName = null,
  participantKey = null,
  backTo = null,
  backLabel = "Back",

  testMode = false,
  timerEnabled = false,
  onLineContext,
  touchSession,
}: {
  notebookId?: string | null;
  classId?: string | null;
  role?: "teacher" | "student";
  /** When provided, the board renders from this content instead of a notebook
   *  (used by the student Assessment workspace). */
  source?: { beats: Beat[]; reservoirs: Reservoir[]; title?: string } | null;
  /** Set together with `source` to enable server-graded assessment mode. */
  assessmentId?: string | null;
  /** Owner of the assessment board session. The student passes their own id;
   *  a teacher reviewing "View Student Work" passes the student's id so both
   *  sides render ONE shared board (live mirror). */
  boardStudentId?: string | null;
  boardQuestionId?: string | null;
  /** Which workspace opened this board — an Adventure board and an Assignment
   *  board for the same question are independent surfaces. */
  workspace?: BoardWorkspace;
  /** Adventure game the board was opened from (part of the board identity). */
  gameId?: string | null;
  /** Force a read-only mirror (teacher "View Only" mode). */
  viewOnly?: boolean;
  /** Teacher enabled the Assignment timer for this assessment. */
  timerEnabled?: boolean;
  /** Public Smart Card challenge — grading runs without an account. */
  smartCardSlug?: string | null;
  /** Public Guest Link (Course / Assignment Card) — graded without an account
   *  and recorded apart from every registered student. */
  guestSlug?: string | null;
  guestName?: string | null;
  participantKey?: string | null;
  /** Explicit Back target. Public Smart Cards return to their own card; every
   *  other caller omits this and keeps the nav-history behaviour. */
  backTo?: string | null;
  backLabel?: string;

  /** Teacher's temporary Floating Number test: same board, same engine, but
   *  nothing is recorded — marks live only for this sitting. */
  testMode?: boolean;
  /** Read-only reporter for the interactive teaching-video layer: the current
   *  mathematical line and whether it is already awarded. Never writes back. */
  onLineContext?: (ctx: {
    questionId: string | null;
    lineId: string | null;
    index: number;
    total: number;
    completed: boolean;
    /** The line whose mark was awarded most recently (a marking event). */
    lastAwardedLineId?: string | null;
    /** False until the student really activates a line (#, chip, Present,
     *  Next, Previous, table cell) — the Introduction owns the board until then. */
    lineEngaged?: boolean;
    /** Increments when Reset begins a fresh video sequence. */
    playbackResetGeneration?: number;
  }) => void;
  /** Optional phone/tablet session controls owned by an outer guest surface. */
  touchSession?: {
    questionIndex: number;
    questionCount: number;
    onQuestionChange: (index: number) => void;
    score?: number;
    totalScore?: number;
    onBack: () => void;
    backLabel: string;
    videoControl?: ReactNode;
    fullscreen: boolean;
    onFullscreenChange: (active: boolean) => void;
  };

} = {}) => {
  const params = useParams<{ notebookId: string }>();
  const notebookId = notebookIdProp ?? params.notebookId;
  const navigate = useNavigate();
  // BACK THE WAY YOU CAME — a board opened from inside a lesson note returns
  // to that note; a board opened from the shelf returns to the shelf.
  const [searchParams] = useSearchParams();
  const cameFromNote = searchParams.get("from") === "note" && !!notebookId;
  const backTarget = cameFromNote
    ? { to: `/lesson-notes/${notebookId}`, label: "Lesson note" }
    : { to: "/smartboard", label: "Shelf" };
  // Assessment mode renders from an injected source and grades via the server.
  const assessmentMode = !!source && !!assessmentId;

  // Board identity — student × class × workspace × game × assessment ×
  // question. EVERY per-board cache key hangs off this, so work can never
  // bleed from one question, class or workspace into another.
  const boardScope = useMemo(
    () =>
      buildBoardScope({
        studentId: boardStudentId,
        classId: classIdProp,
        workspace,
        gameId,
        assessmentId,
        questionId: boardQuestionId,
        notebookId,
      }),
    [boardStudentId, classIdProp, workspace, gameId, assessmentId, boardQuestionId, notebookId],
  );

  const { notebook, sections, loading } = useNotebook(assessmentMode ? undefined : (notebookId ?? undefined));


  // Live classroom mirroring (disabled in assessment mode).
  const { selfId, incoming, activeStudentId, pushSnapshot, setActiveStudent, diagnostics: syncDiagnostics } =
    useSmartboardSync({ classId: assessmentMode ? null : classIdProp, role });

  const syncEnabled = !!classIdProp && !assessmentMode;
  // In assessment mode the student edits their OWN board (canEdit true) but no
  // teacher-only chrome is shown.
  // Teacher chrome (Presenter Preview / Normal mode) is available whenever the
  // viewer is a teacher — including while reviewing a student's assessment.
  const isTeacher = role === "teacher";

  // MOBILE STUDENT MODE — phone/tablet student session. The board keeps its
  // full size; the device becomes a viewport that pans across it. Desktop and
  // every teacher surface are untouched because all branches read this flag.
  const mobileBoard = useMobileStudentBoard(role);
  const mobileStudent = mobileBoard.active;
  const breakpoint = useBreakpoint();
  const phoneLayout = mobileStudent && breakpoint === "phone";
  // PHONE/TABLET + SMARTBOARD = no native keyboard, for every role. Layout and
  // chrome still follow `mobileStudent`; only keyboard raising reads this flag.
  const noNativeKeyboard = useBoardNativeKeyboard();
  // (Two-finger viewport pan removed: the board fits the viewport width.)
  // Measured height of the mobile chrome panel so the board content always
  // starts below it, however many rows the number line wraps onto.
  const [mobileChromeH, setMobileChromeH] = useState(0);
  const chromeMeasureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const apply = () => setMobileChromeH(node.getBoundingClientRect().height);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(node);
  }, []);

  // Measured height of the foldable TOP BAR. On phones/tablets its controls
  // wrap onto as many rows as they need, so the pull-tab must follow the real
  // rendered height instead of a hard-coded single-row offset.
  const [topBarH, setTopBarH] = useState(44);
  const topBarMeasureRef = useCallback((node: HTMLElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const apply = () => setTopBarH(Math.max(36, node.getBoundingClientRect().height));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(node);
  }, []);

  const isActiveStudent = role === "student" && !!selfId && activeStudentId === selfId;
  const canEdit = assessmentMode ? !viewOnly : (isTeacher || isActiveStudent);

  // ── Shared assessment board session (live mirror, one state) ─────────────
  const {
    sessionActive: boardSessionActive,
    incoming: boardIncoming,
    push: pushBoardState,
  } = useAssessmentBoardSession({
    assessmentId,
    studentId: boardStudentId,
    questionId: boardQuestionId,
    enabled: assessmentMode && !!boardStudentId && !testMode && !guestSlug,
  });
  const applyingRemoteRef = useRef(false);

  const rawBeats = useMemo(() => buildBeats(sections, notebook), [sections, notebook]);
  const rawReservoirs = useMemo(() => buildReservoirs(sections), [sections]);
  // Apply the teacher's approved Preview plan (Present / Skip flags). The
  // Preview page writes these to localStorage; the live board reads them
  // here so the classroom presentation is a 1:1 copy of what the teacher
  // rehearsed. Assessment mode ignores the plan.
  const { beats: notebookBeats, reservoirs: notebookReservoirs } = useMemo(() => {
    if (assessmentMode) return { beats: rawBeats, reservoirs: rawReservoirs };
    return applyPlan(rawBeats, rawReservoirs, loadPlan(notebookId));
  }, [rawBeats, rawReservoirs, assessmentMode, notebookId]);
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
  // Check is an EVALUATION VIEW, never a new workspace: it echoes the frozen
  // student expression back with the verdict. The board is untouched.
  const [checkView, setCheckView] = useState<{
    lineNo: number;
    studentAscii: string;
    correct: boolean;
    label: string;
    detail: string;
    marks: number;
  } | null>(null);
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

  // Whose progress row this board mirrors: the viewed student when a teacher
  // opens a student's board, otherwise the signed-in user.
  const [progressOwnerId, setProgressOwnerId] = useState<string | null>(null);
  useEffect(() => {
    if (boardStudentId) { setProgressOwnerId(boardStudentId); return; }
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setProgressOwnerId(data.user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [boardStudentId]);

  // Seed progress from the server on open + follow live updates.
  // A test sitting always starts from zero and is never seeded or mirrored.
  useEffect(() => {
    if (testMode) { setSolvedSlots({}); setAssessScore(0); return; }
    // A Guest Link sitting is seeded by its own page, never from student rows.
    if (guestSlug) return;
    if (!assessmentMode || !assessmentId || !progressOwnerId) return;
    let cancelled = false;
    (async () => {
      const { data: prog } = await supabase
        .from("assessment_progress")
        .select("solved_lines, score")
        .eq("assessment_id", assessmentId)
        .eq("student_id", progressOwnerId)
        .maybeSingle();
      if (cancelled) return;
      setSolvedSlots(((prog?.solved_lines as Record<string, number>) ?? {}));
      setAssessScore(Number(prog?.score ?? 0));
    })();
    return () => { cancelled = true; };
  }, [assessmentMode, assessmentId, progressOwnerId, guestSlug, testMode]);

  useEffect(() => {
    if (testMode || guestSlug) return;
    if (!assessmentMode || !assessmentId || !progressOwnerId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-progress-${assessmentId}-${progressOwnerId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessment_progress", filter: `assessment_id=eq.${assessmentId}` },
          (payload) => {
            const row = payload.new as { solved_lines?: Record<string, number>; score?: number; student_id?: string } | null;
            if (!row) return;
            // Only mirror the row belonging to the board's owner.
            if (row.student_id && row.student_id !== progressOwnerId) return;
            setSolvedSlots(row.solved_lines ?? {});
            setAssessScore(Number(row.score ?? 0));
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentMode, assessmentId, progressOwnerId, guestSlug, testMode]);






  const LESSON_CURSOR_KEY = boardKey("lessonCursor", boardScope);
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
  /** Selected Floating Number Display design (personal choice, else the
   *  administrator's platform default). Presentation only. */
  const { style: floatingDisplayStyle } = useFloatingDisplayStyle();

  const [inkColorId, setInkColorId] = useState<InkColorId>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(INK_COLOR_STORAGE_KEY) : null;
    return (saved as InkColorId) || DEFAULT_INK_COLOR;
  });
  const [placeholderColorId, setPlaceholderColorId] = useState<PlaceholderColorId>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PLACEHOLDER_COLOR_STORAGE_KEY) : null;
    return sanitizePlaceholderColorId(saved ?? DEFAULT_PLACEHOLDER_COLOR);
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  

  const [topOpen, setTopOpen] = useState(false);
  // Review Properties: the diagram already on this board plus its selection.
  const review = useReviewProperties();
  const [railOpen, setRailOpen] = useState(false);
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

  // Presenter Preview side panel (teacher-only). Icon auto-hides after 10s.
  const PRESENTER_PANEL_KEY = `smartboard:presenterPanelOpen:${notebookId ?? "_"}`;
  const [presenterPanelOpen, setPresenterPanelOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(PRESENTER_PANEL_KEY) === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(PRESENTER_PANEL_KEY, presenterPanelOpen ? "1" : "0"); }
    catch { /* noop */ }
  }, [presenterPanelOpen, PRESENTER_PANEL_KEY]);
  const [presenterIconVisible, setPresenterIconVisible] = useState(false);
  // Manual AI Edit workspace — driven from the Presenter Preview's Edit mode.
  const [aiEditTarget, setAiEditTarget] = useState<EditTarget | null>(null);
  const [mirrorActive, setMirrorActive] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<MirrorUiStatus | null>(null);
  // The 70% Smartboard pane element. Published via context so portals
  // (FloatingNumberPanel, SensorDPad) mount inside this container instead of
  // document.body, keeping every control anchored to the resized pane.
  const [sbRootEl, setSbRootEl] = useState<HTMLDivElement | null>(null);
  const presenterIconTimer = useRef<number | null>(null);
  const revealPresenterIcon = useCallback(() => {
    setPresenterIconVisible(true);
    if (presenterIconTimer.current) window.clearTimeout(presenterIconTimer.current);
    presenterIconTimer.current = window.setTimeout(() => setPresenterIconVisible(false), 10000);
  }, []);
  const [presenterManualScroll, setPresenterManualScroll] = useState(false);
  // Draggable eraser: lives at a home position; while dragging it follows the
  // pointer and wipes any line it crosses. On release it animates home.
  const [eraserDrag, setEraserDrag] = useState<{ x: number; y: number } | null>(null);
  // AI line-status verification — off by default. When off, no bulbs render.
  const [verifyOn] = useState(false);

  // PHONE/TABLET layout: the Floating Number workspace reports its real
  // rendered box, and the eraser + # controls hang immediately above it. Taller
  // designs push them up, shorter designs let them settle back down. Desktop is
  // untouched.
  const touchLayout = useIsTouchLayout();
  const [floatingBox, setFloatingBox] = useState<{ height: number; bottom: number } | null>(null);
  const onFloatingMeasure = useCallback((m: { height: number; bottom: number } | null) => {
    setFloatingBox((prev) => {
      if (!m) return prev === null ? prev : null;
      if (prev && Math.abs(prev.height - m.height) < 1 && Math.abs(prev.bottom - m.bottom) < 1) return prev;
      return m;
    });
  }, []);
  const touchControlsBottom = floatingBox
    ? Math.round(floatingBox.bottom + floatingBox.height + 12)
    : 8;
  // PHONE/TABLET question strip: ALWAYS three positions — previous, current,
  // next — with the current question in the middle whenever possible. When a
  // board carries fewer than three questions the empty positions render as
  // disabled placeholders (null entries) so the row never collapses to one.
  const questionWindow = useMemo(() => {
    const count = touchSession?.questionCount ?? beats.length;
    const active = touchSession?.questionIndex ?? Math.max(0, beatCursor);
    return getQuestionWindow(count, active);
  }, [touchSession?.questionCount, touchSession?.questionIndex, beats.length, beatCursor]);
  const touchQuestionIndex = touchSession?.questionIndex ?? Math.max(0, beatCursor);
  const changeTouchQuestion = useCallback((index: number) => {
    if (touchSession) touchSession.onQuestionChange(index);
    else setBeatCursor(index);
  }, [touchSession]);
  // Real browser full screen on the board surface, with the chrome-hiding
  // immersive mode switched on alongside it so browsers that refuse the
  // Fullscreen API still hand the whole screen to the board.
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [timeDetailsOpen, setTimeDetailsOpen] = useState(false);
  useEffect(() => {
    const sync = () => setBrowserFullscreen(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // HONEST FULL SCREEN — only offer it where the browser really grants it.
  // A "fullscreen" that leaves the address bar sitting over the board hides
  // controls, so on those browsers the button is simply not shown and the
  // board keeps the whole usable height instead.
  const canFullscreen = useMemo(() => {
    if (typeof document === "undefined") return false;
    const doc = document as Document & { webkitFullscreenEnabled?: boolean };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => unknown };
    const enabled = doc.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true;
    const callable = typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
    return enabled && callable;
  }, []);
  const touchFullscreenActive = browserFullscreen || !!touchSession?.fullscreen;
  const toggleTouchFullscreen = useCallback(async () => {
    const next = !touchFullscreenActive;
    touchSession?.onFullscreenChange(next);
    try {
      if (!next) {
        if (document.fullscreenElement) await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        // Phones: try the board surface first, then the whole document, then
        // the old WebKit call — whichever the browser accepts, so Expand
        // really does fill the entire screen.
        type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
        const targets: FsEl[] = [];
        if (sbRootEl) targets.push(sbRootEl as FsEl);
        targets.push(document.documentElement as FsEl);
        for (const el of targets) {
          try {
            if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions); }
            else if (el.webkitRequestFullscreen) { await el.webkitRequestFullscreen(); }
            if (document.fullscreenElement) break;
          } catch { /* try the next target */ }
        }
      }

    } catch {
      // Unsupported mobile browsers already receive the full 100dvh board.
    }
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }, [sbRootEl, touchSession, touchFullscreenActive]);

  // FIXED SHELL (phone / tablet) — the page behind the board must not scroll.
  // Only the maths canvas inside the board moves, so the top bar and bottom
  // toolbar can never be pushed out of view. Desktop is untouched.
  useEffect(() => {
    if (!touchLayout) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.height = "100%";
    body.style.height = "100%";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
    };
  }, [touchLayout]);


  // Invisible-grid free-writing state.
  const FREEWRITE_KEY = boardKey("freewrite", boardScope);
  const SENSOR_KEY = boardKey("sensor", boardScope);
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
        // Legacy values were a 0..1 slider — they all collapse to 1 row unit.
        if (Number.isFinite(v)) return normalizeRowSpacing(v);
      }
    } catch { /* noop */ }
    return 1;
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
  // Narrow viewports (phone/tablet, any role) start the writing near the left
  // edge so the full width is usable. Desktop keeps the classic wide margin.
  const compactMargins = touchLayout;
  const marginScale = compactMargins ? 0.25 : 1;
  const grid = useMemo(
    () => getGrid(zoom, rowSpacing, textScale, marginScale),
    [zoom, rowSpacing, textScale, marginScale],
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
  /** Notes-layer objects (diagrams) currently revealed with a teaching note.
   *  Session-only: pressing the note icon shows them, closing hides them. */
  const [revealedNoteObjects, setRevealedNoteObjects] = useState<SolutionObject[]>([]);
  // Live snapshot for the Board Writer channels (read at write time).
  const notebookRowLinesRef = useRef<Set<number>>(new Set());
  notebookRowLinesRef.current = notebookRowLines;
  const OFFSETS_KEY = boardKey("offsets", boardScope);
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

  // KEYBOARD CAPTURE FOCUS. On a phone or tablet focusing this hidden textarea
  // would raise the device keyboard over the board, so focus is skipped for
  // every role there — hardware-keyboard handlers stay registered.
  const focusCapture = useCallback(() => {
    if (noNativeKeyboard) return;
    hiddenInputRef.current?.focus({ preventScroll: true });
  }, [noNativeKeyboard]);

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
  const SMARTLINES_KEY = boardKey("smartlines", boardScope);
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
    // Debounced — serializing on every stroke made writing feel stiff.
    const t = window.setTimeout(() => {
      try { localStorage.setItem(SMARTLINES_KEY, JSON.stringify(smartLines)); } catch { /* noop */ }
    }, 300);
    return () => window.clearTimeout(t);
  }, [smartLines, SMARTLINES_KEY]);

  // Magnet boxes — drop-in labelled cells that snap to a SmartLine when
  // released near it (numerator above, denominator below).
  const BOXES_KEY = boardKey("boxes", boardScope);
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

  /* ── Diagrams on the board (2D geometry + 3D / TVD) ──
     The board stores scene data and a position only; all drawing/editing is
     delegated to the existing diagram engines. Scoped by boardScope, so a
     diagram belongs to the page it was made on and returns on reload. */
  const DIAGRAMS_KEY = boardKey("diagrams", boardScope);
  /* ── Two-workspace board ──
     Left: this writing workspace. Right: the companion Lesson Note page of the
     same note (stored on the notebook row, not in board storage). */
  const [activeBoard, setActiveBoard] = useState<"main" | "tools">("main");
  /** Board B (the working copy editor) mounts on first use, then stays mounted. */
  const [boardBMounted, setBoardBMounted] = useState(false);
  useEffect(() => {
    if (activeBoard === "tools") setBoardBMounted(true);
  }, [activeBoard]);
  const [diagrams, setDiagrams] = useState<BoardDiagram[]>(() => {
    try {
      const raw = localStorage.getItem(DIAGRAMS_KEY);
      return raw ? sanitizeBoardDiagrams(JSON.parse(raw)) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(diagrams)); } catch { /* noop */ }
  }, [diagrams, DIAGRAMS_KEY]);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  // 2D diagrams edit inside their own floating card; only the 3D / TVD
  // workspace opens as a dialog. The Diagram menu picks 2D or 3D.
  const [diagramMenuOpen, setDiagramMenuOpen] = useState(false);
  const [editing3dId, setEditing3dId] = useState<string | null>(null);

  // Mathematical Tables picker, and the two floating utility workspaces
  // (Calculator, Conversion) which are used but never merged into the page.
  const [boardTablesOpen, setBoardTablesOpen] = useState(false);
  const [calcFloat, setCalcFloat] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [convFloat, setConvFloat] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Slide — presentation only on the board. The slides belong to the lesson
  // note; opening the menu just reads that note's own slide list.
  const [slideMenuOpen, setSlideMenuOpen] = useState(false);
  const [boardSlides, setBoardSlides] = useState<Slide[]>([]);
  const [slideShowIndex, setSlideShowIndex] = useState<number | null>(null);
  const openSlideMenu = useCallback(() => {
    setSlideMenuOpen((v) => !v);
    if (!notebookId) return;
    listSlides(notebookId).then(setBoardSlides).catch(() => setBoardSlides([]));
  }, [notebookId]);




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
    // Opening Floating Numbers is the student's explicit command to begin the
    // current mathematical line. This must fire even when the cursor already
    // rests on Line 1 and therefore has no index change to report.
    if (k === "numbers") setLineEngaged(true);
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
    const lineY = rowTopPx(sensor.line) + grid.LINE_HEIGHT * 0.5;
    setSmartLines((prev) => [...prev, newSmartLine(cx, lineY, grid.LINE_HEIGHT * 2)]);
  };
  /** Eraser hook for Smart Table / Smart Structure cells. Installed later
   *  (once the table state exists) and consulted FIRST by the eraser, so a
   *  value typed inside a structure can be rubbed out in place. Returns true
   *  when the point was handled. Retained ink (bracket, rules, minus signs,
   *  divider, "R", teacher-retained values) is never handled → never erased. */
  const eraseObjectCellRef = useRef<((cx: number, cy: number) => boolean) | null>(null);

  /** Per-node eraser. Hit-tests at viewport (cx, cy) and removes only the
   *  individual character / structure piece under the pointer — never the
   *  whole line. Works on stray digits dropped anywhere on the canvas. */
  const eraseAtPoint = useCallback((cx: number, cy: number) => {
    if (typeof document === "undefined") return;
    if (eraseObjectCellRef.current?.(cx, cy)) return;

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




  /* ── Undo / redo over ALL board editing — ONE chronological history ──
     Snapshots cover writing, smart lines, magnet boxes AND diagrams, so the
     newest user action is always what Undo reverses, whichever tool made it.
     We push the PREVIOUS state onto `past` every time any of them change
     (unless the change came from undo/redo itself — the `skip` flag). */
  type Snap = {
    freeLines: FreeLineMap;
    lineOffsets: Record<number, number>;
    smartLines: SmartLine[];
    boxes: MagnetBox[];
    diagrams: BoardDiagram[];
  };
  const histRef = useRef<{ past: Snap[]; future: Snap[]; skip: boolean; prev: Snap }>({
    past: [],
    future: [],
    skip: false,
    prev: { freeLines, lineOffsets, smartLines, boxes, diagrams },
  });
  const [, setHistTick] = useState(0);
  const bumpHist = () => setHistTick((n) => n + 1);
  useEffect(() => {
    const h = histRef.current;
    const next: Snap = { freeLines, lineOffsets, smartLines, boxes, diagrams };
    if (h.skip) { h.skip = false; h.prev = next; return; }
    // Cheap reference comparison — the old full-board JSON.stringify on
    // every keystroke was a major source of lag.
    if (
      h.prev.freeLines === freeLines &&
      h.prev.lineOffsets === lineOffsets &&
      h.prev.smartLines === smartLines &&
      h.prev.boxes === boxes &&
      h.prev.diagrams === diagrams
    ) return;
    h.past.push(h.prev);
    if (h.past.length > 200) h.past.shift();
    h.future = [];
    h.prev = next;
    bumpHist();
  }, [freeLines, lineOffsets, smartLines, boxes, diagrams]);

  const applySnap = (snap: Snap) => {
    setFreeLines(snap.freeLines);
    setLineOffsets(snap.lineOffsets);
    setSmartLines(snap.smartLines);
    setBoxes(snap.boxes);
    setDiagrams(snap.diagrams);
  };
  const doUndo = () => {
    const h = histRef.current;
    if (h.past.length === 0) return;
    const snap = h.past.pop()!;
    h.future.push(h.prev);
    h.skip = true;
    applySnap(snap);
    h.prev = snap;
    bumpHist();
  };
  const doRedo = () => {
    const h = histRef.current;
    if (h.future.length === 0) return;
    const snap = h.future.pop()!;
    h.past.push(h.prev);
    h.skip = true;
    applySnap(snap);
    h.prev = snap;
    bumpHist();
  };
  const canUndo = histRef.current.past.length > 0;
  const canRedo = histRef.current.future.length > 0;

  /* ── Diagram actions ──
     Each helper is one board state change, so it lands as one entry in the
     unified history above and Undo reverses it like any writing action. */
  const updateDiagram = useCallback((id: string, patch: Partial<BoardDiagram>) => {
    setDiagrams((prev) =>
      prev.map((d) => (d.id === id ? ({ ...d, ...patch } as BoardDiagram) : d)),
    );
  }, []);
  const deleteDiagram = useCallback((id: string) => {
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    setActiveDiagramId((cur) => (cur === id ? null : cur));
    setEditing3dId((cur) => (cur === id ? null : cur));
  }, []);
  const addDiagram2D = useCallback(() => {
    // Opens uncommitted → the card renders the Lesson Note 2D workbench.
    const d = newBoardDiagram2D(80, 80);
    setDiagrams((prev) => [...prev, d]);
    setActiveDiagramId(d.id);
  }, []);
  const addBoardGraph = useCallback(() => {
    const g = newBoardGraph(80, 80);
    setDiagrams((prev) => [...prev, g]);
    setActiveDiagramId(g.id);
  }, []);
  const addBoardTable = useCallback((attrs: MathTableAttrs) => {
    const t = newBoardTable(100, 100, attrs);
    setDiagrams((prev) => [...prev, t]);
    setActiveDiagramId(t.id);
  }, []);
  const addDiagram3D = useCallback(() => {
    const d = newBoardDiagram3D(80, 80);
    setDiagrams((prev) => [...prev, d]);
    setActiveDiagramId(d.id);
    setEditing3dId(d.id);
  }, []);



  const editing3d = diagrams.find((d) => d.id === editing3dId && d.kind === "3d") as
    | Extract<BoardDiagram, { kind: "3d" }>
    | undefined;




  /** Scroll the board one viewport down — the "nest" gesture. The board is
   *  already an infinite scroll surface (minHeight grows past the lowest used
   *  line), so this just smooth-scrolls the existing surface. */
  const scrollDownOneView = () => {
    const host = boardScrollRef.current;
    if (!host) return;
    host.scrollBy({ top: host.clientHeight * 0.85, behavior: "smooth" });
  };


  // Debounced persistence — synchronous JSON serialization on every
  // keystroke/sensor move made the board feel stiff.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try { localStorage.setItem(SENSOR_KEY, JSON.stringify(sensor)); } catch { /* noop */ }
    }, 300);
    return () => window.clearTimeout(t);
  }, [sensor, SENSOR_KEY]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try { localStorage.setItem(FREEWRITE_KEY, JSON.stringify(freeLines)); } catch { /* noop */ }
    }, 300);
    return () => window.clearTimeout(t);
  }, [freeLines, FREEWRITE_KEY]);
  useEffect(() => { setOccupancyTick((n) => n + 1); }, [freeLines, smartLines]);
  useEffect(() => {
    try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch { /* noop */ }
  }, [zoom, ZOOM_KEY]);
  // Floating-number workspace mirror (declared before the sync effects; the
  // state itself lives further down). The student's floating number is the
  // SAME shared object, so its activation travels with every board frame.
  const floatingSyncRef = useRef<{ activeLineIdx: number; lineEngaged: boolean; floating: FloatingShared | null }>(
    { activeLineIdx: 0, lineEngaged: false, floating: null },
  );

  const [floatingSyncTick, setFloatingSyncTick] = useState(0);
  /** The shared floating workspace as published by whoever holds edit rights.
   *  Receivers render THIS, never a locally re-derived arrangement. */
  const [remoteFloating, setRemoteFloating] = useState<FloatingShared | null>(null);
  /** Strip window + use order of the shared floating workspace (publisher side). */
  const [floatingView, setFloatingView] = useState({ reveal: 0, offset: 0, reentryOffset: 0 });
  const [floatingUsedOrderIdx, setFloatingUsedOrderIdx] = useState<number[]>([]);



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
    if (incoming.placeholderColorId) setPlaceholderColorId(sanitizePlaceholderColorId(incoming.placeholderColorId));
    // SAME floating number, not a copy: the active line activates on every
    // board at the same instant, even while its panel is hidden.
    if (typeof incoming.activeLineIdx === "number") setActiveLineIdxState(incoming.activeLineIdx);
    if (typeof incoming.lineEngaged === "boolean") setLineEngaged(incoming.lineEngaged);
    // The shared floating arrangement and its per-chip state, addressed by id.
    if (incoming.floating !== undefined) setRemoteFloating(incoming.floating ?? null);
    const t = window.setTimeout(() => { applyingRemoteRef.current = false; }, 0);
    return () => window.clearTimeout(t);
  }, [incoming, syncEnabled, selfId]);

  // ── Live mirroring: broadcast local board state while we hold edit rights. ──
  // The floating-number workspace (active line, engagement, shared arrangement)
  // is declared later in this component, so it reaches this effect through a ref
  // plus a tick.
  useEffect(() => {
    if (!syncEnabled || !canEdit) return;
    if (applyingRemoteRef.current) return;
    pushSnapshot({
      beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
      sensor, zoom, surface, profileId, inkColorId, placeholderColorId,
      activeLineIdx: floatingSyncRef.current.activeLineIdx,
      lineEngaged: floatingSyncRef.current.lineEngaged,
      floating: floatingSyncRef.current.floating ?? null,
    });
  }, [
    syncEnabled, canEdit, pushSnapshot,
    beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
    sensor, zoom, surface, profileId, inkColorId, placeholderColorId,
    floatingSyncTick,
  ]);






  // Keep the hidden textarea focused so keystrokes flow into the board.
  useEffect(() => {
    const t = window.setTimeout(() => focusCapture(), 0);
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
   *  baseline row. THE LAW:
   *  - Plain equation / handwriting / superscripts (x²) → 0 extra rows.
   *  - Tall structure (stacked fraction, binomial, matrix, big operator)
   *    → exactly 1 extra row (the row its lower body occupies).
   *  - Text Size overflow → whatever additional rows the measured ink needs
   *    beyond its allotted row pitch, so larger text pushes content DOWN
   *    and smaller text releases the space again. */
  const extraRowsFor = (line: number): number => {
    const row = freeLines[line] ?? freeLines[line + 0.5];
    const structural = row && row.length > 0 && rowHasTallStructure(row) ? 1 : 0;
    const measured = lineHeightsRef.current[line] ?? 0;
    const overflow = grid.LINE_HEIGHT > 0
      ? Math.max(0, Math.ceil(measured / grid.LINE_HEIGHT) - 1)
      : 0;
    return Math.max(structural, overflow);
  };

  // ── ROW PUSH-DOWN LAW ────────────────────────────────────────────────
  // Row Spacing defines a CONSTANT gap between consecutive Rows. Text Size
  // must never eat into that gap. When a Row's ink is taller than one
  // cursor height, the overflow is taken from the INFINITE space below:
  // every Row underneath is pushed down by exactly that overflow. Shrinking
  // the text releases the space again and the rows below travel back up.
  const beatOverflowRef = useRef<Record<string, { at: number; px: number }>>({});
  const [beatTick, setBeatTick] = useState(0);

  const shiftEntries = useMemo(() => {
    const out: Array<[number, number]> = [];
    const heights = lineHeightsRef.current;
    for (const k of Object.keys(heights)) {
      const line = Number(k);
      if (!Number.isFinite(line)) continue;
      const px = Math.max(0, (heights[line] ?? 0) - grid.CURSOR_HEIGHT);
      if (px > 0.5) out.push([line, px]);
    }
    for (const v of Object.values(beatOverflowRef.current)) {
      if (v.px > 0.5) out.push([v.at, v.px]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
    // heightsTick / beatTick force recomputation when measurements change.
  }, [grid.CURSOR_HEIGHT, heightsTick, beatTick]);

  /** Accumulated downward push (px) applied to `line` by taller ink above. */
  const shiftFor = useCallback((line: number): number => {
    let s = 0;
    for (const [l, px] of shiftEntries) {
      if (l >= line) break;
      s += px;
    }
    return s;
  }, [shiftEntries]);

  /** Screen Y of a Row's top, including push-down. */
  const rowTopPx = useCallback(
    (line: number) => grid.MARGIN_TOP + line * grid.LINE_HEIGHT + shiftFor(line),
    [grid.MARGIN_TOP, grid.LINE_HEIGHT, shiftFor],
  );

  /** Inverse of the push-down map: converts a canvas Y back into the
   *  equivalent unshifted Y so all existing row math keeps working. */
  const unshiftY = useCallback((y: number): number => {
    let adj = y;
    for (let i = 0; i < 4; i++) {
      const approx = Math.max(0, Math.floor((adj - grid.MARGIN_TOP) / grid.LINE_HEIGHT));
      adj = y - shiftFor(approx);
    }
    return adj;
  }, [grid.MARGIN_TOP, grid.LINE_HEIGHT, shiftFor]);

  const handleBeatMeasure = useCallback((id: string, at: number, allotmentPx: number, height: number) => {
    const px = Math.max(0, height - allotmentPx);
    const prev = beatOverflowRef.current[id];
    if (!prev || Math.abs(prev.px - px) > 2 || prev.at !== at) {
      beatOverflowRef.current[id] = { at, px };
      setBeatTick((t) => (t + 1) & 0xffff);
    }
  }, []);




  /** Post-structure gap is folded into the fixed skip-one law above:
   *  a tall structure already yields sensor = row + 2 via extraRowsFor.
   *  No additional gap row is ever added. */
  const sensorGapRowsBelow = (_line: number): number => 0;

  /** SINGLE definition of "the row right below `row`" used by EVERY sensor
   *  advance path (Enter key, line-sync, checkpoint).
   *  THE LAW: plain equation → exactly row + 1. Multi-row structure
   *  (fraction, matrix, big operator) → skip exactly ONE row → row + 2.
   *  Never more. */
  const nextSensorRowBelow = (row: number): number =>
    row + 1 + extraRowsFor(row) + sensorGapRowsBelow(row);

  // Structure-aware reflow was REMOVED intentionally. The teacher owns
  // the workspace layout: the Smartboard must never reposition already
  // written ink when a structure grows. Tall Lesson Objects simply
  // extend downward visually; the sensor and subsequent lines stay
  // wherever the teacher placed them.

  // ── LAW 2: LOCKED-INK RULE ───────────────────────────────────────────
  /** A row owned by a lesson line EARLIER than the one the Floating
   *  Number display is showing is immutable: no write path may replace
   *  or clear its ink. (Rows owned by the displayed line stay editable.) */
  const isLockedInkRow = (line: number): boolean => {
    if (displayedGuidedIdx < 0) return false;
    const r = Math.floor(line);
    const owner = rowOwners[r] ?? rowOwners[line];
    if (owner === undefined || owner >= displayedGuidedIdx) return false;
    const row = freeLines[r] ?? freeLines[line];
    return !!row && rowHasVisibleInk(row);
  };

  /** Edit the active line's tree via a fn that returns next root + cursor. */
  const editActive = (
    fn: (row: Row, c: Cursor) => { root: Row; cursor: Cursor },
  ) => {
    const line = sensor.line;
    const floorLine = Math.floor(line);
    // NEVER swallow a write. If the sensor is parked on a locked
    // notebook row (the old code silently returned here — the "nothing
    // is clickable" dead zone), relocate to the first genuinely free
    // row below using the ONE shared parking rule and write there.
    let writeLine: number = line;
    let relocated = false;
    if (notebookRowLines.has(floorLine) || notebookRowLines.has(line)) {
      const t = parkRowBelow(
        {
          ink: freeLines,
          rowOwners,
          lockedRows: notebookRowLines,
          bandStartRow: 0,
        },
        floorLine,
      );
      writeLine = t;
      relocated = true;
      ensureBandCovers(t);
      setSensor({ line: t, x: 0 });
      manualSensorRef.current = { line: t, x: 0 };
      activeSensorPhysicalLineRef.current = t;
      requestAnimationFrame(() => scrollBoardToRow(t));
    }
    setFreeLines((prev) => {
      const row = prev[writeLine] ?? [];
      const res = fn(row, relocated ? { path: [], index: 0 } : cursorRef.current);
      setLiveCursor(res.cursor);
      const next = { ...prev };
      if (res.root.length === 0) delete next[writeLine];
      else next[writeLine] = res.root;
      return next;
    });
    focusCapture();
  };

  // LIVE DISPATCH: `editActive` and `insertIntoActiveBox` are re-created on
  // every render so they always see the CURRENT sensor line / active box.
  // Stable callbacks (useCallback) must NEVER capture them directly — a
  // frozen copy remembers the first render's sensor line forever, which is
  // exactly the "everything writes onto one row" bug. They call through
  // these refs instead, which always point at the latest closures.
  const editActiveRef = useRef<typeof editActive>(() => {});
  const insertIntoActiveBoxRef = useRef<(text: string, replace?: boolean) => boolean>(() => false);

  /** Append input into the active magnet box (if any) instead of the board.
   *  Returns true when handled. */
  const insertIntoActiveBox = (text: string, replace = false): boolean => {
    if (!activeBoxId) return false;
    setBoxes((prev) => prev.map((b) => b.id === activeBoxId ? { ...b, text: replace ? text : b.text + text } : b));
    return true;
  };

  // Keep the live-dispatch refs pointing at THIS render's closures.
  editActiveRef.current = editActive;
  insertIntoActiveBoxRef.current = insertIntoActiveBox;

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
   *  real stacked structures before the teacher sees them.
   *
   *  Identity is stable (for the AI controller memo) but it dispatches
   *  through the live refs so writes ALWAYS land on the sensor's current
   *  line — never on a line frozen from the first render. */
  const insertTextAtSensor = useCallback((text: string) => {
    if (insertIntoActiveBoxRef.current(text)) return;
    const mirror = mirrorLessonNoteRow(text);
    if (!mirror.ok || mirror.row.length === 0) return;
    editActiveRef.current((row, c) => {
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
  }, []);

  /** Present-mode write: honours the teacher's sensor position (parity with
   *  Floating Number chip taps). If the current row is locked, the sensor
   *  steps to the first free row below — UNCAPPED walk, never bounded to
   *  the band, so line 6 behaves exactly like line 1. Block-kind items
   *  advance the sensor down one row afterwards so the next click gets a
   *  fresh line. */
  const presentWriteAtSensor = useCallback(
    (text: string, opts?: { advanceAfter?: boolean }) => {
      if (!text.trim()) return;
      const stepPastLocked = (from: number): number => {
        let t = nextSensorRowBelow(from);
        for (let g = 0; g < 200 && (notebookRowLines.has(t) || isLockedInkRow(t)); g++) t += 1;
        return t;
      };
      const cur = Math.floor(sensor.line);
      if (notebookRowLines.has(cur) || isLockedInkRow(sensor.line)) {
        const t = stepPastLocked(cur);
        ensureBandCoversRef.current(t);
        setSensor((s) => ({ ...s, line: t, x: 0 }));
      }
      insertTextAtSensor(text);
      if (opts?.advanceAfter) {
        const t = stepPastLocked(Math.floor(sensor.line));
        ensureBandCoversRef.current(t);
        setSensor((s) => ({ ...s, line: t, x: 0 }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [notebookRowLines, insertTextAtSensor, sensor.line],
  );

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
  // Live snapshot of freeLines so writers can compute placement
  // synchronously (before React commits) and report the rows they used.
  const freeLinesRef = useRef(freeLines);
  freeLinesRef.current = freeLines;

  const writeProseLineOnBoard = useCallback((
    rawFromLessonNote: string,
    atRow?: number,
    opts?: { advanceSensor?: boolean },
  ): number | null => {
    const raw = rawFromLessonNote ?? "";
    if (!raw.trim()) return null;
    // PARAGRAPH-SHAPED NOTES: the note must mirror the lesson-note's own
    // paragraph structure, not flatten onto one endlessly-scrolling row.
    // Split on blank lines first (real paragraph breaks); if none exist,
    // fall back to single-newline breaks so authored line breaks still
    // create rows. Empty paragraphs are dropped.
    const paragraphs = (
      raw.includes("\n\n") ? raw.split(/\n{2,}/) : raw.split(/\n+/)
    )
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) return null;

    // Pre-compute the mirror rows once so the parity gate runs per
    // paragraph and any that fail are skipped rather than dropping the
    // whole note.
    let mirrored = paragraphs
      .map((p) => mirrorLessonNoteRow(p))
      .filter((m) => m.ok && m.row.length > 0);
    if (mirrored.length === 0) {
      // Parity gate refused every paragraph. NEVER silently no-op — a note
      // click must always produce visible ink, so fall back to writing the
      // raw text as plain character rows.
      mirrored = paragraphs.map((p) => ({
        row: graphemes(p).map((ch) => mkChar(ch)),
        signature: p,
        ok: true,
      }));
      if (mirrored.length === 0) return null;
    }

    const prev = freeLinesRef.current;

    // Move the sensor to the first empty writable row BELOW lastRow.
    // Note rows are locked (non-editable), so the sensor must never be
    // left parked on/before a note — it lands on the next free row.
    const advanceBelow = (
      lastRow: number,
      map: typeof prev,
      extraNoteRows: Set<number>,
    ): void => {
      let t = lastRow + 1;
      const blocked = (r: number): boolean => {
        const whole = map[r];
        const half = map[r + 0.5];
        return (
          (!!whole && rowHasVisibleInk(whole)) ||
          (!!half && rowHasVisibleInk(half)) ||
          notebookRowLines.has(r) ||
          extraNoteRows.has(r)
        );
      };
      // UNCAPPED walk — a bounded walk here used to expire on dense
      // boards and park the sensor ON a locked row (dead zone).
      for (let guard = 0; guard < 200 && blocked(t); guard++) t += 1;
      // BAND-FOLLOWS-INK: the parked row must be INSIDE the writable
      // band, or clicks there are dead (hidden rows below bandEnd).
      ensureBandCovers(t, extraNoteRows);
      setSensor({ line: t, x: 0 });
      setLiveCursor({ path: [], index: 0 });
      manualSensorRef.current = { line: t, x: 0 };
      activeSensorPhysicalLineRef.current = t;
      requestAnimationFrame(() => scrollBoardToRow(t));
    };

    // Idempotency: if the FIRST paragraph is already on the board with
    // the exact same signature, treat the whole note as already
    // committed, re-mark it as sensor-restricted, and SCROLL to it so
    // the teacher can SEE the existing note (it may live off-screen —
    // a bare sensor jump with no visible ink reads as "nothing happened").
    const firstSig = mirrored[0].signature;
    for (const k of Object.keys(prev)) {
      const n = Number(k);
      const row = prev[n];
      if (row && row.length > 0 && rowSignature(row) === firstSig) {
        const existing = Math.floor(n);
        setNotebookRowLines((prevSet) => {
          const ns = new Set(prevSet);
          ns.add(existing);
          return ns;
        });
        requestAnimationFrame(() => scrollBoardToRow(existing));
        if (opts?.advanceSensor) {
          advanceBelow(existing + mirrored.length - 1, prev, new Set([existing]));
        }
        return existing;
      }
    }

    // Insert paragraphs consecutively from the target row downward.
    // The caller may pass an EXPLICIT row (atRow) — required when the
    // sensor was just moved in the same event, because `sensor.line`
    // in this closure is still the OLD value (React state is async).
    // LAW 2 (Locked-Ink Rule) still applies: existing ink is never
    // overwritten — each paragraph slides to the first free row below.
    // POST-STRUCTURE GAP: writing directly under a tall structure
    // (fraction, matrix, big-op, tall radicand) reserves at least one
    // empty row so the note never collides with a denominator/body.
    const next = { ...prev };
    const newNotebookRows: number[] = [];
    let target = Math.floor(atRow ?? sensor.line);
    const rowIsTall = (r: number): boolean => {
      const row = next[r] ?? next[r + 0.5];
      return !!row && rowHasVisibleInk(row) && rowHasTallStructure(row);
    };
    // Initial gap enforcement: covers BOTH "sensor parked directly on
    // the tall row" and "sensor parked one row below it". Either way
    // the note must clear the structure's full footprint plus one
    // empty breathing row before it may land.
    if (rowIsTall(target)) {
      target = nextSensorRowBelow(target);
    } else if (target > 0 && rowIsTall(target - 1)) {
      target = Math.max(target, nextSensorRowBelow(target - 1));
    }
    const occupied = (r: number): boolean => {
      const whole = next[r];
      const half = next[r + 0.5];
      return (
        (!!whole && rowHasVisibleInk(whole)) ||
        (!!half && rowHasVisibleInk(half)) ||
        notebookRowLines.has(r) ||
        newNotebookRows.includes(r)
      );
    };
    for (const m of mirrored) {
      // Skip occupied rows; when an occupant is a tall structure, jump
      // past its full multi-row footprint + one empty breathing row so
      // the paragraph never collides with a denominator/body.
      while (occupied(target)) {
        target = rowIsTall(target) ? nextSensorRowBelow(target) : target + 1;
      }
      next[target] = m.row;
      newNotebookRows.push(target);
      target += 1;
    }
    // Optimistically publish the snapshot so a second write in the same
    // tick sees these rows as taken, then merge into live state (never
    // clobbering rows another queued updater may have touched).
    freeLinesRef.current = next;
    const placed = newNotebookRows.map((r) => [r, next[r]] as const);
    setFreeLines((p) => {
      const merged = { ...p };
      for (const [r, rowInk] of placed) merged[r] = rowInk;
      return merged;
    });
    setNotebookRowLines((prevSet) => {
      const ns = new Set(prevSet);
      for (const r of newNotebookRows) ns.add(r);
      return ns;
    });
    const lastRow = newNotebookRows[newNotebookRows.length - 1];
    // The note rows themselves must be inside the writable band —
    // rows below bandEnd are hidden and unclickable.
    ensureBandCovers(lastRow, new Set(newNotebookRows));
    if (opts?.advanceSensor) {
      advanceBelow(lastRow, next, new Set(newNotebookRows));
    }
    return lastRow;
  // scrollBoardToRow / refs are stable identities read at call time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor.line, notebookRowLines]);


  /** Insert a real stacked fraction at the sensor (no slash). Optional sign
   *  is typed first; the frac node is created with numerator/denominator
   *  rows pre-filled so the bar shows immediately. Stable identity, live
   *  dispatch — same pattern as insertTextAtSensor. */
  const insertFractionAtSensor = useCallback((parts: { sign: string; num: string; den: string }) => {
    if (insertIntoActiveBoxRef.current(`${parts.sign}${parts.num}/${parts.den}`)) return;
    editActiveRef.current((row, c) => {
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
  }, []);

  /** A matrix chip is a STRUCTURE, never a finished object. Tapping it inserts
   *  an EMPTY bracketed grid of the chosen dimensions with the cursor parked in
   *  the first cell — exactly like a fraction or square-root shell. The teacher
   *  then fills each cell independently from the value chips. Values are never
   *  inserted together with the structure. */
  const insertMatrixAtSensor = useCallback((latex: string) => {
    const shell = matrixShellFromLatex(latex);
    if (!shell) return;
    const node = mkMatrix(shell.rows, shell.cols, shell.left || "(", shell.right || ")");
    editActiveRef.current((row, c) => {
      const cur = exitCompletedScriptCursor(row, c);
      // descend = true → cursor lands inside the first (empty) matrix cell.
      return treeInsertNode(row, cur, node, true);
    });
  }, []);

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
      rect.top + 24 + lineToY(sensor.line, grid) + shiftFor(sensor.line) - host.scrollTop + grid.CARET_HEIGHT * 0.5;
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
  useEffect(() => { try { localStorage.setItem(PLACEHOLDER_COLOR_STORAGE_KEY, placeholderColorId); } catch { /* noop */ } }, [placeholderColorId]);

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
  const placeholderColor = resolvePlaceholderColor(placeholderColorId, surface);
  const current = beatCursor >= 0 ? beats[beatCursor] : undefined;
  const revealed = beatCursor >= 0 ? beats.slice(0, beatCursor + 1) : [];

  // ── Timer attempt layer (optional, teacher-enabled, per question) ────────
  // A SECOND temporary layer. It never grades and never writes progress.
  const timer = useQuestionTimerAttempt({
    enabled: !!timerEnabled && assessmentMode && !testMode && role === "student" && !viewOnly,
    assessmentId,
    studentId: boardStudentId,
    questionId: boardQuestionId ?? current?.id ?? null,
    // Guest Link sitting — the same timer, kept on the guest's own device.
    guest: guestSlug && participantKey ? { code: guestSlug, token: participantKey } : null,
  });

  const timerRef = useRef(timer);
  timerRef.current = timer;

  /** The dust pen (Eraser) and # (Floating numbers) are toggles, so their
   *  button must read unmistakably ON while the tool is active. */
  const controlIsOn = (label: string): boolean =>
    (label === "Eraser" && eraseMode) ||
    (label === "Floating numbers" && activeAssistant === "numbers");

  // ONE number sequence, TWO visible colours only.
  //   BLUE  → the mark for that position is already awarded (survives Reset)
  //   BROWN → that position is being solved/re-solved in the live timed attempt
  // The permanent and attempt layers are still tracked separately internally,
  // but the student never sees a green state and never a second number row.
  const PROGRESS_BROWN = "hsl(26 55% 38%)";
  const progressLayers = useMemo(() => {
    const blue = new Set<string>();
    const brown = new Set<string>();
    for (const key of Object.keys(solvedSlots)) blue.add(key.split(":")[0] ?? "");
    if (timer.active) for (const key of Object.keys(timer.confirmed)) brown.add(key.split(":")[0] ?? "");
    return { blue, brown };
  }, [solvedSlots, timer.active, timer.confirmed]);


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

  const rowHasInk = useCallback((line: number): boolean => {
    const row = freeLines[line];
    return !!row && rowHasVisibleInk(row);
  }, [freeLines]);

  /** Lowest board row inside the active band that carries VISIBLE ink
   *  (or a placed note). This — the actual board content — is the sole
   *  source of truth for "the last written row"; ownership bookkeeping
   *  is never trusted for sensor placement. Returns -1 when the band is
   *  entirely empty. */
  const lastVisibleInkRow = useCallback((L: BeatLayout): number => {
    const a = bandStart(L), b = bandEnd(L);
    let last = -1;
    for (const key of Object.keys(freeLines)) {
      const ln = Number(key);
      const r = Math.floor(ln);
      if (r < a || r > b) continue;
      const row = freeLines[ln];
      if (row && rowHasVisibleInk(row)) last = Math.max(last, r);
    }
    for (const ln of notebookRowLines) {
      const r = Math.floor(ln);
      if (r >= a && r <= b) last = Math.max(last, r);
    }
    return last;
  }, [freeLines, notebookRowLines]);

  /** A row can be visually occupied by a tall structure that starts above it
   *  (fraction denominator, radical body, matrix, etc.). The sensor must skip
   *  those covered rows exactly as if they contained ink. */
  const rowCoveredByStructure = useCallback((line: number, L: BeatLayout): boolean => {
    const target = Math.floor(line);
    const a = bandStart(L), b = bandEnd(L);
    for (const key of Object.keys(freeLines)) {
      const source = Number(key);
      if (!Number.isInteger(source)) continue;
      if (source < a || source > b || source >= target) continue;
      const row = freeLines[source];
      const isOccupied = (!!row && row.length > 0) || notebookRowLines.has(source);
      if (!isOccupied) continue;
      if (source + extraRowsFor(source) >= target) return true;
    }
    return false;
  // extraRowsFor reads measured heights from a ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, notebookRowLines]);

  const isEmptyWritableRow = useCallback((line: number, L: BeatLayout): boolean => {
    const r = Math.floor(line);
    const a = bandStart(L), b = bandEnd(L);
    if (r < a || r > b) return false;
    if (notebookRowLines.has(r) || notebookRowLines.has(line)) return false;
    if (rowHasInk(r) || rowHasInk(line)) return false;
    if (rowCoveredByStructure(r, L)) return false;
    return true;
  }, [notebookRowLines, rowHasInk, rowCoveredByStructure]);

  // First empty writable row inside the active beat's band. This is used only
  // at checkpoints (open Solution / Enter / note / line-complete / scrollbar),
  // never on every keystroke, so typing order is not disturbed.
  const firstEmptyBandRow = useCallback((L: BeatLayout): number => {
    const a = bandStart(L), b = bandEnd(L);
    for (let r = a; r <= b; r++) {
      if (isEmptyWritableRow(r, L)) return r;
    }
    return b + 1;
  }, [isEmptyWritableRow]);

  const findNextWritableEmptyRow = useCallback((startRow: number, dir: 1 | -1, L: BeatLayout): number => {
    const a = bandStart(L), b = bandEnd(L);
    let r = Math.floor(startRow);
    if (dir > 0) {
      for (; r <= b; r++) if (isEmptyWritableRow(r, L)) return r;
      return b + 1;
    }
    for (; r >= a; r--) if (isEmptyWritableRow(r, L)) return r;
    return a - 1;
  }, [isEmptyWritableRow]);

  const firstWritableRowAfter = useCallback((line: number, L: BeatLayout): number => {
    const start = nextSensorRowBelow(Math.floor(line));
    return findNextWritableEmptyRow(start, 1, L);
  // extraRowsFor reads measured heights from a ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findNextWritableEmptyRow]);

  // Tracks a deliberate downward push of the sensor by the teacher via
  // the Cursor Scrollbar. While set, auto-snap stops moving the sensor
  // back to the first-empty row.
  const manualPushedRef = useRef<number | null>(null);
  // Sticky manual sensor position from the Sensor D-pad. When set, the
  // auto-anchor effect must respect this {line,x} instead of snapping the
  // sensor back to firstEmptyBandRow. Cleared on beat/reservoir change
  // and when ink lands on the manually chosen row.
  const manualSensorRef = useRef<{ line: number; x: number } | null>(null);
  const activeSensorLogicalIdxRef = useRef<number | null>(null);
  const activeSensorPhysicalLineRef = useRef<number | null>(null);
  // Rows owned by the guided line currently shown on the Floating Number
  // display. Kept in a ref so the D-pad nudge callbacks (declared before
  // the ownership memo) can read it without stale-closure/TDZ issues.
  const displayedLineRowsRef = useRef<Set<number>>(new Set());



  // When a writable Solution opens, anchor the sensor at the first EMPTY row
  // of the active Solution band — below the last written equation/note, not
  // permanently under the “Solution” label.
  useEffect(() => {
    if (!solvingMode) return;
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    // Initial sensor position = the row IMMEDIATELY below "Solution".
    // Do NOT scan for the first empty row: on reload the teacher expects
    // to land right under the caption, above any existing ink, and place
    // themselves manually. bandStart is exactly that row.
    const r = bandStart(activeLayout);
    setSensor({ line: r, x: 0 });
    setLiveCursor({ path: [], index: 0 });
    autoFloorRef.current = r;
    manualPushedRef.current = null;
    manualSensorRef.current = null;
    activeSensorLogicalIdxRef.current = null;
    activeSensorPhysicalLineRef.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvingMode, activeLayout?.id]);

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
  /** Live mirror of rowOwners for callbacks declared above its state
   *  (growActiveBand / nudgeCursor) — avoids TDZ while staying current. */
  const rowOwnersRef = useRef<Record<number, number>>({});

  /** FRESH-ROW GROWTH LAW: when the writable band grows, the newly opened
   *  row must be BLANK. Board ink is persisted across sessions, and rows
   *  outside the band are hidden — not deleted. Without this purge, every
   *  ▼ press at the band bottom would un-hide one more row of the old
   *  saved solution, making the board look like it "solves itself".
   *  Rows owned by this lesson's committed lines or placed notes are
   *  never touched — only orphaned, hidden leftover ink is cleared. */
  const purgeHiddenInkRow = (r: number) => {
    setFreeLines((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of [r, r + 0.5]) {
        const row = next[key];
        if (!row || row.length === 0) continue;
        if (rowOwnersRef.current[r] !== undefined) continue; // committed lesson line
        // Read locks through the REF (updated synchronously on note
        // commits) so a note written in this same tick is never purged.
        if (notebookRowLinesRef.current.has(r) || notebookRowLinesRef.current.has(key as number)) continue; // placed note
        delete next[key];
        changed = true;
      }
      return changed ? next : prev;
    });
  };

  /** Grow the active band by one when the teacher needs more room.
   *  Always purges stale hidden ink on the row being opened, so NO
   *  growth path (D-pad ▼, keyboard ArrowDown, Enter-advance, line
   *  verification) can ever reveal previously hidden content. */
  const growActiveBand = () => {
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    purgeHiddenInkRow(bandEnd(activeLayout) + 1);
    setBandExtra((m) => ({ ...m, [activeLayout.id]: (m[activeLayout.id] ?? 0) + 1 }));
  };

  /** BAND-FOLLOWS-INK LAW: any write that lands ink or parks the sensor
   *  at/below the band's last row grows the band so every landed row AND
   *  the sensor row stay inside writable space. Rows below bandEnd are
   *  hidden and unclickable — THAT was the line-6+ dead zone: lines 1-5
   *  fit inside the initial band, line 6+ overflowed it. Identical for
   *  every line. `skipPurge` = rows written this very tick. */
  const ensureBandCovers = (maxRow: number, skipPurge?: ReadonlySet<number>) => {
    const L = activeLayout;
    if (!L || L.bandLines <= 0) return;
    const b = bandEnd(L);
    const need = Math.ceil(maxRow);
    if (need <= b) return;
    for (let r = b + 1; r <= need; r++) {
      if (skipPurge?.has(r)) continue;
      purgeHiddenInkRow(r);
    }
    setBandExtra((m) => ({ ...m, [L.id]: (m[L.id] ?? 0) + (need - b) }));
  };
  // Live-dispatch ref so stable callbacks (commitWritePlan, note paths)
  // always call THIS render's ensureBandCovers — never a stale layout.
  const ensureBandCoversRef = useRef<typeof ensureBandCovers>(() => {});
  ensureBandCoversRef.current = ensureBandCovers;



  /** Dedicated cursor-up/down nudge for the Sensor D-pad. It jumps over
   *  written/locked/restricted/structure-covered rows and parks on empty
   *  working space OR on a row belonging to the line the Floating Number
   *  display currently shows (that line is always editable). Master left
   *  margin (x=0) is enforced on every nudge. ▲ is free anywhere inside
   *  the empty solution space — it only stops at the top of the band. */
  const nudgeCursor = useCallback((dir: 1 | -1) => {
    // STRUCTURE FIRST — checked BEFORE any board-layout guard, so caret
    // movement inside a fraction, radical, power, script or matrix cell
    // never depends on band state. ▲/▼ steps between that structure's
    // slots, searching outward through every enclosing structure, and ▲
    // escapes once nothing sits above. Only when the maths offers no
    // vertical target does the sensor change board row.
    {
      const rowInk = freeLines[sensor.line] ?? freeLines[Math.floor(sensor.line)] ?? [];
      const c = cursorRef.current;
      if (rowInk.length > 0 && c.path.length >= 2) {
        const next = dir < 0 ? treeMoveUp(rowInk, c) : treeMoveDown(rowInk, c);
        if (next) {
          setLiveCursor(next);
          focusCapture();
          return;
        }
      }
    }
    if (!activeLayout || activeLayout.bandLines <= 0) return;



    const a = bandStart(activeLayout);
    const b = bandEnd(activeLayout);
    const start = Math.floor(sensor.line) + dir;
    const displayedRows = displayedLineRowsRef.current;
    // Scan for the next acceptable row: empty writable OR owned by the
    // displayed line (editable even when written).
    let cand = a - 1 - (dir > 0 ? -(b - a + 2) : 0); // sentinel out of range
    {
      let r = start;
      let found = false;
      while (dir > 0 ? r <= b : r >= a) {
        if (isEmptyWritableRow(r, activeLayout) || displayedRows.has(r)) { found = true; break; }
        r += dir;
      }
      cand = found ? r : (dir > 0 ? b + 1 : a - 1);
    }

    if (dir === -1 && cand < a) return; // top of the writable band
    if (dir === 1 && cand > b) {
      // ▼ at the bottom of the writable band: grow the band by one empty
      // row so all empty space stays reachable by the sensor. The teacher
      // must always be able to keep moving down into fresh working space.
      growActiveBand();
      cand = b + 1;
    }
    // Leaving an empty row resets its temporary horizontal offset so
    // future ink on it starts back at the master left margin.
    const departed = sensor.line;
    const departedInk = freeLines[departed] ?? freeLines[Math.floor(departed)] ?? [];
    if (departedInk.length === 0) {
      setLineOffsets((m) => {
        if (!(departed in m)) return m;
        const copy = { ...m };
        delete copy[departed];
        return copy;
      });
    }
    setSensor((s) => ({ ...s, line: cand, x: 0 }));
    // Landing on a written row of the displayed line parks the caret at the
    // END of its ink, ready to continue/edit; empty rows start at index 0.
    const candInk = freeLines[cand] ?? freeLines[cand + 0.5] ?? [];
    setLiveCursor({ path: [], index: displayedRows.has(cand) ? candInk.length : 0 });
    const auto = Math.min(firstEmptyBandRow(activeLayout), b + 1);
    manualPushedRef.current = cand > auto ? cand : null;
    manualSensorRef.current = { line: cand, x: 0 };
    activeSensorPhysicalLineRef.current = cand;
    // IMPORTANT: keep activeSensorLogicalIdxRef intact. Nulling it made the
    // line-sync effect believe the presentation line changed, which wiped
    // manualSensorRef and snapped the sensor straight back — the D-pad
    // looked dead.
  }, [activeLayout, sensor.line, freeLines, firstEmptyBandRow, isEmptyWritableRow, setLiveCursor]);

  /** Horizontal nudge for the Sensor D-pad. Moves the sensor inside its
   *  current empty row by one grid column. Clamps at the master left
   *  margin (x=0) on the left and at the row's right-edge writable
   *  extent on the right. Never enters a written/restricted row.
   *  The visible caret is positioned via lineOffsets (the row's start
   *  offset), so horizontal nudges must write BOTH sensor.x and the
   *  row's offset — sensor.x alone never moves the caret on screen. */
  const nudgeCursorHoriz = useCallback((dir: 1 | -1) => {
    const r = Math.floor(sensor.line);
    // Only bail if we're clearly on a restricted prose row.
    if (notebookRowLines.has(r)) return;
    const rowInk = freeLines[sensor.line] ?? freeLines[r] ?? [];
    if (rowInk.length > 0) {
      // Written row: shifting the offset would drag the ink sideways, so
      // ◀/▶ walks the CARET through the existing ink instead. Checked before
      // any board-layout guard — it is the only way out of a nested slot
      // such as a radical's radicand.
      setLiveCursor((c) => (dir > 0 ? treeMoveRight(rowInk, c) : treeMoveLeft(rowInk, c)));
      focusCapture();
      return;
    }
    if (!activeLayout || activeLayout.bandLines <= 0) return;


    const step = grid.FONT_PX * 0.6; // one ~character-width column
    const boardW = boardScrollRef.current?.getBoundingClientRect().width ?? 1200;
    const maxX = Math.max(0, boardW - grid.MARGIN_LEFT - grid.FONT_PX);
    const next = dir > 0
      ? Math.min(maxX, sensor.x + step)
      : Math.max(0, sensor.x - step);
    if (next === sensor.x) return;
    setSensor((s) => ({ ...s, x: next }));
    // Move the visible caret: the row's start offset drives where the
    // empty active line (and its future ink) renders.
    setLineOffsets((m) => {
      const key = sensor.line;
      if (next === 0) {
        if (!(key in m)) return m;
        const copy = { ...m };
        delete copy[key];
        return copy;
      }
      return { ...m, [key]: next };
    });
    setLiveCursor({ path: [], index: 0 });
    manualSensorRef.current = { line: r, x: next };
    activeSensorPhysicalLineRef.current = sensor.line;
  }, [activeLayout, sensor.line, sensor.x, grid.FONT_PX, grid.MARGIN_LEFT, notebookRowLines, freeLines, setLiveCursor]);

  /** True while the caret sits inside a nested slot of a structure on an
   *  inked row — there the D-pad navigates the maths, not the board. */
  const caretInStructure = (() => {
    if (cursor.path.length < 2) return false;
    const rowInk = freeLines[sensor.line] ?? freeLines[Math.floor(sensor.line)] ?? [];
    return rowInk.length > 0;
  })();

  const canCursorUp = (() => {
    // ▲ is enabled whenever ANY empty writable row exists above the
    // sensor inside the active band — the sensor roams freely in the
    // empty solution space. It is ALSO enabled while the caret sits inside
    // a structure, because there ▲ steps/escapes slots rather than rows.
    if (caretInStructure) return true;
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
    const a = bandStart(activeLayout);
    const cand = findNextWritableEmptyRow(Math.floor(sensor.line) - 1, -1, activeLayout);
    return cand >= a;
  })();

  const canCursorDown = (() => {
    if (caretInStructure) return true;
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
    // ↓ can always grow the band, so it's always enabled while solving.
    return true;
  })();
  // ◀ / ▶ are ALWAYS live on a writable row. On an inked row they walk the
  // caret through the equation (into and out of fractions, radicals,
  // powers…) instead of shifting the row offset, so the sensor can never be
  // trapped inside a structure slot.
  const canCursorLeft = (() => {
    if (notebookRowLines.has(Math.floor(sensor.line))) return false;
    const rowInk = freeLines[sensor.line] ?? freeLines[Math.floor(sensor.line)] ?? [];
    if (rowInk.length > 0) return true;
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
    return sensor.x > 0;
  })();
  const canCursorRight = (() => {
    if (notebookRowLines.has(Math.floor(sensor.line))) return false;
    const rowInk = freeLines[sensor.line] ?? freeLines[Math.floor(sensor.line)] ?? [];
    if (rowInk.length > 0) return true;
    if (!activeLayout || activeLayout.bandLines <= 0) return false;
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

  // The Floating Number panel remembers its current line across page
  // reloads and across open/close of the # panel. We deliberately do NOT
  // snap back to Line 1 when the panel opens — that behaviour was replaced
  // by teacher-facing "line memory" (see the localStorage restore below).
  /* ── Line-by-line composer state ──
     For each active example reservoir, the teacher must reproduce every
     `reservoir.lines[k].equation` on the board IN ORDER before the Next
     button is allowed to advance. Detection compares the canonical ASCII
     of each written line against the target. Tokens belonging to a
     completed line get dimmed in the carrier; structures it required get
     dimmed in the structures strip. */
  // ── ONE ACTIVE LINE ──────────────────────────────────────────────────
  // There used to be three parallel cursors (activeLineIdx for grading,
  // floatingLineIdx for the chip strip, manualFloatingLineIdx for manual
  // navigation) which drifted apart, so the Floating Number Display, the
  // Presenter Preview and the Check engine could each believe a different
  // line was active. They are now ONE state. The old setter names are kept
  // as aliases so every existing call site funnels into the same value.
  const [activeLineIdx, setActiveLineIdxState] = useState<number>(0);
  // ENGAGEMENT — false until the student really activates a line (#, a
  // floating chip, Present, Next, Previous, a table cell). The teaching
  // video reads it so the Introduction owns the opening instead of being
  // cut off by the default cursor sitting on Line 1.
  const [lineEngaged, setLineEngaged] = useState(false);
  const [playbackResetGeneration, setPlaybackResetGeneration] = useState(0);
  /** Every real activation funnels here, so engagement is never guessed. */
  const setActiveLineIdx = useCallback<React.Dispatch<React.SetStateAction<number>>>((v) => {
    setLineEngaged(true);
    setActiveLineIdxState(v);
  }, []);
  const floatingLineIdx = activeLineIdx;
  // Feed the live-mirroring effect above: any activation of the shared
  // floating number publishes on the very next frame, with no debounce.
  useEffect(() => {
    floatingSyncRef.current = { ...floatingSyncRef.current, activeLineIdx, lineEngaged };
    setFloatingSyncTick((n) => n + 1);
  }, [activeLineIdx, lineEngaged]);

  const setFloatingLineIdx = setActiveLineIdx;
  const setManualFloatingLineIdx = useCallback((v: number | null) => {
    if (typeof v === "number") setActiveLineIdx(v);
  }, [setActiveLineIdx]);


  // ── REASONING ENGINE ────────────────────────────────────────────────────
  // The one brain: it owns the active line, binds it to the board row the
  // student is actually writing on, tracks attempts, and produces the live
  // snapshot the teacher Reasoning panel renders. In-memory only.
  const reasoningRef = useRef<ReasoningEngine>(new ReasoningEngine());




  // ─── Placeholder sweep on advance ────────────────────────────────────
  // When the teacher moves forward (activeLineIdx increases), any row on
  // the board that is now "placeholder-only" (an empty fraction, empty
  // √, empty power, …) belongs to a chip the teacher tapped but never
  // filled. We hide it now that the line is locked, so orphaned □ boxes
  // stop hanging around. If the teacher rewinds to an earlier line, they
  // can tap the chip again to bring a fresh placeholder back — the line
  // is unlocked and editable at that point.
  const placeholderSweepPrevRef = useRef<number>(0);
  useEffect(() => {
    const prev = placeholderSweepPrevRef.current;
    placeholderSweepPrevRef.current = activeLineIdx;
    if (activeLineIdx <= prev) return; // only sweep on forward moves

    const stale: number[] = [];
    for (const key of Object.keys(freeLinesRef.current)) {
      const r = Number(key);
      const row = freeLinesRef.current[r];
      if (!row || row.length === 0) continue;
      if (isPlaceholderOnly(row)) stale.push(r);
    }
    if (stale.length === 0) return;

    const nextFree = { ...freeLinesRef.current };
    for (const r of stale) delete nextFree[r];
    freeLinesRef.current = nextFree;
    setFreeLines((p) => {
      const nx = { ...p };
      for (const r of stale) delete nx[r];
      return nx;
    });
    setRowOwners((p) => {
      let changed = false;
      const nx = { ...p };
      for (const r of stale) if (r in nx) { delete nx[r]; changed = true; }
      return changed ? nx : p;
    });
    setNotebookRowLines((p) => {
      if (p.size === 0) return p;
      let changed = false;
      const nx = new Set(p);
      for (const r of stale) if (nx.delete(r)) changed = true;
      return changed ? nx : p;
    });
  }, [activeLineIdx]);
  // Manual navigation no longer keeps a separate cursor — it writes straight
  // into the single active line above. Kept as a null alias so the existing
  // `manualFloatingLineIdx ?? floatingLineIdx` reads still resolve.
  const manualFloatingLineIdx: number | null = null;

  // Notebook-reveal gate: when non-null, the FloatingNumberPanel is showing
  // the prose "Notebook N" instead of Line N's fillers. A second Prev/Next
  // tap commits the reveal — marks N as shown and advances to Line N.
  const [notebookRevealIdx, setNotebookRevealIdx] = useState<number | null>(null);
  const [shownNotebookIdx, setShownNotebookIdx] = useState<Set<number>>(() => new Set());
  // A note icon stays calm at first. It only glows after the teacher tries to
  // move to the next Lesson Line without first placing that note on the board.
  const [notebookAttentionIdx, setNotebookAttentionIdx] = useState<Set<number>>(() => new Set());
  const [consumedAbsIdx, setConsumedAbsIdx] = useState<Set<number>>(() => new Set());
  const [consumedStructures, setConsumedStructures] = useState<Set<ContainerKind>>(() => new Set());

  // The "notebook shown" set is SESSION-ONLY. It used to be persisted in
  // localStorage, which let stale "already clicked" flags from old sessions
  // (auto-write era) silently satisfy the note gate forever — the line-1
  // "never glows" bug. The gate below now checks the BOARD live instead.

  // Reset composer state every time the active example changes. We do NOT
  // force activeLineIdx back to 0: the resume effect below will scan the
  // board and place the teacher on the next unsolved lesson line.
  useEffect(() => {
    // Line-memory restore: read the persisted Floating Number line for
    // this notebook+reservoir so leaving the page and coming back keeps
    // the teacher on the same lesson line.
    const FLOAT_LINE_KEY = `${boardKey("floatLineIdx", boardScope)}:${activeReservoirIdx}`;
    let restoredIdx = 0;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(FLOAT_LINE_KEY) : null;
      if (raw != null) {
        const n = Number(JSON.parse(raw));
        if (Number.isFinite(n) && n >= 0) restoredIdx = Math.floor(n);
      }
    } catch { /* noop */ }
    // Reasoning is a live monitoring tool only — a new question/reservoir
    // starts from a completely empty engine.
    reasoningRef.current.reset();
    // Programmatic restore — NOT a student activation, so engagement stays off
    // and an Introduction may still open the question.
    setActiveLineIdxState(restoredIdx);
    setLineEngaged(false);
    setNotebookRevealIdx(null);

    setNotebookAttentionIdx(new Set());
    // Purge legacy persisted "notebook shown" flags — they must never
    // pre-satisfy the note gate again. Fresh session, fresh gates.
    try {
      if (typeof window !== "undefined") {
        const stale: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith("smartboard:shownNotebooks:")) stale.push(key);
        }
        stale.forEach((k) => window.localStorage.removeItem(k));
      }
    } catch { /* noop */ }
    setShownNotebookIdx(new Set());
    setConsumedAbsIdx(new Set());
    setConsumedStructures(new Set());
    setNotebookRowLines(new Set());
    activeSensorLogicalIdxRef.current = null;
    activeSensorPhysicalLineRef.current = null;
    manualSensorRef.current = null;
    manualPushedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReservoirIdx]);

  // Persist the Floating Number line index whenever it changes so the
  // teacher can leave and return to the same line.
  useEffect(() => {
    if (activeReservoirIdx < 0) return;
    try {
      const FLOAT_LINE_KEY = `${boardKey("floatLineIdx", boardScope)}:${activeReservoirIdx}`;
      window.localStorage.setItem(FLOAT_LINE_KEY, JSON.stringify(activeLineIdx));
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLineIdx, activeReservoirIdx]);

  // shownNotebookIdx is intentionally NOT persisted — see note above.



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

  // The Floating Number presentation ALWAYS begins at Line 1 — the old
  // localStorage restore of activeLineIdx was removed on purpose. Already
  // written lines keep their chips marked consumed (see the resume scan
  // below), but the displayed line and the sensor start from the top.


  const activeReservoir = activeReservoirIdx >= 0 ? reservoirs[activeReservoirIdx] : undefined;
  const guidedLines = activeReservoir?.lines ?? [];
  const hasGuidedLines = guidedLines.length > 0;

  /* ── LIVE CLASSROOM: the floating number is ONE shared object ─────────────
     The client holding edit rights publishes the arrangement itself (lines and
     chips with stable ids) plus which chips are used and how the strip window
     sits. Every other client renders exactly that. Nothing here runs on other
     boards, which keep their present local behaviour. */
  const sharedFloatingResId = activeReservoir?.beatId ?? "";
  const publishedFloatingLines = useMemo(
    () =>
      syncEnabled && canEdit && activeReservoir
        ? buildFloatingLines(sharedFloatingResId, activeReservoir)
        : null,
    [syncEnabled, canEdit, activeReservoir, sharedFloatingResId],
  );
  const floatingOut = useMemo<FloatingShared | null>(() => {
    if (!publishedFloatingLines) return null;
    return {
      resId: sharedFloatingResId,
      viewIdx: viewReservoirIdx >= 0 ? viewReservoirIdx : Math.max(0, activeReservoirIdx),
      activeIdx: activeReservoirIdx,
      lineIdx: activeLineIdx,
      lines: publishedFloatingLines,
      usedOrder: chipIdsForAbsIdx(publishedFloatingLines, floatingUsedOrderIdx),
      reveal: floatingView.reveal,
      offset: floatingView.offset,
      reentryOffset: floatingView.reentryOffset,
    };
  }, [
    publishedFloatingLines, sharedFloatingResId, viewReservoirIdx, activeReservoirIdx,
    activeLineIdx, floatingUsedOrderIdx, floatingView,
  ]);
  // Publish through the same ref+tick channel as the rest of the workspace, so
  // a floating operation leaves on the very next frame with no debounce.
  useEffect(() => {
    floatingSyncRef.current = { ...floatingSyncRef.current, floating: floatingOut };
    setFloatingSyncTick((n) => n + 1);
  }, [floatingOut]);

  // Receiver side: render the publisher's arrangement and per-chip state.
  const sharedFloatingActive = syncEnabled && !canEdit && !!remoteFloating;
  const sharedFloatingReservoir = useMemo(
    () => (sharedFloatingActive && remoteFloating ? reservoirFromShared(remoteFloating, activeReservoir) : null),
    [sharedFloatingActive, remoteFloating, activeReservoir],
  );
  const sharedFloatingUsed = useMemo(
    () => (sharedFloatingActive && remoteFloating ? sharedConsumedSet(remoteFloating, remoteFloating.usedOrder) : null),
    [sharedFloatingActive, remoteFloating],
  );
  const sharedFloatingUsedOrder = useMemo(
    () => (sharedFloatingActive && remoteFloating ? sharedUsedOrderIdx(remoteFloating, remoteFloating.usedOrder) : null),
    [sharedFloatingActive, remoteFloating],
  );
  const sharedFloatingView = useMemo(
    () =>
      sharedFloatingActive && remoteFloating
        ? { reveal: remoteFloating.reveal, offset: remoteFloating.offset, reentryOffset: remoteFloating.reentryOffset }
        : null,
    [sharedFloatingActive, remoteFloating],
  );
  const handleFloatingViewChange = useCallback(
    (v: { reveal: number; offset: number; reentryOffset: number }) => {
      if (!syncEnabled || !canEdit) return;
      setFloatingView((prev) =>
        prev.reveal === v.reveal && prev.offset === v.offset && prev.reentryOffset === v.reentryOffset ? prev : v,
      );
    },
    [syncEnabled, canEdit],
  );
  const handleFloatingUsedOrderChange = useCallback(
    (order: number[]) => {
      if (!syncEnabled || !canEdit) return;
      setFloatingUsedOrderIdx((prev) =>
        prev.length === order.length && prev.every((v, i) => v === order[i]) ? prev : [...order],
      );
    },
    [syncEnabled, canEdit],
  );


  /* ── Table Activity ──────────────────────────────────────────────
     A highlighted Smart Table's lines are ONE lesson step. While that
     step is active the table becomes the workspace: cell clicks pick the
     member line, the Floating Number panel and Present write into the
     sensor cell, and Assessment follows the row/column. */
  const tableGroups = useMemo(() => buildTableGroups(guidedLines), [guidedLines]);
  const activeTableGroup = useMemo(
    () => groupForLine(tableGroups, activeLineIdx),
    [tableGroups, activeLineIdx],
  );
  const TABLE_STATE_KEY = `${boardKey("tableActivity", boardScope)}:${activeReservoirIdx}`;
  const [tableEntries, setTableEntries] = useState<Record<string, TableEntries>>({});
  /** Sensor cell PER table — several tables can sit on the board at once and
   *  each keeps its own cursor. */
  const [tableSensorCells, setTableSensorCells] = useState<Record<string, string | null>>({});
  /** Live cursor row, read when the teacher taps a table's Floating Number. */
  const sensorRef = useRef(sensor);
  sensorRef.current = sensor;
  /** Expand / collapse is per table and remembered for the session. */
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  /** Tables the teacher has PLACED on this board view, and the board row
   *  each one sits on. A table is a permanent lesson line represented by its
   *  Floating Number icon; it appears on the board only when the teacher taps
   *  that icon. Once placed the table STAYS visible — moving the cursor away
   *  only switches the active Floating Number workspace. Removing it from the
   *  board deletes nothing — entries, orientation, retention, T-series and
   *  mappings all stay, and the icon keeps working. */
  const [placedTables, setPlacedTables] = useState<Record<string, { row: number }>>({});

  /** The table whose T-series currently owns the Floating Number panel. Set
   *  when a cell inside a placed table is clicked, cleared as soon as the
   *  cursor lands anywhere outside a table. Purely a workspace flag: it never
   *  affects whether the table is drawn. */
  const [activeTableObjId, setActiveTableObjId] = useState<string | null>(null);
  const openTableObjId = activeTableObjId && expandedTables[activeTableObjId]
    ? activeTableObjId
    : null;
  const tableSensorCell = activeTableGroup
    ? tableSensorCells[activeTableGroup.objId] ?? null
    : null;
  const setTableSensorCellFor = useCallback((objId: string, key: string | null) => {
    setTableSensorCells((prev) => ({ ...prev, [objId]: key }));
  }, []);


  // Restore per-cell entries for this reservoir.
  useEffect(() => {
    if (activeReservoirIdx < 0) return;
    try {
      const raw = typeof window !== "undefined"
        ? window.localStorage.getItem(TABLE_STATE_KEY)
        : null;
      setTableEntries(raw ? (JSON.parse(raw) ?? {}) : {});
    } catch { setTableEntries({}); }
    setTableSensorCells({});

    setExpandedTables({});
    setPlacedTables({});
    setActiveTableObjId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReservoirIdx]);

  useEffect(() => {
    if (activeReservoirIdx < 0) return;
    try {
      window.localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(tableEntries));
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableEntries, activeReservoirIdx]);

  const activeTableEntries: TableEntries = activeTableGroup
    ? tableEntries[activeTableGroup.objId] ?? {}
    : {};

  /** Placement of the table owning the active lesson line (null = not on the
   *  board yet; the lesson line and its icon still exist). */
  const activeTablePlacement = activeTableGroup
    ? placedTables[activeTableGroup.objId] ?? null
    : null;
  const activeTablePlaced = !!activeTablePlacement;


  // THE SENSOR IS TEACHER-OWNED. It is seated ONCE, when a table first
  // becomes active, and after that it only ever moves because the teacher
  // tapped a cell (or Σ Sum Row / Σ Sum Column placed a total). Nothing the
  // student types may relocate it.
  const tableSensorSeededRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeTableGroup) return;
    const objId = activeTableGroup.objId;
    if (tableSensorSeededRef.current.has(objId)) return;
    tableSensorSeededRef.current.add(objId);
    const target = firstOpenCell(activeTableGroup, activeTableEntries, activeLineIdx);
    setTableSensorCells((prev) => (prev[objId] ? prev : { ...prev, [objId]: target }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTableGroup?.objId]);


  const setTableEntry = useCallback(
    (objId: string, key: string, value: string) => {
      setTableEntries((prev) => ({
        ...prev,
        [objId]: { ...(prev[objId] ?? {}), [key]: value },
      }));
    },
    [],
  );

  /* ── HIDDEN VALIDATION STATE ─────────────────────────────────────────
     The board itself stays neutral (no ticks, no marking). The same
     validation logic runs silently here; the Reasoning / Assessment layer
     is the only consumer and the only place feedback may appear. */
  const tableValidationState: TableValidation | null = useMemo(
    () => (activeTableGroup && activeTablePlaced
      ? tableValidation(activeTableGroup, activeTableEntries, activeLineIdx)
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTableGroup?.objId, activeTableEntries, activeLineIdx, activeTablePlaced],
  );
  const tableValidationRef = useRef<TableValidation | null>(null);
  tableValidationRef.current = tableValidationState;

  /** Remove the Smart Table from THIS board view only. Nothing is deleted:
   *  its lesson line, generated floating numbers, T-series, orientation,
   *  retained cells, assessment mappings, student entries and configuration
   *  all survive, and its Floating Number icon keeps working, so the same
   *  table can be placed again at any time. */
  const deleteTableObject = useCallback((group: typeof tableGroups[number]) => {
    setPlacedTables((prev) => {
      if (!(group.objId in prev)) return prev;
      const next = { ...prev };
      delete next[group.objId];
      return next;
    });
    setActiveTableObjId((cur) => (cur === group.objId ? null : cur));
    setTableSensorCellFor(group.objId, null);
  }, [setTableSensorCellFor]);

  /** Place (or re-place) the table on the board at the teacher's cursor —
   *  exactly how an ordinary Floating Number writes at the cursor. */
  const placeTableAtCursor = useCallback((objId: string) => {
    const row = Math.floor(sensorRef.current?.line ?? 0);
    setPlacedTables((prev) => ({ ...prev, [objId]: { row } }));
    setExpandedTables((prev) => ({ ...prev, [objId]: true }));
  }, []);

  // A table line is the activity itself, not an optional floating token. When
  // the board opens on a table (especially Line 1 in a test), put the real grid
  // on the writing surface immediately so it can never appear as flattened
  // values such as "3 9 6" or as an empty ordinary writing line.
  useEffect(() => {
    if (!activeTableGroup || placedTables[activeTableGroup.objId]) return;
    const row = Math.floor(sensorRef.current?.line ?? 0);
    setPlacedTables((prev) => ({
      ...prev,
      [activeTableGroup.objId]: prev[activeTableGroup.objId] ?? { row },
    }));
    setExpandedTables((prev) => ({ ...prev, [activeTableGroup.objId]: true }));
    setActiveTableObjId(activeTableGroup.objId);
  }, [activeTableGroup, placedTables]);

  /** Clear = drop every student-entered value. Retained cells, formulas,
   *  headings, structure, formatting and orientation are untouched. */
  const clearTableEntries = useCallback((group: typeof tableGroups[number]) => {
    setTableEntries((prev) => ({ ...prev, [group.objId]: {} }));
    tableSensorSeededRef.current.delete(group.objId);
    setTableSensorCellFor(group.objId, null);
  }, [setTableSensorCellFor]);

  /* ── ERASER INSIDE OBJECTS ───────────────────────────────────────────
     Two kinds of ink live in a Smart Table / Smart Structure:
       • RETAINED  — the teacher's drawing (bracket, horizontal rules, minus
         signs, ladder divider, "R" labels, headings) plus any value marked
         retained. Read-only ink: the eraser passes straight over it.
       • ENTERED   — anything written into an editable cell. The eraser rubs
         it out in place, exactly like a digit on the board.
     Only Clear (all entered values) and Remove from board touch more. */
  useEffect(() => {
    eraseObjectCellRef.current = (cx: number, cy: number): boolean => {
      if (typeof document === "undefined") return false;
      for (const el of document.elementsFromPoint(cx, cy)) {
        const cellEl = (el as HTMLElement).closest?.<HTMLElement>("[data-sb-cell]");
        if (!cellEl) continue;
        const host = cellEl.closest<HTMLElement>("[data-sb-table-obj-id]");
        const objId = host?.getAttribute("data-sb-table-obj-id");
        const key = cellEl.getAttribute("data-sb-cell") ?? "";
        if (!objId || !key) continue;
        // Retained / structural ink — handled (swallowed) but never erased.
        if (cellEl.dataset.sbLocked === "1") return true;
        const group = tableGroups.find((g) => g.objId === objId);
        if (!group) return true;
        const structural = Array.isArray((group.grid as any).staticCells)
          && ((group.grid as any).staticCells as string[]).includes(key);
        if (structural || isRetained(group, key)) return true;
        setTableEntry(objId, key, "");
        return true;
      }
      return false;
    };
    return () => { eraseObjectCellRef.current = null; };
  }, [tableGroups, setTableEntry]);


  /* ── LESSON STEPS vs T-SERIES ────────────────────────────────────────
     Lesson numbering NEVER counts table rows: a table is one lesson step.
     The active workspace follows the CURSOR: clicking a cell inside a placed
     table hands the floating numbers to that table's T-series, and putting
     the cursor anywhere outside a table restores the lesson numbering. The
     table itself stays on the board either way. */
  const steps = useMemo(
    () => lessonSteps(guidedLines.length, tableGroups),
    [guidedLines.length, tableGroups],
  );
  const activeStepIdx = stepIdxForLine(steps, activeLineIdx);
  /** The table currently driving the counter (only after a cell click). */
  const tSeriesGroup = activeTableGroup
    && activeTableObjId === activeTableGroup.objId
    ? activeTableGroup
    : null;
  const tSeries = useMemo(
    () => (tSeriesGroup ? tSeriesFor(tSeriesGroup) : []),
    [tSeriesGroup],
  );

  /** THE tag of the active floating number — `T{k}.{i}` inside an open table
   *  branch, otherwise the main-path tag (`L{n}` or `T{k}`). One value, every
   *  surface. A closed table NEVER shows a child tag. */
  const activeTag = useMemo(
    () => (tSeriesGroup
      ? tagForLine(steps, tableGroups, activeLineIdx)
      : mainTagForStep(steps, activeStepIdx)),
    [tSeriesGroup, steps, tableGroups, activeLineIdx, activeStepIdx],
  );

  const activeTagRef = useRef(activeTag);
  activeTagRef.current = activeTag;


  /** Leave the table workspace: the cursor is no longer inside a table.
   *  Visibility is untouched — the table stays on the board. */
  const exitTableWorkspace = useCallback(() => {
    setActiveTableObjId((cur) => (cur ? null : cur));
  }, []);

  // The cursor decides the workspace. The table's own lines are the only
  // positions that keep the T-series alive; any lesson line outside a table
  // (or an un-placed / collapsed table) restores the lesson numbering.
  useEffect(() => {
    if (!activeTableObjId) return;
    const stillInside = activeTableGroup?.objId === activeTableObjId;
    if (!stillInside || !expandedTables[activeTableObjId] || !placedTables[activeTableObjId]) {
      setActiveTableObjId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTableObjId, activeTableGroup?.objId, expandedTables, placedTables]);


  // NOTE: the lesson trunk never skips a table. Its lesson line stays a valid
  // cursor position whether or not the table is currently on the board.


  /** Present / Floating chip taps land in the table when it is open. */
  const writeIntoTableCell = useCallback(
    (text: string): boolean => {
      if (!activeTableGroup) return false;
      if (openTableObjId !== activeTableGroup.objId) return false;
      const key = tableSensorCell
        ?? firstOpenCell(activeTableGroup, activeTableEntries, activeLineIdx);
      if (!key || isRetained(activeTableGroup, key)) return false;
      const existing = String(activeTableEntries[key] ?? "");
      setTableEntry(activeTableGroup.objId, key, `${existing}${text}`);
      return true;
    },
    [activeTableGroup, openTableObjId, tableSensorCell, activeTableEntries, activeLineIdx, setTableEntry],
  );

  // Completion → next row/column; last one ends the activity and the lesson
  // advances to the following line. Driven by the HIDDEN validation state:
  // nothing about this is displayed on the board.
  //
  // PER-TRACK MARKING: a track (a row under Row orientation, a column under
  // Column orientation) is assessed and awarded the INSTANT its cells are
  // complete — before the activity moves on. T1.1 marks as T1.1, T1.2 as
  // T1.2, and so on; the final track is never the only one that scores.
  const gradeTableTrackRef = useRef<
    ((k: number, mode: "manual" | "auto") => Promise<boolean>) | null
  >(null);
  const tableTrackGradedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeTableGroup || !activeTablePlaced) return;
    if (!isLineComplete(activeTableGroup, activeTableEntries, activeLineIdx)) return;

    // Award this track once. The guard is keyed on the question + line so
    // re-renders (and the leave/idle paths) can never double-count it.
    const lineId = guidedLines[activeLineIdx]?.lineId ?? null;
    const guardKey = `${current?.id ?? ""}:${lineId ?? activeLineIdx}`;
    if (!tableTrackGradedRef.current.has(guardKey)) {
      tableTrackGradedRef.current.add(guardKey);
      void gradeTableTrackRef.current?.(activeLineIdx, "auto").then((completed) => {
        if (!completed) tableTrackGradedRef.current.delete(guardKey);
      });
    }

    // MARKING ONLY — NO MOVEMENT. Completing a track awards it immediately
    // (T1.1 as T1.1, T1.2 as T1.2 …) but the board never jumps: the teacher
    // taps the next cell, and the existing Next control performs the branch
    // exit back to the following main step (T1 → L4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTableGroup?.objId, activeTableEntries, activeLineIdx, steps, activeTablePlaced, guidedLines, current?.id]);




  // NOTE GATE — one uniform live rule for every line, no special cases:
  // a line with a note blocks Next until the note's TEXT IS ON THE BOARD
  // (checked live via boardHasTextRow at press time). Clicking the note
  // icon writes it onto the board, which opens the gate. Erasing the ink
  // closes the gate again automatically — no flags to re-arm, nothing
  // persisted, nothing inherited from previous sessions.

  /** Equation labels like "(1)" may be added before/after the math at any
   *  time — line matching must succeed with or without them. */
  const stripEqLabel = (s: string): string =>
    s.replace(/^\s*\(\s*\d+\s*\)\s*/, "").replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();

  // ── DISPLAYED-LINE EDITABILITY ───────────────────────────────────────
  // The Floating Number display is the source of truth: the guided line it
  // currently shows must stay editable even when its rows already have ink.
  // A lesson line may span SEVERAL physical rows (e.g. a continuation row
  // "= x − y" below a fraction), so we track row → guided-line OWNERSHIP:
  //   • Any row that receives its first ink while line K is displayed
  //     belongs to line K.
  //   • On reload, pre-existing rows are seeded by sequentially matching
  //     accumulated row text against each guided equation.
  // All rows owned by the displayed line stay editable; they lock only
  // after the display moves to another line.
  const displayedGuidedIdx = hasGuidedLines
    ? Math.min(manualFloatingLineIdx ?? floatingLineIdx, Math.max(0, guidedLines.length - 1))
    : -1;
  const [rowOwners, setRowOwners] = useState<Record<number, number>>({});
  // Keep the pre-declared ref in sync so growActiveBand's purge sees the
  // current ownership map (render-time assignment is intentional).
  rowOwnersRef.current = rowOwners;
  const seededOwnersRef = useRef<number>(-1);
  useEffect(() => {
    if (!hasGuidedLines || !activeLayout || activeLayout.bandLines <= 0) return;
    const a = bandStart(activeLayout);
    const b = bandEnd(activeLayout);
    const occupiedRows = (): number[] => {
      const set = new Set<number>();
      for (const k of Object.keys(freeLines)) {
        const ln = Number(k);
        const r = Math.floor(ln);
        if (r < a || r > b) continue;
        if (notebookRowLines.has(r) || notebookRowLines.has(ln)) continue;
        const row = freeLines[ln];
        // Whitespace-only rows are NOT ink — they must never claim
        // Lesson-Line ownership (stale owners poisoned sensor placement).
        if (!row || !rowHasVisibleInk(row)) continue;
        set.add(r);
      }
      return [...set].sort((x, y) => x - y);
    };

    // ── One-time seeding per reservoir: map pre-existing ink to lines by
    // sequentially matching accumulated row text against guided equations.
    if (seededOwnersRef.current !== activeReservoirIdx) {
      seededOwnersRef.current = activeReservoirIdx;
      const eqTargets: { idx: number; eq: string }[] = [];
      for (let k = 0; k < guidedLines.length; k++) {
        const g = guidedLines[k];
        if (g && !g.notebookOnly) eqTargets.push({ idx: k, eq: stripEqLabel(g.equation) });
      }
      const seeded: Record<number, number> = {};
      let t = 0;
      let group: number[] = [];
      let combined = "";
      for (const r of occupiedRows()) {
        const ascii = stripEqLabel(rowToAscii(freeLines[r] ?? freeLines[r + 0.5] ?? []));
        group.push(r);
        combined = (combined + ascii).trim();
        const ownerIdx = t < eqTargets.length ? eqTargets[t].idx : eqTargets.length > 0 ? eqTargets[eqTargets.length - 1].idx : 0;
        for (const gr of group) seeded[gr] = ownerIdx;
        if (
          t < eqTargets.length &&
          (equationsMatch(combined, eqTargets[t].eq) ||
            equationsEquivalent(combined, eqTargets[t].eq) ||
            equationsMatch(ascii, eqTargets[t].eq) ||
            equationsEquivalent(ascii, eqTargets[t].eq))
        ) {
          t++;
          group = [];
          combined = "";
        }
      }
      setRowOwners(seeded);
      return;
    }

    // ── Incremental ownership: new ink belongs to the displayed line;
    // erased rows release their ownership.
    setRowOwners((prev) => {
      let changed = false;
      const next = { ...prev };
      const occ = new Set(occupiedRows());
      for (const k of Object.keys(next)) {
        const r = Number(k);
        if (!occ.has(r)) { delete next[r]; changed = true; }
      }
      if (displayedGuidedIdx >= 0) {
        // New ink belongs to the displayed line. When the display is on a
        // prose (notebookOnly) line, the teacher is really writing the NEXT
        // equation line — assign ownership there so the row stays editable
        // when that equation's chips come up on the panel.
        let owner = displayedGuidedIdx;
        if (guidedLines[owner]?.notebookOnly) {
          for (let k = displayedGuidedIdx + 1; k < guidedLines.length; k++) {
            if (!guidedLines[k]?.notebookOnly) { owner = k; break; }
          }
        }
        for (const r of occ) {
          if (next[r] === undefined) { next[r] = owner; changed = true; }
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, hasGuidedLines, activeLayout, activeReservoirIdx, displayedGuidedIdx, guidedLines, notebookRowLines]);

  /** Every physical row owned by the guided line the Floating Number
   *  display is currently showing. These rows are ALWAYS editable. */
  const displayedLineRows = useMemo<Set<number>>(() => {
    const out = new Set<number>();
    if (displayedGuidedIdx < 0) return out;
    for (const [k, owner] of Object.entries(rowOwners)) {
      if (owner === displayedGuidedIdx) out.add(Number(k));
    }
    return out;
  }, [rowOwners, displayedGuidedIdx]);
  // Mirror into the ref for the D-pad callbacks declared earlier.
  useEffect(() => {
    displayedLineRowsRef.current = displayedLineRows;
  }, [displayedLineRows]);

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
    // SensorDPad (the single sensor controller).
    // Follow whichever line the FloatingNumberPanel is currently showing —
    // manual navigation (▲/▼ on the panel) takes precedence over the
    // auto-advanced floatingLineIdx so clicking "line 2" on the panel
    // immediately walks the writing sensor down to the next empty row.
    const idx = Math.min(
      manualFloatingLineIdx ?? floatingLineIdx,
      guidedLines.length - 1,
    );
    // A presentation "line" is NOT a board row — a single logical line may
    // span multiple physical rows (or be separated from neighbours by blank
    // rows the teacher left for spacing). Anchor the sensor to the K-th
    // OCCUPIED row inside the active band, so stepping up/down jumps to the
    // row where that line's math actually lives — not to row = K.
    const a = bandStart(activeLayout);
    const b = bandEnd(activeLayout);

    const logicalLineChanged = activeSensorLogicalIdxRef.current !== idx;
    // ── MANUAL-OVERRIDE MODE ─────────────────────────────────────────
    // While the teacher holds a D-pad position, the auto-anchor leaves
    // the sensor completely alone. The override clears ONLY when:
    //   1. ink lands on the manually chosen row (resume auto-flow), or
    //   2. the Floating Number display navigates to a different line, or
    //   3. the beat / reservoir changes (handled elsewhere).
    if (manualSensorRef.current !== null) {
      if (rowHasInk(manualSensorRef.current.line)) {
        // Writing resumed on the chosen row — hand control back to the
        // normal flow, anchored exactly where the sensor already is.
        manualSensorRef.current = null;
        activeSensorLogicalIdxRef.current = idx;
        activeSensorPhysicalLineRef.current = sensor.line;
        return;
      }
      if (!logicalLineChanged) {
        activeSensorLogicalIdxRef.current = idx;
        activeSensorPhysicalLineRef.current = sensor.line;
        return;
      }
      // Explicit presentation-line change → clear the override and let
      // the anchor logic below reposition the sensor.
      manualSensorRef.current = null;
      manualPushedRef.current = null;
    }
    if (
      !logicalLineChanged &&
      manualPushedRef.current !== null &&
      Math.floor(sensor.line) === manualPushedRef.current
    ) {
      activeSensorLogicalIdxRef.current = idx;
      activeSensorPhysicalLineRef.current = sensor.line;
      return;
    }
    if (logicalLineChanged) {
      manualPushedRef.current = null;
      manualSensorRef.current = null;
    }

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

    // Lesson-Line owned rows for the target line. Rewinding to a line
    // that already has ink parks the sensor on its LAST owned row (end
    // of the multi-row equation). Advancing to a line that has no ink
    // yet parks the sensor immediately below the previous line's LAST
    // owned row — never in the middle of a stacked structure.
    // Only trust rowOwners entries whose ink is still on the board — a
    // deleted / erased row must not drag the sensor back to its old slot,
    // and stale claims from earlier commits must not compound spacing
    // (this is what caused lines 7+ to drift by extra rows).
    const ownedRows = Object.entries(rowOwners)
      .filter(([k, o]) => {
        if (o !== idx) return false;
        const r = Number(k);
        const row = freeLines[r] ?? freeLines[r + 0.5];
        return !!row && rowHasVisibleInk(row);
      })
      .map(([k]) => Number(k))
      .sort((x, y) => x - y);
    const isEquationLine = !guidedLines[idx]?.notebookOnly;
    let target: number;
    if (ownedRows.length > 0) {
      // Line K already has ink → park at its last owned row (end of ink).
      target = ownedRows[ownedRows.length - 1];
    } else {
      // Line K has no ink yet → land EXACTLY one row below the last
      // visibly inked row AT OR ABOVE the sensor (the line just finished).
      // Never below unrelated content further down the band — that is what
      // used to fling the sensor 4-5 rows down. THE LAW: plain equation
      // → +1 row; tall structure (stacked fraction / matrix) → +2, via
      // nextSensorRowBelow. Nothing else may push it further.
      const ceil = Math.max(Math.floor(sensor.line), a);
      let lastInk = -1;
      for (const key of Object.keys(freeLines)) {
        const r = Math.floor(Number(key));
        if (r < a || r > ceil) continue;
        const row = freeLines[Number(key)];
        if (row && rowHasVisibleInk(row)) lastInk = Math.max(lastInk, r);
      }
      for (const ln of notebookRowLines) {
        const r = Math.floor(ln);
        if (r >= a && r <= ceil) lastInk = Math.max(lastInk, r);
      }
      // Sensor parked above all ink (teacher scrolled up) → fall back to
      // the band-wide last-ink row so we still land below the work.
      if (lastInk < 0) lastInk = activeLayout ? lastVisibleInkRow(activeLayout) : -1;
      if (lastInk >= a) {
        let t = nextSensorRowBelow(lastInk);
        // Step past locked rows (notes / structure bodies) ONE row at a
        // time — a minimal step-over, never a compounding offset.
        while (t <= b && activeLayout && !isEmptyWritableRow(t, activeLayout)) t++;
        if (t > b) {
          // Band exhausted (dense board, line 6+): GROW the band instead
          // of clamping onto the locked band-end row — the old clamp was
          // the dead zone where nothing clicked.
          ensureBandCoversRef.current(t);
        }
        target = t;
      } else {
        // No prior ink: land right below "Solution".
        target = a;
      }
      if (!isEquationLine) {
        // Notebook-only guided line: keep the sensor still — the teacher
        // is reading, not writing yet.
        target = Math.min(b, target);
      }
    }

    if (sensor.line !== target) {
      setSensor((s) => (s.line === target ? s : { ...s, line: target, x: 0 }));
      const tInk = freeLines[target] ?? freeLines[target + 0.5] ?? [];
      setLiveCursor({ path: [], index: ownedRows.includes(target) ? tInk.length : 0 });
    }
    activeSensorLogicalIdxRef.current = idx;
    activeSensorPhysicalLineRef.current = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatingLineIdx, manualFloatingLineIdx, hasGuidedLines, guidedLines.length, activeLayout?.startLine, activeLayout?.captionLines, activeLayout?.bandLines, freeLines, notebookRowLines, sensor.line, isEmptyWritableRow, firstWritableRowAfter, rowOwners]);


  // Keep Used in sync with actual board ink. Used means "currently present on
  // the whiteboard", so deleting a chip immediately returns it to the white
  // conveyor ring in its original reservoir position.
  //
  // IMPORTANT — this pass may only ever run in the SHRINKING direction.
  // Structured ink (stacked fractions, roots, brackets) does not flatten back
  // into the exact ASCII of its chip label, so a text search right after a
  // write can fail to "see" what was just written and would instantly un-mark
  // the fragment — the chip would snap back instead of moving to the Used
  // zone. We therefore only reconcile when the board's ink actually got
  // smaller (erase / undo / clear); growth never un-marks anything.
  const boardInkSizeRef = useRef(0);
  useEffect(() => {
    const parts = [
      ...Object.values(freeLines).map((row) => rowToAscii(row)),
      ...boxes.map((b) => b.text ?? ""),
    ].map(normalizeFloatingPresence);
    const boardText = parts.join("\n");
    const inkSize = parts.reduce((n, s) => n + s.length, 0);
    const shrank = inkSize < boardInkSizeRef.current;
    boardInkSizeRef.current = inkSize;
    if (!shrank) return;
    if (!activeReservoir || consumedAbsIdx.size === 0) return;


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


  // ── PASSIVE LINE-MATCH DETECTION (no auto-advance) ───────────────────
  // When the board ink matches the current guided line, its floating-number
  // chips are marked consumed (they dim/turn green) — and NOTHING else
  // happens. The sensor never advances and the line never locks on its own,
  // so the teacher can keep editing (e.g. append the "(1)" equation label).
  // Advancing + locking happen ONLY when the teacher moves the Floating
  // Number display to the next line (see stepTo in the panel wiring).
  useEffect(() => {
    if (assessmentMode) return; // assessment lines are graded server-side
    if (!hasGuidedLines) return;
    if (activeLineIdx >= guidedLines.length) return;
    if (!activeLayout || activeLayout.bandLines <= 0) return;
    const target = guidedLines[activeLineIdx];
    if (!target || target.notebookOnly) return;
    const targetEq = stripEqLabel(target.equation);
    let matchedRow: number | null = null;
    for (let r = bandStart(activeLayout); r <= bandEnd(activeLayout); r++) {
      if (notebookRowLines.has(r)) continue;
      const candidate = freeLines[r];
      if (!candidate || candidate.length === 0) continue;
      const candidateAscii = stripEqLabel(rowToAscii(candidate));
      if (equationsMatch(candidateAscii, targetEq) || equationsEquivalent(candidateAscii, targetEq)) {
        matchedRow = r;
        break;
      }
    }
    if (matchedRow == null) return;
    const ascii = stripEqLabel(rowToAscii(freeLines[matchedRow]));
    // Completion is judged by mathematical content, never by the presence of
    // an "=" sign: a line may legitimately be a bare expression.
    const dangling = /[+\-−*×/÷=^]/.test(ascii.slice(-1));
    if (!ascii.trim() || dangling) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, hasGuidedLines, activeLineIdx, guidedLines, activeLayout, notebookRowLines]);

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
      const ascii = stripEqLabel(rowToAscii(row));
      const eq = stripEqLabel(target.equation);
      if (equationsEquivalent(ascii, eq) || equationsMatch(ascii, eq)) {
        highestCompleted = k;
        // Deliberately do NOT mark its notebook as shown — the note gate
        // requires an explicit click EVERY session, even on resumed lines.
        // (Auto-marking here was the line-1 "never glows" bypass.)
      } else {
        break; // strict sequential — stop at the first gap
      }
    }
    const resumeIdx = Math.min(highestCompleted + 1, guidedLines.length);
    if (resumeIdx > 0) {
      // Deliberately do NOT move activeLineIdx / floatingLineIdx here — the
      // Floating Number presentation ALWAYS begins at Line 1. Completed
      // lines only get their chips marked consumed below so the strip
      // mirrors what is already on the board.
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

  // ── INTELLIGENT ERASE — LAW 1: FORWARD-ONLY RULE ─────────────────────
  // The presentation may only rewind when ink was ACTUALLY DELETED from
  // the latest completed line's own rows. Typing anywhere else on the
  // board — a fresh row, a new line, a spacer — can NEVER trigger a
  // rewind. This is enforced structurally: before any match check runs,
  // we compare the line's ink against the previous render's snapshot and
  // bail out unless its own text got SHORTER (a real deletion).
  const prevActiveLineIdxRef = useRef<number>(activeLineIdx);
  useEffect(() => {
    prevActiveLineIdxRef.current = activeLineIdx;
  }, [activeLineIdx]);
  const prevFreeLinesRef = useRef<FreeLineMap>(freeLines);
  useEffect(() => {
    const before = prevFreeLinesRef.current;
    prevFreeLinesRef.current = freeLines;
    if (!hasGuidedLines || !activeLayout || activeLayout.bandLines <= 0) return;
    // Only the LATEST completed line can ever rewind. Older lines are
    // locked history; notebook prose lines have no ink to lose.
    const k = activeLineIdx - 1;
    if (k < 0) return;
    const target = guidedLines[k];
    if (!target || target.notebookOnly) return;
    // Rows owned by line k — looked up by OWNERSHIP, never a fixed a+k
    // offset (teachers may leave blank spacer rows between lines).
    const owned = Object.entries(rowOwners)
      .filter(([, o]) => o === k)
      .map(([r]) => Number(r))
      .filter((r) => Number.isFinite(r))
      .sort((x, y) => x - y);
    // Never written yet in this session → nothing to lose, skip.
    if (owned.length === 0) return;
    // Read the line's FULL ink: integer row AND half-row key of every
    // owned row — multi-row structures (fractions, matrices) store part
    // of their ink under r + 0.5, which the old check silently dropped,
    // producing the false "line was erased" rewind on every keystroke.
    const readLine = (src: FreeLineMap): string =>
      owned
        .map((r) => {
          const whole = src[r];
          const half = src[r + 0.5];
          return (
            (whole && whole.length > 0 ? rowToAscii(whole) : "") +
            (half && half.length > 0 ? rowToAscii(half) : "")
          );
        })
        .join("");
    const nowText = readLine(freeLines);
    const beforeText = readLine(before);
    // LAW 1: no deletion on this line's own rows → never rewind, no
    // matter what the (possibly stricter) equation match would say.
    if (nowText.length >= beforeText.length) return;
    const eq = stripEqLabel(target.equation);
    const asciiJoined = stripEqLabel(nowText);
    const ok = asciiJoined.length > 0 &&
      (equationsEquivalent(asciiJoined, eq) || equationsMatch(asciiJoined, eq));
    if (ok) return; // still holds the full equation → nothing lost
    setActiveLineIdx(k);
    setFloatingLineIdx(k);
    setManualFloatingLineIdx(null);
    activeSensorLogicalIdxRef.current = null;
    activeSensorPhysicalLineRef.current = null;
    // Drop the consumed fragments/structures that belonged to the erased line.
    setConsumedAbsIdx((prev) => {
      const next = new Set(prev);
      for (let i = target.fragmentStart; i < target.fragmentEnd; i++) next.delete(i);
      return next;
    });
    // Notebook-glow reset: any notebooks belonging to the rewound line
    // (or lines beyond it) must forget that they've already been read,
    // so that trying to advance forward again re-glows them until the
    // teacher clicks the note back onto the board.
    setShownNotebookIdx((prev) => {
      let changed = false;
      const nextS = new Set(prev);
      for (const idx of prev) {
        if (idx >= k) { nextS.delete(idx); changed = true; }
      }
      return changed ? nextS : prev;
    });
    setNotebookAttentionIdx((prev) => {
      let changed = false;
      const nextS = new Set(prev);
      for (const idx of prev) {
        if (idx >= k) { nextS.delete(idx); changed = true; }
      }
      return changed ? nextS : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, rowOwners, hasGuidedLines, activeLayout?.startLine, activeLayout?.bandLines, guidedLines.length]);


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
      const lastCh = ascii.slice(-1);
      const dangling = /[+\-−*×/÷=^]/.test(lastCh);
      // A line is "settled" once it holds ink and doesn't end on an operator.
      // No equals-sign requirement — equivalence decides correctness.
      const completeShape = ascii.trim().length > 0 && !dangling;

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

  // ── Line context reporter (interactive teaching video) ───────────────────
  // Read-only: the video layer listens to the ONE line cursor the board
  // already keeps. Nothing here writes board, grading or navigation state.
  const activeLineId = guidedLines[activeLineIdx]?.lineId ?? null;
  const activeLineSolved =
    !!current && !!activeLineId ? `${current.id}:${activeLineId}` in solvedSlots : false;

  // The MARKING event: which line most recently earned its mark. Derived by
  // diffing the awarded-slot map, so it fires once per award and never again
  // on a re-render or on a revisit of an already-correct line.
  const [lastAwardedLineId, setLastAwardedLineId] = useState<string | null>(null);
  const seenSlotsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const keys = Object.keys(solvedSlots);
    const seen = seenSlotsRef.current;
    const added = keys.filter((k) => !seen.has(k));
    seenSlotsRef.current = new Set(keys);
    if (!added.length || !current) return;
    const prefix = `${current.id}:`;
    const mine = added.filter((k) => k.startsWith(prefix));
    if (!mine.length) return;
    setLastAwardedLineId(mine[mine.length - 1].slice(prefix.length));
  }, [solvedSlots, current]);

  useEffect(() => {
    onLineContext?.({
      questionId: current?.id ?? null,
      lineId: activeLineId,
      index: activeLineIdx,
      total: guidedLines.length,
      completed: activeLineSolved,
      lastAwardedLineId,
      lineEngaged,
      playbackResetGeneration,
    });
  }, [
    onLineContext, current?.id, activeLineId, activeLineIdx, guidedLines.length,
    activeLineSolved, lastAwardedLineId, lineEngaged, playbackResetGeneration,
  ]);



  /* ── Timer attempt: start on first real input, finish on full attempt ── */

  // A content change that follows a real user gesture is input; a change that
  // arrives from the server (board hydration / live mirror) is not.
  const lastGestureRef = useRef(0);
  useEffect(() => {
    if (!timer.active) return;
    const note = () => { lastGestureRef.current = Date.now(); };
    window.addEventListener("pointerdown", note, true);
    window.addEventListener("keydown", note, true);
    return () => {
      window.removeEventListener("pointerdown", note, true);
      window.removeEventListener("keydown", note, true);
    };
  }, [timer.active]);

  useEffect(() => {
    if (!timer.active || !timer.ready) return;
    if (Date.now() - lastGestureRef.current > 2000) return;
    timer.markInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, boxes, smartLines, tableEntries, timer.active, timer.ready]);

  // The attempt is complete only when every required line of this question is
  // confirmed correct in THIS attempt.
  const attemptSlots = useMemo(() => {
    if (!current) return [] as string[];
    return guidedLines
      .filter((g) => g.lineId && !g.notebookOnly)
      .map((g) => `${current.id}:${g.lineId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, guidedLines]);

  useEffect(() => {
    if (!timer.active || attemptSlots.length === 0) return;
    if (attemptSlots.every((slot) => slot in timer.confirmed)) timer.complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.active, timer.confirmed, attemptSlots]);

  // Forward reference — the live-mirror broadcaster is defined further down.
  const broadcastCheckResultRef = useRef<
    | ((info: {
        questionId: string;
        lineId: string;
        mode: "manual" | "auto";
        correct: boolean;
        verdict?: string;
        diagnosis?: { code: string; label: string; detail: string };
        marks?: number;
        studentAscii?: string;
        progress?: { solvedLines: Record<string, number>; score: number };
      }) => void)
    | null
  >(null);

  // ── ONE GRADING PIPELINE ────────────────────────────────────────────────
  // Manual "Check line" and the silent auto-grader resolve the student's line
  // the SAME way and send it to the SAME server grader (`grade-line`, the very
  // engine the Reasoning panel uses). There is no local/legacy validation:
  // the server verdict is the only judge of correctness.
  const resolveGradableLine = useCallback((k: number) => {
    if (!assessmentMode || !assessmentId || !current || !activeLayout) return null;
    if (k < 0 || k >= guidedLines.length) return null;
    const target = guidedLines[k];
    if (!target?.lineId) return null;

    const expectedFrags = (activeReservoir?.fragments ?? [])
      .slice(target.fragmentStart, target.fragmentEnd)
      .filter(Boolean);

    const writtenRows = Object.keys(freeLines)
      .map(Number)
      .filter((n) => Number.isInteger(n) && !!freeLines[n] && freeLines[n].length > 0)
      .sort((x, y) => x - y);

    // 1) THE ENGINE'S BINDING WINS. The row a line is written on is the row
    //    the student was on when that line became active — never a guess made
    //    by comparing tokens, which used to hand one line another line's ink.
    const bound = reasoningRef.current.rowFor(k);
    if (bound !== null) {
      const boundRow = freeLines[bound];
      return {
        target,
        expectedFrags,
        rowNum: bound,
        ascii: boundRow && boundRow.length > 0 ? rowToAscii(boundRow) : "",
      };
    }

    // 2) Lines the student never visited: fall back to the historic
    //    best-overlap search so old boards still resolve.
    let rowNum = clampToActiveBand(bandStart(activeLayout) + k);
    const expectedSet = chipMultiset(expectedFrags);
    if (expectedSet.size > 0 && writtenRows.length > 0) {
      let bestRow = -1, bestScore = -1;
      for (const n of writtenRows) {
        const used = chipMultiset(extractTermsFromAscii(rowToAscii(freeLines[n])).map((t) => t.ascii));
        const score = multisetOverlap(expectedSet, used);
        if (score > bestScore) { bestScore = score; bestRow = n; }
      }
      if (bestRow >= 0) rowNum = bestRow;
    }
    if (!freeLines[rowNum]?.length && freeLines[sensor.line]?.length) rowNum = sensor.line;

    const row = freeLines[rowNum];
    const ascii = row && row.length > 0 ? rowToAscii(row) : "";
    return { target, expectedFrags, rowNum, ascii };
  }, [assessmentMode, assessmentId, current, activeLayout, guidedLines, activeReservoir, freeLines, sensor.line]);

  /** Grade one line through the shared equivalence engine.
   *  `mode: "manual"` shows feedback + advances; `mode: "auto"` is silent.
   *  `frozenAscii` (End Point) wins over whatever is on the board now. */
  /** CELL-AWARE TABLE MARKING — a table line is never graded from board ink.
   *  Its marks come from the cells themselves: the right value in the right
   *  coordinate. Nothing else can earn the mark. */
  const gradeTableTrackThroughCells = useCallback(async (
    k: number,
    mode: "manual" | "auto",
  ) => {
    const group = groupForLine(tableGroups, k);
    if (!group || !current || !assessmentId) return false;
    const target = guidedLines[k];
    if (!target?.lineId) return false;
    const slot = `${current.id}:${target.lineId}`;
    // MASTERED LINES ARE NEVER RE-MARKED. With the timer on, a mastered line
    // still has to be confirmed for the CURRENT attempt, so the row is checked
    // without awarding anything a second time.
    let confirmOnly = false;
    if (slot in solvedSlots) {
      if (timerRef.current.active && !(slot in timerRef.current.confirmed)) {
        confirmOnly = true;
      } else {
        if (mode === "manual") {
          toast({ title: "Already marked", description: `This line has already earned ${solvedSlots[slot]} marks.` });
        }
        return true;
      }
    }
    const entries = tableEntries[group.objId] ?? {};
    const cells = editableCellsForLine(group, k).filter(
      (key) => expectedCellValue(group, key).trim().length > 0,
    );
    const wrong = cells.filter((key) => !isCellCorrect(group, entries, key));
    const blank = cells.filter((key) => !String(entries[key] ?? "").trim());
    const correct = cells.length > 0 && wrong.length === 0;
    const label = trackLabel(group, k);
    const studentAscii = cellKeysForLine(group, k)
      .map((key) => (isRetained(group, key) ? expectedCellValue(group, key) : String(entries[key] ?? "")))
      .filter((v) => v.trim().length > 0)
      .join("  ");

    const tableDiagnosis = {
      code: correct ? "table_complete" : blank.length ? "table_incomplete" : "table_cell_wrong",
      label: correct ? `${label} complete` : blank.length ? `${label} incomplete` : `${label} — wrong cells`,
      detail: correct
        ? "Every cell of this row holds the expected value in the expected position."
        : blank.length
          ? `${blank.length} cell${blank.length === 1 ? "" : "s"} still empty in ${label}.`
          : `${wrong.length} cell${wrong.length === 1 ? "" : "s"} do not match the expected value for ${label}.`,
    };

    if (!correct) {
      broadcastCheckResultRef.current?.({
        questionId: current.id,
        lineId: target.lineId,
        mode,
        correct: false,
        verdict: "not_equal",
        diagnosis: tableDiagnosis,
        marks: 0,
        studentAscii,
      });
      if (mode === "manual") {
        setCheckView({
          lineNo: k + 1,
          studentAscii,
          correct: false,
          label: blank.length ? `${label} incomplete` : `${label} — check your cells`,
          detail: blank.length
            ? "Some cells of this row are still empty."
            : "Some values are not in the cell they belong to.",
          marks: 0,
        });
      }
      return true;
    }

    const awarded = Number(target.marks ?? 0);
    let authoritativeProgress: { solvedLines: Record<string, number>; score: number } | undefined;
    timerRef.current.confirmLine(slot, confirmOnly ? (solvedSlots[slot] ?? 0) : awarded);
    if (confirmOnly) {
      if (mode === "manual") {
        setCheckView({
          lineNo: k + 1,
          studentAscii,
          correct: true,
          label: `${label} confirmed`,
          detail: "Correct for this attempt. The marks for this row were already earned.",
          marks: 0,
        });
      }
      return true;
    }
    if (testMode) {
      setSolvedSlots((prev) => (slot in prev ? prev : { ...prev, [slot]: awarded }));
      setAssessScore((prev) => prev + awarded);
    } else {
      // The cells decided the verdict; the server only records it.
      try {
        const { data, error } = await supabase.functions.invoke("grade-line", {
          body: {
            assessmentId,
            questionId: current.id,
            lineId: target.lineId,
            studentAscii,
            mode,
            persist: true,
            ...(smartCardSlug && participantKey ? { smartCardSlug, participantKey } : {}),
          ...(guestSlug && participantKey ? { guestSlug, participantKey, guestName } : {}),
          },
        });
        if (error) {
          // Never fail silently: a guest has no dashboard to check later.
          toast({
            title: "Marking failed",
            description: String(error.message ?? "The marking engine could not be reached."),
            variant: "destructive",
          });
          return false;
        }
        const res = data as { score?: number; solvedLines?: Record<string, number> } | null;
        if (res?.solvedLines && typeof res.score === "number") {
          authoritativeProgress = { solvedLines: res.solvedLines, score: res.score };
          setSolvedSlots(res.solvedLines);
          setAssessScore(res.score);
        }
        else if (res?.solvedLines) setSolvedSlots(res.solvedLines);
        else if (typeof res?.score === "number") setAssessScore(res.score);
        else {
          setSolvedSlots((prev) => (slot in prev ? prev : { ...prev, [slot]: awarded }));
          setAssessScore((prev) => prev + awarded);
        }
      } catch (e) {
        toast({
          title: "Marking failed",
          description: String((e as Error)?.message ?? e),
          variant: "destructive",
        });
        return false;
      }
    }
    broadcastCheckResultRef.current?.({
      questionId: current.id,
      lineId: target.lineId,
      mode,
      correct: true,
      verdict: "equal",
      diagnosis: tableDiagnosis,
      marks: awarded,
      studentAscii,
      progress: authoritativeProgress,
    });
    if (mode === "manual") {
      setCheckView({
        lineNo: k + 1,
        studentAscii,
        correct: true,
        label: `${label} complete`,
        detail: "Every cell holds the expected value in the expected position.",
        marks: awarded,
      });
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableGroups, tableEntries, guidedLines, current, assessmentId, solvedSlots, testMode, smartCardSlug, guestSlug, participantKey, toast]);

  // The completion effect above is declared earlier in the component, so it
  // reaches the grader through this ref rather than the binding itself.
  gradeTableTrackRef.current = gradeTableTrackThroughCells;



  const gradeLineThroughEngine = useCallback(async (
    k: number,
    mode: "manual" | "auto",
    frozenAscii?: string,
  ) => {
    // A table line is graded by its cells, never by board ink.
    if (groupForLine(tableGroups, k)) {
      return gradeTableTrackThroughCells(k, mode);
    }
    const resolved = resolveGradableLine(k);
    if (!resolved || !current || !assessmentId) return false;
    const { target, expectedFrags, rowNum } = resolved;
    // Everything created between Start Point and End Point belongs to this
    // line; anything typed after the End Point does not.
    const ascii = typeof frozenAscii === "string" ? frozenAscii : resolved.ascii;


    // Nothing written at all — nothing to evaluate. (Not a validation rule:
    // there is simply no expression to send to the engine.)
    if (!ascii.trim()) {
      if (mode === "manual") {
        setCheckView({
          lineNo: k + 1,
          studentAscii: "",
          correct: false,
          label: "Nothing written",
          detail: "Nothing has been written on this line yet, so there is no expression to evaluate.",
          marks: 0,
        });
      }
      return false;
    }
    // AWARDED MARKS ARE PERMANENT — once a line has earned its mark it is
    // never re-evaluated, in either mode. Editing it afterwards cannot take
    // the mark away and cannot earn it twice.
    const slotKey = `${current.id}:${target.lineId}`;
    // With the timer on, a mastered line is still re-checked (never re-marked)
    // so the CURRENT attempt row can confirm it.
    let confirmOnly = false;
    if (slotKey in solvedSlots) {
      if (timerRef.current.active && !(slotKey in timerRef.current.confirmed)) {
        confirmOnly = true;
      } else {
        if (mode === "manual") {
          toast({ title: "Already marked", description: `This line has already earned ${solvedSlots[slotKey]} marks.` });
        }
        return true;
      }
    }

    if (mode === "manual") setAssessChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-line", {
        body: {
          assessmentId,
          questionId: current.id,
          lineId: target.lineId,
          studentAscii: ascii,
          mode,
          allowedFloatingTokens: expectedFrags,
          // A test never writes progress: the engine grades, the board keeps
          // the score in memory only.
          persist: !testMode && !confirmOnly,
          ...(smartCardSlug && participantKey ? { smartCardSlug, participantKey } : {}),
          ...(guestSlug && participantKey ? { guestSlug, participantKey, guestName } : {}),
        },
      });
      if (error) {
        if (mode === "manual") throw error;
        // AN AUTOMATIC EVALUATION ALWAYS REPORTS AN OUTCOME. Going silent here
        // leaves the teacher's Evaluation panel spinning forever, so a failure
        // is broadcast as such; the retry still runs and replaces it with the
        // real verdict.
        broadcastCheckResultRef.current?.({
          questionId: current.id,
          lineId: target.lineId ?? "",
          mode,
          correct: false,
          verdict: "error",
          diagnosis: {
            code: "error",
            label: "Could not evaluate",
            detail: "The marking engine did not answer. Retrying.",
          },
          marks: 0,
          studentAscii: ascii,
        });
        return false;
      }
      const res = data as {
        correct: boolean; verdict?: string; marks?: number;
        diagnosis?: { code: string; label: string; detail: string };
        score: number; solvedLines: Record<string, number>;
      } | null;

      broadcastCheckResultRef.current?.({
        questionId: current.id,
        lineId: target.lineId ?? "",
        mode,
        correct: !!res?.correct,
        verdict: res?.verdict,
        diagnosis: res?.diagnosis,
        marks: Number(res?.marks ?? 0),
        studentAscii: ascii,
        progress: res
          ? { solvedLines: res.solvedLines ?? {}, score: Number(res.score ?? 0) }
          : undefined,
      });

      if (res?.correct) {
        const awarded = Number(res?.marks ?? target.marks ?? 0);
        timerRef.current.confirmLine(slotKey, confirmOnly ? (solvedSlots[slotKey] ?? 0) : awarded);
        if (confirmOnly) {
          setWrongLine((w) => (w === rowNum ? null : w));
          if (mode === "manual") {
            setCheckView({
              lineNo: k + 1,
              studentAscii: ascii,
              correct: true,
              label: "Confirmed for this attempt",
              detail: "Correct. The marks for this line were already earned.",
              marks: 0,
            });
          }
          return true;
        }
        if (testMode) {
          // Nothing was persisted, so the sitting accumulates its own total.
          const slot = `${current.id}:${target.lineId}`;
          setSolvedSlots((prev) => (slot in prev ? prev : { ...prev, [slot]: awarded }));
          setAssessScore((prev) => prev + awarded);
        } else {
          setSolvedSlots(res.solvedLines ?? {});
          setAssessScore(Number(res.score ?? 0));
        }
        setWrongLine((w) => (w === rowNum ? null : w));
      }

      if (mode !== "manual") return true;

      if (res?.correct) {
        // Advance to the next line when the student checked the current one.
        if (k === activeLineIdx) {
          const nextIdx = Math.min(activeLineIdx + 1, guidedLines.length);
          setActiveLineIdx(nextIdx);
          setFloatingLineIdx(nextIdx);
          const nextWritable = activeLayout
            ? firstWritableRowAfter(rowNum, activeLayout)
            : rowNum + 1;
          if (activeLayout && nextWritable > bandEnd(activeLayout)) growActiveBand();
          setSensor({ line: clampToActiveBand(nextWritable), x: 0 });
          setLiveCursor({ path: [], index: 0 });
          activeSensorLogicalIdxRef.current = nextIdx;
          activeSensorPhysicalLineRef.current = clampToActiveBand(nextWritable);
          manualPushedRef.current = null;
        }
        setCheckView({
          lineNo: k + 1,
          studentAscii: ascii,
          correct: true,
          label: res?.diagnosis?.label ?? "Equivalent",
          detail: res?.diagnosis?.detail ?? "This line matches the expected step.",
          marks: Number(res?.marks ?? target.marks ?? 0),
        });
      } else {
        setWrongLine(rowNum);
        // Short, specific, teacher-style feedback only — the explanation lives
        // in the Reasoning panel, and the answer is never revealed.
        const label =
          res?.diagnosis?.label ??
          (res?.verdict === "parse_error" ? "Invalid expression" : "Not equivalent");
        setCheckView({
          lineNo: k + 1,
          studentAscii: ascii,
          correct: false,
          label,
          detail: res?.diagnosis?.detail ?? "This line could not be shown to be equivalent to the expected step.",
          marks: 0,
        });
      }
      return true;
    } catch (e: any) {
      if (mode === "manual") {
        toast({ title: "Could not check", description: String(e?.message ?? e), variant: "destructive" });
      } else {
        broadcastCheckResultRef.current?.({
          questionId: current.id,
          lineId: target.lineId ?? "",
          mode,
          correct: false,
          verdict: "error",
          diagnosis: {
            code: "error",
            label: "Could not evaluate",
            detail: "The marking engine did not answer. Retrying.",
          },
          marks: 0,
          studentAscii: ascii,
        });
      }
      return false;
    } finally {
      if (mode === "manual") setAssessChecking(false);
    }
  }, [
    resolveGradableLine, current, assessmentId, solvedSlots, activeLineIdx,
    tableGroups, gradeTableTrackThroughCells,

    guidedLines.length, activeLayout, toast, testMode, smartCardSlug, guestSlug, participantKey,
  ]);

  // CHECK IS AN END POINT. Pressing Check closes the active session exactly
  // like leaving the line: freeze, evaluate once, award. The button itself
  // never grades — it asks the engine and shows what the engine decided.
  const checkActiveLine = (kOverride?: number) => {
    const k = typeof kOverride === "number" ? kOverride : activeLineIdx;
    if (k < 0 || k >= guidedLines.length) {
      toast({ title: "All lines done", description: "You've solved every line in this question." });
      return;
    }
    let frozen: string | undefined;
    if (k === activeLineIdx) {
      const live = resolveGradableLineRef.current(k)?.ascii ?? "";
      reasoningRef.current.end(k, live);
      freezeSession(sessionRef.current, live);
      if (live.trim()) frozenByLineRef.current[k] = live;
      frozen = live.trim() ? live : undefined;
    } else {
      frozen = reasoningRef.current.frozenFor(k) ?? frozenByLineRef.current[k];
    }
    void gradeLineThroughEngine(k, "manual", frozen);
  };

  // Silent auto-grading — same resolver, same engine, no UI feedback.
  // MARKING BELONGS TO THE STUDENT'S BOARD. The verdict is recorded here and
  // broadcast to the teacher; the student never sees it. The key guard stops
  // the SAME expression being sent to the engine twice while the student keeps
  // the line open, without ever blocking a changed expression.
  const autoGradedKeyRef = useRef<string>("");
  const autoGradingKeyRef = useRef<string>("");
  const silentAutoCheckLine = useCallback(
    async (k: number, frozenAscii?: string) => {
      const ascii = typeof frozenAscii === "string"
        ? frozenAscii
        : (resolveGradableLineRef.current(k)?.ascii ?? "");
      const key = studentGradingKey(current?.id ?? "", k, ascii);
      if (ascii.trim() && autoGradedKeyRef.current === key) return;
      if (!ascii.trim() || autoGradingKeyRef.current === key) return;
      autoGradingKeyRef.current = key;
      let completed = await gradeLineThroughEngine(k, "auto", frozenAscii);
      // One bounded retry repairs a transient function/network interruption.
      // The key is committed only after an authoritative response arrives.
      if (!completed) {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        const latest = resolveGradableLineRef.current(k)?.ascii ?? "";
        if (latest === ascii && current?.id) {
          completed = await gradeLineThroughEngine(k, "auto", frozenAscii);
        }
      }
      if (completed) autoGradedKeyRef.current = key;
      if (autoGradingKeyRef.current === key) autoGradingKeyRef.current = "";
    },
    [gradeLineThroughEngine, current?.id],
  );


  // ── EDITING SESSION: Start Point / End Point ─────────────────────────
  // A session opens the moment the student enters a line (from the Floating
  // Number Display, the Presenter Preview, or anywhere else) and closes the
  // moment they leave it. Everything created in between belongs to that
  // line; the expression is frozen at the End Point and never re-read, so
  // maths written afterwards cannot change an already-recorded result.
  const sessionRef = useRef<EditingSession | null>(null);
  const frozenByLineRef = useRef<Record<number, string>>({});
  const resolveGradableLineRef = useRef(resolveGradableLine);
  resolveGradableLineRef.current = resolveGradableLine;

  // Keep the engine's row binding on the row the student is actually writing
  // on. This is what makes "Student line (live)" always show THIS line.
  const sensorLineRef = useRef<number>(sensor.line);
  sensorLineRef.current = sensor.line;
  useEffect(() => {
    reasoningRef.current.bindRow(activeLineIdx, sensor.line);
  }, [sensor.line, activeLineIdx]);

  // ── ATTEMPT LIFECYCLE ────────────────────────────────────────────────
  // Navigation is NOT an attempt. Moving the Floating Number Display from
  // line 2 → 4 → 6 → 3 without writing changes nothing. An attempt is born
  // the instant real content appears on the active line (chip tap, keyboard,
  // inserted object, Add tool) and dies completely if the student clears
  // that content again before leaving — no history, no evaluation.
  const prevAssessActiveLineRef = useRef<number>(activeLineIdx);
  useEffect(() => {
    const prev = prevAssessActiveLineRef.current;
    prevAssessActiveLineRef.current = activeLineIdx;

    if (prev !== activeLineIdx && prev >= 0) {
      // END POINT — only a line that was actually WRITTEN on has something
      // to freeze. A line that was merely visited leaves no trace.
      const leaving = resolveGradableLineRef.current(prev);
      const ascii = leaving?.ascii ?? "";
      // A TABLE TRACK carries no board ink: its work lives in the cells. So
      // leaving a row/column always grades it from those cells — including a
      // partially wrong track, which records its verdict (and its zero)
      // instead of being discarded as "an attempt that never existed".
      const leavingTable = !!groupForLine(tableGroups, prev);
      if (leavingTable) {
        if (assessmentMode && role === "student") {
          void silentAutoCheckLine(prev);
        }
      } else if (reasoningRef.current.hasAttempt(prev) && ascii.trim()) {
        reasoningRef.current.end(prev, ascii);
        freezeSession(sessionRef.current, ascii);
        frozenByLineRef.current[prev] = ascii;
        if (assessmentMode && role === "student") {
          void silentAutoCheckLine(prev, frozenByLineRef.current[prev]);
        }
      } else if (reasoningRef.current.hasAttempt(prev)) {
        // Left with nothing on it — the attempt never existed.
        reasoningRef.current.cancel(prev);
        delete frozenByLineRef.current[prev];
      }
      if (!leavingTable && sessionRef.current && sessionRef.current.lineIdx === prev && !ascii.trim()) {
        sessionRef.current = cancelSession(sessionRef.current);
      }
    }


    // NAVIGATION — record the visit only. Returning to a line releases its
    // freeze so the student continues exactly where they left off; the row
    // ownership map keeps that line's rows editable again.
    if (prev !== activeLineIdx) {
      reasoningRef.current.enter(
        activeLineIdx,
        guidedLines[activeLineIdx]?.lineId ?? null,
        sensorLineRef.current,
      );
      reasoningRef.current.clearFreeze(activeLineIdx);
      delete frozenByLineRef.current[activeLineIdx];
      if (sessionRef.current && sessionRef.current.lineIdx !== activeLineIdx) {
        sessionRef.current = null;
      }
    }
  }, [activeLineIdx, assessmentMode, role, silentAutoCheckLine, guidedLines, tableGroups]);

  // FIRST WRITE / EMPTY-AGAIN — the only place an attempt is created or
  // cancelled. Watches the live content of the active line.
  const activeHadInkRef = useRef<boolean>(false);
  useEffect(() => {
    const ascii = resolveGradableLineRef.current(activeLineIdx)?.ascii ?? "";
    const hasInk = ascii.trim().length > 0;
    const had = activeHadInkRef.current;
    activeHadInkRef.current = hasInk;

    if (hasInk && !reasoningRef.current.hasAttempt(activeLineIdx)) {
      // ATTEMPT CREATED — the student wrote something on this line.
      reasoningRef.current.write(
        activeLineIdx,
        guidedLines[activeLineIdx]?.lineId ?? null,
        sensorLineRef.current,
      );
      sessionRef.current = startSession(
        activeLineIdx,
        guidedLines[activeLineIdx]?.lineId ?? null,
      );
    } else if (!hasInk && had && reasoningRef.current.hasAttempt(activeLineIdx)) {
      // ATTEMPT CANCELLED — everything was deleted. Remove it entirely and
      // hand the editing session back to the previous unfinished line so the
      // student is never trapped by the locking system.
      reasoningRef.current.cancel(activeLineIdx);
      sessionRef.current = cancelSession(sessionRef.current);
      delete frozenByLineRef.current[activeLineIdx];
      const back = reasoningRef.current.lastUnfinishedLine(activeLineIdx);
      if (back !== null && back !== activeLineIdx) {
        reasoningRef.current.clearFreeze(back);
        delete frozenByLineRef.current[back];
        setActiveLineIdx(back);
        setFloatingLineIdx(back);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeLines, activeLineIdx, guidedLines]);

  // Idle silent auto-check — a line that is finished but never left would
  // otherwise never be graded. Debounced; the grader itself skips dangling
  // lines and already-solved slots, so this never disturbs the student.
  useEffect(() => {
    if (!assessmentMode || role !== "student") return;
    const id = window.setTimeout(() => { void silentAutoCheckLine(activeLineIdx); }, 900);
    return () => window.clearTimeout(id);
    // `tableEntries` is here so a cell edit re-arms the debounce: a completed
    // final row/column is never left unmarked just because the student stayed.
  }, [assessmentMode, role, activeLineIdx, freeLines, tableEntries, silentAutoCheckLine]);




  // ── SHARED SESSION: apply the other side's board snapshot ────────────────
  // The student's board and the teacher's "View Student Work" board are ONE
  // session. Whoever authored the snapshot skips its own echo.
  useEffect(() => {
    if (!boardSessionActive || !boardIncoming) return;
    if (boardIncoming.author && selfId && boardIncoming.author === selfId) return;
    applyingRemoteRef.current = true;
    if (typeof boardIncoming.beatCursor === "number") setBeatCursor(boardIncoming.beatCursor);
    if (boardIncoming.bandExtra) setBandExtra(boardIncoming.bandExtra);
    if (boardIncoming.freeLines) setFreeLines(boardIncoming.freeLines as FreeLineMap);
    if (boardIncoming.lineOffsets) setLineOffsets(boardIncoming.lineOffsets);
    if (boardIncoming.smartLines) setSmartLines(boardIncoming.smartLines as SmartLine[]);
    if (boardIncoming.boxes) setBoxes(boardIncoming.boxes as MagnetBox[]);
    if (boardIncoming.sensor) setSensor(boardIncoming.sensor);
    if (typeof boardIncoming.zoom === "number") setZoom(boardIncoming.zoom);
    if (boardIncoming.surface) setSurface(boardIncoming.surface as Surface);
    if (boardIncoming.profileId) setProfileId(boardIncoming.profileId as WritingProfileId);
    if (boardIncoming.inkColorId) setInkColorId(boardIncoming.inkColorId as InkColorId);
    if (boardIncoming.placeholderColorId) setPlaceholderColorId(sanitizePlaceholderColorId(boardIncoming.placeholderColorId));
    if (typeof boardIncoming.activeLineIdx === "number") {
      // Mirrored from another device — not this student's own activation.
      setActiveLineIdxState(boardIncoming.activeLineIdx);

    }
    const t = window.setTimeout(() => { applyingRemoteRef.current = false; }, 0);
    return () => window.clearTimeout(t);
  }, [boardIncoming, boardSessionActive, selfId]);

  // ── SHARED SESSION: publish our board while we hold edit rights ──────────
  // A ref of the live board is kept on every render so the safety re-publish
  // below also catches mutations that happen in place (drag / rearrange /
  // delete paths that don't produce a new state identity).
  const liveBoardRef = useRef<AssessBoardState | null>(null);
  liveBoardRef.current = {
    beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
    sensor, zoom, surface, profileId, inkColorId, placeholderColorId,
    activeLineIdx, questionId: current?.id ?? null,
  } as AssessBoardState;

  useEffect(() => {
    if (!boardSessionActive || !canEdit) return;
    if (applyingRemoteRef.current) return;
    pushBoardState({
      beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
      sensor, zoom, surface, profileId, inkColorId, placeholderColorId,
      activeLineIdx, questionId: current?.id ?? null,
    });
  }, [
    boardSessionActive, canEdit, pushBoardState,
    beatCursor, bandExtra, freeLines, lineOffsets, smartLines, boxes,
    sensor, zoom, surface, profileId, inkColorId, placeholderColorId,
    activeLineIdx, current?.id,
  ]);

  // Safety re-publish — `push` de-dupes identical content, so this is a no-op
  // unless something changed without re-running the effect above (drag,
  // rearrange, delete and floating-number drops mutate in place). Publishes
  // once immediately so a teacher joining late sees the whole board at once.
  useEffect(() => {
    if (!boardSessionActive || !canEdit) return;
    const tick = () => {
      if (applyingRemoteRef.current) return;
      const snap = liveBoardRef.current;
      if (snap) pushBoardState(snap);
    };
    tick();
    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, [boardSessionActive, canEdit, pushBoardState]);





  // ── LIVE MIRROR TO TEACHER — broadcast the student's board state so the
  // teacher Reasoning Panel can display it live. Broadcast-only (no DB
  // writes). Uses a per-(assessment, student) private channel.
  const liveBroadcastChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [liveChanReady, setLiveChanReady] = useState(false);
  useEffect(() => {
    if (!assessmentMode || !assessmentId || role !== "student" || !selfId) return;
    let cancelled = false;
    let retries = 0;
    const chanName = `assessment-live-${assessmentId}-${selfId}`;
    const connect = () => {
      void ensureRealtimeAuth().then(() => {
        if (cancelled) return;
        const ch = supabase.channel(chanName, { config: { broadcast: { self: false } } });
        ch.subscribe((status) => {
          if (cancelled) return;
          setLiveChanReady(status === "SUBSCRIBED");
          if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && retries < 3) {
            retries += 1;
            supabase.removeChannel(ch);
            if (liveBroadcastChanRef.current === ch) liveBroadcastChanRef.current = null;
            window.setTimeout(() => { if (!cancelled) connect(); }, 600 * retries);
          }
        });
        liveBroadcastChanRef.current = ch;
      });
    };
    connect();
    return () => {
      cancelled = true;
      setLiveChanReady(false);
      if (liveBroadcastChanRef.current) {
        supabase.removeChannel(liveBroadcastChanRef.current);
        liveBroadcastChanRef.current = null;
      }
    };
  }, [assessmentMode, assessmentId, role, selfId]);

  // Build the snapshot the reasoning panel needs. Values are preserved
  // verbatim — never normalised or reordered.
  const buildLiveSnapshot = useCallback(() => {
    const rowsAscii: Record<number, string> = {};
    // The math OBJECT itself, sent verbatim. The Reasoning panel renders this
    // — it must never rebuild an expression from the ASCII text.
    const rowsTree: Record<number, Row> = {};
    for (const [k, v] of Object.entries(freeLines)) {
      const n = Number(k);
      if (!Number.isFinite(n)) continue;
      if (v && v.length > 0) { rowsAscii[n] = rowToAscii(v); rowsTree[n] = v; }
    }
    const linesAscii: Record<string, string> = {};
    const linesTree: Record<string, Row> = {};

    const floatingTokens: Record<string, string[]> = {};
    const writtenRows = Object.keys(freeLines)
      .map(Number)
      .filter((n) => Number.isInteger(n) && !!freeLines[n] && freeLines[n].length > 0)
      .sort((x, y) => x - y);
    for (let k = 0; k < guidedLines.length; k++) {
      const target = guidedLines[k];
      if (!target?.lineId) continue;
      const expectedFrags = (activeReservoir?.fragments ?? [])
        .slice(target.fragmentStart, target.fragmentEnd)
        .filter(Boolean);
      floatingTokens[target.lineId] = expectedFrags;

      // The engine's binding is the truth for every visited line. Only lines
      // the student has never opened fall back to the overlap search.
      const bound = reasoningRef.current.rowFor(k);
      let rowNum: number;
      if (bound !== null) {
        rowNum = bound;
      } else {
        rowNum = activeLayout ? clampToActiveBand(bandStart(activeLayout) + k) : k;
        const expectedSet = chipMultiset(expectedFrags);
        if (expectedSet.size > 0 && writtenRows.length > 0) {
          let bestRow = -1, bestScore = -1;
          for (const n of writtenRows) {
            const used = chipMultiset(extractTermsFromAscii(rowToAscii(freeLines[n])).map((t) => t.ascii));
            const score = multisetOverlap(expectedSet, used);
            if (score > bestScore) { bestScore = score; bestRow = n; }
          }
          if (bestRow >= 0) rowNum = bestRow;
        }
      }
      const row = freeLines[rowNum];
      linesAscii[target.lineId] = row && row.length > 0 ? rowToAscii(row) : "";
      if (row && row.length > 0) linesTree[target.lineId] = row;
    }
    const activeLid = guidedLines[activeLineIdx]?.lineId ?? null;
    const activeAscii = activeLid ? (linesAscii[activeLid] ?? "") : "";
    const activeTokens = activeLid ? (floatingTokens[activeLid] ?? []) : [];
    return {
      ts: Date.now(),
      questionId: current?.id ?? null,
      activeLineIdx,
      // TAG of the active floating number — `T{n}` inside a Smart Table,
      // the lesson step number outside. Every consumer displays this value
      // instead of deriving its own line number.
      activeTag: activeTagRef.current,

      lineIds: guidedLines.map((g) => g.lineId ?? null),
      rowsAscii,
      linesAscii,
      rowsTree,
      linesTree,
      floatingTokens,
      // Reasoning-engine view of the ONE active line.
      activeRow: reasoningRef.current.rowFor(activeLineIdx),
      attempt: reasoningRef.current.attemptFor(activeLineIdx),
      introducedTerms: introducedTermsOf(activeAscii, activeTokens),
      // Hidden Smart Table validation — the board shows nothing; the
      // Reasoning engine decides what (if anything) to say about it.
      table: tableValidationRef.current,

    };

  }, [freeLines, guidedLines, activeReservoir, activeLayout, current?.id, activeLineIdx]);

  // Same-page feed. When the Evaluation panel lives in THIS page (the
  // Floating Number test sitting) realtime broadcasts never come back to
  // their own tab, so the identical payload also goes through the in-page
  // bridge. Null outside a test sitting — remote mirroring is untouched.
  const localLiveChan = useMemo(
    () => (testMode && assessmentId && selfId ? localLiveChannel(assessmentId, selfId) : null),
    [testMode, assessmentId, selfId],
  );
  const liveFeedActive = liveChanReady || !!localLiveChan;

  const publishLiveSnapshot = useCallback(() => {
    const payload = buildLiveSnapshot();
    publishLocalLive(localLiveChan, "board", payload);
    const ch = liveBroadcastChanRef.current;
    if (!ch || !liveChanReady) return;
    void ch.send({ type: "broadcast", event: "board", payload });
  }, [liveChanReady, buildLiveSnapshot, localLiveChan]);

  // Push a snapshot on every board change (debounced) — and immediately once
  // the channel is ready so a teacher joining mid-session sees the line.
  const liveBroadcastTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!assessmentMode || role !== "student" || !liveFeedActive) return;
    if (liveBroadcastTimer.current) window.clearTimeout(liveBroadcastTimer.current);
    liveBroadcastTimer.current = window.setTimeout(() => { publishLiveSnapshot(); }, 120);
    return () => { if (liveBroadcastTimer.current) window.clearTimeout(liveBroadcastTimer.current); };
  }, [assessmentMode, role, liveFeedActive, publishLiveSnapshot]);

  // Heartbeat — keeps a late-opening reasoning panel populated even when the
  // student is idle.
  useEffect(() => {
    if (!assessmentMode || role !== "student" || !liveFeedActive) return;
    const id = window.setInterval(() => { publishLiveSnapshot(); }, 4000);
    return () => window.clearInterval(id);
  }, [assessmentMode, role, liveFeedActive, publishLiveSnapshot]);

  // Broadcast the outcome of a real (persisting) check so the reasoning panel
  // can show what the student actually scored, and from which path.
  const broadcastCheckResult = useCallback(
    (info: { questionId: string; lineId: string; mode: "manual" | "auto"; correct: boolean; verdict?: string; diagnosis?: { code: string; label: string; detail: string }; marks?: number; studentAscii?: string; progress?: { solvedLines: Record<string, number>; score: number } }) => {
      const payload = { ...info, ts: Date.now() };
      publishLocalLive(localLiveChan, "check", payload);
      const ch = liveBroadcastChanRef.current;
      if (!ch || !liveChanReady) return;
      void ch.send({ type: "broadcast", event: "check", payload });
    },
    [liveChanReady, localLiveChan],
  );

  broadcastCheckResultRef.current = broadcastCheckResult;

  // The persisting student auto-check above is also the live evaluation feed.
  // There is deliberately no second observation-only grader here: the teacher
  // sees the exact verdict and progress returned by the student's real check.







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

  // Presentation AI (autoplay + diagnosis) has been removed. Present Mode
  // and Floating Number Display are the only rendering surfaces.
  // `paiRefs` is retained purely as a live snapshot bag consumed by the
  // row-signature / guided-line helpers below — it no longer feeds any AI.
  const paiRefs = useRef({
    beatCursor,
    activeLineIdx,
    shownNotebookIdx,
    activeReservoir,
    guidedLines,
  });
  paiRefs.current = {
    beatCursor,
    activeLineIdx,
    shownNotebookIdx,
    activeReservoir,
    guidedLines,
  };
  // Row-signature helpers for the Presentation AI read `freeLinesRef`
  // (declared next to writeProseLineOnBoard) for the freshest board state.


  const findBoardRowForLine = useCallback((lineIdx: number): number | null => {
    const owners = rowOwnersRef.current;
    for (const [k, owner] of Object.entries(owners)) {
      if (owner === lineIdx) return Number(k);
    }
    return null;
  }, []);

  const getBoardRowSignatureFor = useCallback((lineIdx: number): string => {
    const row = findBoardRowForLine(lineIdx);
    if (row === null) return "";
    const ink = freeLinesRef.current[row] ?? freeLinesRef.current[row + 0.5];
    if (!ink || ink.length === 0) return "";
    return rowSignature(ink);
  }, [findBoardRowForLine]);

  const getExpectedRowSignatureFor = useCallback((lineIdx: number): string => {
    const line = paiRefs.current.guidedLines[lineIdx];
    if (!line) return "";
    const text = (line.equation ?? "").trim();
    if (!text) return "";
    const m = mirrorLessonNoteRow(text);
    return m.ok ? m.signature : "";
  }, []);

  const getExpectedPrefixSignatureFor = useCallback(
    (lineIdx: number, prefixTokenCount: number): string => {
      const line = paiRefs.current.guidedLines[lineIdx];
      if (!line) return "";
      const fillers = (line.fillers ?? []).slice(0, Math.max(0, prefixTokenCount));
      if (fillers.length === 0) return "";
      const text = fillers.join(" ");
      const m = mirrorLessonNoteRow(text);
      return m.ok ? m.signature : "";
    },
    [],
  );

  const writeEquationPrefix = useCallback(
    (lineIdx: number, prefixTokenCount: number) => {
      const line = paiRefs.current.guidedLines[lineIdx];
      if (!line) return;
      const fillers = (line.fillers ?? []).slice(0, Math.max(0, prefixTokenCount));
      if (fillers.length === 0) return;
      // writeProseLineOnBoard is idempotent by first-paragraph row signature,
      // so re-issuing with an extended prefix rewrites into the same owned
      // row rather than piling up new rows.
      writeProseLineOnBoard(fillers.join(" "));
    },
    [writeProseLineOnBoard],
  );

  // Board-note presence check: given a lineIdx with a Teacher Note in the
  // preview, verify that some row on the Smartboard carries ink whose
  // signature matches the note text. This is what catches the "flagged
  // shown, never rendered" bug on Line 2.
  const getBoardHasNoteFor = useCallback((lineIdx: number): boolean => {
    const line = paiRefs.current.guidedLines[lineIdx];
    const raw = (line?.notebook ?? "").trim();
    if (!raw) return true;
    const m = mirrorLessonNoteRow(raw);
    if (!m.ok) return true;
    const expected = m.signature;
    const rows = freeLinesRef.current;
    for (const key of Object.keys(rows)) {
      const ink = rows[Number(key) as unknown as number];
      if (!ink || ink.length === 0) continue;
      if (rowSignature(ink) === expected) return true;
    }
    return false;
  }, []);

  // Strict text-presence check for Live Mirror verification: true iff
  // some board row's ink signature matches `text`. Unlike the note check
  // above, empty/unrenderable text returns FALSE — so a write that never
  // happened can never pass verification.
  const boardHasTextRow = useCallback((text: string): boolean => {
    const raw = (text ?? "").trim();
    if (!raw) return false;
    const m = mirrorLessonNoteRow(raw);
    if (!m.ok) return false;
    const expected = m.signature;
    const rows = freeLinesRef.current;
    for (const key of Object.keys(rows)) {
      const ink = rows[Number(key) as unknown as number];
      if (!ink || ink.length === 0) continue;
      if (rowSignature(ink) === expected) return true;
    }
    return false;
  }, []);

  // Like boardHasTextRow, but returns WHICH row holds the text (or null).
  // Used by the note-click handler to scroll to an already-inked note
  // instead of silently doing nothing.
  const findTextRow = useCallback((text: string): number | null => {
    const raw = (text ?? "").trim();
    if (!raw) return null;
    const m = mirrorLessonNoteRow(raw);
    if (!m.ok) return null;
    const expected = m.signature;
    const rows = freeLinesRef.current;
    for (const key of Object.keys(rows)) {
      const ink = rows[Number(key) as unknown as number];
      if (!ink || ink.length === 0) continue;
      if (rowSignature(ink) === expected) return Math.floor(Number(key));
    }
    return null;
  }, []);



  const scrollBoardTo = useCallback((lineIdx: number) => {
    setActiveLineIdx(lineIdx);
    // Bring the row physically into view. If we already own a board row
    // for this line, scroll to its pixel Y; otherwise fall back to just
    // updating the active line (band-driven scroll effect will follow).
    const host = boardScrollRef.current;
    const row = findBoardRowForLine(lineIdx);
    if (!host) return;
    if (row === null) return;
    const y = lineToY(row, grid) + shiftFor(row);
    // Aim for row ~140px from the top (below the "Solution" header).
    const target = Math.max(0, y - 140);
    host.scrollTo({ top: target, behavior: "smooth" });
  }, [findBoardRowForLine, grid]);

  // Scroll straight to a known board ROW (no ownership lookup needed).
  // Live Mirror uses this after writing so the mirrored ink is always
  // brought into view — note rows have no rowOwners entry.
  const scrollBoardToRow = useCallback((row: number) => {
    const host = boardScrollRef.current;
    if (!host) return;
    const y = lineToY(row, grid) + shiftFor(row);
    host.scrollTo({ top: Math.max(0, y - 140), behavior: "smooth" });
  }, [grid]);

  /** Row occupancy classification — used by the AI to decide whether the
   *  next visual row is safe to write on. */
  const getRowOccupancy = useCallback(
    (row: number): "empty" | "ink" | "note" | "fraction-denominator" => {
      const rows = freeLinesRef.current;
      const whole = rows[row];
      const half = rows[row + 0.5];
      const hasInk = (!!whole && whole.length > 0) || (!!half && half.length > 0);
      if (notebookRowLines.has(row)) return "note";
      // Tall structures upstream cover this row (denominator zone).
      // Half-row ink (sensor parked on n.5) counts via its floor row —
      // skipping fractional keys made tall fractions typed on half rows
      // invisible here, letting notes land inside their footprint.
      for (const key of Object.keys(rows)) {
        const srcRaw = Number(key);
        const src = Math.floor(srcRaw);
        if (src >= row) continue;
        const r = rows[srcRaw];
        if (!r || r.length === 0) continue;
        if (rowHasTallStructure(r) && src + extraRowsFor(src) >= row) {
          return "fraction-denominator";
        }
      }
      return hasInk ? "ink" : "empty";
    },
    // extraRowsFor / rowHasTallStructure read refs; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notebookRowLines],
  );

  /* ── BOARD WRITER — two independent channels, one ledger ─────────────
   * The Presenter Preview channel and the Floating Number channel both
   * read the SAME board snapshot and commit through the SAME dumb write
   * primitive, but neither channel calls into the other. A bug in one
   * can never replicate into its backup. */

  const getBoardSnapshot = useCallback(
    (): BoardSnapshot => ({
      ink: freeLinesRef.current,
      rowOwners: rowOwnersRef.current,
      lockedRows: notebookRowLinesRef.current,
      bandStartRow: activeLayout ? bandStart(activeLayout) : 0,
    }),
    // bandStart is a pure helper; refs are stable identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLayout],
  );

  /** Commit a WritePlan atomically: ink, locks, ownership, sensor,
   *  scroll. The ONLY place channel writes touch board state. */
  const commitWritePlan = useCallback(
    (plan: WritePlan, opts: CommitOptions) => {
      // Optimistically publish so a second write in the same tick sees
      // these rows as taken.
      const next = { ...freeLinesRef.current };
      for (const { row, ink } of plan.rows) next[row] = ink;
      freeLinesRef.current = next;
      const placed = plan.rows;
      setFreeLines((p) => {
        const merged = { ...p };
        for (const { row, ink } of placed) merged[row] = ink;
        return merged;
      });
      if (opts.lock) {
        const lockedNow = new Set(notebookRowLinesRef.current);
        for (const { row } of placed) lockedNow.add(row);
        notebookRowLinesRef.current = lockedNow;
        setNotebookRowLines((prev) => {
          const ns = new Set(prev);
          for (const { row } of placed) ns.add(row);
          return ns;
        });
      }
      if (typeof opts.ownerLineIdx === "number") {
        const owner = opts.ownerLineIdx;
        const ownersNow = { ...rowOwnersRef.current };
        for (const { row } of placed) ownersNow[row] = owner;
        rowOwnersRef.current = ownersNow;
        setRowOwners((prev) => {
          const nx = { ...prev };
          for (const { row } of placed) nx[row] = owner;
          return nx;
        });
      }
      // Park the sensor on the first genuinely free row below the ink,
      // recomputed from the POST-commit snapshot (ink + locks as they
      // are AFTER this write). Uncapped walk — the sensor is never left
      // on a row this very write just locked. Same rule for every line.
      const parked = parkRowBelow(
        {
          ink: freeLinesRef.current,
          rowOwners: rowOwnersRef.current,
          lockedRows: notebookRowLinesRef.current,
          bandStartRow: 0,
        },
        plan.landedRow,
      );
      // BAND-FOLLOWS-INK: the written rows and the parked sensor row
      // must all be INSIDE the writable band — rows below bandEnd are
      // hidden and unclickable (the line-6+ dead zone).
      const writtenRows = new Set(placed.map((p) => Math.floor(p.row)));
      ensureBandCoversRef.current(
        Math.max(parked, ...placed.map((p) => p.row)),
        writtenRows,
      );
      setSensor({ line: parked, x: 0 });
      setLiveCursor({ path: [], index: 0 });
      manualSensorRef.current = { line: parked, x: 0 };
      activeSensorPhysicalLineRef.current = parked;
    },
    [setLiveCursor],
  );

  /** Note is visible — silence the note-gate glow for this line. */
  const markNoteShownForLine = useCallback((lineIdx: number) => {
    setShownNotebookIdx((prev) => {
      if (prev.has(lineIdx)) return prev;
      const nx = new Set(prev);
      nx.add(lineIdx);
      return nx;
    });
    setNotebookAttentionIdx((prev) => {
      if (!prev.has(lineIdx)) return prev;
      const nx = new Set(prev);
      nx.delete(lineIdx);
      return nx;
    });
  }, []);

  /** Jump the board to a beat by id, with type+ordinal fallback when
   *  section ids were regenerated. */
  const navigateToBeat = useCallback(
    (beatId: string, beatOrdinal?: number) => {
      let idx = beats.findIndex((b) => b.id === beatId);
      if (idx < 0 && typeof beatOrdinal === "number") {
        const suffix = beatId.endsWith("-q")
          ? "-q"
          : beatId.endsWith("-text")
            ? "-text"
            : null;
        if (suffix) {
          let n = 0;
          for (let i = 0; i < beats.length; i++) {
            if (beats[i].id.endsWith(suffix)) {
              if (n === beatOrdinal) {
                idx = i;
                break;
              }
              n++;
            }
          }
        }
      }
      if (idx >= 0) setBeatCursor(idx);
    },
    [beats],
  );

  /** PREVIEW CHANNEL host — Presenter Preview → board, one-to-one. */
  const previewHost = useMemo<PreviewChannelHost>(
    () => ({
      getSnapshot: getBoardSnapshot,
      commitPlan: commitWritePlan,
      scrollToRow: scrollBoardToRow,
      markNoteShown: markNoteShownForLine,
      navigateToBeat,
      insertTextAtSensor,
      insertFractionAtSensor,
    }),
    [
      getBoardSnapshot,
      commitWritePlan,
      scrollBoardToRow,
      markNoteShownForLine,
      navigateToBeat,
      insertTextAtSensor,
      insertFractionAtSensor,
    ],
  );

  /** FLOATING CHANNEL host — Floating Number panel → board. */
  const floatingHost = useMemo<FloatingChannelHost>(
    () => ({
      getSnapshot: getBoardSnapshot,
      commitPlan: commitWritePlan,
      scrollToRow: scrollBoardToRow,
      markNoteShown: markNoteShownForLine,
    }),
    [getBoardSnapshot, commitWritePlan, scrollBoardToRow, markNoteShownForLine],
  );

  /** Note write entry for the # panel and the AI controller — delegates
   *  to the FLOATING channel (the Preview writes through its own).
   *
   *  ONE ACTIVATION = ONE NOTE. Automatic activation and a manual tap can
   *  both target the same line, which used to stamp the text twice. The
   *  row this line's note landed on is remembered; while that row still
   *  carries ink we scroll to it instead of writing a second copy. Once
   *  the copy is erased (or Reset clears the board) the note may be
   *  written again. */
  const noteRowByLineRef = useRef<Record<number, number>>({});
  const writeNoteForLine = useCallback(
    (lineIdx: number, text: string): number | null => {
      const existing = noteRowByLineRef.current[lineIdx];
      if (typeof existing === "number") {
        const row = freeLinesRef.current[existing] ?? freeLinesRef.current[existing + 0.5];
        if (row && rowHasVisibleInk(row)) {
          scrollBoardToRow(existing);
          return existing;
        }
        delete noteRowByLineRef.current[lineIdx];
      }
      const landed = floatingWriteNote(lineIdx, text, floatingHost);
      if (typeof landed === "number") noteRowByLineRef.current[lineIdx] = landed;
      return landed;
    },
    [floatingHost, scrollBoardToRow],
  );






  /** Move the sensor to the first row that is safe to write on for this
   *  line. Skips notebook rows, existing ink, and rows covered by a tall
   *  structure above (fraction denominator). Claims the row in rowOwners
   *  so subsequent fillers append to the same row. */
  const moveSensorToSafeRow = useCallback(
    (lineIdx: number): number => {
      const owners = rowOwnersRef.current;
      // Existing owner wins.
      for (const key of Object.keys(owners)) {
        if (owners[Number(key) as unknown as number] === lineIdx) {
          const r = Number(key);
          setSensor({ line: r, x: 0 });
          setLiveCursor({ path: [], index: 0 });
          return r;
        }
      }
      // Start below the last owned row that STILL carries content (stale
      // ownership entries whose ink was erased must never drag the sensor
      // further down), else at current sensor.
      let start = Math.max(0, Math.floor(sensor.line));
      for (const key of Object.keys(owners)) {
        const r = Number(key);
        if (typeof owners[r] !== "number") continue;
        const row = freeLinesRef.current[r] ?? freeLinesRef.current[r + 0.5];
        const live = (!!row && rowHasVisibleInk(row)) || notebookRowLines.has(r);
        if (live) start = Math.max(start, r + 1);
      }
      let target = start;
      // Walk down while blocked; give one extra row of clearance below a
      // fraction denominator so descenders don't collide.
      // Safety cap: 200 rows.
      for (let guard = 0; guard < 200; guard++) {
        const occ = getRowOccupancy(target);
        if (occ === "empty") break;
        if (occ === "fraction-denominator") target += 2;
        else target += 1;
      }
      setRowOwners((prev) => (prev[target] === lineIdx ? prev : { ...prev, [target]: lineIdx }));
      setSensor({ line: target, x: 0 });
      setLiveCursor({ path: [], index: 0 });
      return target;
    },
    [getRowOccupancy, sensor.line, setLiveCursor, notebookRowLines],
  );

  const moveSensorUp = useCallback((rows: number = 1) => {
    setSensor((s) => ({ ...s, line: Math.max(0, s.line - rows) }));
  }, []);
  const moveSensorDown = useCallback((rows: number = 1) => {
    setSensor((s) => ({ ...s, line: s.line + rows }));
  }, []);

  /** Erase all ink from a specific row and release row ownership. When
   *  `row === -1`, erases the row currently owned by `guardOwnerLineIdx`. */
  const eraseRow = useCallback(
    (row: number, guardOwnerLineIdx?: number) => {
      let target = row;
      if (target < 0 && typeof guardOwnerLineIdx === "number") {
        const owners = rowOwnersRef.current;
        for (const key of Object.keys(owners)) {
          if (owners[Number(key) as unknown as number] === guardOwnerLineIdx) {
            target = Number(key);
            break;
          }
        }
      }
      if (target < 0) return;
      // Rule 9 guard: never erase a row owned by a different line.
      if (typeof guardOwnerLineIdx === "number") {
        const owner = rowOwnersRef.current[target];
        if (typeof owner === "number" && owner !== guardOwnerLineIdx) return;
      }
      setFreeLines((prev) => {
        if (prev[target] === undefined && prev[target + 0.5] === undefined) return prev;
        const nx = { ...prev };
        delete nx[target];
        delete nx[target + 0.5];
        return nx;
      });
      if (lineWidthsRef.current[target] !== undefined) {
        const nx = { ...lineWidthsRef.current };
        delete nx[target];
        lineWidthsRef.current = nx;
      }
      setRowOwners((prev) => {
        if (prev[target] === undefined) return prev;
        const nx = { ...prev };
        delete nx[target];
        return nx;
      });
    },
    [],
  );

  const eraseNoteAt = useCallback((lineIdx: number) => {
    // Best-effort: drop the note flag so a rewrite re-runs the effect, and
    // erase the row that currently holds the note (guarded by owner).
    setShownNotebookIdx((prev) => {
      if (!prev.has(lineIdx)) return prev;
      const nx = new Set(prev);
      nx.delete(lineIdx);
      return nx;
    });
    eraseRow(-1, lineIdx);
  }, [eraseRow]);

  /** Write the question line (first line of a section) wholesale onto the
   *  Smartboard. Different from filler-driven writes because it does not
   *  open the # panel. */
  const writeQuestionLine = useCallback(
    (lineIdx: number, equation: string) => {
      const eq = (equation ?? "").trim();
      if (!eq) return;
      moveSensorToSafeRow(lineIdx);
      writeProseLineOnBoard(eq);
    },
    [moveSensorToSafeRow, writeProseLineOnBoard],
  );

  // Clear all ink/rows WITHOUT touching the beat cursor. Live Mirror Mode
  // uses this so clearing before a mirror never knocks the section back
  // to beat 0 (which made note/line lookups read the wrong reservoir).
  const clearInkOnly = useCallback(() => {
    // No-op-safe: keep the same state references when already empty so
    // a repeated clear can never trigger an update storm.
    setFreeLines((p) => (Object.keys(p).length === 0 ? p : {}));
    lineWidthsRef.current = {};
    setSensor((p) => (p.line === 0 && p.x === 0 ? p : { line: 0, x: 0 }));
    setLiveCursor({ path: [], index: 0 });
    setShownNotebookIdx((p) => (p.size === 0 ? p : new Set<number>()));
    noteRowByLineRef.current = {};

    setNotebookAttentionIdx((p) => (p.size === 0 ? p : new Set<number>()));
    setConsumedAbsIdx((p) => (p.size === 0 ? p : new Set<number>()));
    setNotebookRowLines((p) => (p.size === 0 ? p : new Set<number>()));
    rowOwnersRef.current = {};
    setRowOwners((p) => (Object.keys(p).length === 0 ? p : {}));
  }, [setLiveCursor]);

  // Wipe the Smartboard so Autoplay starts from a blank surface. Mirrors
  // the toolbar "Clear board" action and additionally clears PAI reveal
  // state so the AI reconstructs everything from scratch.
  const resetBoard = useCallback(() => {
    setBeatCursor(0);
    clearInkOnly();
  }, [clearInkOnly]);

  // RESET = a new attempt. Board contents, the attempt row and the clock go;
  // permanent marks, the achievement row and the best time all stay.
  const resetAttempt = useCallback(async () => {
    clearInkOnly();
    setBoxes([]);
    setSmartLines([]);
    setTableEntries({});
    setWrongLine(null);
    setCheckView(null);
    // A fresh attempt reopens the lesson: engagement is cleared so the
    // Introduction can play again before the first activation.
    setActiveLineIdxState(0);
    setLineEngaged(false);
    setLastAwardedLineId(null);
    setPlaybackResetGeneration((generation) => generation + 1);

    await timer.reset();
    toast({ title: "New attempt started", description: "Your earned marks and best time are unchanged." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearInkOnly, timer.reset, toast]);


  // Real "click the # button" — opens the Numbers assistant panel and
  // points it at the target line so chips grey out as the AI picks them.
  const openFloatingPanelReal = useCallback((lineIdx?: number) => {
    setActiveAssistant("numbers");
    if (typeof lineIdx === "number") {
      setManualFloatingLineIdx(lineIdx);
      setFloatingLineIdx(lineIdx);
    }
  }, []);
  const closeFloatingPanelReal = useCallback(() => {
    setActiveAssistant(null);
  }, []);

  // Compute the reservoir-flat absIdx of a chip inside the current
  // active reservoir, mirroring FloatingNumberPanel's numbering.
  const resolveFloatingAbsIdx = useCallback(
    (lineIdx: number, fillerIdx: number): number | null => {
      const res = paiRefs.current.activeReservoir;
      if (!res) return null;
      let abs = 0;
      for (let k = 0; k < lineIdx && k < res.lines.length; k++) {
        abs += (res.lines[k].fillers ?? []).length;
      }
      return abs + fillerIdx;
    },
    [],
  );

  // Teacher-style filler placement: open the # panel, seat the sensor on
  // the row owned by this line (or the first empty row below the last
  // owned line), and append the chip's mirror-row via freeLines so the
  // token actually lands even when it's a leading-operator fragment like
  // "+5x" that writeProseLineOnBoard cannot commit on its own.
  const pickFloatingNumberReal = useCallback(
    (lineIdx: number, fillerIdx: number) => {
      const line = paiRefs.current.guidedLines[lineIdx];
      if (!line) return;
      const filler = (line.fillers ?? [])[fillerIdx];
      if (!filler) return;
      const mirror = mirrorLessonNoteRow(filler);
      if (!mirror.ok || mirror.row.length === 0) return;

      // Open (or refocus) the # panel — the visible teacher gesture.
      setActiveAssistant("numbers");
      setManualFloatingLineIdx(lineIdx);
      setFloatingLineIdx(lineIdx);

      // Choose the target row: existing owner for this line, else next
      // empty row below the last owned line (falling back to sensor row).
      let targetRow: number | null = null;
      const owners = rowOwnersRef.current;
      let maxOwnedRow = -1;
      for (const key of Object.keys(owners)) {
        const r = Number(key);
        const owner = owners[r];
        if (owner === lineIdx) {
          targetRow = r;
          break;
        }
        if (typeof owner === "number") maxOwnedRow = Math.max(maxOwnedRow, r);
      }
      if (targetRow === null) {
        targetRow = maxOwnedRow >= 0 ? maxOwnedRow + 1 : Math.max(0, Math.floor(sensor.line));
        // Skip past any occupied / notebook rows.
        const occupied = (r: number): boolean => {
          const rows = freeLinesRef.current;
          const whole = rows[r];
          const half = rows[r + 0.5];
          return (
            (!!whole && whole.length > 0) ||
            (!!half && half.length > 0) ||
            notebookRowLines.has(r)
          );
        };
        while (occupied(targetRow)) targetRow += 1;
      }

      // Append the mirror row atomically. Idempotency: if the exact
      // token sequence already tails the row, skip (protects against
      // double-clicks / repair re-runs).
      const targetRowFinal = targetRow;
      setFreeLines((prev) => {
        const existing = prev[targetRowFinal] ?? [];
        const combined: Row = [...existing, ...mirror.row];
        return { ...prev, [targetRowFinal]: combined };
      });
      // Record ownership so the row-signature checks resolve correctly
      // and subsequent fillers append to the same row.
      setRowOwners((prev) => {
        if (prev[targetRowFinal] === lineIdx) return prev;
        return { ...prev, [targetRowFinal]: lineIdx };
      });
      // Move the sensor to the end of this row so the following filler
      // append lands right next to what the AI just wrote.
      setSensor({ line: targetRowFinal, x: 0 });
      setLiveCursor({ path: [], index: 0 });

      // Grey the chip out on the panel the same way a manual click does.
      const absIdx = resolveFloatingAbsIdx(lineIdx, fillerIdx);
      if (absIdx !== null) {
        setConsumedAbsIdx((prev) => {
          if (prev.has(absIdx)) return prev;
          const nx = new Set(prev);
          nx.add(absIdx);
          return nx;
        });
      }
    },
    [notebookRowLines, resolveFloatingAbsIdx, sensor.line, setLiveCursor],
  );


  // Presentation AI hook wiring removed.






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

  // Presenter Preview panel sync — the live board's beat id already matches
  // the preview panel's item id ("__cover__", "<secId>-text", "<subId>-q").
  // Preview mirrors the board's cursor exactly — no fallback that could
  // silently pin the highlight to beat 0 while `beatCursor` is transiently
  // out of range.
  const activePreviewBeatId: string | null = current?.id ?? null;
  // Clamp the line index: only forward a value that actually addresses a
  // line in the current reservoir. Anything else → `null`, which promotes
  // the card-level border so the teacher always sees SOMETHING highlighted.
  // Prefer `displayedGuidedIdx` — the line the writing sensor is currently
  // sitting on (via rowOwners). That way the Presenter Preview highlight
  // follows typing on the current line whether the teacher got there via a
  // Present chip, the D-pad, or the Floating Number panel. Fall back to the
  // FN-driven activeLineIdx when the sensor's row isn't owned yet.
  const sensorLineIdx =
    displayedGuidedIdx >= 0 && displayedGuidedIdx < guidedLines.length
      ? displayedGuidedIdx
      : activeLineIdx;
  const activePreviewLineIdx: number | null =
    current &&
    (current.kind === "problem" || current.kind === "exercise-prompt") &&
    sensorLineIdx >= 0 &&
    sensorLineIdx < guidedLines.length
      ? sensorLineIdx
      : null;
  // Presenter Preview is available to the teacher (full) and to the student
  // (Present mode only — never Normal mode, so answers can never leak).
  const showPresenterChrome =
    (isTeacher || role === "student") && (!!notebookId || assessmentMode);

  const presenterSplitOpen = showPresenterChrome && presenterPanelOpen;
  return (
    <div className="absolute inset-0 flex overflow-hidden" style={{ background: palette.background }}>



      {/* Presenter Preview — 30% split pane (teacher only). Not an overlay:
          it lives as a flex sibling so the Smartboard container shrinks to
          fill the remaining space and every child (chrome, toolbars,
          bottom panel) reflows with it. */}
      {showPresenterChrome && (
        <aside
          data-sb-presenter
          className="relative flex flex-col border-r overflow-hidden"
          style={{
            width: presenterSplitOpen ? "30%" : 0,
            minWidth: presenterSplitOpen ? 320 : 0,
            maxWidth: presenterSplitOpen ? 520 : 0,
            transition: "width 280ms ease, min-width 280ms ease, max-width 280ms ease",
            background: "rgba(246,244,239,0.97)",
            borderColor: "rgba(138,106,31,0.2)",
            boxShadow: presenterSplitOpen ? "8px 0 24px rgba(0,0,0,0.12)" : "none",
            backdropFilter: "blur(10px)",
          }}
        >
          {presenterSplitOpen && (
            <>
              <header
                className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
                style={{ borderColor: "rgba(138,106,31,0.2)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: "#8a6a1f" }}>
                    Presenter Preview
                  </p>
                  <p className="text-sm font-semibold truncate" style={{ color: "#1a2230" }}>
                    {notebook?.title ?? "Untitled"}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: presenterManualScroll ? "#b45309" : "#15803d" }}
                  >
                    {presenterManualScroll ? "Paused — manual scroll" : "Following teacher"}
                  </p>
                </div>
                <button
                  onClick={() => setPresenterPanelOpen(false)}
                  aria-label="Close presenter preview"
                  className="grid place-items-center rounded-full h-8 w-8 hover:bg-black/5"
                  style={{ color: "#1a2230" }}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </header>
              <div className="flex-1 min-h-0">
                <PresenterPreviewPanel
                  notebookId={notebookId}
                  presentOnly={!isTeacher}
                  activeBeatId={activePreviewBeatId}
                  activeLineIdx={activePreviewLineIdx}
                  onActivateLine={(lineIdx) => {
                    // Presenter Preview drives the single active line: the
                    // chip strip, board, Check and Reasoning all follow.
                    if (!hasGuidedLines) return;
                    const k = Math.max(0, Math.min(lineIdx, guidedLines.length - 1));
                    setActiveLineIdx((cur) => (cur === k ? cur : k));
                  }}

                  placeholderColor={placeholderColor}
                  onManualScrollChange={setPresenterManualScroll}
                  mirrorStatus={mirrorStatus}
                  onMirrorChange={(active, t) => {
                    setMirrorActive(active);
                    setAiEditTarget(active ? t : null);
                  }}
                />
              </div>
            </>
          )}
        </aside>
      )}

      {/* Smartboard container — takes remaining width. The `transform`
          declaration makes this the containing block for every
          `position: fixed` descendant (CSS spec), so all Smartboard chrome
          (eraser, floating-number pill, cursor toolbar, bottom panel,
          symbol buttons, etc.) is scoped to this pane and reflows when
          the preview opens. */}
      <SmartboardRootContext.Provider value={sbRootEl}>
      <div
        ref={setSbRootEl}
        id="sb-root"
        className="relative h-full overflow-hidden"
        style={{
          flex: 1,
          minWidth: 0,
          transform: "translateZ(0)",
          transition: "width 280ms ease",
          background: palette.background,
          color: palette.ink,
        } as React.CSSProperties}


      >
      {/* BOARD 1 — the main writing board. Unchanged; it simply slides left
          when the teacher moves to Board 2. */}
      <div
        data-sb-board="main"
        className="absolute inset-0"
        style={{
          // `transform: none` on the visible pane: an identity translate keeps the
          // pane on a composited layer, which rasterises text softly (the "blurred
          // headings" effect). Only the off-screen pane carries a transform.
          transform: activeBoard === "main" ? "none" : "translateX(-100%)",
          transition: "transform 320ms ease",
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


      {/* Presenter Preview — top-left expandable icon (teacher only).
          The icon auto-hides after 10s; a hit-zone on the left edge reveals
          it again on pointer activity. Clicking opens/closes the 30% split
          preview pane (a flex sibling above — not an overlay). */}
      {showPresenterChrome && (
        <>
          {/* Hit-zone: top-left corner of the Smartboard pane. */}
          <div
            aria-hidden
            onPointerEnter={revealPresenterIcon}
            onPointerMove={revealPresenterIcon}
            className="absolute z-30"
            style={{ left: 0, top: 0, width: 72, height: 96 }}
          />
          <button
            data-sb-presenter
            onClick={() => { setPresenterPanelOpen((v) => !v); revealPresenterIcon(); }}
            aria-label={presenterPanelOpen ? "Close presenter preview" : "Open presenter preview"}
            title={presenterPanelOpen ? "Close presenter preview" : "Open presenter preview"}
            className="absolute z-40 grid place-items-center rounded-full border transition-opacity duration-300"
            style={{
              left: 12,
              top: 12,
              width: 40,
              height: 40,
              background: palette.chromeBg,
              color: palette.chromeFg,
              borderColor: palette.chromeBorder,
              boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
              backdropFilter: "blur(10px)",
              opacity: (presenterIconVisible || presenterPanelOpen) ? 0.95 : 0,
              pointerEvents: (presenterIconVisible || presenterPanelOpen) ? "auto" : "none",
            }}
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Presentation AI (Autoplay + Diagnosis) has been removed. */}






      {/* Review Properties dock — a right column, ~1/5 of the board, opened
          only by the top-bar button and closed with its own ✕. */}
      {/* RELATIONSHIP PAGE — opened from the Properties icon beside a diagram.
          One shared page (same as the teacher's Smartboard test): the diagram
          alone with its properties on the right, its own zoom, and one way back
          to the board. */}
      <BoardRelationshipView />

      {/* A student's question belongs to the assessment card they are on — it
          never goes to the general notification system. */}
      {/* Teacher test boards mount in student mode to reuse the solving
          engine — but only students ask teachers, so never show it there. */}
      {/* Phone / tablet: asking happens on the question screen BEFORE the
          board opens, so the board itself keeps every pixel. */}
      {role === "student" && !touchLayout && !testMode && !smartCardSlug && !guestSlug && !viewOnly && assessmentId && classIdProp && (
        <AskAssessmentQuestion
          assessmentId={assessmentId}
          classId={classIdProp}
          boardQuestionId={boardQuestionId ?? null}
        />
      )}




      {review.open && !review.fullscreen && review.active && (
        <div className="absolute inset-x-0 bottom-0 z-[70] h-[62%] w-full overflow-auto overscroll-contain rounded-t-2xl shadow-2xl md:inset-x-auto md:bottom-auto md:right-0 md:top-0 md:h-full md:w-[20%] md:min-w-[240px] md:overflow-visible md:rounded-none md:shadow-none">
          <ReviewPropertiesPanel
            scene={review.active.scene}
            role={isTeacher ? "teacher" : "student"}
            selectedObjectId={review.selectedObjectId}
            activePropertyId={review.activePropertyId}
            onPickProperty={(item) => {
              if (!item || !review.active) {
                reviewProperties.pickProperty(null, []);
                return;
              }
              reviewProperties.pickProperty(item.id, itemObjectIds(item));
            }}
            onClose={() => reviewProperties.setOpen(false)}
            fg={palette.chromeFg}
            bg={palette.chromeBg}
            border={palette.chromeBorder}
            accent={palette.accent}
          />
        </div>
      )}

      {/* Top chrome — narrow centered pill, slides out of view by default.
          Pull-tab at top-center reveals it. */}
      <header
        data-sb-chrome
        data-sb-teacher-only
        ref={topBarMeasureRef}
        className={
          touchLayout
            // PHONE / TABLET — a responsive toolbar container: it spans the
            // usable width and its controls flow onto as many rows as needed.
            ? "absolute z-20 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-2 py-2 border rounded-b-2xl transition-transform duration-500"
            : "absolute z-20 flex items-center gap-3 px-4 py-2 border rounded-b-2xl transition-transform duration-500"
        }
        style={
          touchLayout
            ? {
                ...chromeStyle,
                top: 0,
                left: 8,
                right: 8,
                transform: `translateY(${topOpen ? "0" : "-110%"})`,
                maxWidth: "none",
                width: "auto",
                paddingLeft: "max(8px, env(safe-area-inset-left))",
                paddingRight: "max(8px, env(safe-area-inset-right))",
              }
            : {
                ...chromeStyle,
                top: 0,
                left: "50%",
                transform: `translate(-50%, ${topOpen ? "0" : "-110%"})`,
                maxWidth: "min(880px, 92vw)",
                width: "max-content",
              }
        }
      >
        <button
          onClick={() => navigate(backTarget.to)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
          style={{ color: palette.chromeFg }}
          aria-label={`Back to ${backTarget.label.toLowerCase()}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {backTarget.label}
        </button>

        {/* REVIEW PROPERTIES — reviews the teacher-authored Geometry Properties
            of the diagram already on this board. Never opens on its own. */}
        {review.candidates.length > 0 && (
          <button
            onClick={() => reviewProperties.setOpen(!review.open)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
            style={review.open
              ? { background: palette.accent, color: palette.chromeBg, borderColor: palette.accent }
              : { color: palette.chromeFg, borderColor: palette.chromeBorder }}
            title="Review the properties attached to this diagram"
          >
            Review properties
          </button>
        )}


        {/* WORKSPACE SWITCH — a two-sided control: left is this writing
            workspace, right is the companion Lesson Note page of the same note. */}
        <span
          className="inline-flex items-center overflow-hidden rounded-md"
          style={{ background: palette.hoverBg, color: palette.chromeFg }}
          role="group"
          aria-label="Switch workspace"
        >
          <button
            onClick={() => setActiveBoard("main")}
            className="inline-flex items-center px-2 py-1 text-xs disabled:opacity-40"
            disabled={activeBoard === "main"}
            title="Teaching board (Board A)"
            aria-label="Teaching board"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span aria-hidden className="h-4 w-px" style={{ background: palette.chromeBorder }} />
          <button
            onClick={() => setActiveBoard("tools")}
            className="inline-flex items-center px-2 py-1 text-xs disabled:opacity-40"
            disabled={activeBoard === "tools"}
            title="Interactive board (Board B)"
            aria-label="Interactive board"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </span>

        <div
          className={
            touchLayout
              ? "flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-[12px] px-1"
              : "flex items-baseline justify-center gap-2 text-[12px] px-2 max-w-[420px] truncate"
          }
        >
          <span className={touchLayout ? "font-medium" : "font-medium truncate"}>{notebook?.title ?? "Untitled"}</span>
          {notebook?.subtopic && (
            <span className={touchLayout ? "opacity-60" : "opacity-60 truncate"}>· {notebook.subtopic}</span>
          )}
          <span className="opacity-40 tabular-nums whitespace-nowrap">· {today()}</span>
        </div>

        <div
          className={
            touchLayout
              ? "flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1.5 text-[12px]"
              : "flex items-center gap-1 text-[11px]"
          }
        >
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
          {/* Diagram / Tables / Graph / Calc / Conversion / Slide are no longer
              board tools: the companion Lesson Note workspace (right side of the
              workspace switch) is the full Lesson Note editor and owns them. */}

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

      {/* Full-board slide presentation: Next / Back / Exit only. */}
      {slideShowIndex !== null && boardSlides.length > 0 && (
        <SlidePlayer
          slides={boardSlides}
          startIndex={slideShowIndex}
          dark
          onExit={() => setSlideShowIndex(null)}
        />
      )}

      {/* Soft-glow pull-tab — TOP. Drag the header down/up. */}
      {!touchLayout && <button
        data-sb-chrome
        data-sb-teacher-only
        onClick={() => setTopOpen((v) => !v)}
        aria-label={topOpen ? "Hide top bar" : "Show top bar"}
        className="absolute z-30 top-0 left-1/2 -translate-x-1/2 grid place-items-center rounded-b-full transition-all"
        style={{
          width: 44,
          height: 18,
          // Follows the bar's real height so the tab stays reachable however
          // many rows the controls wrap onto.
          marginTop: topOpen ? topBarH : 0,
          color: palette.chromeFg,
          background: "transparent",
          boxShadow: `0 0 14px 2px ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          opacity: 0.55,
        }}
      >
        {topOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>}

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
        placeholderColorId={placeholderColorId}
        setPlaceholderColorId={setPlaceholderColorId}
        chromeBg={palette.chromeBg}
        chromeFg={palette.chromeFg}
        chromeBorder={palette.chromeBorder}
        surfaceBg={surfaceFlatBg}
        rowSpacing={rowSpacing}
        setRowSpacing={setRowSpacing}
        textScale={textScale}
        setTextScale={setTextScale}
        compactPhone={phoneLayout}
      />

      {/* Board body — pure surface, fills edge-to-edge. Tapping anywhere
          places the writing sensor on the nearest invisible baseline. */}
      <main
        ref={boardScrollRef}
        className="relative z-10 h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          // Room for the compact mobile chrome panel (number line + marks).
          paddingTop: mobileStudent ? mobileChromeH + 24 : 24,
          // No bottom panel or tab; the canvas fills to the edge.
          paddingBottom: mobileStudent ? 8 : 24,
          paddingRight: 0,
          cursor: eraseMode ? "cell" : undefined,
          // Touch devices: a finger on the board writes/erases instead of
          // triggering browser pan-zoom gestures. Vertical scrolling stays.
          touchAction: eraseMode ? "none" : "pan-y",
          WebkitTapHighlightColor: "transparent",
        }}


        onPointerDown={(e) => {
          // WORKSPACE SWITCH — the cursor alone decides which floating
          // numbers are active. A tap anywhere outside every Smart Table
          // returns the panel to the lesson numbers. The table itself is
          // untouched: it stays on the board until the teacher removes it.
          if (!(e.target as HTMLElement).closest("[data-sb-table-line]")) {
            exitTableWorkspace();
          }
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
          const yRaw = e.clientY - rect.top + host.scrollTop - 24;
          const y = unshiftY(yRaw);
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
          const row = freeLines[targetLine] ?? freeLines[Math.floor(targetLine)] ?? [];
          // LINE LOCKING: a written row is restricted once the teacher has
          // moved past it — UNLESS it belongs to the line the Floating Number
          // display is currently showing. ALL rows of the displayed line are
          // ALWAYS editable; navigating the display back to a line unlocks it.
          if (
            row.length > 0 &&
            Math.floor(sensor.line) !== Math.floor(targetLine) &&
            !displayedLineRows.has(Math.floor(targetLine))
          ) return;
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
            // Free-space tap: hold the sensor here (manual override) so the
            // auto-anchor doesn't immediately snap it back.
            manualSensorRef.current = { line: Math.floor(targetLine), x: 0 };
            activeSensorPhysicalLineRef.current = targetLine;
          }
          setSensor({ line: targetLine, x: 0 });
          setLiveCursor({ path: [], index: row.length });
          focusCapture();


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
            minHeight: `${rowTopPx(
              (layouts.length > 0
                ? layouts[layouts.length - 1].startLine + layouts[layouts.length - 1].totalLines
                : 10) + 10,
            )}px`,
             width: "100%",
             // The board always fits the available width — never wider, so
             // the page only ever scrolls vertically.
             maxWidth: "100%",
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
                top: rowTopPx(L.startLine),
                left: 0,
                right: 0,
                paddingLeft: grid.MARGIN_LEFT,
                paddingRight: compactMargins ? 12 : 32,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  pointerEvents: "auto",
                  maxWidth: "min(64rem, 100%)",
                  overflowWrap: "break-word",
                  // Beats scale with Text Size and follow Row Spacing just
                  // like hand-written rows, so intro / example / explanation
                  // all react to the same two controls.
                  fontSize: `${grid.FONT_PX}px`,
                  lineHeight: `${grid.LINE_HEIGHT}px`,
                }}
                ref={(el) => {
                  if (!el) return;
                  handleBeatMeasure(
                    L.id,
                    L.startLine + L.captionLines,
                    L.captionLines * grid.LINE_HEIGHT,
                    el.getBoundingClientRect().height,
                  );
                }}
              >
                <BeatBlock
                  beat={L.beat}
                  isCurrent={i === layouts.length - 1}
                  ink={ink}
                  placeholderColor={placeholderColor}
                  accent={palette.accent}
                  jitter={profile.strokeJitter}
                  notebookTitle={notebook?.title ?? "Untitled"}
                  topic={notebook?.subject ?? ""}
                  subtopic={notebook?.subtopic ?? ""}
                  dateLabel={today()}
                  zoom={zoom}
                />
              </div>
            </div>
          ))}

          {/* Smart Tables — FIRST-CLASS Smartboard objects, not popups. Every
              table the teacher has PLACED stays on the writing surface at the
              row where it was placed, regardless of which floating-number
              workspace is active. It only leaves when the teacher removes it.
              Several tables can be on the board at once, each with its own
              entries, expand state and cell cursor. */}
          {Object.entries(placedTables).map(([objId, placement]) => {
            const group = tableGroups.find((g) => g.objId === objId);
            if (!group || !placement) return null;
            // The table sits where the TEACHER placed it (the cursor row at
            // the moment its Floating Number icon was tapped), not wherever
            // the lesson line happens to fall.
            const anchorRow = activeLayout
              ? clampToActiveBand(placement.row)
              : placement.row;
            const entries = tableEntries[objId] ?? {};
            // The line the table highlights: the active line when the cursor
            // is inside this table, otherwise its own first line.
            const lineIdx = group.memberLineIdxs.includes(activeLineIdx)
              ? activeLineIdx
              : group.memberLineIdxs[0] ?? 0;

            return (
              <div
                key={`table:${objId}`}
                data-sb-table-line
                style={{
                  position: "absolute",
                  top: rowTopPx(anchorRow),
                  left: grid.MARGIN_LEFT,
                  right: 32,
                  zIndex: 26,
                }}
              >
                <TableActivityStage
                  group={group}
                  activeLineIdx={lineIdx}
                  entries={entries}
                  sensorCell={tableSensorCells[objId] ?? null}
                  open={!!expandedTables[objId]}
                  dark={isDark}
                  editable={canEdit}
                  canDelete={isTeacher}
                  onOpenChange={(o) =>
                    setExpandedTables((prev) => ({ ...prev, [objId]: o }))}
                  onActivateLine={(k) => {
                    // Clicking a cell hands the floating numbers to this
                    // table's own T-series until the cursor leaves the table.
                    setActiveTableObjId(objId);
                    setActiveLineIdx(k);
                    setFloatingLineIdx(k);
                    setManualFloatingLineIdx(k);
                  }}
                  onSensorCell={(k) => setTableSensorCellFor(objId, k)}
                  onEntry={(k, v) => setTableEntry(objId, k, v)}
                  onDelete={() => deleteTableObject(group)}
                  onClear={() => clearTableEntries(group)}
                  onMeasure={(h) =>
                    handleBeatMeasure(`table:${objId}`, anchorRow + 1, grid.LINE_HEIGHT, h)}
                />
              </div>
            );
          })}

          {/* Not placed? Nothing is drawn. The table is a permanent lesson
              line: its Floating Number icon stays in the panel and the
              teacher places it at the cursor whenever they want it. */}




          {/* Invisible-grid free-writing overlay. Filtered to lines that
              fall inside some beat's writable band, so solution ink can
              never bleed above the section line into the cover / previous
              sessions. Empty math-tree sub-slots (fraction num/den, √
              radicand, exponents, matrix cells) are drawn in the whiteboard
              color everywhere, so they blend invisibly with the white board
              surface and stay visible against darker panels. */}
          <FreeWriteLayer
            lines={visibleFreeLines}
            offsets={lineOffsets}
            yShift={shiftFor}
            grid={grid}
            activeLine={!solvingMode ? null : (activeBoxId ? null : sensor.line)}
            cursor={cursor}
            caretColor={ink}
            placeholderColor={placeholderColor}
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
                // Caret may land on the sensor's row OR on ANY row of the
                // line currently shown in the Floating Number display —
                // that line is always editable. Everything else is locked.
                if (
                  Math.floor(sensor.line) !== Math.floor(line) &&
                  !displayedLineRows.has(Math.floor(line))
                ) return;
              }
              if (line !== sensor.line) setSensor((s) => ({ ...s, line }));
              setLiveCursor(c);
              focusCapture();
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
            placeholderColor={placeholderColor}
            suppressNativeKeyboard={noNativeKeyboard}
          />

          {/* Diagrams live on the page itself — they scroll with the board and
              are saved with this page's board scope. */}
          <BoardToolLayer
            diagrams={diagrams}
            onChange={setDiagrams}
            onEdit={(id) => {
              const d = diagrams.find((x) => x.id === id);
              if (!d) return;
              setActiveDiagramId(id);
              if (d.kind === "3d") setEditing3dId(id);
            }}

            onDelete={deleteDiagram}
            activeId={activeDiagramId}
            onActivate={setActiveDiagramId}
            editable={isTeacher}
            ink={ink}
            palette={{
              chromeBg: palette.chromeBg,
              chromeFg: palette.chromeFg,
              chromeBorder: palette.chromeBorder,
              hoverBg: palette.hoverBg,
              dark: isDark,
            }}
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
            const bandTopPx = rowTopPx(bandStart(activeLayout));
            const bandBotPx = rowTopPx(bandEnd(activeLayout) + 1);
            // Final written line within this band — drives the upper drag clamp.
            // Use measured DOM heights so tall structures (fractions, roots,
            // matrices) contribute their *full* vertical extent — never just
            // their first row. Falls back to one row pitch if unmeasured.
            let finalLineBottomPx = rowTopPx(bandStart(activeLayout));
            for (const k of Object.keys(freeLines)) {
              const ln = Number(k);
              if (!freeLines[ln] || freeLines[ln].length === 0) continue;
              const flr = Math.floor(ln);
              if (flr < bandStart(activeLayout) || flr > bandEnd(activeLayout)) continue;
              const topPx = rowTopPx(ln);
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
            const padBot = 24;
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
            // SINGLE NOTE SOURCE — same module the Presenter Preview uses.
            // A line has a note iff its own saved highlight authored one.
            const notebookFor = (k: number): string =>
              noteForLine(guidedLines[k] as { notebook?: string } | undefined);

            // Notes never block progression. The first forward movement from
            // a line activates its note once for this attempt; manual opening
            // remains available, and Reset clears shownNotebookIdx.
            const noteGateOpen = (k: number): boolean => {
              const note = notebookFor(k);
              if (note.length === 0) return true;
              return shownNotebookIdx.has(k);
            };
            const activateNoteOnce = (k: number) => {
              const note = notebookFor(k);
              if (!note || shownNotebookIdx.has(k)) return;
              writeNoteForLine(k, note);
              setShownNotebookIdx((prev) => new Set(prev).add(k));
              setNotebookAttentionIdx((prev) => {
                const next = new Set(prev);
                next.delete(k);
                return next;
              });
            };

            // Cursor movement: teacher may freely traverse every line up to
            // the last one. The down-chevron naturally disables at the bottom
            // (cur >= total) so the teacher sees the line is blocked.
            const maxReachable = lineCount - 1;
            /* COUNTER DOMAIN — lesson steps (a table counts as ONE step, its
               rows never inflate the numbering) or, while a table is active,
               that table's own T-series. */
            const tCount = tSeries.length;
            const tIdx = tSeriesGroup
              ? Math.max(0, tSeriesGroup.memberLineIdxs.indexOf(curLineIdx))
              : -1;
            const counterNumber = tCount > 0 ? tIdx + 1 : activeStepIdx + 1;
            const counterTotal = tCount > 0 ? tCount : steps.length;
            /* TAG — the active node's own identifier: `T{k}.{i}` inside an open
               table branch, `T{k}` for a collapsed table, `L{n}` for an
               equation. The main path never shows a child tag. */
            const counterLabel = tCount > 0
              ? (tSeries[tIdx]?.label ?? activeTag)
              : mainTagForStep(steps, stepIdxForLine(steps, curLineIdx));


            const lineForCounter = (target: number): number | null => {
              if (tCount > 0) return tSeriesGroup?.memberLineIdxs[target] ?? null;
              return steps[target]?.lineIdx ?? null;
            };
            const stepTo = (target: number) => {
              if (!hasGuidedLines) return;
              if (target < 0 || target >= lineCount) return;
              if (target > maxReachable) return; // out of reach — block the jump
              if (target > curLineIdx) activateNoteOnce(curLineIdx);
              // The display drives everything: moving it advances/rewinds
              // the lesson-line index, releases any D-pad override, and
              // lets the line-sync effect park the sensor on the target
              // line's row (unlocking it) or on the first empty row below
              // (a new line). This is the ONLY place a line locks/unlocks.
              setActiveLineIdx(target);
              setFloatingLineIdx(target);
              setManualFloatingLineIdx(target);
              manualSensorRef.current = null;
              manualPushedRef.current = null;
            };
            const stepToCounter = (target: number) => {
              if (target < 0 || target >= counterTotal) return;
              const line = lineForCounter(target);
              if (line == null) return;
              stepTo(line);
            };
            const goPrev = () => {
              if (!hasGuidedLines) return;
              if (notebookRevealIdx != null) {
                // Cancel notebook reveal — stay on current line, no advance.
                setNotebookRevealIdx(null);
                return;
              }
              stepToCounter(counterNumber - 2);
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
                setNotebookAttentionIdx((prev) => {
                  const next = new Set(prev);
                  next.delete(k);
                  return next;
                });
                setNotebookRevealIdx(null);
                setActiveLineIdx(k);
                setFloatingLineIdx(k);
                setManualFloatingLineIdx(k);
                return;
              }
              activateNoteOnce(curLineIdx);
              // BRANCH EXIT (explicit, teacher-driven): when every track of the
              // active table is filled, Next returns to the next MAIN-PATH node
              // (T1 → L4, T2 → L6), never to another table's child line.
              if (activeTableGroup && isGroupComplete(activeTableGroup, activeTableEntries)) {
                const back = nextMainStepAfter(steps, activeTableGroup);
                if (back && back.lineIdx !== curLineIdx) {
                  setActiveLineIdx(back.lineIdx);
                  setFloatingLineIdx(back.lineIdx);
                  setManualFloatingLineIdx(back.lineIdx);
                  return;
                }
              }
              stepToCounter(counterNumber);
            };
            const lineContainers = hasGuidedLines ? (guidedLines[curLineIdx]?.containers ?? []) : [];
            const currentNotebookText = notebookFor(curLineIdx);
            const currentNotebookPending = !noteGateOpen(curLineIdx);
            const revealNotebookText =
              notebookRevealIdx != null ? notebookFor(notebookRevealIdx) : currentNotebookText;
            // DIAGRAM LAW: diagrams are note content. They ride the note of the
            // line above them and appear when the teacher opens that note.
            const noteObjectsFor = (k: number): SolutionObject[] =>
              noteObjectsForLine<SolutionObject>(
                guidedLines[k] as { noteObjects?: SolutionObject[] } | undefined,
              );
            const revealNoteObjects = noteObjectsFor(notebookRevealIdx ?? curLineIdx);
            const markCurrentNotebookRead = () => {
              const k = notebookRevealIdx ?? curLineIdx;
              setShownNotebookIdx((prev) => {
                const next = new Set(prev);
                next.add(k);
                return next;
              });
              setNotebookAttentionIdx((prev) => {
                const next = new Set(prev);
                next.delete(k);
                return next;
              });
              if (notebookRevealIdx != null) {
                setNotebookRevealIdx(null);
                setActiveLineIdx(k);
                setFloatingLineIdx(k);
                setManualFloatingLineIdx(k);
              }
            };
            return (
              <>
                <FloatingNumberPanel
                  onMeasure={onFloatingMeasure}
                  phoneCompact={phoneLayout}
                  phoneControls={phoneLayout ? [
                    { label: "Eraser", disabled: false, action: () => setEraseMode((value) => !value), icon: <Eraser className="h-4 w-4" /> },
                    { label: "Floating numbers", disabled: false, action: () => toggleAssistant("numbers"), icon: <Hash className="h-4 w-4" /> },
                    { label: "Undo", disabled: !canUndo, action: doUndo, icon: <Undo2 className="h-4 w-4" /> },
                    { label: "Redo", disabled: !canRedo, action: doRedo, icon: <Redo2 className="h-4 w-4" /> },
                  ].map((control) => (
                    <button
                      key={control.label}
                      type="button"
                      onClick={control.action}
                      disabled={control.disabled}
                      aria-label={control.label}
                      title={control.label}
                      aria-pressed={controlIsOn(control.label)}
                      className="mx-auto grid h-8 w-8 shrink-0 place-items-center rounded-md disabled:opacity-30"
                      style={controlIsOn(control.label)
                        ? { background: palette.accent, color: palette.chromeBg, boxShadow: `0 0 0 2px ${palette.accent}` }
                        : { background: palette.hoverBg }}
                    >
                      {control.icon}
                    </button>
                  )) : undefined}
                  displayStyle={floatingDisplayStyle}
                  chromeFg={palette.chromeFg}
                  reservoirs={reservoirs}
                  viewIdx={viewReservoirIdx >= 0 ? viewReservoirIdx : Math.max(0, activeReservoirIdx)}
                  activeIdx={activeReservoirIdx}
                  visible={activeAssistant === "numbers" && reservoirs.length > 0}
                  onInsert={(t) => {
                    // Flex-nudge: if the sensor is parked on a locked or
                    // already-inked row (very common right after a
                    // fraction, whose ink spills onto row+0.5), slide it
                    // down to the first safe row so the tap never
                    // silently no-ops. Present Mode gets this for free
                    // via presentWriteAtSensor; the Floating Number
                    // panel now behaves the same way.
                    // Table Activity: while the table is the workspace, a
                    // tapped value lands in the cell holding the sensor.
                    if (writeIntoTableCell(t)) return;
                    presentWriteAtSensor(t);
                  }}
                  onInsertMatrix={(latex) => {
                    if (writeIntoTableCell(latex)) return;
                    const cur = Math.floor(sensor.line);
                    if (notebookRowLines.has(cur) || isLockedInkRow(sensor.line)) {
                      let t = nextSensorRowBelow(cur);
                      for (let g = 0; g < 200 && (notebookRowLines.has(t) || isLockedInkRow(t)); g++) t += 1;
                      ensureBandCovers(t);
                      setSensor((s) => ({ ...s, line: t, x: 0 }));
                    }
                    insertMatrixAtSensor(latex);
                  }}
                  onInsertFrac={(p) => {
                    // Same uncapped step-past-locked rule as every other
                    // write path — never bounded to the band.
                    const cur = Math.floor(sensor.line);
                    if (notebookRowLines.has(cur) || isLockedInkRow(sensor.line)) {
                      let t = nextSensorRowBelow(cur);
                      for (let g = 0; g < 200 && (notebookRowLines.has(t) || isLockedInkRow(t)); g++) t += 1;
                      ensureBandCovers(t);
                      setSensor((s) => ({ ...s, line: t, x: 0 }));
                    }
                    insertFractionAtSensor(p);
                  }}
                  activeLineIdx={hasGuidedLines ? curLineIdx : undefined}
                  consumedAbsIdx={consumedAbsIdx}
                  /* Live classroom: one shared floating workspace. The editing
                     client publishes its arrangement and strip state; every
                     other client renders exactly that (all null elsewhere). */
                  sharedReservoir={sharedFloatingReservoir}
                  sharedUsed={sharedFloatingUsed}
                  sharedUsedOrder={sharedFloatingUsedOrder}
                  sharedView={sharedFloatingView}
                  onFloatingViewChange={syncEnabled && canEdit ? handleFloatingViewChange : undefined}
                  onUsedOrderChange={syncEnabled && canEdit ? handleFloatingUsedOrderChange : undefined}

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
                  viewportBottomInset={0}
                  onPing={pingAssistant}
                  beatId={beatKey}
                  lineNumber={hasGuidedLines ? counterNumber : undefined}
                  lineCount={hasGuidedLines ? counterTotal : undefined}
                  lineLabel={counterLabel}
                  tagOfLineIdx={(idx) => tagForLine(steps, tableGroups, idx)}
                  /* This lesson line IS a table: one table-icon chip instead
                     of equation fragments. Once a cell is clicked the T-series
                     takes over and the ordinary chips return so the teacher can
                     write into cells. */
                  tableChip={
                    activeTableGroup && tCount === 0
                      ? {
                          objId: activeTableGroup.objId,
                          label: activeTableGroup.label,
                          placed: !!activeTablePlacement,
                            isMatrix: !!(activeTableGroup.grid as any).isMatrix,
                        }
                      : null
                  }
                  onPlaceTable={placeTableAtCursor}
                  onPrevLine={goPrev}
                  onNextLine={goNext}
                  notebookText={revealNotebookText}
                  noteObjectCount={revealNoteObjects.length}
                  onShowNoteObjects={() => setRevealedNoteObjects(revealNoteObjects)}
                  onWriteNotebookToBoard={(text) => {
                    // Same direct note channel the Presenter Preview uses:
                    // anchors under the line's own board row, writes (or
                    // scrolls to an existing copy), locks the row, and
                    // clears the note-gate glow. Never a silent no-op.
                    writeNoteForLine(curLineIdx, text);
                  }}
                  onNotebookRead={markCurrentNotebookRead}
                  frozen={false}
                  notebookPending={
                    hasGuidedLines &&
                    !noteGateOpen(curLineIdx) &&
                    notebookAttentionIdx.has(curLineIdx)
                  }
                  placeholderColor={placeholderColor}
                />

                {revealedNoteObjects.length > 0 && (
                  <div className="pointer-events-auto fixed bottom-24 right-6 z-[95] max-h-[70vh] w-[42vw] max-w-[720px] overflow-auto rounded-2xl border border-black/10 bg-white/95 p-4 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-black/60">
                        Lesson note
                      </span>
                      <button
                        type="button"
                        onClick={() => setRevealedNoteObjects([])}
                        className="rounded-md border border-black/10 px-2 py-1 text-xs text-black/70"
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-6">
                      {revealedNoteObjects.map((o) => (
                        <div
                          key={o.objId}
                          className="lesson-doc sb-board-object w-full max-w-full"
                          style={{ fontSize: `${zoom}rem` }}
                        >
                          <SolutionObjectView nodeType={o.nodeType} attrs={o.attrs ?? {}} presentation zoom={zoom} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <StructurePanel
                  chromeFg={palette.chromeFg}
                  placeholderColor={placeholderColor}
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
                  lineNumber={hasGuidedLines ? counterNumber : undefined}
                  lineCount={hasGuidedLines ? counterTotal : undefined}
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
              sets. Cursor movement lives in the SensorDPad below. */}



        </WritingSurface>
      </main>

      {/* Edge pan arrows removed — the board always fits the viewport width,
          so there is nothing to pan across. */}



      {/* Invisible keyboard capture. Omitted in view-only mirror mode. */}
      {canEdit && (
      <textarea
        ref={hiddenInputRef}
        aria-hidden
        inputMode={noNativeKeyboard ? "none" : "text"}
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
            // Structure-aware advance: move to the next truly empty writable
            // row. If the next physical row is a notebook/prose row, previous
            // ink, or covered by a tall math object, jump over it.
            const base = Number.isInteger(sensor.line) ? sensor.line : Math.floor(sensor.line);
            let nextLine = activeLayout
              ? findNextWritableEmptyRow(nextSensorRowBelow(base), 1, activeLayout)
              : nextSensorRowBelow(base);
            // Gate: don't allow advancing past the current expected guided
            // line until that line has turned green.
            if (hasGuidedLines && activeLayout) {
              const expectedLineNum = Math.floor(sensor.line);
              const row = freeLines[expectedLineNum];
              const ascii = row ? rowToAscii(row) : "";
              const target = guidedLines[activeLineIdx];
              const currentLineComplete = !!row && row.length > 0 && !!target &&
                (equationsMatch(ascii, target.equation) || equationsEquivalent(ascii, target.equation));
              if (nextLine > expectedLineNum && !currentLineComplete) {
                return;
              }
            }
            if (activeLayout && nextLine > bandEnd(activeLayout)) {
              growActiveBand();
            }
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
            manualPushedRef.current = null;
            activeSensorLogicalIdxRef.current = hasGuidedLines ? activeLineIdx + 1 : null;
            activeSensorPhysicalLineRef.current = snapLine;
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
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // STRUCTURE FIRST: step between the slots of the structure the
            // caret is inside (denominator ↔ numerator, exponent ↔ base,
            // matrix cell ↔ cell above/below); ▲ escapes the structure when
            // there is nothing above. Row movement is the fallback.
            const inkRow = freeLines[sensor.line] ?? freeLines[Math.floor(sensor.line)] ?? [];
            if (inkRow.length > 0 && cursor.path.length >= 2) {
              const nextCursor = e.key === "ArrowUp"
                ? treeMoveUp(inkRow, cursor)
                : treeMoveDown(inkRow, cursor);
              if (nextCursor) {
                e.preventDefault();
                setLiveCursor(nextCursor);
                return;
              }
            }
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
      {!touchLayout && (() => {
        const HOME_LEFT = 12;
        // Stack above the bottom-left Floating Numbers AssistantButton so the
        // eraser never sits under (or near) any right-edge control.
        // PHONE/TABLET: suspended above the measured Floating Number workspace.
        const HOME_BOTTOM = touchLayout ? touchControlsBottom : 12 + 52;
        const wiping = !!eraserDrag;
        // Convert viewport pointer coords to Smartboard-pane-local coords.
        // The pane has `transform: translateZ(0)`, so any `position: fixed`
        // descendant is contained by the pane's box. Using raw clientX/Y
        // would draw the icon offset by the pane's viewport left/top —
        // visible as a horizontal offset while the 30% preview is open.
        const toLocal = (cx: number, cy: number) => {
          const host = boardScrollRef.current;
          const r = host?.getBoundingClientRect();
          return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
        };
        const startEraserDrag = (e: React.PointerEvent) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setEraserDrag(toLocal(e.clientX, e.clientY));
          const wipeAt = (cx: number, cy: number) => {
            const host = boardScrollRef.current;
            if (!host) return;
            const rect = host.getBoundingClientRect();
            if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;
            eraseAtPoint(cx, cy);
          };
          wipeAt(e.clientX, e.clientY);
          const onMove = (ev: PointerEvent) => {
            setEraserDrag(toLocal(ev.clientX, ev.clientY));
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
              position: "absolute",
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
      {!touchLayout && <div
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
      />}
      {!touchLayout && <div
        data-sb-chrome
        className="absolute z-30 flex flex-col items-center gap-2 transition-opacity duration-300"
        style={{
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: touchLayout || leftToolsVisible ? 1 : 0,
          pointerEvents: touchLayout || leftToolsVisible ? "auto" : "none",
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

        {/* The left-rail ↑/↓ scrollbar has been replaced by the permanent
            Sensor D-pad (bottom-center, 4-direction). Nothing renders here. */}
      </div>}

      {/* RIGHT rail — two-point line tool. */}
      {canEdit && carrierVisible && !mobileStudent && (
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
          {/* Box tool button removed by request — no replacement. */}
        </div>
      )}








      {/* Emoji dock removed from the Smartboard by request — no replacement. */}

      {/* Permanent activation button for the Floating Numbers workspace. On
          phone/tablet it is suspended above the measured workspace. */}
      {canEdit && carrierVisible && !touchLayout && (
        <AssistantButtons
          active={activeAssistant}
          onToggle={toggleAssistant}
          chromeBg={palette.chromeBg}
          chromeFg={palette.chromeFg}
          chromeBorder={palette.chromeBorder}
          ink={ink}
          bottomInset={0}
          positionOverride={
            touchLayout
              ? { left: "max(64px, calc(env(safe-area-inset-left) + 64px))", bottom: touchControlsBottom }
              : undefined
          }
        />
      )}

      {/* Phone/tablet: one PERMANENT strip owns every frequent solving action.
          It is screen-anchored (never inside the scrolling lesson content) and
          never depends on the Floating Number workspace being open — that
          workspace only pushes the strip upward while it is showing. */}
      {canEdit && touchLayout && !phoneLayout && (
        <div
          className="fixed left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur"
          style={{
            bottom: `calc(${Math.max(12, touchControlsBottom)}px + env(safe-area-inset-bottom))`,
            background: palette.chromeBg,
            color: palette.chromeFg,
            borderColor: palette.chromeBorder,
          }}
        >

          {[
            { label: "Eraser", disabled: false, action: () => setEraseMode((value) => !value), icon: <Eraser className="h-4 w-4" /> },
            { label: "Floating numbers", disabled: false, action: () => toggleAssistant("numbers"), icon: <Hash className="h-4 w-4" /> },
            { label: "Undo", disabled: !canUndo, action: doUndo, icon: <Undo2 className="h-4 w-4" /> },
            { label: "Redo", disabled: !canRedo, action: doRedo, icon: <Redo2 className="h-4 w-4" /> },
            { label: "Previous section", disabled: beatCursor <= 0, action: () => setBeatCursor((cursor) => Math.max(0, cursor - 1)), icon: <ChevronLeft className="h-4 w-4" /> },
            { label: "Next section", disabled: !canAdvanceBeat, action: () => setBeatCursor((cursor) => Math.min(beats.length - 1, cursor + 1)), icon: <ChevronRight className="h-4 w-4" /> },
          ].map((control) => (
            <button
              key={control.label}
              type="button"
              onClick={control.action}
              disabled={control.disabled}
              aria-label={control.label}
              title={control.label}
              aria-pressed={controlIsOn(control.label)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-30"
              style={controlIsOn(control.label)
                ? { background: palette.accent, color: palette.chromeBg, boxShadow: `0 0 0 2px ${palette.accent}` }
                : { background: palette.hoverBg }}
            >
              {control.icon}
            </button>
          ))}
        </div>
      )}

      {/* Left-rail CursorScrollbar REMOVED — it duplicated the SensorDPad's
          up/down controls. The SensorDPad is the single sensor controller. */}



      {/* AI line-status verification toggle removed by request — no replacement. */}




      {/* Permanent Sensor Controller (D-pad). Visible whenever the
          Floating Number workspace is active. Only moves the sensor. */}
      {canEdit && solvingMode && (
        <SensorDPad
          onUp={() => { nudgeCursor(-1); revealLeftTools(); }}
          onDown={() => { nudgeCursor(1); revealLeftTools(); }}
          onLeft={() => { nudgeCursorHoriz(-1); revealLeftTools(); }}
          onRight={() => { nudgeCursorHoriz(1); revealLeftTools(); }}
          chromeBg={palette.chromeBg}
          chromeFg={palette.chromeFg}
          chromeBorder={palette.chromeBorder}
          ink={ink}
          canUp={canCursorUp}
          canDown={canCursorDown}
          canLeft={canCursorLeft}
          canRight={canCursorRight}
          bottomPx={16}
          touchLayout={touchLayout}
          topInsetPx={mobileStudent ? mobileChromeH + 12 : 0}
          bottomInsetPx={phoneLayout ? (floatingBox?.height ?? 48) + 8 : 0}
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

      {/* Teacher-only: show/toggle whether students can see this class board. */}
      {isTeacher && syncEnabled && classIdProp && (
        <StudentAccessControl
          classId={classIdProp}
          chromeBg={palette.chromeBg}
          chromeFg={palette.chromeFg}
          chromeBorder={palette.chromeBorder}
          accent={palette.accent}
        />
      )}



      {/* Assessment controls. Touch gets one compact row; desktop retains its
          established progress strip. Manual Check Line UI has been removed. */}
      {assessmentMode && (
        <>
          <div
            // Row 1 of the board chrome. The video view switcher measures this
            // element and stacks itself underneath, so the two never overlap.
            data-board-chrome="top"
            ref={mobileStudent ? chromeMeasureRef : undefined}
            className={mobileStudent
              ? "absolute left-0.5 right-0.5 top-0.5 z-[60] flex min-w-0 items-center justify-between gap-0.5 overflow-visible rounded-md border px-0.5 py-0.5 shadow-md backdrop-blur"
              : "absolute left-1/2 top-3 z-[60] -translate-x-1/2 flex max-w-[94vw] items-center gap-3 rounded-2xl border px-4 py-2 shadow-lg backdrop-blur"}
            style={{ background: palette.chromeBg, color: palette.chromeFg, borderColor: palette.chromeBorder }}
          >
            {mobileStudent && touchSession ? (
              <button
                type="button"
                onClick={touchSession.onBack}
                aria-label={touchSession.backLabel}
                title={touchSession.backLabel}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md min-[390px]:h-8 min-[390px]:w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : backTo ? (
              <a
                href={backTo}
                aria-label={backLabel}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-black/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
              </a>
            ) : (
              <BackButton
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-black/5"
                iconClassName="h-3.5 w-3.5"
                ariaLabel="Back"
              >
                {" "}Back
              </BackButton>
            )}

            {!mobileStudent && (
              <span className="truncate text-sm font-semibold max-w-[34vw]">{source?.title ?? "Assignment"}</span>
            )}

            {/* ONE number strip, never more than THREE positions:
                previous · current · next. On a phone or tablet with several
                questions the strip tracks the QUESTION (tap to move); a
                single-question board tracks the guided line instead.
                Colour comes from the question's own state only — the score
                beside it never decides it:
                blue = mark earned, brown/gold = inside the live timed attempt. */}
            {(hasGuidedLines || beats.length > 1 || mobileStudent) && (() => {
              const byLine = hasGuidedLines && !(mobileStudent && beats.length > 1);
              return (
              <div className="flex min-w-0 items-center gap-1" title={byLine ? "Line progress" : "Question progress"}>
                {(byLine
                  ? getQuestionWindow(guidedLines.length, activeLineIdx)
                  : getQuestionWindow(beats.length, touchQuestionIndex)
                ).map((i, slot) => {
                  const key = byLine
                    ? (i != null ? slotFor(i) : null)
                    : (i != null ? beats[i]?.id ?? null : null);
                  // NO FLOATING NUMBER = NO MARK STATE: a note-only line stays
                  // neutral, never blue and never brown.
                  const carries = byLine
                    ? (i != null && lineCarriesMarkState(guidedLines[i]))
                    : i != null && !!key;
                  const state = questionTabState({
                    carries: carries && !!key,
                    marked: !!key && (byLine ? key in solvedSlots : progressLayers.blue.has(key)),
                    confirmedNow: !!key && (byLine ? key in timer.confirmed : progressLayers.brown.has(key)),
                    timerActive: timer.active,
                  });
                  const blue = state === "blue";
                  const brown = state === "brown";
                  const active = i != null && i === (byLine ? activeLineIdx : touchQuestionIndex);
                  // Brown wins while the line is in the live attempt; blue is
                  // what remains once Reset clears that temporary layer.
                  const fill = brown ? PROGRESS_BROWN : blue ? palette.accent : null;
                  const style = fill
                    ? { background: fill, color: palette.chromeBg, borderColor: fill }
                    : active
                      ? { background: palette.hoverBg, borderColor: palette.accent, color: palette.chromeFg }
                      : { borderColor: palette.chromeBorder };
                  const label = byLine ? "Line" : "Question";
                  return (
                    <button
                      key={`${label}-${i ?? `empty-${slot}`}`}
                      onClick={() => { if (i != null && !byLine) changeTouchQuestion(i); }}
                      disabled={i == null}
                      className={`grid place-items-center rounded-full font-medium transition disabled:opacity-30 ${
                        mobileStudent ? "h-7 min-w-7 px-1 text-xs min-[390px]:h-8 min-[390px]:min-w-8 min-[390px]:px-2 min-[390px]:text-[13px]" : "h-6 min-w-6 px-2 text-[11px]"
                      }`}
                      style={{ ...style, borderWidth: active ? 2 : 1, borderStyle: "solid" }}
                      title={i != null
                        ? `${label} ${i + 1}${blue ? " · mark awarded" : ""}${brown ? " · solving now" : ""}`
                        : `No ${label.toLowerCase()}`}
                    >
                      {i != null ? i + 1 : "–"}
                    </button>
                  );
                 })}
              </div>
              );
            })()}



            <div className="shrink-0 rounded-md px-1 py-1 text-[10px] font-bold tabular-nums min-[390px]:px-1.5 min-[390px]:text-xs" style={{ background: palette.hoverBg }}>
              {touchSession?.score ?? assessScore} <span className="opacity-60">/ {touchSession?.totalScore ?? assessTotal}</span>
            </div>

            {/* Attempt timer — HH:MM:SS, best time, and Reset (new attempt). */}
            {timer.active && !mobileStudent && (
              <div className="inline-flex items-center gap-1.5">
                <span
                  className="rounded-md px-2 py-1 text-xs font-semibold tabular-nums"
                  style={{ background: palette.hoverBg }}
                  title={timer.running ? "Timing this attempt" : "Timer paused — starts on your first input"}
                >
                  {formatAttemptTime(timer.elapsedMs)}
                </span>
                {/* One visible statistic — the student's own Best Time. The
                    fastest time by anyone appears only when they open it. */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTimeDetailsOpen((open) => !open)}
                    className="rounded-md px-2 py-1 text-[11px] tabular-nums opacity-90 hover:bg-black/5"
                    style={{ border: `1px solid ${palette.chromeBorder}` }}
                    aria-expanded={timeDetailsOpen}
                    title="Best Time — your own fastest completed solve"
                  >
                    ⏱ Best Time {timer.bestMs == null ? "—" : formatAttemptTime(timer.bestMs)}
                  </button>
                  {timeDetailsOpen && (
                    <div
                      className="absolute left-0 top-full z-[80] mt-1 w-48 rounded-md border p-2 text-[11px] tabular-nums shadow-lg"
                      style={{ background: palette.chromeBg, borderColor: palette.chromeBorder }}
                    >
                      🏆 Overall Best {timer.overallBestMs == null ? "—" : formatAttemptTime(timer.overallBestMs)}
                    </div>
                  )}
                </div>




                <button
                  onClick={() => { void resetAttempt(); }}
                  className="rounded-md px-2 py-1 text-[11px] font-medium hover:bg-black/5"
                  style={{ border: `1px solid ${palette.chromeBorder}` }}
                  title="Start a new attempt — clears the board and the clock, keeps your marks and best time"
                >
                  Reset
                </button>
              </div>
            )}

            {timer.active && mobileStudent && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setTimeDetailsOpen((open) => !open)}
                  className="rounded-md px-1 py-1 text-[9px] font-semibold tabular-nums min-[390px]:px-1.5 min-[390px]:text-[10px]"
                  style={{ background: palette.hoverBg }}
                  aria-expanded={timeDetailsOpen}
                  aria-label="Timer and best times"
                >
                  {formatAttemptTime(timer.elapsedMs)}
                </button>
                {timeDetailsOpen && (
                  <div
                    className="absolute right-0 top-full z-[80] mt-1 w-44 rounded-md border p-2 text-[10px] shadow-lg"
                    style={{ background: palette.chromeBg, borderColor: palette.chromeBorder }}
                  >
                    <div>My Best {timer.bestMs == null ? "—" : formatAttemptTime(timer.bestMs)}</div>
                    <div>Overall Best {timer.overallBestMs == null ? "—" : formatAttemptTime(timer.overallBestMs)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Zoom controls */}
            {/* Compact [ − ] 100% [ + ] content zoom — when the timer is active the
                percentage label is hidden so the tracker/score/timer have room; the
                steppers stay visible. */}
            <div className="inline-flex shrink-0 items-center rounded-md" style={{ background: palette.hoverBg }}>
              <button
                onClick={() => applyZoom(zoom - ZOOM_STEP)}
                className={mobileStudent ? "px-1.5 py-1 text-sm leading-none" : "px-2 py-1 text-base leading-none"}
                aria-label="Zoom out"
                title="Make the content smaller"
              >−</button>
              {!timer.active && (
                <button
                  onClick={() => applyZoom(1)}
                  className="px-1 py-1 tabular-nums text-[9px] min-[390px]:px-2 min-[390px]:text-[10px]"
                  aria-label="Reset zoom"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
              )}
              <button
                onClick={() => applyZoom(zoom + ZOOM_STEP)}
                className={mobileStudent ? "px-1.5 py-1 text-sm leading-none" : "px-2 py-1 text-base leading-none"}
                aria-label="Zoom in"
                title="Make the content bigger"
              >+</button>
            </div>

            {mobileStudent && (
              <button
                type="button"
                onClick={() => { void resetAttempt(); }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md min-[390px]:h-8 min-[390px]:w-8"
                aria-label="Reset attempt"
                title="Reset attempt"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {mobileStudent && touchSession?.videoControl}

            {/* Board Settings — same sheet the teacher Smartboard uses. */}
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={mobileStudent ? "grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-black/5 min-[390px]:h-8 min-[390px]:w-8" : "inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-black/5"}
              aria-label="Board settings"
              title="Board settings"
              style={{ color: palette.chromeFg }}
            >
              <SettingsIcon className="h-4 w-4" />
            </button>

            {/* Only where the browser genuinely grants full screen. Where it
                doesn't (most iPhone browsers) no button is offered at all —
                the board already fills the real usable height. */}
            {mobileStudent && canFullscreen && (
              <button
                type="button"
                onClick={() => { void toggleTouchFullscreen(); }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md min-[390px]:h-8 min-[390px]:w-8"
                aria-label={touchFullscreenActive ? "Exit full screen" : "Full screen"}
                title={touchFullscreenActive ? "Exit full screen" : "Full screen"}
              >
                {touchFullscreenActive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </>
      )}

      {/* Student status indicator — visible to live-mirror students only. */}
      {role === "student" && !assessmentMode && (
        <div
          className="absolute left-1/2 top-3 z-[60] -translate-x-1/2 select-none rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur"
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
      {/* BOARD B — the interactive mathematics board for the SAME active
          section: Diagram / Table / Graph / Calculator / Conversion, plus the
          private companion Lesson Note page. Slides in from the right. */}
      {isTeacher && !assessmentMode && boardBMounted && (
        <div
          className="absolute inset-0"
          style={{
            // No identity transform while visible — keeps the companion Lesson Note
            // text crisp (same rendering as the standalone editor).
            transform: activeBoard === "tools" ? "none" : "translateX(100%)",
            transition: "transform 320ms ease",
            zIndex: 45,
          }}

        >
          <InteractiveBoard
            sectionId={current?.sectionId ?? "lesson"}
            sectionLabel={current?.sectionLabel || current?.caption || notebook?.title || "Lesson"}
            
            notebookId={notebookId}
            editable={isTeacher}
            zoom={zoom}
            onReturn={() => setActiveBoard("main")}
            palette={{
              chromeBg: palette.chromeBg,
              chromeFg: palette.chromeFg,
              chromeBorder: palette.chromeBorder,
              hoverBg: palette.hoverBg,
              accent: palette.accent,
            }}
          />
        </div>
      )}
      {syncEnabled && <SyncDiagnosticsPanel diagnostics={syncDiagnostics} />}
      </div>
      </SmartboardRootContext.Provider>

      {/* Headless Preview Channel runner — renders nothing. One preview
          click = one deterministic board write through the independent
          preview channel (never through the Floating Number path). */}
      <AiEditWorkspace
        open={mirrorActive}
        target={aiEditTarget}
        host={previewHost}
        onStatus={setMirrorStatus}
      />

      {/* 2D geometry needs nothing mounted here — the diagram itself carries the
          Lesson Note workbench (left tools | canvas | right tools) inside its
          floating card. Only the 3D / TVD workspace opens as a dialog. */}

      {isTeacher && editing3d && (
        <Workspace3DDialog
          open
          onOpenChange={(open) => { if (!open) setEditing3dId(null); }}
          initialScene={editing3d.scene}
          onExport={(scene: Scene3D) => {
            updateDiagram(editing3d.id, { scene });
            setEditing3dId(null);
          }}
        />
      )}

      {/* Mathematical Tables — the Lesson Note picker, inserting the generated
          table as a floating board object. */}
      {isTeacher && (
        <MathTablesPicker
          open={boardTablesOpen}
          onOpenChange={setBoardTablesOpen}
          onInsert={(attrs) => addBoardTable(attrs)}
        />
      )}

      {/* Calculator + Conversion — floating utility workspaces. They are used
          and closed; nothing merges into the page. */}
      {isTeacher && (calcFloat || convFloat) && (
        <div className="absolute inset-0" style={{ pointerEvents: "none", zIndex: 60 }}>
          {calcFloat && (
            <FloatingToolLayer
              title="Calculator"
              icon={<CalculatorIcon className="h-3 w-3" />}
              x={calcFloat.x}
              y={calcFloat.y}
              width={calcFloat.w}
              height={calcFloat.h}
              editable
              solidBody
              minWidth={300}
              minHeight={280}
              palette={{
                chromeBg: palette.chromeBg,
                chromeFg: palette.chromeFg,
                chromeBorder: palette.chromeBorder,
                hoverBg: palette.hoverBg,
                dark: isDark,
              }}
              onGeometry={(g) => setCalcFloat((c) => c && {
                x: g.x ?? c.x, y: g.y ?? c.y, w: g.width ?? c.w, h: g.height ?? c.h,
              })}
              onClose={() => setCalcFloat(null)}
            >
              <div className="p-2">
                <SmartCalculatorBody onInsertWorking={() => { /* board keeps working on the board */ }} />
              </div>
            </FloatingToolLayer>
          )}
          {convFloat && (
            <FloatingToolLayer
              title="Conversion"
              icon={<ArrowLeftRightIcon className="h-3 w-3" />}
              x={convFloat.x}
              y={convFloat.y}
              width={convFloat.w}
              height={convFloat.h}
              editable
              solidBody
              minWidth={360}
              minHeight={260}
              palette={{
                chromeBg: palette.chromeBg,
                chromeFg: palette.chromeFg,
                chromeBorder: palette.chromeBorder,
                hoverBg: palette.hoverBg,
                dark: isDark,
              }}
              onGeometry={(g) => setConvFloat((c) => c && {
                x: g.x ?? c.x, y: g.y ?? c.y, w: g.width ?? c.w, h: g.height ?? c.h,
              })}
              onClose={() => setConvFloat(null)}
            >
              <div className="p-3">
                <ConversionBody />
              </div>
            </FloatingToolLayer>
          )}
        </div>
      )}

    </div>
  );
};



/* ─────────────── Beat renderer ─────────────── */

const BeatBlock = ({
  beat, isCurrent, ink, placeholderColor, accent, jitter,
  notebookTitle, topic, subtopic, dateLabel, zoom = 1,
}: {
  beat: Beat;
  isCurrent: boolean;
  /** Board zoom — diagrams and objects scale with the writing. */
  zoom?: number;
  ink: string;
  placeholderColor: string;
  accent: string;
  jitter: number;
  notebookTitle?: string;
  topic?: string;
  subtopic?: string;
  dateLabel?: string;
}) => {
  const opacityClass = isCurrent ? "opacity-100" : "opacity-75";
  const revealClass = isCurrent ? "sb-writing-in" : "";

  // Session objects (Smart Table, chart, question diagram, 3D scene) render
  // with the session they belong to, at the line they were drawn beside —
  // every beat now flows text and objects together (FlowingTextAndObjects),
  // so a diagram can never be pushed to the bottom of its section.



  const FlowingTextAndObjects = ({ beat: b }: { beat: Beat }) => {
    const lines = String(b.content ?? "").split(/\r?\n/);
    const objects = sortByPlacement(b.objects ?? []);
    if (!objects.length) {
      return (
        <SmartboardLessonText jitter={jitter} seed={b.id.length} placeholderColor={placeholderColor}>
          {b.content}
        </SmartboardLessonText>
      );
    }
    const slots = new Map<number, typeof objects>();
    for (const object of objects) {
      const at = Math.max(0, Math.min(lines.length, Number.isFinite(object.afterLine) ? object.afterLine : lines.length));
      slots.set(at, [...(slots.get(at) ?? []), object]);
    }
    return (
      <div className="space-y-2">
        {Array.from({ length: lines.length + 1 }, (_, index) => (
          <div key={`${b.id}-flow-${index}`}>
            {(slots.get(index) ?? []).map((object) => (
              <div
                key={object.objId}
                className="lesson-doc sb-board-object my-7 w-full max-w-full"
                style={{ fontSize: `${zoom}rem` }}
              >
                <SolutionObjectView nodeType={object.nodeType} attrs={object.attrs ?? {}} presentation zoom={zoom} />
              </div>
            ))}
            {index < lines.length && lines[index].trim() && (
              <div>
                <SmartboardLessonText jitter={jitter} seed={b.id.length + index * 17} placeholderColor={placeholderColor}>
                  {lines[index]}
                </SmartboardLessonText>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };


  // Synthetic cover beat — title / topic / subtopic / date.
  if (beat.id === "__cover__") {
    return (
      <div data-sb-beat className={`transition-opacity duration-300 ${opacityClass} ${revealClass}`}>
        <div className="text-center" style={{ color: ink }}>
          <div className="text-xs uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            {dateLabel}
          </div>
          <div className="text-4xl md:text-5xl font-light leading-tight mb-3">
            <Inked jitter={jitter * 0.6} seed={1}>{sanitizePresentation(notebookTitle ?? beat.content ?? "")}</Inked>
          </div>
          {topic && (
            <div className="text-lg md:text-xl opacity-80 mb-1">
              <Inked jitter={jitter * 0.5} seed={2}>{sanitizePresentation(topic)}</Inked>
            </div>
          )}
          {subtopic && (
            <div className="text-sm md:text-base opacity-55">
              <Inked jitter={jitter * 0.5} seed={3}>{sanitizePresentation(subtopic)}</Inked>
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
          <FlowingTextAndObjects beat={beat} />
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
        {/* PLACEMENT LAW: the question's own objects interleave with its text
            at the line they were drawn beside — never piled beneath it. */}
        <div style={{ color: ink, fontSize: "1em" }}>
          <FlowingTextAndObjects beat={beat} />
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
          <SmartboardLessonText jitter={jitter * 0.6} seed={beat.id.length + 23} placeholderColor={placeholderColor}>
            {beat.content}
          </SmartboardLessonText>
        </span>
      </div>
      {beat.reasoning && (
        <div
          className="flex-none max-w-[40%] pt-2"
          style={{ color: accent, fontStyle: "italic", fontSize: "0.55em" }}
        >
          → <SmartboardLessonText jitter={jitter * 0.7} seed={beat.id.length + 1} placeholderColor={placeholderColor}>
            {beat.reasoning}
          </SmartboardLessonText>
        </div>
      )}
    </div>
  );
};

export default PresentationView;
