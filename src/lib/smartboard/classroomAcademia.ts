/**
 * Live-classroom Academia on the Smartboard.
 *
 * The teacher opens the same Academia they would see in their workspace:
 * a school workspace shows that school's Academia (subjects assigned to them,
 * which is wider than work they personally authored); every other workspace
 * shows the academies connected to the account (school memberships and
 * enrolments). Students render the snapshot the teacher publishes. They never
 * drive it, and a classroom demonstration does not write Academia evaluation.
 */
import { markPaper, statusOf, type McqQuestion } from "@/lib/academia/mcq/core";
import { DEFAULT_TIER, isTier, type AcademiaTier } from "@/lib/academia/tiers";

export type ClassroomBoardSurface = "lesson" | "notes" | "academia";

/** Identity used when Academia is open and no lesson note is on the board. */
export const CLASSROOM_ACADEMIA_SOURCE = "__classroom_academia__";
export const CLASSROOM_ACADEMIA_FINGERPRINT = "academia-v1";

export const CLASSROOM_WORKING_LIMIT = 4000;
export const CLASSROOM_PROMPT_LIMIT = 2000;

export type NamedRef = { id: string; name: string };

export type ClassroomAcademiaQuestion = {
  activityId: string;
  title: string;
  kind: string;
  /** Position in the activity, starting at 0. */
  index: number;
  total: number;
  /** Paper question number used as the answer key. */
  n: number;
  prompt: string;
  options: { label: string; text: string }[];
  /** Set only after the teacher checks, so the class cannot see the key early. */
  correctLabel: string | null;
};

export type ClassroomAcademiaWork = {
  activityId: string;
  questionIndex: number;
  /** Question number → chosen option label. */
  answers: Record<string, string>;
  submitted: boolean;
  correct: boolean | null;
  feedback: string | null;
  working: string;
};

export type ClassroomAcademiaState = {
  open: boolean;
  academiaId: string | null;
  academiaName: string | null;
  academias: NamedRef[];
  classId: string | null;
  subjectId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  tier: AcademiaTier;
  classes: NamedRef[];
  subjects: NamedRef[];
  topics: NamedRef[];
  subtopics: NamedRef[];
  sessions: NamedRef[];
  activities: { id: string; title: string; kind: string; tier: AcademiaTier }[];
  scrollTop: number;
  question: ClassroomAcademiaQuestion | null;
  work: ClassroomAcademiaWork | null;
};

export type ClassroomAcademiaCatalog = {
  ready: boolean;
  academias: NamedRef[];
  classes: Array<NamedRef & { academiaId: string }>;
  subjects: Array<NamedRef & { classId: string }>;
  topics: Array<NamedRef & { subjectId: string }>;
  subtopics: Array<NamedRef & { topicId: string }>;
  sessions: Array<NamedRef & { subtopicId: string }>;
  activities: Array<{
    id: string;
    title: string;
    kind: string;
    tier: AcademiaTier;
    sessionId: string;
  }>;
  sessionTitle: string | null;
};

/** School workspace → that school's Academia. Otherwise the connected list. */
export type WorkspaceAcademiaEntry = "school" | "connected";

export function workspaceAcademiaEntry(
  activeKind: string | null | undefined,
): WorkspaceAcademiaEntry {
  return activeKind === "school" ? "school" : "connected";
}

/**
 * Subjects the teacher sees. A school workspace keeps the subjects assigned
 * to them (not an "authored by me" filter). A connected workspace shows every
 * subject in the academia they opened.
 */
export function visibleSubjects<T extends { id: string }>(
  entry: WorkspaceAcademiaEntry,
  subjects: readonly T[],
  assignedIds: readonly string[],
): T[] {
  if (entry === "connected") return [...subjects];
  const mine = new Set(assignedIds);
  return subjects.filter((subject) => mine.has(subject.id));
}

/**
 * Academies connected to a workspace: every academia of a school the person
 * belongs to, plus any academia they enrolled. Ownership is not required.
 */
