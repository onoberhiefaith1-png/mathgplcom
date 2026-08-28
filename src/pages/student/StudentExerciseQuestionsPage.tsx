// Student — the questions inside one Exercise Card.
//
// Student-only surface: the question list and the student's own marks. No
// Testing Ground, no Evaluation panel, no teacher controls. Selecting a
// question opens the SAME solving board students use for assignments.

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, ClipboardList, Loader2, MonitorPlay } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findCourseExerciseAssessment, exerciseTally, type ExerciseBoard } from "@/lib/courses/exerciseBoard";
import { markCourseProgress } from "@/lib/courses/classCourses";
import { loadCardVideoFlags } from "@/lib/courses/questionVideoStore";

type BlockMeta = { name: string; passMark: number };

const db = supabase as unknown as { from: (t: string) => any };

const StudentExerciseQuestionsPage = () => {
  const { classId, courseId, blockId } = useParams<{ classId: string; courseId: string; blockId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<ExerciseBoard | null>(null);
  const [meta, setMeta] = useState<BlockMeta>({ name: "Exercise", passMark: 80 });
  const [earned, setEarned] = useState<Record<string, number>>({});
  const [withVideo, setWithVideo] = useState<Set<string>>(new Set());

  const listPath = `/student/class/${classId}/courses/${courseId}/exercise/${blockId}`;

  const load = useCallback(async () => {
    if (!classId || !courseId || !blockId) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate(`/auth?redirect=${encodeURIComponent(listPath)}`);
      return;
    }
    const uid = userData.user.id;

    const { data: membership } = await supabase
      .from("class_members")
      .select("class_id")
      .eq("class_id", classId)
      .eq("user_id", uid)
      .maybeSingle();
    if (!membership) {
      navigate("/join");
      return;
    }

    const [{ data: block }, prepared] = await Promise.all([
      db.from("course_blocks").select("config").eq("id", blockId).maybeSingle(),
      findCourseExerciseAssessment(classId, blockId),
    ]);
    const config = (block as { config?: any } | null)?.config ?? {};
    setMeta({ name: String(config.name ?? "Exercise"), passMark: Number(config.passMark ?? 80) });
    setBoard(prepared);
    // Which questions carry an interactive teaching video.
    void loadCardVideoFlags(blockId).then(setWithVideo).catch(() => {});

    if (prepared) {
      // The marking engine stores every earned line as `${questionId}:${lineId}`
      // in assessment_progress.solved_lines — the student's own row.
      const { data: prog } = await db
        .from("assessment_progress")
        .select("solved_lines")
        .eq("assessment_id", prepared.assessmentId)
        .eq("student_id", uid)
        .maybeSingle();
      const solved = ((prog as { solved_lines?: Record<string, number> } | null)?.solved_lines ?? {});
      const map: Record<string, number> = {};
      for (const [key, marks] of Object.entries(solved)) {
        const qid = key.split(":")[0];
        if (!qid) continue;
        map[qid] = (map[qid] ?? 0) + (Number(marks) || 0);
      }
      setEarned(map);
    }
    setLoading(false);
  }, [classId, courseId, blockId, navigate, listPath]);

  useEffect(() => { void load(); }, [load]);

  const tally = exerciseTally({
    questions: board?.questions ?? [],
    earnedByQuestion: earned,
    passMark: meta.passMark,
  });

  // Reaching the pass mark keeps the existing pathway progress moving.
  useEffect(() => {
    if (!classId || !courseId || !tally.passed) return;
    void markCourseProgress({ classId, courseId, status: "in_progress", progress: 60 }).catch(() => {});
  }, [classId, courseId, tally.passed]);

  const open = (questionId: string) => {
    if (!board) return;
    navigate(
      `/student/class/${classId}/assessment/${board.assessmentId}?q=${encodeURIComponent(questionId)}&source=course&block=${encodeURIComponent(blockId ?? "")}&returnTo=${encodeURIComponent(listPath)}`,
    );
  };

  const pct = tally.total > 0 ? Math.round((tally.earned / tally.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b border-border/60 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6 sm:px-6">
          <Link
            to={`/student/class/${classId}/courses/${courseId}`}
            className="inline-flex min-h-[40px] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to course
          </Link>

          <h1 className="mt-3 inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" /> {meta.name}
          </h1>

          {!loading && board && board.questions.length > 0 && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{board.questions.length} question{board.questions.length === 1 ? "" : "s"}</span>
                <span className="tabular-nums">{tally.earned}/{tally.total} marks</span>
                <span>pass {meta.passMark}%</span>
                {tally.passed && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600">
                    Passed
                  </span>
                )}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
          </div>
        ) : !board || board.questions.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            This exercise isn't ready yet. Your teacher still has to prepare its questions.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {board.questions.map((q, i) => {
              const score = earned[q.id];
              const attempted = score !== undefined;
              const full = attempted && score >= q.marks;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => open(q.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
                          full
                            ? "bg-emerald-500/15 text-emerald-600"
                            : attempted
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {full ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">Question {i + 1}</span>
                        <span className="block text-xs text-muted-foreground">
                          {q.marks} marks
                          {withVideo.has(q.id) ? (
                            <span className="ml-2 inline-flex items-center gap-1 font-medium text-primary">
                              <MonitorPlay className="h-3 w-3" /> teaching video
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold">
                      {attempted ? (
                        <span className={full ? "text-emerald-600" : "text-primary"}>
                          {score}/{q.marks}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Start →</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

};

export default StudentExerciseQuestionsPage;
