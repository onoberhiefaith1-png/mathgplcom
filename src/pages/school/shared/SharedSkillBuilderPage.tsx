import { useQuery } from "@tanstack/react-query";
import { Eye, GraduationCap, Loader2 } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedCourses } from "@/lib/accounts/sharedWorkspace";

/** Skill Builder courses built inside this school, reviewed by the school. */
const SharedSkillBuilderPage = ({ userId }: { userId: string }) => {
  const { orgId, person } = useSharedMember(userId);

  const courses = useQuery({
    queryKey: ["shared-courses", orgId, userId],
    queryFn: async () => fetchSharedCourses(orgId!, userId),
    enabled: Boolean(orgId),
  });

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="skill-builder"
      title="Skill Builder"
      subtitle="Courses the teacher built and uses inside this school. The school reviews them; the teacher edits them."
    >
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
        <Eye className="h-3.5 w-3.5" /> View only
      </div>

      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      ) : courses.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading courses…
        </p>
      ) : (courses.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          No Skill Builder courses in this shared workspace yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {(courses.data ?? []).map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.subject, c.topic].filter(Boolean).join(" · ") || "No topic set"} · {c.status ?? "draft"} ·{" "}
                    {c.learningMode === "sequential" ? "sequential learning" : "free learning"}
                  </p>
                </div>
              </div>
              {c.sections.length > 0 && (
                <ul className="mt-3 divide-y divide-border/60">
                  {c.sections.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.blocks} block{s.blocks === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedSkillBuilderPage;