export function connectedAcademiaIds(input: {
  schoolOrgIds: readonly string[];
  enrolledIds: readonly string[];
  academias: readonly { id: string; orgId: string | null }[];
}): string[] {
  const orgs = new Set(input.schoolOrgIds);
  const ids = input.academias
    .filter((row) => row.orgId != null && orgs.has(row.orgId))
    .map((row) => row.id);
  for (const id of input.enrolledIds) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

const clip = (value: string, limit: number) =>
  value.length > limit ? value.slice(0, limit) : value;

export function emptyClassroomAcademia(): ClassroomAcademiaState {
  return {
    open: false,
    academiaId: null,
    academiaName: null,
    academias: [],
    classId: null,
    subjectId: null,
    topicId: null,
    subtopicId: null,
    sessionId: null,
    sessionTitle: null,
    tier: DEFAULT_TIER,
    classes: [],
    subjects: [],
    topics: [],
    subtopics: [],
    sessions: [],
    activities: [],
    scrollTop: 0,
    question: null,
    work: null,
  };
}

const clearedWork = (
  state: ClassroomAcademiaState,
): ClassroomAcademiaState => ({
  ...state,
  sessionId: null,
  sessionTitle: null,
  activities: [],
  question: null,
  work: null,
  scrollTop: 0,
});

export function selectAcademia(
  state: ClassroomAcademiaState,
  academiaId: string,
  name: string | null,
): ClassroomAcademiaState {
  if (state.academiaId === academiaId)
    return { ...state, academiaName: name ?? state.academiaName, open: true };
  return {
    ...clearedWork(state),
    open: true,
    academiaId,
    academiaName: name,
    classId: null,
    subjectId: null,
    topicId: null,
    subtopicId: null,
    subjects: [],
    topics: [],
    subtopics: [],
    sessions: [],
  };
}

export function selectClass(
  state: ClassroomAcademiaState,
  classId: string,
): ClassroomAcademiaState {
  if (state.classId === classId) return state;
  return {
    ...clearedWork(state),
    classId,
    subjectId: null,
    topicId: null,
    subtopicId: null,
    topics: [],
    subtopics: [],
    sessions: [],
  };
}

export function selectSubject(
  state: ClassroomAcademiaState,
  subjectId: string,
): ClassroomAcademiaState {
  if (state.subjectId === subjectId) return state;
  return {
    ...clearedWork(state),
    subjectId,
    topicId: null,
    subtopicId: null,
    subtopics: [],
    sessions: [],
  };
}

export function selectTopic(
  state: ClassroomAcademiaState,
  topicId: string,
): ClassroomAcademiaState {
  if (state.topicId === topicId) return state;
  return { ...clearedWork(state), topicId, subtopicId: null, sessions: [] };
}

export function selectSubtopic(
  state: ClassroomAcademiaState,
  subtopicId: string,
): ClassroomAcademiaState {
  if (state.subtopicId === subtopicId) return state;
  return { ...clearedWork(state), subtopicId, sessions: [] };
}

export function selectSession(
  state: ClassroomAcademiaState,
  sessionId: string,
  title: string | null,
): ClassroomAcademiaState {
  if (state.sessionId === sessionId)
    return { ...state, sessionTitle: title ?? state.sessionTitle };
  return {
    ...state,
    sessionId,
    sessionTitle: title,
    question: null,
    work: null,
    scrollTop: 0,
  };
}

export function leaveSession(
  state: ClassroomAcademiaState,
): ClassroomAcademiaState {
  return {
    ...state,
    sessionId: null,
    sessionTitle: null,
    activities: [],
    question: null,
    work: null,
    scrollTop: 0,
  };
}

/** A tier change shows that tier's questions and leaves the previous solution. */
export function selectTier(
  state: ClassroomAcademiaState,
  tier: AcademiaTier,
): ClassroomAcademiaState {
  if (state.tier === tier) return state;
  return { ...state, tier, question: null, work: null, scrollTop: 0 };
}

export function setAcademiaScroll(
  state: ClassroomAcademiaState,
  scrollTop: number,
): ClassroomAcademiaState {
  const next = Math.max(0, Math.round(scrollTop / 16) * 16);
  if (next === state.scrollTop) return state;
  return { ...state, scrollTop: next };
}

export function questionPrompt(activity: {
  title: string;
  question_design?: {
    instruction?: string | null;
    math?: string | null;
  } | null;
}): string {
  const design = activity.question_design;
  const parts = [design?.instruction, design?.math, activity.title]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  return clip([...new Set(parts)].join("\n"), CLASSROOM_PROMPT_LIMIT);
}

const blankWork = (
  activityId: string,
  questionIndex: number,
): ClassroomAcademiaWork => ({
  activityId,
  questionIndex,
  answers: {},
  submitted: false,
  correct: null,
  feedback: null,
  working: "",
});

export function openClassroomQuestion(
  state: ClassroomAcademiaState,
  question: ClassroomAcademiaQuestion,
): ClassroomAcademiaState {
  const next = {
    ...question,
    prompt: clip(question.prompt, CLASSROOM_PROMPT_LIMIT),
    correctLabel: null,
  };
  return {
    ...state,
    question: next,
    work: blankWork(next.activityId, next.index),
    scrollTop: 0,
  };
}

export function showClassroomQuestion(
  state: ClassroomAcademiaState,
  index: number,
  face: {
    n: number;
    prompt: string;
    options: ClassroomAcademiaQuestion["options"];
  },
): ClassroomAcademiaState {
  if (!state.question) return state;
  const total = state.question.total;
  const clamped = Math.max(0, Math.min(index, Math.max(0, total - 1)));
  return {
    ...state,
    question: {
      ...state.question,
      index: clamped,
      n: face.n,
      prompt: clip(face.prompt, CLASSROOM_PROMPT_LIMIT),
      options: face.options,
      correctLabel: null,
    },
    work: blankWork(state.question.activityId, clamped),
    scrollTop: 0,
  };
}

export function closeClassroomQuestion(
  state: ClassroomAcademiaState,
): ClassroomAcademiaState {
  return { ...state, question: null, work: null, scrollTop: 0 };
}

export function selectClassroomAnswer(
  state: ClassroomAcademiaState,
  questionNumber: number,
  label: string,
): ClassroomAcademiaState {
  if (!state.question || !state.work) return state;
  return {
    ...state,
    question: { ...state.question, correctLabel: null },
    work: {
      ...state.work,
      answers: { ...state.work.answers, [String(questionNumber)]: label },
      submitted: false,
      correct: null,
      feedback: null,
    },
  };
}

export function setClassroomWorking(
  state: ClassroomAcademiaState,
  working: string,
): ClassroomAcademiaState {
  if (!state.work) return state;
  const next = clip(working, CLASSROOM_WORKING_LIMIT);
  if (next === state.work.working) return state;
  return { ...state, work: { ...state.work, working: next } };
}

export type ClassroomGrade = {
  state: ClassroomAcademiaState;
  /** Classroom demonstration never writes academia_attempts or tier scores. */
  recordsAttempt: false;
};

/**
 * Mark the question the class is looking at. The correct option is added to
 * the snapshot only as part of the result. Nothing is written to evaluation.
 */
export function gradeClassroomMcq(
  state: ClassroomAcademiaState,
  questions: readonly Pick<McqQuestion, "n" | "answer">[],
): ClassroomGrade {
  const unchanged = { state, recordsAttempt: false as const };
  if (!state.question || !state.work) return unchanged;
  const current = questions[state.question.index];
  if (!current) {
    return {
      recordsAttempt: false,
      state: {
        ...state,
        work: {
          ...state.work,
          submitted: true,
          correct: null,
          feedback: "This question is not available.",
        },
      },
    };
  }
  const picked = state.work.answers[String(current.n)] ?? "";
  if (!picked) {
    return {
      recordsAttempt: false,
      state: {
        ...state,
        work: {
          ...state.work,
          submitted: false,
          correct: null,
          feedback: "Choose an answer first.",
        },
      },
    };
  }
  const paperQuestion: McqQuestion = {
    n: current.n,
    text: "",
    options: [],
    answer: current.answer,
  };
  const answers = { [current.n]: picked };
  // Same marker the Academia session uses. The result stays in the live
  // snapshot; it is not written to academia_attempts.
  const marked = markPaper([paperQuestion], answers);
  const correct =
    statusOf(paperQuestion, answers) === "correct" && marked.correct === 1;
  return {
    recordsAttempt: false,
    state: {
      ...state,
      question: { ...state.question, correctLabel: current.answer },
      work: {
        ...state.work,
        submitted: true,
        correct,
        feedback: correct ? "Correct" : "Not correct",
      },
    },
  };
}

/** Written working is shown to the class and is not an evaluation attempt. */
export function showClassroomWorking(
  state: ClassroomAcademiaState,
): ClassroomGrade {
  if (!state.work) return { state, recordsAttempt: false };
  const text = state.work.working.trim();
  return {
    recordsAttempt: false,
    state: {
      ...state,
      work: {
        ...state.work,
        submitted: true,
        correct: null,
        feedback: text
          ? "Shown to the class. This demonstration is not saved to anyone's Academia evaluation."
          : "Write the working first. Nothing is saved to Academia evaluation.",
      },
    },
  };
}

const namesOf = (rows: readonly { id: string; name: string }[]): NamedRef[] =>
  rows.map((row) => ({ id: row.id, name: row.name }));

export function projectCatalog(
  state: ClassroomAcademiaState,
  catalog: ClassroomAcademiaCatalog,
): ClassroomAcademiaState {
  if (!catalog.ready) return state;
  let next = state.open ? state : { ...state, open: true };
  // One academia on the workspace opens immediately. Filling its id must not
  // throw away a class the teacher has already picked.
  if (!next.academiaId && catalog.academias.length === 1) {
    next = {
      ...next,
      open: true,
      academiaId: catalog.academias[0].id,
      academiaName: catalog.academias[0].name,
    };
  }
  const academiaId = next.academiaId;
  const classes = catalog.classes.filter(
    (row) => row.academiaId === academiaId,
  );
  if (next.classId && !classes.some((row) => row.id === next.classId)) {
    next = { ...selectClass(next, ""), classId: null };
  }
  const subjects = catalog.subjects.filter(
    (row) => row.classId === next.classId,
  );
  if (next.subjectId && !subjects.some((row) => row.id === next.subjectId)) {
    next = { ...selectSubject(next, ""), subjectId: null };
  }
  const topics = catalog.topics.filter(
    (row) => row.subjectId === next.subjectId,
  );
  if (next.topicId && !topics.some((row) => row.id === next.topicId)) {
    next = { ...selectTopic(next, ""), topicId: null };
  }
  const subtopics = catalog.subtopics.filter(
    (row) => row.topicId === next.topicId,
  );
  if (next.subtopicId && !subtopics.some((row) => row.id === next.subtopicId)) {
    next = { ...selectSubtopic(next, ""), subtopicId: null };
  }
  const sessions = catalog.sessions.filter(
    (row) => row.subtopicId === next.subtopicId,
  );
  if (
    next.sessionId &&
    sessions.length > 0 &&
    !sessions.some((row) => row.id === next.sessionId)
  ) {
    next = leaveSession(next);
  }
  const tier = isTier(next.tier) ? next.tier : DEFAULT_TIER;
  const activities = catalog.activities
    .filter((row) => row.sessionId === next.sessionId && row.tier === tier)
    .map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      tier: row.tier,
    }));
  const academiaName =
    catalog.academias.find((row) => row.id === academiaId)?.name ??
    next.academiaName;
  const sessionTitle = next.sessionId
    ? (sessions.find((row) => row.id === next.sessionId)?.name ??
      catalog.sessionTitle ??
      next.sessionTitle)
    : null;
  return {
    ...next,
    open: true,
    academiaName,
    academias: namesOf(catalog.academias),
    classes: namesOf(classes),
    subjects: namesOf(subjects),
    topics: namesOf(topics),
    subtopics: namesOf(subtopics),
    sessions: namesOf(sessions),
    sessionTitle,
    tier,
    activities,
  };
}

