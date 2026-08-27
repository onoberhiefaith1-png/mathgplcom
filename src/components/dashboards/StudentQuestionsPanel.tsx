import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  answerAssessmentQuestion,
  listAssessmentQuestions,
} from "@/lib/assessments/studentQuestions.functions";
import {
  sortForTeacher,
  unansweredCount,
  type AssessmentStudentQuestion,
} from "@/lib/assessments/studentQuestions";

/**
 * Student Questions for the assessment cards on this dashboard. Every question
 * shows who asked it and which question of the assignment it belongs to; the
 * teacher's answer stays attached to it.
 */
export const StudentQuestionsPanel = ({
  classId,
  assessmentIds,
  questionLabels,
}: {
  classId: string;
  assessmentIds: string[];
  /** assessment id → the question number/title on the card */
  questionLabels?: Map<string, string>;
}) => {
  const list = useServerFn(listAssessmentQuestions);
  const answerFn = useServerFn(answerAssessmentQuestion);
  const [rows, setRows] = useState<AssessmentStudentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const idsKey = assessmentIds.join(",");

  const refresh = useCallback(async () => {
    if (!classId || assessmentIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const data = await list({ data: { classId, assessmentIds } });
      setRows(data);
    } catch {
      /* a failed read must not break the dashboard */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, idsKey, list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`asq-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessment_student_questions", filter: `class_id=eq.${classId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, refresh]);

  const sorted = useMemo(() => sortForTeacher(rows), [rows]);
  const open = unansweredCount(rows);

  const send = async (id: string) => {
    if (draft.trim().length === 0) return;
    setSending(true);
    try {
      const updated = await answerFn({ data: { id, answer: draft.trim() } });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated, studentName: r.studentName } : r)));
      setDraft("");
      setOpenId(null);
      toast.success("Answer sent to the student.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide">
          <MessageCircleQuestion className="h-4 w-4" /> Student Questions
        </h2>
        {open > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            {open} waiting
          </span>
        )}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No questions yet. Questions students ask on their board appear here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((q) => {
            const isOpen = openId === q.id;
            return (
              <li key={q.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => {
                    setOpenId(isOpen ? null : q.id);
                    setDraft(isOpen ? "" : (q.answerBody ?? ""));
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{q.studentName || "Student"}</span>
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                      {questionLabels?.get(q.assessmentId) || "Assignment question"}
                      {" · "}
                      {new Date(q.createdAt).toLocaleString()}
                    </span>
                    <span className="mt-1 block truncate text-sm text-foreground/90">{q.body}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      q.answerBody ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {q.answerBody ? "Answered" : "New"}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{q.body}</p>
                    <Textarea
                      value={draft}
                      rows={3}
                      maxLength={4000}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Answer this student…"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" className="gap-2" disabled={sending || draft.trim().length === 0} onClick={() => void send(q.id)}>
                        {sending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {q.answerBody ? "Update answer" : "Send answer"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default StudentQuestionsPanel;
