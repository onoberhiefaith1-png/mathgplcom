import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail } from "lucide-react";
import RoleShell from "@/components/accounts/RoleShell";
import { useAccount } from "@/lib/accounts/useAccount";
import { fetchPlatformStats, fetchPlatformAccounts } from "@/lib/accounts/platform.functions";

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
 * only — nothing here opens a customer's lesson notes, classes or student work.
 */
const AdminConsole = () => {
  const navigate = useNavigate();
  const { role, isLoading } = useAccount();
  const [tab, setTab] = useState<TabKey>("schools");

  const loadStats = useServerFn(fetchPlatformStats);
  const loadAccounts = useServerFn(fetchPlatformAccounts);

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking access…
      </div>
    );
  }

  const s = stats.data;
  const overview = [
    { label: "Schools", value: s?.schools },
    { label: "Teachers", value: s?.teachers },
    { label: "Parents", value: s?.parents },
    { label: "Students", value: s?.students },
    { label: "Active subscriptions", value: s?.activeOrgs },
    { label: "Expired / suspended", value: s?.suspendedOrgs },
    { label: "New in 30 days", value: s?.newThisMonth },
  ];

  return (
    <RoleShell title="Platform">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {overview.map((o) => (
          <div key={o.label} className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
            <div className="text-2xl font-semibold">{o.value ?? "—"}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{o.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
        <h2 className="text-lg font-semibold capitalize">{tab}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Registered {tab}. Contact them at their registered email address — their workspace content
          stays private.
        </p>

        <div className="mt-5 overflow-x-auto">
          {accounts.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (accounts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No {tab} registered yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
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
                </tr>
              </thead>
              <tbody>
                {(accounts.data ?? []).map((row) => (
                  <tr key={row.userId} className="border-t border-border/60">
                    <td className="py-2 pr-4 font-medium">{row.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {row.email ? (
                        <a className="inline-flex items-center gap-1 hover:text-foreground" href={`mailto:${row.email}`}>
                          <Mail className="h-3.5 w-3.5" /> {row.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">{tab === "schools" ? (row.subscription ?? "—") : row.organisation}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    {tab === "schools" && (
                      <>
                        <td className="py-2 pr-4">{row.teachers ?? 0}</td>
                        <td className="py-2 pr-4">{row.students ?? 0}</td>
                        <td className="py-2 pr-4">{row.parents ?? 0}</td>
                      </>
                    )}
                    <td className="py-2 pr-4 text-muted-foreground">{date(row.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </RoleShell>
  );
};

export default AdminConsole;
