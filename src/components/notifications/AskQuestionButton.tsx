import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askQuestion } from "@/lib/notifications/notifications.functions";
import type { NotificationContext } from "@/lib/notifications/types";

/**
 * The student's one way to start a message: ask a question from inside the
 * board they are working on, without leaving the activity. The context of the
 * work is attached automatically so the teacher knows exactly what is meant.
 */
const AskQuestionButton = ({ context }: { context: NotificationContext }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const ask = useServerFn(askQuestion);

  const mutation = useMutation({
    mutationFn: () =>
      ask({
        data: {
          body,
          context,
          targetPath: typeof window === "undefined" ? null : window.location.pathname + window.location.search,
        },
      }),
    onSuccess: () => {
      toast.success("Question sent to your teacher.");
      setBody("");
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div data-sb-chrome className="absolute bottom-4 left-4 z-[70]">
      {!open ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-2 shadow-lg"
          onClick={() => setOpen(true)}
        >
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
            Your teacher will see what you are working on with your question.
          </p>
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
              Cancel
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

export default AskQuestionButton;
