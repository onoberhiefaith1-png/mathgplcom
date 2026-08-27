import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/lib/accounts/roles";
import AudiencePicker from "./AudiencePicker";
import { SENDER_AUDIENCES, type AudienceRequest } from "@/lib/notifications/audience";
import { sendNotification } from "@/lib/notifications/notifications.functions";

/** Compose panel for administrators, schools, teachers and parents. */
const ComposeNotification = ({ role, onSent }: { role: AppRole; onSent?: () => void }) => {
  const first = SENDER_AUDIENCES[role][0];
  const [audience, setAudience] = useState<AudienceRequest>({ kind: first ?? "individuals" });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const send = useServerFn(sendNotification);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => send({ data: { audience, subject, body } }),
    onSuccess: (result) => {
      toast.success(`Notification sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}.`);
      setSubject("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onSent?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!subject.trim() || !body.trim()) {
          toast.error("A notification needs a subject and a message.");
          return;
        }
        mutation.mutate();
      }}
    >
      <AudiencePicker role={role} value={audience} onChange={setAudience} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="notification-subject">
          Subject
        </label>
        <Input
          id="notification-subject"
          value={subject}
          maxLength={160}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Staff meeting tomorrow at 9:00 AM"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="notification-body">
          Message
        </label>
        <Textarea
          id="notification-body"
          value={body}
          rows={5}
          maxLength={4000}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write the notification…"
        />
      </div>

      <Button type="submit" disabled={mutation.isPending} className="gap-2">
        <Send className="h-4 w-4" aria-hidden="true" />
        {mutation.isPending ? "Sending…" : "Send notification"}
      </Button>
    </form>
  );
};

export default ComposeNotification;