const projectionKey = (state: ClassroomAcademiaState) =>
  JSON.stringify({
    open: state.open,
    academiaId: state.academiaId,
    academiaName: state.academiaName,
    academias: state.academias,
    classId: state.classId,
    subjectId: state.subjectId,
    topicId: state.topicId,
    subtopicId: state.subtopicId,
    sessionId: state.sessionId,
    sessionTitle: state.sessionTitle,
    tier: state.tier,
    classes: state.classes,
    subjects: state.subjects,
    topics: state.topics,
    subtopics: state.subtopics,
    sessions: state.sessions,
    activities: state.activities,
  });

export function sameAcademiaProjection(
  a: ClassroomAcademiaState,
  b: ClassroomAcademiaState,
): boolean {
  return projectionKey(a) === projectionKey(b);
}

/**
 * Full frames from a student (who does not publish Academia) must not wipe the
 * teacher's Academia snapshot. A frame that includes the keys still wins.
 */
const KEEP_WHEN_FULL_OMITS = ["academia", "boardSurface"] as const;

export function mergeBoardFrame<T extends Record<string, unknown>>(
  base: T | null,
  patch: Partial<T>,
  full: boolean,
): T {
  const merged = { ...(full ? {} : (base ?? {})), ...patch } as T;
  if (full && base) {
    for (const key of KEEP_WHEN_FULL_OMITS) {
      if (!(key in patch) && key in base) {
        (merged as Record<string, unknown>)[key] = base[key];
      }
    }
  }
  return merged;
}

/** Which screen a student Smartboard should open from the durable row. */
export function studentBoardFollow(row: {
  notebookId: string | null;
  state: unknown;
}): "academia" | "lesson" | "waiting" {
  const snap =
    row.state && typeof row.state === "object"
      ? (row.state as {
          boardSurface?: string;
          sourceNotebookId?: string | null;
          academia?: { open?: boolean } | null;
        })
      : null;
  const academiaOnly =
    snap?.boardSurface === "academia" &&
    snap.academia?.open === true &&
    snap.sourceNotebookId === CLASSROOM_ACADEMIA_SOURCE;
  if (academiaOnly) return "academia";
  if (row.notebookId) return "lesson";
  return "waiting";
}
