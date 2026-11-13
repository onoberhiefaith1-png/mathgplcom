import { describe, expect, it } from "vitest";
import { diffBoardState, type BoardState } from "@/hooks/useSmartboardSync";
import {
  CLASSROOM_ACADEMIA_SOURCE,
  CLASSROOM_WORKING_LIMIT,
  connectedAcademiaIds,
  emptyClassroomAcademia,
  gradeClassroomMcq,
  leaveSession,
  mergeBoardFrame,
  openClassroomQuestion,
  projectCatalog,
  questionPrompt,
  sameAcademiaProjection,
  selectAcademia,
  selectClass,
  selectClassroomAnswer,
  selectSession,
  selectSubject,
  selectTier,
  setClassroomWorking,
  showClassroomQuestion,
  showClassroomWorking,
  studentBoardFollow,
  visibleSubjects,
  workspaceAcademiaEntry,
  type ClassroomAcademiaCatalog,
  type ClassroomAcademiaState,
} from "@/lib/smartboard/classroomAcademia";

const lesson = (): BoardState => ({
  beatCursor: 1,
  bandExtra: {},
  freeLines: {},
  lineOffsets: {},
  smartLines: [],
  boxes: [],
  sensor: { line: 0, x: 0 },
  zoom: 1,
  surface: "whiteboard",
  profileId: "default",
  inkColorId: "ink",
  sourceNotebookId: "note-1",
  sourceFingerprint: "fp",
});

const catalog = (
  patch: Partial<ClassroomAcademiaCatalog> = {},
): ClassroomAcademiaCatalog => ({
  ready: true,
  academias: [{ id: "ac-1", name: "Riverside Academy" }],
  classes: [{ id: "class-1", name: "Year 8", academiaId: "ac-1" }],
  subjects: [
    { id: "sub-assigned", name: "Algebra", classId: "class-1" },
    { id: "sub-other", name: "Art", classId: "class-1" },
  ],
  topics: [{ id: "topic-1", name: "Equations", subjectId: "sub-assigned" }],
  subtopics: [{ id: "subtopic-1", name: "Linear", topicId: "topic-1" }],
  sessions: [{ id: "session-1", name: "Lesson 3", subtopicId: "subtopic-1" }],
  activities: [
    {
      id: "q1",
      title: "Solve 2x",
      kind: "question",
      tier: "beginner",
      sessionId: "session-1",
    },
    {
      id: "q2",
      title: "Harder",
      kind: "mcq",
      tier: "expert",
      sessionId: "session-1",
    },
  ],
  sessionTitle: "Lesson 3",
  ...patch,
});

const drilled = (): ClassroomAcademiaState => {
  const opened = selectAcademia(
    emptyClassroomAcademia(),
    "ac-1",
    "Riverside Academy",
  );
  const withClass = selectClass(opened, "class-1");
  const withSubject = selectSubject(withClass, "sub-assigned");
  return selectSession(
    { ...withSubject, topicId: "topic-1", subtopicId: "subtopic-1" },
    "session-1",
    "Lesson 3",
  );
};

describe("workspace Academia entry", () => {
  it("uses the school Academia inside a school workspace and connected academies everywhere else", () => {
    expect(workspaceAcademiaEntry("school")).toBe("school");
    expect(workspaceAcademiaEntry("teacher")).toBe("connected");
    expect(workspaceAcademiaEntry(null)).toBe("connected");
  });

  it("keeps subjects assigned to the teacher, including ones they did not author", () => {
    const subjects = [
      { id: "authored", name: "Mine" },
      { id: "assigned", name: "School algebra" },
      { id: "hidden", name: "Someone else's" },
    ];
    expect(
      visibleSubjects("school", subjects, ["assigned"]).map((row) => row.id),
    ).toEqual(["assigned"]);
    expect(
      visibleSubjects("connected", subjects, ["assigned"]).map((row) => row.id),
    ).toEqual(["authored", "assigned", "hidden"]);
  });

  it("lists every academia connected by membership or enrolment", () => {
    expect(
      connectedAcademiaIds({
        schoolOrgIds: ["org-school"],
        enrolledIds: ["ac-enrolled"],
        academias: [
          { id: "ac-school", orgId: "org-school" },
          { id: "ac-other", orgId: "org-elsewhere" },
          { id: "ac-enrolled", orgId: null },
        ],
      }),
    ).toEqual(["ac-school", "ac-enrolled"]);
  });
});

describe("classroom Academia navigation", () => {
  it("clears the levels under a class and publishes the visible columns", () => {
    const start = projectCatalog(drilled(), catalog());
    expect(start.subjectId).toBe("sub-assigned");
    const next = selectClass(start, "class-2");
    expect(next.classId).toBe("class-2");
    expect(next.subjectId).toBeNull();
    expect(next.sessionId).toBeNull();
    expect(start.classes.map((row) => row.name)).toEqual(["Year 8"]);
    expect(
      sameAcademiaProjection(start, projectCatalog(start, catalog())),
    ).toBe(true);
  });

  it("auto-opens the only connected academia and shows the selected tier's questions", () => {
    const projected = projectCatalog(
      {
        ...selectSession(
          selectClass(emptyClassroomAcademia(), "class-1"),
          "session-1",
          null,
        ),
        subjectId: "sub-assigned",
        topicId: "topic-1",
        subtopicId: "subtopic-1",
      },
      catalog(),
    );
    expect(projected.academiaId).toBe("ac-1");
    expect(projected.academiaName).toBe("Riverside Academy");
    expect(projected.activities.map((row) => row.id)).toEqual(["q1"]);
    const expert = projectCatalog(selectTier(projected, "expert"), catalog());
    expect(expert.question).toBeNull();
    expect(expert.activities.map((row) => row.id)).toEqual(["q2"]);
  });

  it("drops a class that is no longer in the catalog", () => {
    const projected = projectCatalog(drilled(), catalog({ classes: [] }));
    expect(projected.classId).toBeNull();
    expect(projected.sessionId).toBeNull();
  });

  it("leaves a session without forgetting the topic above it", () => {
    const left = leaveSession(drilled());
    expect(left.sessionId).toBeNull();
    expect(left.subtopicId).toBe("subtopic-1");
  });
});

