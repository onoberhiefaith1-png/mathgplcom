import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Paperclip, X } from "lucide-react";
import {
  EVENT_LABEL,
  addAssignees,
  addComment,
  changeDeadline,
  decideExtension,
  deleteTask,
  fetchTaskExtras,
  fmt,
  isOverdue,
  openProof,
  requestExtension,
  reviewTask,
  startTask,
  submitTask,
  uploadProof,
  type AssigneeRow,
  type StaffMember,
  type TaskRow,
} from "@/lib/staffHub/api";
import type { Ctx } from "./StaffHubPage";
import { Avatar, PriorityPill, StatusPill, btn, btnGhost, field } from "./ui";

export default function TaskDrawer({
  ctx,
  task,
  team,
  onClose,
}: {
  ctx: Ctx;
  task: TaskRow | null;
  team: StaffMember[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const assignees = task?.staff_task_assignees ?? [];
  const ids = assignees.map((a) => a.id);
  const extras = useQuery({
    queryKey: ["staff-task-extras", task?.id, ids.join(",")],
    enabled: !!task,
    queryFn: () => fetchTaskExtras(task!.id, ids),
  });
  const [comment, setComment] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["staff-tasks", ctx.orgId] });
    void qc.invalidateQueries({ queryKey: ["staff-task-extras"] });
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const name = (id: string) => team.find((m) => m.userId === id)?.name ?? "Teacher";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="float-right rounded-full p-2 hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        {!task ? (
          <p className="text-sm text-muted-foreground">This task is not available. It may have been removed, or it isn't assigned to you.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{task.title}</h2>
                <PriorityPill p={task.priority} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {task.estimated_hours}h estimated · {task.deadline_kind === "flexible" ? "Flexible deadline" : fmt(task.deadline)} · Proof{" "}
                {task.evidence_required ? "required" : "optional"} · {task.review_required ? "Reviewed before completion" : "Completes on submission"}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.instructions || "No written instructions."}</p>
            {task.link_kind && task.link_id && (
              <a href={task.link_id} className={btnGhost} target="_blank" rel="noopener">
                <ExternalLink className="h-4 w-4" /> Open {task.link_label || "linked work"}
              </a>
            )}

            {ctx.isManager && <ManagerTools ctx={ctx} task={task} team={team} act={act} onDeleted={onClose} />}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{ctx.isManager ? "Teachers" : "Your progress"}</h3>
              {assignees
                .filter((a) => ctx.isManager || a.user_id === ctx.userId)
                .map((a) => (
                  <AssigneeCard
                    key={a.id}
                    ctx={ctx}
                    task={task}
                    a={a}
                    name={name(a.user_id)}
                    avatar={team.find((m) => m.userId === a.user_id)?.avatarUrl}
                    submissions={(extras.data?.submissions ?? []).filter((s) => s.assignee_id === a.id)}
                    extensions={(extras.data?.extensions ?? []).filter((x) => x.assignee_id === a.id)}
                    act={act}
                  />
                ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Comments</h3>
              <ul className="space-y-2">
                {(extras.data?.comments ?? []).map((c) => (
                  <li key={c.id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {c.author_id === ctx.userId ? "You" : name(c.author_id)} · {fmt(c.created_at)}
                    </div>
                    {c.body}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input className={field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment" />
                <button
                  type="button"
                  className={btn}
                  disabled={!comment.trim()}
                  onClick={() => act(() => addComment(task.id, comment), "Comment added").then(() => setComment(""))}
                >
                  Send
                </button>
              </div>
            </section>

            {ctx.isManager && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Audit trail</h3>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {(extras.data?.events ?? []).map((e) => (
                    <li key={e.id}>
                      {fmt(e.created_at)} — {EVENT_LABEL[e.kind] ?? e.kind}
                      {e.subject_user_id ? ` · ${name(e.subject_user_id)}` : ""}
                      {e.actor_id && e.actor_id !== e.subject_user_id ? ` (by ${e.actor_id === ctx.userId ? "you" : name(e.actor_id)})` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>;

function ManagerTools({ ctx, task, team, act, onDeleted }: { ctx: Ctx; task: TaskRow; team: StaffMember[]; act: Act; onDeleted: () => void }) {
  const [deadline, setDeadline] = useState("");
  const [extra, setExtra] = useState("");
  const already = new Set(task.staff_task_assignees.map((a) => a.user_id));
  const others = team.filter((m) => !already.has(m.userId));
  return (
    <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
      <div className="flex gap-2">
        <input type="datetime-local" className={field} value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="New deadline" />
        <button type="button" className={btnGhost} disabled={!deadline} onClick={() => act(() => changeDeadline(task.id, new Date(deadline).toISOString()), "Deadline changed")}>
          Set
        </button>
      </div>
      <div className="flex gap-2">
        <select className={field} value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Add teacher">
          <option value="">Add a teacher…</option>
          {others.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="button" className={btnGhost} disabled={!extra} onClick={() => act(() => addAssignees(task.id, [extra]), "Teacher added").then(() => setExtra(""))}>
          Add
        </button>
      </div>
      <button
        type="button"
        className="text-left text-xs text-destructive underline"
        onClick={() => {
          if (confirm("Delete this task for everyone?")) void act(() => deleteTask(task.id), "Task deleted").then(onDeleted);
        }}
      >
        Delete task
      </button>
      <span className="text-xs text-muted-foreground">{ctx.isAdmin ? "School owner" : "Manager"} tools</span>
    </div>
  );
}

function AssigneeCard({
  ctx,
  task,
  a,
  name,
  avatar,
  submissions,
  extensions,
  act,
}: {
  ctx: Ctx;
  task: TaskRow;
  a: AssigneeRow;
  name: string;
  avatar?: string | null;
  submissions: { id: string; note: string; links: string[]; files: unknown; decision: string | null; review_note: string | null; created_at: string }[];
  extensions: { id: string; requested_deadline: string; reason: string; status: string }[];
  act: Act;
}) {
  const mine = a.user_id === ctx.userId;
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<{ path: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState("");
  const [ext, setExt] = useState({ date: "", reason: "" });
  const pendingExt = extensions.find((x) => x.status === "pending");

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Avatar name={name} url={avatar} /> {mine ? "You" : name}
        </span>
        <StatusPill status={a.status} overdue={isOverdue(a)} />
      </div>
      <div className="text-xs text-muted-foreground">
        Due {fmt(a.deadline)}
        {a.started_at ? ` · started ${fmt(a.started_at)}` : ""}
        {a.submitted_at ? ` · submitted ${fmt(a.submitted_at)}` : ""}
        {a.review_rounds ? ` · ${a.review_rounds} review round(s)` : ""}
      </div>

      {submissions.map((s) => (
        <div key={s.id} className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Proof · {fmt(s.created_at)}
            {s.decision ? ` · ${s.decision === "approved" ? "Approved" : "Changes requested"}` : ""}
          </div>
          {s.note && <p className="mt-1 whitespace-pre-wrap">{s.note}</p>}
          {s.links.map((l) => (
            <a key={l} href={l} target="_blank" rel="noopener" className="block truncate text-primary underline">
              {l}
            </a>
          ))}
          {(Array.isArray(s.files) ? (s.files as { path: string; name: string }[]) : []).map((f) => (
            <button key={f.path} type="button" className="flex items-center gap-1 text-primary underline" onClick={() => void openProof(f.path)}>
              <Paperclip className="h-3 w-3" /> {f.name}
            </button>
          ))}
          {s.review_note && <p className="mt-1 text-xs italic">Reviewer: {s.review_note}</p>}
        </div>
      ))}

      {mine && (a.status === "assigned" || a.status === "changes_requested") && (
        <button type="button" className={btnGhost} onClick={() => act(() => startTask(a.id), "Task started")}>
          {a.status === "changes_requested" ? "Start changes" : "Start task"}
        </button>
      )}

      {mine && a.status !== "completed" && a.status !== "submitted" && (
        <div className="space-y-2">
          <textarea className={`${field} min-h-[80px]`} placeholder="What did you do? Describe the proof." value={note} onChange={(e) => setNote(e.target.value)} />
          <input className={field} placeholder="Link to the work (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          <label className={`${btnGhost} cursor-pointer`}>
            <Paperclip className="h-4 w-4" /> {uploading ? "Uploading…" : "Attach a file"}
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const up = await uploadProof(ctx.orgId, file);
                  setFiles((x) => [...x, up]);
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {files.length > 0 && <div className="text-xs text-muted-foreground">{files.map((f) => f.name).join(", ")}</div>}
          <button
            type="button"
            className={btn}
            onClick={() =>
              act(() => submitTask(a.id, note, link.trim() ? [link.trim()] : [], files), task.review_required ? "Sent for review" : "Task completed").then(() => {
                setNote("");
                setLink("");
                setFiles([]);
              })
            }
          >
            Submit task
          </button>
          {!pendingExt && a.deadline && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">Need more time?</summary>
              <div className="mt-2 space-y-2">
                <input type="datetime-local" className={field} value={ext.date} onChange={(e) => setExt({ ...ext, date: e.target.value })} aria-label="New deadline" />
                <input className={field} placeholder="Reason" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} />
                <button
                  type="button"
                  className={btnGhost}
                  disabled={!ext.date}
                  onClick={() => act(() => requestExtension(a.id, new Date(ext.date).toISOString(), ext.reason), "Request sent")}
                >
                  Ask for more time
                </button>
              </div>
            </details>
          )}
        </div>
      )}

      {pendingExt && (
        <div className="rounded-lg border border-border p-3 text-sm">
          More time requested until {fmt(pendingExt.requested_deadline)}
          {pendingExt.reason ? ` — ${pendingExt.reason}` : ""}
          {ctx.isManager && (
            <div className="mt-2 flex gap-2">
              <button type="button" className={btn} onClick={() => act(() => decideExtension(pendingExt.id, true), "More time approved")}>
                Approve
              </button>
              <button type="button" className={btnGhost} onClick={() => act(() => decideExtension(pendingExt.id, false), "Declined")}>
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {ctx.isManager && a.status === "submitted" && (
        <div className="space-y-2">
          <input className={field} placeholder="Feedback for the teacher" value={review} onChange={(e) => setReview(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => act(() => reviewTask(a.id, true, review), "Approved")}>
              Approve
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                if (!review.trim()) return toast.error("Say what needs changing");
                void act(() => reviewTask(a.id, false, review), "Changes requested");
              }}
            >
              Request changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
