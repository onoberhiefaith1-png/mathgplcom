import { useQuery } from "@tanstack/react-query";
import { GraduationCap, UserPlus, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { EmptyNote, RailCard } from "@/components/workspace/DashboardParts";
import { supabase } from "@/integrations/supabase/client";
import { connectedOwner, connectedSchoolByOrg } from "@/lib/student/workspaceAccess";

/**
 * Inside one school or one teacher.
 *
 * Level 2 of the student journey: the workspace the student has just entered,
 * showing only that owner's classes, the teachers behind them and a way to
 * join another of their classes. Read and play only, exactly as before.
 */
const WorkspaceHomePage = ({ kind, id }: { kind: "school" | "teacher"; id: string }) => {
  const owner = useQuery({
    queryKey: ["student-workspace-owner", kind, id],
    queryFn: () => (kind === "school" ? connectedSchoolByOrg(id) : connectedOwner(id)),
  });

  const ownerId = owner.data?.ownerId ?? null;

  const inside = useQuery({
    queryKey: ["student-workspace-inside", kind, id, ownerId ?? ""],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { classes: [], teachers: [] as { id: string; name: string }[] };

      const { data: memberships } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", uid);
      const ids = ((memberships ?? []) as { class_id: string }[]).map((m) => m.class_id);
      if (ids.length === 0) return { classes: [], teachers: [] };

      const base = supabase.from("classes").select("id, name, owner_id, org_id").in("id", ids);
      const { data } = await (kind === "school" ? base.eq("org_id", id) : base.eq("owner_id", ownerId!));
      const rows = (data ?? []) as { id: string; name: string | null; owner_id: string | null }[];

      const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter((v): v is string => Boolean(v))));
      let teachers: { id: string; name: string }[] = [];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ownerIds);
        teachers = ((profiles ?? []) as { user_id: string; display_name: string | null }[]).map((p) => ({
          id: p.user_id,
          name: p.display_name ?? "Teacher",
        }));
      }

      return {
        classes: rows.map((r) => ({ id: r.id, name: r.name ?? "Class" })),
        teachers,
      };
    },
  });

  const name = owner.data?.name ?? (kind === "school" ? "School" : "Teacher");
  const classes = inside.data?.classes ?? [];
  const teachers = inside.data?.teachers ?? [];

  const rail = (
    <>
      <RailCard title={kind === "school" ? "Teachers here" : "Your teacher"}>
        {teachers.length === 0 ? (
          <EmptyNote>No teachers to show yet.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm"
              >
                {teacher.name}
              </li>
            ))}
          </ul>
        )}
      </RailCard>
      <RailCard title="Join a class here">
        <p className="text-xs text-muted-foreground">
          Have a join code or invite link from {name}? Enter it below and you go straight into the classroom.
        </p>
        <div className="mt-3">
          <JoinClassPanel />
        </div>
      </RailCard>

    </>
  );

  return (
    <WorkspaceLayout
      title={name}
      subtitle={kind === "school" ? "School workspace" : "Teacher workspace"}
      rail={rail}
    >
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Users className="h-4 w-4" /> Classes in {name}
        </h2>
        {inside.isLoading ? (
          <EmptyNote>Loading…</EmptyNote>
        ) : classes.length === 0 ? (
          <EmptyNote>
            You are not in a class here yet. Use Join Class with the code {name} gave you.
          </EmptyNote>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {classes.map((cls) => (
              <li key={cls.id}>
                <Link
                  to={`/student/class/${cls.id}`}
                  className="grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-4 transition hover:border-primary/40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-medium">{cls.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceLayout>
  );
};

export default WorkspaceHomePage;
