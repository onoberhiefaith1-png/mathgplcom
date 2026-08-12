import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Mail,
  Building2,
  GraduationCap,
  Users,
  Baby,
  BadgeCheck,
  AlertTriangle,
  Sparkles,
  Eye,
  LogIn,
  Ban,
  RotateCcw,
  Trash2,
  Plus,
} from "lucide-react";
import DashboardShell from "@/components/accounts/DashboardShell";
import { MathgplIdCard } from "@/components/accounts/MathgplIdCard";
import { useMathgplId } from "@/lib/accounts/useMathgplId";

import StatCard from "@/components/accounts/StatCard";
import AccountPreviewSheet from "@/components/accounts/AccountPreviewSheet";
import AddAccountDialog from "@/components/accounts/AddAccountDialog";
import CredentialEntryDialog, { type CredentialTarget } from "@/components/accounts/CredentialEntryDialog";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@/lib/accounts/useAccount";
import { beginImpersonation } from "@/lib/accounts/impersonation";
import {
  fetchPlatformStats,
  fetchPlatformAccounts,
  fetchMyAccounts,
  ensureMyAccounts,
  setAccountStatus,
  deletePlatformAccount,
  enterWorkspace,
} from "@/lib/accounts/platform.functions";


type TabKey = "schools" | "teachers" | "parents" | "students" | "admins";

const tabs: { key: TabKey; label: string }[] = [
  { key: "schools", label: "Schools" },
  { key: "teachers", label: "Teachers" },
  { key: "parents", label: "Parents" },
  { key: "students", label: "Students" },
  { key: "admins", label: "Co-Administrators" },
];

const date = (v: string) => (v ? new Date(v).toLocaleDateString() : "—");

/**
 * Platform control centre. Account, organisation and subscription information
 * only — nothing here opens a customer's lesson notes, classes or student work
 * unless the owner deliberately enters that workspace.
 */