describe("classroom solving snapshot", () => {
  const opened = () =>
    openClassroomQuestion(drilled(), {
      activityId: "mcq-1",
      title: "Paper",
      kind: "mcq",
      index: 0,
      total: 2,
      n: 1,
      prompt: "What is 2 + 2?",
      options: [
        { label: "A", text: "3" },
        { label: "B", text: "4" },
      ],
      correctLabel: "B",
    });

  it("hides the answer key until the teacher checks, and never records an attempt", () => {
    const open = opened();
    expect(open.question?.correctLabel).toBeNull();
    const picked = selectClassroomAnswer(open, 1, "B");
    expect(picked.work?.answers).toEqual({ "1": "B" });
    expect(picked.question?.correctLabel).toBeNull();
    const graded = gradeClassroomMcq(picked, [
      { n: 1, answer: "B" },
      { n: 2, answer: "A" },
    ]);
    expect(graded.recordsAttempt).toBe(false);
    expect(graded.state.work?.correct).toBe(true);
    expect(graded.state.work?.feedback).toBe("Correct");
    expect(graded.state.question?.correctLabel).toBe("B");
    const missed = gradeClassroomMcq(selectClassroomAnswer(open, 1, "A"), [
      { n: 1, answer: "B" },
    ]);
    expect(missed.recordsAttempt).toBe(false);
    expect(missed.state.work?.correct).toBe(false);
    expect(missed.state.work?.feedback).toBe("Not correct");
  });

  it("steps to the next question without carrying the previous working", () => {
    const next = showClassroomQuestion(
      selectClassroomAnswer(opened(), 1, "B"),
      1,
      {
        n: 2,
        prompt: "Next",
        options: [{ label: "A", text: "1" }],
      },
    );
    expect(next.question?.index).toBe(1);
    expect(next.question?.prompt).toBe("Next");
    expect(next.work?.answers).toEqual({});
    expect(next.question?.correctLabel).toBeNull();
  });

  it("mirrors written working and does not turn it into an evaluation", () => {
    const writing = setClassroomWorking(opened(), "2x = 4\nx = 2");
    expect(writing.work?.working).toBe("2x = 4\nx = 2");
    const shown = showClassroomWorking(writing);
    expect(shown.recordsAttempt).toBe(false);
    expect(shown.state.work?.feedback).toMatch(/not saved/i);
    expect(
      setClassroomWorking(writing, "y".repeat(CLASSROOM_WORKING_LIMIT + 50))
        .work?.working,
    ).toHaveLength(CLASSROOM_WORKING_LIMIT);
  });

  it("builds the question prompt from the activity design", () => {
    expect(
      questionPrompt({
        title: "Solve",
        question_design: { instruction: "Expand", math: "(x+1)^2" },
      }),
    ).toBe("Expand\n(x+1)^2\nSolve");
  });
});

describe("classroom Academia sync", () => {
  it("rides along in a board delta and survives a full frame that omits it", () => {
    const academia = selectAcademia(
      emptyClassroomAcademia(),
      "ac-1",
      "Riverside Academy",
    );
    const withAcademia: BoardState = {
      ...lesson(),
      boardSurface: "academia",
      academia,
    };
    expect(diffBoardState(lesson(), withAcademia)).toEqual({
      boardSurface: "academia",
      academia,
    });
    const studentFrame = lesson();
    const kept = mergeBoardFrame(withAcademia, studentFrame, true);
    expect(kept.academia?.academiaId).toBe("ac-1");
    expect(kept.boardSurface).toBe("academia");
    const closed = mergeBoardFrame(
      withAcademia,
      {
        ...lesson(),
        boardSurface: "lesson",
        academia: { ...academia, open: false },
      },
      true,
    );
    expect(closed.boardSurface).toBe("lesson");
    expect(closed.academia?.open).toBe(false);
  });

  it("sends a late joiner to Academia when that is the live surface, and to the lesson when Academia is open on a note", () => {
    expect(
      studentBoardFollow({
        notebookId: "stale-note",
        state: {
          boardSurface: "academia",
          sourceNotebookId: CLASSROOM_ACADEMIA_SOURCE,
          academia: { open: true },
        },
      }),
    ).toBe("academia");
    expect(
      studentBoardFollow({
        notebookId: "note-1",
        state: {
          boardSurface: "academia",
          sourceNotebookId: "note-1",
          academia: { open: true },
        },
      }),
    ).toBe("lesson");
    expect(studentBoardFollow({ notebookId: null, state: {} })).toBe("waiting");
  });
});
