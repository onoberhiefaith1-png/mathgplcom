import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import SchoolShell from "@/components/accounts/SchoolShell";
import { useAccount } from "@/lib/accounts/useAccount";
import { fetchSchoolTeachers } from "@/lib/accounts/schoolDirectory";
import {
  addClass,
  addSubject,
  ensureSchoolAcademia,
  loadAcademiaTree,
  removeRow,
  setSubjectTeachers,
  updateAcademia,
} from "@/lib/academia/api";

type Col = { id: string; name: string; sub?: string };

function Column({
  title,
  items,
  selected,
  onSelect,
  onAdd,
  onRemove,
  empty,
  addLabel,
}: {
  title: string;
  items: Col[];
  selected: string | null;
  onSelect?: (id: string) => void;
  onAdd?: (name: string) => void;
  onRemove?: (id: string) => void;
  empty: string;
  addLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="flex min-h-[360px] flex-col rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</header>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted-foreground">{empty}</li>}
        {items.map((it) => (
          <li key={it.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(it.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect?.(it.id)}
              className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition ${
                selected === it.id ? "bg-primary/15 text-foreground" : "hover:bg-muted"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.name}</span>
                {it.sub && <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>}
              </span>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${it.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove "${it.name}" and everything inside it?`)) onRemove(it.id);
                  }}
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {onAdd && (
        <form
          className="flex gap-2 border-t border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onAdd(draft.trim());
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={addLabel}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      )}
    </section>
  );
}

const SchoolAcademiaPage = () => {
  const { orgId, isLoading } = useAccount();
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const academiaQ = useQuery({
    queryKey: ["academia", orgId],
    enabled: !!orgId,
    queryFn: () => ensureSchoolAcademia(orgId!),
  });
  const academia = academiaQ.data;
  const treeQ = useQuery({
    queryKey: ["academia-tree", academia?.id],
    enabled: !!academia,
    queryFn: () => loadAcademiaTree(academia!.id),
  });
  const teachersQ = useQuery({
    queryKey: ["school-teachers", orgId],
    enabled: !!orgId,
    queryFn: () => fetchSchoolTeachers(orgId!),
  });

  const tree = treeQ.data;
  const teacherName = useMemo(
    () => new Map((teachersQ.data ?? []).map((t) => [t.userId, t.displayName])),
    [teachersQ.data],
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["academia-tree", academia?.id] });
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error((e as Error).message || "That didn't save.");
    }
  };

  if (isLoading || academiaQ.isLoading) {
    return (
      <SchoolShell title="Academia">
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening your Academia…
        </div>
      </SchoolShell>
    );
  }
  if (!academia) {
    return (
      <SchoolShell title="Academia">
        <p className="text-sm text-muted-foreground">Your Academia could not be opened.</p>
      </SchoolShell>
    );
  }

  const classes = tree?.classes ?? [];
  const subjects = (tree?.subjects ?? []).filter((s) => s.class_id === classId);
  const topics = (tree?.topics ?? []).filter((t) => t.subject_id === subjectId);
  const subtopics = (tree?.subtopics ?? []).filter((s) => s.topic_id === topicId);
  const assignedTo = (sid: string) => (tree?.subjectTeachers ?? []).filter((x) => x.subject_id === sid).map((x) => x.teacher_id);
  const subject = subjects.find((s) => s.id === subjectId) ?? null;

  return (
    <SchoolShell title={academia.name} subtitle="Build the learning structure your teachers fill and your students learn from." nav={false} backTo="/school" backLabel="Dashboard">
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-semibold">Academia settings</span>
        <label className="flex items-center gap-2 text-sm">
          Visibility
          <select
            value={academia.visibility}
            onChange={(e) =>
              run(async () => {
                await updateAcademia(academia.id, { visibility: e.target.value as "private" | "public" });
                await qc.invalidateQueries({ queryKey: ["academia", orgId] });
              })
            }
            className="rounded-lg border border-input bg-background px-2 py-1.5"
          >
            <option value="private">Private to school</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={academia.allow_teacher_assign}
            onChange={(e) =>
              run(async () => {
                await updateAcademia(academia.id, { allow_teacher_assign: e.target.checked });
                await qc.invalidateQueries({ queryKey: ["academia", orgId] });
              })
            }
          />
          Allow teachers to assign Academia Sessions
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Column
          title="Classes"
          items={classes}
          selected={classId}
          onSelect={(id) => {
            setClassId(id);
            setSubjectId(null);
            setTopicId(null);
          }}
          onAdd={(name) => academia && run(() => addClass(academia.id, name, classes.length))}
          onRemove={(id) => run(() => removeRow("academia_classes", id))}
          empty="Add your first Class, e.g. Year 7."
          addLabel="New class"
        />
        <Column
          title="Subjects"
          items={subjects.map((s) => {
            const names = assignedTo(s.id).map((t) => teacherName.get(t) ?? "Teacher");
            return { ...s, sub: names.length ? names.join(", ") : "No teacher assigned" };
          })}
          selected={subjectId}
          onSelect={(id) => {
            setSubjectId(id);
            setTopicId(null);
          }}
          onAdd={classId ? (name) => run(() => addSubject(classId, name, subjects.length)) : undefined}
          onRemove={(id) => run(() => removeRow("academia_subjects", id))}
          empty={classId ? "Add a Subject to this Class." : "Choose a Class first."}
          addLabel="New subject"
        />
        <Column
          title="Topics"
          items={topics}
          selected={topicId}
          onSelect={setTopicId}
          empty={subjectId ? "Assigned teachers add Topics here." : "Choose a Subject first."}
        />
        <Column
          title="Subtopics"
          items={subtopics}
          selected={null}
          empty={topicId ? "Assigned teachers add Subtopics here." : "Choose a Topic first."}
        />
      </div>

      {subject && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAssigning((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary/40"
          >
            <UserPlus className="h-4 w-4" /> Assign teachers to {subject.name}
          </button>
          {assigning && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-4">
              {(teachersQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers are connected to this school yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(teachersQ.data ?? []).map((t) => {
                    const current = assignedTo(subject.id);
                    const on = current.includes(t.userId);
                    return (
                      <li key={t.userId}>
                        <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              run(() =>
                                setSubjectTeachers(
                                  subject.id,
                                  on ? current.filter((x) => x !== t.userId) : [...current, t.userId],
                                ),
                              )
                            }
                          />
                          {t.displayName}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </SchoolShell>
  );
};

export default SchoolAcademiaPage;
