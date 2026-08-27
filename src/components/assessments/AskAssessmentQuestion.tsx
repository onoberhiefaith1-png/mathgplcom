import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  askAssessmentQuestion,
  listMyAssessmentQuestions,
} from "@/lib/assessments/studentQuestions.functions";
import { questionsForBoard } from "@/lib/assessments/studentQuestions";

/**
 * The student asks about THIS work. The question belongs to the assessment
 * card, never to the general notification system, and the teacher's answer
 * comes back in the same place.
 */
const AskAssessmentQuestion = ({
  assessmentId,
  classId,
  boardQuestionId,
}: {
  assessmentId: string;
  classId: string;
  boardQuestionId?: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const ask = useServerFn(askAssessmentQuestion);
  const listMine = useServerFn(listMyAssessmentQuestions);
  const queryClient = useQueryClient();
  const key = ["assessment-student-questions", assessmentId];

  const thread = useQuery({
    queryKey: key,
    queryFn: () => listMine({ data: { assessmentId } }),
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });

  const mutation = useMutation({
    mutationFn: () => ask({ data: { assessmentId, classId, boardQuestionId: boardQuestionId ?? null, body } }),
    onSuccess: () => {
      toast.success("Question sent to your teacher.");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = questionsForBoard(thread.data ?? [], boardQuestionId);

  return (
    <div data-sb-chrome className="absolute right-4 top-4 z-[70]">
      {!open ? (
        <Button type="button" size="sm" variant="secondary" className="gap-2 shadow-lg" onClick={() => setOpen(true)}>
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          Ask a Question
        </Button>
      ) : (
        <div className="w-80 rounded-xl border border-border bg-card p-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-card-foreground">Ask a Question</p>
            <button
              type="button"
              aria-label="Close question panel"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your teacher sees this on the assignment you are working on.
          </p>

          {items.length > 0 && (
            <div className="mt-2 max-h-52 space-y-2 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-2">
              {items.map((q) => (
                <div key={q.id} className="text-xs">
                  <p className="font-medium text-foreground">You: {q.body}</p>
                  {q.answerBody ? (
                    <p className="mt-1 rounded-md bg-primary/10 p-1.5 text-foreground">Teacher: {q.answerBody}</p>
                  ) : (
                    <p className="mt-0.5 text-muted-foreground">Waiting for your teacher…</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <Textarea
            value={body}
            rows={4}
            maxLength={2000}
            autoFocus
            onChange={(event) => setBody(event.target.value)}
            placeholder="I don't understand why we divide both sides by 3."
            className="mt-2"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={mutation.isPending || body.trim().length < 3}
              onClick={() => mutation.mutate()}
              className="gap-2"
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Send question
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AskAssessmentQuestion;
