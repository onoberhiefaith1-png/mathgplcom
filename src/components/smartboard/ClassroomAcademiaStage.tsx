/**
 * The teacher's workspace Academia, shown full-screen on the classroom
 * Smartboard. Students render the published snapshot and cannot drive it.
 * Solving here never calls the Academia evaluation writers.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Library, Loader2 } from "lucide-react";
import { Column } from "@/pages/academia/SchoolAcademiaPage";
import QuestionCardFace from "@/components/academia/QuestionCardFace";
import McqText from "@/components/academia/mcq/McqText";
import TierSwitcher from "@/components/academia/TierSwitcher";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import {
  academiaForWorkspace,
  loadAcademiaTree,
  loadSessionContext,
  loadSessions,
  myAcademias,
  mySubjectIds,
  type AcademiaActivity,
} from "@/lib/academia/api";
import { listSessionItems } from "@/lib/academia/mcq/api";
import { normalizeTier } from "@/lib/academia/tiers";
import { supabase } from "@/integrations/supabase/client";
import { useSmartboardSync } from "@/hooks/useSmartboardSync";
import {
  CLASSROOM_ACADEMIA_FINGERPRINT,
  CLASSROOM_ACADEMIA_SOURCE,
  closeClassroomQuestion,
  emptyClassroomAcademia,
  gradeClassroomMcq,
  leaveSession,
  openClassroomQuestion,
  projectCatalog,
  questionPrompt,
  sameAcademiaProjection,
  selectAcademia,
  selectClass,
  selectClassroomAnswer,
  selectSession,
  selectSubject,
  selectSubtopic,
  selectTier,
  selectTopic,
  setAcademiaScroll,
  setClassroomWorking,
  showClassroomQuestion,
  showClassroomWorking,
  visibleSubjects,
  workspaceAcademiaEntry,
  type ClassroomAcademiaCatalog,
  type ClassroomAcademiaState,
} from "@/lib/smartboard/classroomAcademia";

type McqKey = {
  n: number;
  answer: string | null;
  text: string;
  options: { label: string; text: string }[];
};

const blankBoard = {
  beatCursor: 0,
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
  sourceNotebookId: CLASSROOM_ACADEMIA_SOURCE,
  sourceFingerprint: CLASSROOM_ACADEMIA_FINGERPRINT,
  boardSurface: "academia" as const,
};

export function ClassroomAcademiaPanel({
  state,
  readOnly,
  busy = false,
  onChange,
  onOpenActivity,
  onCheck,
  onStep,
}: {
  state: ClassroomAcademiaState;
  readOnly: boolean;
  busy?: boolean;
  onChange?: (next: ClassroomAcademiaState) => void;
  onOpenActivity?: (activityId: string) => void;
  onCheck?: () => void;
  onStep?: (index: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !readOnly) return;
    if (Math.abs(el.scrollTop - state.scrollTop) > 20)
      el.scrollTop = state.scrollTop;
  }, [readOnly, state.scrollTop, state.sessionId, state.question?.index]);

  const emit = (next: ClassroomAcademiaState) => {
    if (!readOnly) onChange?.(next);
  };
  const path = [
    state.academiaName,
    state.classes.find((row) => row.id === state.classId)?.name,
    state.subjects.find((row) => row.id === state.subjectId)?.name,
    state.topics.find((row) => row.id === state.topicId)?.name,
    state.subtopics.find((row) => row.id === state.subtopicId)?.name,
    state.sessionTitle,
  ].filter(Boolean);

  const question = state.question;
  const work = state.work;
  const questionNumber = question ? question.index + 1 : 0;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-background text-foreground"
      data-testid="classroom-academia-panel"
      aria-readonly={readOnly}
    >
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        onScroll={
          readOnly
            ? undefined
            : (event) => {
                const next = setAcademiaScroll(
                  state,
                  event.currentTarget.scrollTop,
                );
                if (next !== state) emit(next);
              }
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Library className="h-4 w-4 text-primary" />
          <p
            className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
            data-testid="classroom-academia-path"
          >
            {path.length ? path.join("  ·  ") : "Academia"}
          </p>
          {readOnly && (
            <span className="text-xs font-medium text-muted-foreground">
              Following the teacher
            </span>
          )}
        </div>

        {busy && !state.classes.length && !question && (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening Academia…
          </p>
        )}

        {!busy && readOnly && !state.academiaId && !question && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Waiting for the teacher to open Academia.
          </p>
        )}

        {state.academias.length > 1 && !question && (
          <div
            className="mb-4 flex gap-2 overflow-x-auto pb-1"
            data-testid="classroom-academia-list"
          >
            {state.academias.map((academia) => (
              <button
                key={academia.id}
                type="button"
                disabled={readOnly}
                onClick={() =>
                  emit(selectAcademia(state, academia.id, academia.name))
                }
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm ${
                  state.academiaId === academia.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Academia
                </span>
                <span className="font-semibold">{academia.name}</span>
              </button>
            ))}
          </div>
        )}

        {question && work ? (
          <section
            className="mx-auto max-w-3xl space-y-4"
            data-testid="classroom-academia-question"
          >
            <button
              type="button"
              disabled={readOnly}
              onClick={() => emit(closeClassroomQuestion(state))}
              className="text-sm font-medium text-primary disabled:text-muted-foreground"
            >
              Back to {state.sessionTitle || "the session"}
            </button>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Question {questionNumber}
                {question.total > 1 ? ` of ${question.total}` : ""}
              </p>
              <TierSwitcher
                value={state.tier}
                disabled={readOnly}
                onChange={(tier) => emit(selectTier(state, tier))}
              />
            </div>
            {question.kind === "mcq" ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-lg font-medium leading-relaxed">
                  <McqText text={question.prompt} k="prompt" />
                </div>
                <div
                  className="mt-4 space-y-2"
                  role="radiogroup"
                  aria-label="Answers"
                >
                  {question.options.map((option) => {
                    const chosen =
                      work.answers[String(question.n)] === option.label;
                    const reveal = work.submitted && !!question.correctLabel;
                    const isCorrect =
                      reveal && option.label === question.correctLabel;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        disabled={readOnly}
                        onClick={() =>
                          emit(
                            selectClassroomAnswer(
                              state,
                              question.n,
                              option.label,
                            ),
                          )
                        }
                        className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left ${
                          isCorrect
                            ? "border-emerald-600 bg-emerald-50"
                            : chosen
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background"
                        }`}
                      >
                        <span className="font-bold">{option.label}</span>
                        <McqText text={option.text} k={option.label} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <QuestionCardFace
                number={questionNumber}
                title={question.prompt}
                size="hero"
              />
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Working
              </span>
              {readOnly ? (
                <pre
                  className="min-h-24 whitespace-pre-wrap rounded-xl border border-border bg-card p-3 text-sm"
                  data-testid="classroom-academia-working"
                >
                  {work.working ||
                    "The teacher has not written on this question yet."}
                </pre>
              ) : (
                <textarea
                  value={work.working}
                  onChange={(event) =>
                    emit(setClassroomWorking(state, event.target.value))
                  }
                  rows={5}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm"
                  placeholder="Write the working the class should follow"
                  data-testid="classroom-academia-working"
                />
              )}
            </label>
            {work.feedback && (
              <p
                role="status"
                data-testid="classroom-academia-feedback"
                className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  work.correct === true
                    ? "bg-emerald-50 text-emerald-800"
                    : work.correct === false
                      ? "bg-amber-50 text-amber-900"
                      : "bg-muted text-foreground"
                }`}
              >
                {work.feedback}
                {question.correctLabel ? `. Answer: ${question.correctLabel}.` : ""}
              </p>
            )}
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                {question.total > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={question.index === 0}
                      onClick={() => onStep?.(question.index - 1)}
                      className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={question.index + 1 >= question.total}
                      onClick={() => onStep?.(question.index + 1)}
                      className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onCheck?.()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {question.kind === "mcq" ? "Check answer" : "Show to class"}
                </button>
                <span className="text-xs text-muted-foreground">
                  Not saved to Academia evaluation.
                </span>
              </div>
            )}
          </section>
        ) : state.sessionId ? (
          <section
            className="space-y-4"
            data-testid="classroom-academia-session"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => emit(leaveSession(state))}
                className="text-sm font-medium text-primary disabled:text-muted-foreground"
              >
                Back to topics
              </button>
              <TierSwitcher
                value={state.tier}
                disabled={readOnly}
                onChange={(tier) => emit(selectTier(state, tier))}
              />
            </div>
            <h2 className="text-xl font-semibold">
              {state.sessionTitle || "Session"}
            </h2>
            {state.activities.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No {state.tier} questions in this session yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {state.activities.map((activity, index) => (
                  <button
                    key={activity.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onOpenActivity?.(activity.id)}
                    className="rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/50 disabled:hover:border-border"
                  >
                    <QuestionCardFace
                      number={index + 1}
                      title={activity.title}
                    />
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
                      {activity.kind === "mcq" ? "Multiple choice" : "Question"}
                    </p>
                    <p className="line-clamp-2 text-sm font-medium">
                      {activity.title}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            data-testid="classroom-academia-tree"
          >
            <Column
              title="Classes"
              items={state.classes}
              selected={state.classId}
              onSelect={
                readOnly ? undefined : (id) => emit(selectClass(state, id))
              }
              addLabel=""
              empty={
                state.academiaId ? "No classes yet." : "Choose an Academia."
              }
            />
            <Column
              title="Subjects"
              items={state.subjects}
              selected={state.subjectId}
              onSelect={
                readOnly ? undefined : (id) => emit(selectSubject(state, id))
              }
              addLabel=""
              empty={
                state.classId
                  ? "No subjects for you in this class."
                  : "Choose a class."
              }
            />
            <Column
              title="Topics"
              items={state.topics}
              selected={state.topicId}
              onSelect={
                readOnly ? undefined : (id) => emit(selectTopic(state, id))
              }
              addLabel=""
              empty={state.subjectId ? "No topics yet." : "Choose a subject."}
            />
            <Column
              title="Subtopics"
              items={state.subtopics}
              selected={state.subtopicId}
              onSelect={
                readOnly ? undefined : (id) => emit(selectSubtopic(state, id))
              }
              addLabel=""
              empty={state.topicId ? "No subtopics yet." : "Choose a topic."}
            />
            <Column
              title="Sessions"
              items={state.sessions}
              selected={state.sessionId}
              onSelect={
                readOnly
                  ? undefined
                  : (id) =>
                      emit(
                        selectSession(
                          state,
                          id,
                          state.sessions.find((row) => row.id === id)?.name ??
                            null,
                        ),
                      )
              }
              addLabel=""
              empty={
                state.subtopicId ? "No sessions yet." : "Choose a subtopic."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function useClassroomCatalog(
  active: boolean,
  state: ClassroomAcademiaState,
): { catalog: ClassroomAcademiaCatalog; loading: boolean } {
  const { active: workspace, activeOrgId, isLoading } = useWorkspace();
  const entry = workspaceAcademiaEntry(workspace?.kind);
  const school = entry === "school";
  const orgQ = useQuery({
    queryKey: ["classroom-academia-org", activeOrgId],
    enabled: active && school && !!activeOrgId && !isLoading,
    queryFn: () => academiaForWorkspace(activeOrgId!, false),
  });
  const connectedQ = useQuery({
    queryKey: ["classroom-academia-connected"],
    enabled: active && !school && !isLoading,
    queryFn: myAcademias,
  });
  const mineQ = useQuery({
    queryKey: ["classroom-academia-assigned"],
    enabled: active && school,
    queryFn: mySubjectIds,
  });
  const academias = useMemo(
    () =>
      school
        ? orgQ.data
          ? [{ id: orgQ.data.id, name: orgQ.data.name }]
          : []
        : (connectedQ.data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
          })),
    [school, orgQ.data, connectedQ.data],
  );
  const academiaId =
    state.academiaId ?? (academias.length === 1 ? academias[0].id : null);
  const treeQ = useQuery({
    queryKey: ["academia-tree", academiaId],
    enabled: active && !!academiaId,
    queryFn: () => loadAcademiaTree(academiaId!),
  });
  const sessionsQ = useQuery({
    queryKey: ["academia-sessions", state.subtopicId],
    enabled: active && !!state.subtopicId,
    queryFn: () => loadSessions(state.subtopicId!),
  });
  const sessionQ = useQuery({
    queryKey: ["academia-session", state.sessionId],
    enabled: active && !!state.sessionId,
    queryFn: () => loadSessionContext(state.sessionId!),
  });

  const catalog = useMemo<ClassroomAcademiaCatalog>(() => {
    const tree = treeQ.data;
    const assigned = mineQ.data ?? [];
    const subjects = visibleSubjects(entry, tree?.subjects ?? [], assigned);
    const ready =
      active &&
      !isLoading &&
      (school ? orgQ.isFetched && mineQ.isFetched : connectedQ.isFetched) &&
      (!academiaId || treeQ.isFetched) &&
      (!state.subtopicId || sessionsQ.isFetched) &&
      (!state.sessionId || sessionQ.isFetched);
    const activities = (
      (sessionQ.data?.activities ?? []) as AcademiaActivity[]
    ).map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      tier: normalizeTier(row.tier),
      sessionId: row.session_id,
    }));
    return {
      ready,
      academias,
      classes: (tree?.classes ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        academiaId: row.academia_id,
      })),
      subjects: subjects.map((row) => ({
        id: row.id,
        name: row.name,
        classId: row.class_id,
      })),
      topics: (tree?.topics ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        subjectId: row.subject_id,
      })),
      subtopics: (tree?.subtopics ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        topicId: row.topic_id,
      })),
      sessions: (sessionsQ.data ?? []).map((row) => ({
        id: row.id,
        name: row.title,
        subtopicId: row.subtopic_id,
      })),
      activities,
      sessionTitle: sessionQ.data?.session.title ?? null,
    };
  }, [
    active,
    isLoading,
    school,
    entry,
    orgQ.isFetched,
    connectedQ.isFetched,
    mineQ.isFetched,
    mineQ.data,
    academiaId,
    treeQ.isFetched,
    treeQ.data,
    state.subtopicId,
    state.sessionId,
    sessionsQ.isFetched,
    sessionsQ.data,
    sessionQ.isFetched,
    sessionQ.data,
    academias,
  ]);

  const loading =
    active &&
    (isLoading ||
      (school ? orgQ.isLoading || mineQ.isLoading : connectedQ.isLoading) ||
      treeQ.isLoading);
  return { catalog, loading };
}

export function ClassroomAcademiaStage({
  readOnly,
  state,
  onChange,
}: {
  readOnly: boolean;
  state: ClassroomAcademiaState;
  onChange?: (next: ClassroomAcademiaState) => void;
}) {
  const { catalog, loading } = useClassroomCatalog(!readOnly, state);
  const keys = useRef<Record<string, McqKey[]>>({});
  const activities = useRef<AcademiaActivity[]>([]);
  const sessionQ = useQuery({
    queryKey: ["academia-session", state.sessionId],
    enabled: !readOnly && !!state.sessionId,
    queryFn: () => loadSessionContext(state.sessionId!),
  });
  activities.current = (sessionQ.data?.activities ?? []) as AcademiaActivity[];

  useEffect(() => {
    if (readOnly || !onChange) return;
    const next = projectCatalog(state, catalog);
    if (!sameAcademiaProjection(state, next)) onChange(next);
  }, [readOnly, onChange, catalog, state]);

  const openActivity = async (activityId: string) => {
    if (!onChange) return;
    const activity =
      activities.current.find((row) => row.id === activityId) ??
      state.activities.find((row) => row.id === activityId);
    if (!activity) return;
    if (activity.kind === "mcq") {
      let items: McqKey[] = [];
      try {
        items = (await listSessionItems(activityId)).map((item) => ({
          n: item.n,
          answer: item.answer,
          text: item.text,
          options: item.options ?? [],
        }));
      } catch {
        items = [];
      }
      keys.current[activityId] = items;
      const first = items[0];
      onChange(
        openClassroomQuestion(state, {
          activityId,
          title: activity.title,
          kind: "mcq",
          index: 0,
          total: Math.max(1, items.length),
          n: first?.n ?? 1,
          prompt: first?.text || activity.title,
          options: first?.options ?? [],
          correctLabel: null,
        }),
      );
      return;
    }
    const design = (
      activity as AcademiaActivity & {
        question_design?: {
          instruction?: string | null;
          math?: string | null;
        } | null;
      }
    ).question_design;
    onChange(
      openClassroomQuestion(state, {
        activityId,
        title: activity.title,
        kind: activity.kind,
        index: 0,
        total: 1,
        n: 1,
        prompt: questionPrompt({
          title: activity.title,
          question_design: design,
        }),
        options: [],
        correctLabel: null,
      }),
    );
  };

  const step = (index: number) => {
    if (!onChange || !state.question) return;
    const items = keys.current[state.question.activityId] ?? [];
    const item = items[index];
    if (!item) return;
    onChange(
      showClassroomQuestion(state, index, {
        n: item.n,
        prompt: item.text,
        options: item.options,
      }),
    );
  };

  const check = () => {
    if (!onChange || !state.question) return;
    if (state.question.kind === "mcq") {
      const items = keys.current[state.question.activityId] ?? [];
      const graded = gradeClassroomMcq(
        state,
        items.map((item) => ({ n: item.n, answer: item.answer })),
      );
      onChange(graded.state);
      return;
    }
    onChange(showClassroomWorking(state).state);
  };

  return (
    <ClassroomAcademiaPanel
      state={state}
      readOnly={readOnly}
      busy={loading && !readOnly}
      onChange={onChange}
      onOpenActivity={(id) => {
        void openActivity(id);
      }}
      onCheck={check}
      onStep={step}
    />
  );
}

/** Academia with no lesson note open. Uses the classroom board channel. */
export function ClassroomAcademiaHost({
  classId,
  role,
}: {
  classId: string;
  role: "teacher" | "student";
}) {
  const teacher = role === "teacher";
  const [state, setState] = useState<ClassroomAcademiaState>(() => ({
    ...emptyClassroomAcademia(),
    open: true,
  }));
  const { incoming, pushSnapshot, selfId } = useSmartboardSync({
    classId,
    notebookId: CLASSROOM_ACADEMIA_SOURCE,
    sourceFingerprint: CLASSROOM_ACADEMIA_FINGERPRINT,
    role,
  });

  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    void (async () => {
      await supabase
        .from("classes")
        .update({ smartboard_visibility: "student_access_enabled" })
        .eq("id", classId);
      if (cancelled) return;
      await supabase.from("class_smartboard_state").upsert(
        {
          class_id: classId,
          notebook_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "class_id" },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, teacher]);

  useEffect(() => {
    if (teacher || !incoming?.academia) return;
    if (incoming.author && selfId && incoming.author === selfId) return;
    setState(incoming.academia);
  }, [teacher, incoming, selfId]);

  useEffect(() => {
    if (!teacher) return;
    pushSnapshot({ ...blankBoard, academia: state });
  }, [teacher, state, pushSnapshot]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="classroom-academia-host"
    >
      <ClassroomAcademiaStage
        readOnly={!teacher}
        state={state}
        onChange={teacher ? setState : undefined}
      />
    </div>
  );
}

export default ClassroomAcademiaStage;
