import {
  BarChart3,
  Building2,
  GraduationCap,
  Loader2,
  Radio,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import ChildProgressCard from "@/components/family/ChildProgressCard";
import ConnectedList from "@/components/family/ConnectedList";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import ConnectChildDialog from "@/components/family/ConnectChildDialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { useProfileSummary } from "@/lib/accounts/useProfileSummary";
import { useChildren, useFamilyActivity, useFamilyConnections } from "@/lib/family/useFamily";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const ACTIVITY_LABEL: Record<string, string> = {
  assignment: "completed an assignment",
  adventure: "finished an adventure",
  skill: "completed a skill pathway",
};

/**
 * The Parent Console.
 *
 * A parent is a guardian and an observer, never a teacher: there are no lesson
 * notes, no SmartBoard and no classes here. Each child keeps their own student
 * account; the parent follows it, and can introduce a school or a teacher —
 * which the school or teacher accepts and the child then confirms.
 */
const FamilyDashboard = () => {
  const { displayName } = useProfileSummary();
  const { children, loading } = useChildren();
  const connections = useFamilyConnections();
  const activity = useFamilyActivity();

  const rows = connections.data ?? [];
  const schools = rows.filter((r) => r.kind === "school");
  const teachers = rows.filter((r) => r.kind === "teacher");

  const average =
    children.length === 0
      ? 0
      : Math.round(children.reduce((sum, c) => sum + c.progress, 0) / children.length);

  const rail = (
    <>
      <RailCard title="Quick actions">
        <div className="space-y-2">
          <ConnectByCodeDialog
            trigger={
              <Button type="button" variant="outline" className="min-h-[44px] w-full justify-start">
                <UserPlus className="mr-2 h-4 w-4" /> Add a child
              </Button>
            }
          />
          <ConnectChildDialog
            trigger={
              <Button type="button" variant="outline" className="min-h-[44px] w-full justify-start">
                <Building2 className="mr-2 h-4 w-4" /> Connect to a school
              </Button>
            }
          />
          <ConnectChildDialog
            trigger={
              <Button type="button" variant="outline" className="min-h-[44px] w-full justify-start">
                <GraduationCap className="mr-2 h-4 w-4" /> Connect to a teacher
              </Button>
            }
          />
          <Button asChild variant="outline" className="min-h-[44px] w-full justify-start">
            <Link to="/requests">
              <Sparkles className="mr-2 h-4 w-4" /> Requests &amp; invitations
            </Link>
          </Button>
        </div>
      </RailCard>

      <RailCard title="Recent activity">
        {activity.isLoading ? (
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : (activity.data ?? []).length === 0 ? (
          <EmptyNote>Nothing finished yet. Your children's completed work appears here.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {(activity.data ?? []).map((item, index) => (
              <li
                key={`${item.childUserId}-${item.title}-${index}`}
                className="rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-3"
              >
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {item.childName} {ACTIVITY_LABEL[item.kind]}
                  </span>
                  {item.happenedAt && (
                    <span className="shrink-0">{new Date(item.happenedAt).toLocaleDateString()}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

    </>
  );

  return (
    <WorkspaceLayout
      title="Parent Console"
      subtitle="Follow your children's learning. Their accounts remain their own — you can look, never edit."
      rail={rail}
    >
      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-foreground">
              {greeting()}, {displayName || "there"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Here's an overview of your children's learning progress.
            </p>
          </div>
          <span className="shrink-0 rounded-2xl border border-ws-border/70 bg-ws-canvas/40 px-4 py-2 text-right">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ws-gold/80">My family</span>
            <span className="block text-sm font-semibold text-foreground">
              {children.length} {children.length === 1 ? "child" : "children"}
            </span>
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Children under your care" value={children.length} icon={Users} loading={loading} />
        <StatCard label="Schools connected" value={schools.length} icon={Building2} loading={connections.isLoading} />
        <StatCard
          label="Teachers connected"
          value={teachers.length}
          icon={GraduationCap}
          loading={connections.isLoading}
          to="/family/teachers"
        />
        <StatCard
          label="Average progress"
          value={average}
          suffix="%"
          icon={BarChart3}
          loading={loading}
        />
      </div>

      <section>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
            My children
          </h2>
          <ConnectByCodeDialog
            trigger={
              <Button type="button" variant="ghost" className="shrink-0 text-xs text-ws-gold hover:underline">
                Add a child
              </Button>
            }
          />
        </div>
        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your family…
          </p>
        ) : children.length === 0 ? (
          <EmptyNote>
            No children linked yet. Ask your child for their MathGPL ID or Share Code, then use “Add a child”.
            Your child accepts the request from their own account.
          </EmptyNote>
        ) : (
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {children.map((child) => (
              <ChildProgressCard key={child.childUserId} child={child} />
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
            Schools connected
          </h2>
          <ConnectedList
            kind="school"
            rows={schools}
            empty="No schools yet. Introduce a child to a school and the school accepts, then your child confirms."
          />
        </section>

        <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
              Teachers connected
            </h2>
            <Link to="/family/teachers" className="shrink-0 text-xs text-ws-gold hover:underline">
              View all
            </Link>
          </div>
          <ConnectedList
            kind="teacher"
            rows={teachers}
            empty="No teachers yet. Introduce a child to a teacher and the teacher accepts, then your child confirms."
          />
        </section>
      </div>

      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
          <Radio className="h-4 w-4" /> Live sessions
        </h2>
        <p className="text-sm text-muted-foreground">
          Join live sessions and connect with the teachers and schools that teach your children.
        </p>
        <Button asChild className="mt-3 min-h-[44px]">
          <Link to="/live">Go Live now</Link>
        </Button>
      </section>
    </WorkspaceLayout>
  );
};

export default FamilyDashboard;
