import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/lib/accounts/roles";
import AudiencePicker from "./AudiencePicker";
import {
  CATEGORY_LABEL,
  NOTIFICATION_CATEGORIES,
  SENDER_AUDIENCES,
  canAllowResponses,
  type AudienceRequest,
  type NotificationCategory,
} from "@/lib/notifications/audience";
import { sendNotification } from "@/lib/notifications/notifications.functions";

/**
 * Two steps, in the order a person thinks: write the message, then choose who
 * it goes to. Permission is still decided on the server.
 */
const ComposeNotification = ({ role, onSent }: { role: AppRole; onSent?: () => void }) => {
  const first = SENDER_AUDIENCES[role][0];
  const [step, setStep] = useState<1 | 2>(1);
  const [audience, setAudience] = useState<AudienceRequest>({ kind: first ?? "individuals" });
  const [category, setCategory] = useState<NotificationCategory>("announcement");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [allowResponses, setAllowResponses] = useState(true);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const send = useServerFn(sendNotification);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          audience,
          subject,
          body,
          category,
          allowResponses,
          attachment: attachmentUrl.trim()
            ? {
                kind: /\.(png|jpe?g|gif|webp|svg)$/i.test(attachmentUrl.trim()) ? "image" : "link",
                url: attachmentUrl.trim(),
                name: attachmentName.trim() || null,
              }
            : null,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Notification sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}.`);
      setSubject("");
      setBody("");
      setAttachmentUrl("");
      setAttachmentName("");
      setStep(1);
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
        if (step === 1) {
          if (!subject.trim() || !body.trim()) {
            toast.error("A notification needs a subject and a message.");
            return;
          }
          setStep(2);
          return;
        }
        mutation.mutate();
      }}
    >
      <ol className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Compose steps">
        <li className={step === 1 ? "font-semibold text-foreground" : ""}>1 · Message</li>
        <li aria-hidden="true">→</li>
        <li className={step === 2 ? "font-semibold text-foreground" : ""}>2 · Audience</li>
      </ol>

      {step === 1 && (
        <>
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Category</span>
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_CATEGORIES.filter((c) => c !== "system").map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    category === key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary"
                  }`}
                >
                  {CATEGORY_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

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

          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <label
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                htmlFor="notification-attachment"
              >
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Attachment link (optional)
              </label>
              <Input
                id="notification-attachment"
                value={attachmentUrl}
                onChange={(event) => setAttachmentUrl(event.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="notification-attachment-name">
                Label
              </label>
              <Input
                id="notification-attachment-name"
                value={attachmentName}
                maxLength={160}
                onChange={(event) => setAttachmentName(event.target.value)}
                placeholder="Timetable"
              />
            </div>
          </div>

          {canAllowResponses(role) && (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <span>
                <span className="block text-sm font-medium text-foreground">Allow responses</span>
                <span className="block text-xs text-muted-foreground">
                  Recipients can reply to you. Turn off for announcements that need no answer.
                </span>
              </span>
              <Switch checked={allowResponses} onCheckedChange={setAllowResponses} />
            </label>
          )}

          <Button type="submit" className="gap-2">
            Choose audience <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <AudiencePicker role={role} value={audience} onChange={setAudience} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="gap-2" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to message
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              <Send className="h-4 w-4" aria-hidden="true" />
              {mutation.isPending ? "Sending…" : "Send notification"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};

export default ComposeNotification;