const AdminConsole = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, isLoading } = useAccount();
  const [tab, setTab] = useState<TabKey>("schools");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { mathgplId: adminId, typeLabel: adminType } = useMathgplId();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [credentialTarget, setCredentialTarget] = useState<CredentialTarget | null>(null);
  const [settingUp, setSettingUp] = useState(false);

  const loadStats = useServerFn(fetchPlatformStats);
  const loadAccounts = useServerFn(fetchPlatformAccounts);
  const loadMine = useServerFn(fetchMyAccounts);
  const createMine = useServerFn(ensureMyAccounts);
  const changeStatus = useServerFn(setAccountStatus);
  const removeAccount = useServerFn(deletePlatformAccount);
  const openWorkspace = useServerFn(enterWorkspace);

  const allowed = role === "platform_owner" || role === "co_admin";

  useEffect(() => {
    if (isLoading) return;
    if (!allowed) navigate("/home", { replace: true });
  }, [isLoading, allowed, navigate]);

  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => loadStats(),
    enabled: allowed,
  });

  const accounts = useQuery({
    queryKey: ["platform-accounts", tab],
    queryFn: async () => (await loadAccounts({ data: { kind: tab } })).rows,
    enabled: allowed,
  });

  const mine = useQuery({
    queryKey: ["my-test-accounts"],
    queryFn: async () => (await loadMine()).rows,
    enabled: allowed,
  });

  const setUpMine = async () => {
    setSettingUp(true);
    try {
      await createMine();
      toast({ title: "Your accounts are ready", description: "School, Teacher, Parent and Student." });
      await Promise.all([mine.refetch(), accounts.refetch(), stats.refetch()]);
    } catch (e) {
      toast({ title: "Could not set up accounts", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSettingUp(false);
    }
  };

  const enter = async (userId: string) => {
    setBusyId(userId);
    try {
      const entry = await openWorkspace({ data: { userId } });
      if (entry.requiresCredentials) {
        setCredentialTarget({
          email: entry.email,
          name: entry.name,
          role: entry.role,
          home: entry.home,
        });
        return;
      }
      await beginImpersonation({
        tokenHash: entry.tokenHash,
        name: entry.name,
        role: entry.role,
        home: entry.home,
      });
      // Every workspace opens on its building first — the dashboard is entered from there.
      window.location.assign("/");
    } catch (e) {
      toast({ title: "Could not enter workspace", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };


  const toggleStatus = async (userId: string, status: string) => {
    const next = status === "suspended" ? "active" : "suspended";
    setBusyId(userId);
    try {
      await changeStatus({ data: { userId, status: next } });
      toast({ title: next === "suspended" ? "Account suspended" : "Account reactivated" });
      await accounts.refetch();
    } catch (e) {
      toast({ title: "Could not update account", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const destroy = async (userId: string, name: string) => {
    if (!window.confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    setBusyId(userId);
    try {
      await removeAccount({ data: { userId } });
      toast({ title: "Account deleted", description: name });
      await Promise.all([accounts.refetch(), stats.refetch()]);
    } catch (e) {
      toast({ title: "Could not delete account", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking access…
      </div>
    );
  }

  const s = stats.data;
  const overview = [
    { label: "Schools", value: s?.schools, icon: Building2, tone: "assessment" as const, tab: "schools" as TabKey },
    { label: "Teachers", value: s?.teachers, icon: GraduationCap, tone: "students" as const, tab: "teachers" as TabKey },
    { label: "Parents", value: s?.parents, icon: Baby, tone: "skillBuilder" as const, tab: "parents" as TabKey },
    { label: "Students", value: s?.students, icon: Users, tone: "assignments" as const, tab: "students" as TabKey },
    { label: "Active subscriptions", value: s?.activeOrgs, icon: BadgeCheck, tone: "skillBuilder" as const },
    { label: "Expired / suspended", value: s?.suspendedOrgs, icon: AlertTriangle, tone: "sessions" as const },
    { label: "New in 30 days", value: s?.newThisMonth, icon: Sparkles, tone: "gallery" as const },
  ];

  const action =
    "inline-flex items-center gap-1.5 rounded-lg border border-dash-border px-2.5 py-1.5 text-xs font-medium text-dash-surface-foreground transition hover:border-dash-gold hover:bg-dash-gold/10 disabled:opacity-50";

  return (
    <DashboardShell
      title="Platform"
      subtitle="Every school, teacher, parent and student on MathGPL — preview an account, or enter its workspace to test the experience exactly as that user has it."
      actions={
        <>
          <Link
            to="/admin/security"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            Security
          </Link>
          <Link
            to="/admin/email"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            <Mail className="h-3.5 w-3.5" /> Email Dashboard
          </Link>
          <Link
            to="/admin/billing"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            Billing &amp; Costs
          </Link>
          <Link
            to="/admin/cost-analytics"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            Cost Analytics
          </Link>
          <Link
            to="/admin/usage-analytics"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            Usage Analytics
          </Link>
          <Link
            to="/admin/cost-revenue"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            Usage &amp; Revenue
          </Link>




          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-dash-gold px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-navy shadow-md transition hover:brightness-105"
          >
            <Plus className="h-3.5 w-3.5" /> Add account
          </button>
        </>
      }

    >
      {adminId ? (
        <div className="mb-6 max-w-md">
          <MathgplIdCard
            mathgplId={adminId}
            typeLabel={adminType}
            note="Your administrator login — sign in with this ID and your password."
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {overview.map((o) => (
          <StatCard
            key={o.label}
            icon={o.icon}
            label={o.label}
            value={o.value}
            tone={o.tone}
            active={o.tab ? tab === o.tab : false}
            onClick={o.tab ? () => setTab(o.tab!) : undefined}
          />
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-dash-border bg-dash-surface p-6 shadow-[var(--shadow-dash)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-dash-surface-foreground">My accounts</h2>
            <p className="text-xs text-dash-surface-muted">
              One of each role, owned by you — use them to check that School, Teacher, Parent and
              Student all work. Only these open without a password.
            </p>
          </div>
          {(mine.data ?? []).some((m) => !m.userId) && (
            <button
              type="button"
              disabled={settingUp}
              onClick={() => void setUpMine()}
              className="inline-flex items-center gap-2 rounded-full bg-dash-gold px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-navy disabled:opacity-50"
            >
              {settingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Set up my accounts
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(mine.data ?? []).map((m) => (
            <div
              key={m.role}
              className="rounded-2xl border border-dash-border bg-background/40 p-4"
            >
              <p className="text-sm font-semibold capitalize text-dash-surface-foreground">{m.role}</p>
              <p className="mt-1 truncate text-xs text-dash-surface-muted">{m.email || "—"}</p>
              <button
                type="button"
                disabled={!m.userId || busyId === m.userId}
                onClick={() => m.userId && void enter(m.userId)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dash-border px-2.5 py-1.5 text-xs font-medium text-dash-surface-foreground transition hover:border-dash-gold hover:bg-dash-gold/10 disabled:opacity-50"
              >
                {busyId === m.userId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                {m.userId ? "Open workspace" : "Not created yet"}
              </button>
            </div>
          ))}
        </div>
      </section>


      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-dash-surface text-dash-surface-foreground shadow-[var(--shadow-dash)]"
                : "border border-dash-surface/20 bg-dash-surface/10 text-dash-surface/80 backdrop-blur hover:bg-dash-surface/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-3xl border border-dash-border bg-dash-surface p-6 shadow-[var(--shadow-dash)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold capitalize text-dash-surface-foreground">{tab}</h2>
          <p className="text-xs text-dash-surface-muted">
            Preview shows account information. Enter workspace opens the real working environment —
            no second login required.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          {accounts.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-dash-surface-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (accounts.data ?? []).length === 0 ? (
            <p className="text-sm text-dash-surface-muted">No {tab} registered yet.</p>
          ) : (
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-dash-surface-muted">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">{tab === "schools" ? "Subscription" : "Organisation"}</th>
                  <th className="py-2 pr-4">Status</th>
                  {tab === "schools" && (
                    <>
                      <th className="py-2 pr-4">Teachers</th>
                      <th className="py-2 pr-4">Students</th>
                      <th className="py-2 pr-4">Parents</th>
                    </>
                  )}
                  <th className="py-2 pr-4">Joined</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-dash-surface-foreground">
                {(accounts.data ?? []).map((row) => (
                  <tr key={row.userId} className="border-t border-dash-border/70 transition hover:bg-dash-gold/5">
                    <td className="py-3 pr-4 font-semibold">
                      {row.name}
                      {row.isMine && (
                        <span className="ml-2 rounded-full bg-dash-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-navy">
                          Mine
                        </span>
                      )}
                    </td>

                    <td className="py-3 pr-4 text-dash-surface-muted">
                      {row.email ? (
                        <a className="inline-flex items-center gap-1 hover:text-dash-surface-foreground" href={`mailto:${row.email}`}>
                          <Mail className="h-3.5 w-3.5" /> {row.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">{tab === "schools" ? (row.subscription ?? "—") : row.organisation}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          row.status === "suspended"
                            ? "bg-rose-500/15 text-rose-600"
                            : "bg-emerald-500/15 text-emerald-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    {tab === "schools" && (
                      <>
                        <td className="py-3 pr-4 tabular-nums">{row.teachers ?? 0}</td>
                        <td className="py-3 pr-4 tabular-nums">{row.students ?? 0}</td>
                        <td className="py-3 pr-4 tabular-nums">{row.parents ?? 0}</td>
                      </>
                    )}
                    <td className="py-3 pr-4 text-dash-surface-muted">{date(row.joinedAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button type="button" className={action} onClick={() => setPreviewId(row.userId)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </button>
                        <button
                          type="button"
                          className={action}
                          disabled={busyId === row.userId}
                          onClick={() => void enter(row.userId)}
                        >
                          {busyId === row.userId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LogIn className="h-3.5 w-3.5" />
                          )}
                          Enter workspace
                        </button>
                        <button
                          type="button"
                          className={action}
                          disabled={busyId === row.userId}
                          onClick={() => void toggleStatus(row.userId, row.status)}
                        >
                          {row.status === "suspended" ? (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" /> Suspend
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`${action} hover:border-destructive hover:bg-destructive/10`}
                          disabled={busyId === row.userId}
                          onClick={() => void destroy(row.userId, row.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {previewId && (
        <AccountPreviewSheet
          userId={previewId}
          onClose={() => setPreviewId(null)}
          onEnter={() => void enter(previewId)}
        />
      )}
      {addOpen && (
        <AddAccountDialog
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            void accounts.refetch();
            void stats.refetch();
          }}
        />
      )}
      {credentialTarget && (
        <CredentialEntryDialog
          target={credentialTarget}
          onClose={() => setCredentialTarget(null)}
        />
      )}

    </DashboardShell>
  );
};

export default AdminConsole;
