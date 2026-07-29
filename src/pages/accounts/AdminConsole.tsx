import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Loader2 } from "lucide-react";
import RoleShell from "@/components/accounts/RoleShell";
import { useAccount } from "@/lib/accounts/useAccount";

const tabs = [
  { key: "schools", label: "Schools" },
  { key: "teachers", label: "Teachers" },
  { key: "parents", label: "Parents" },
  { key: "students", label: "Students" },
  { key: "admins", label: "Co-Administrators" },
];

/**
 * Platform control centre. Lists here are platform-level only: accounts that
 * registered directly. Users owned by a school or a teacher never appear.
 */
const AdminConsole = () => {
  const navigate = useNavigate();
  const { role, isLoading } = useAccount();
  const [tab, setTab] = useState("schools");

  useEffect(() => {
    if (isLoading) return;
    if (role !== "platform_owner" && role !== "co_admin") navigate("/home", { replace: true });
  }, [isLoading, role, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking access…
      </div>
    );
  }

  return (
    <RoleShell title="Platform">
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
        <p className="mt-2 text-sm text-muted-foreground">
          Platform-level {tab} only. Accounts created inside a school or by an independent teacher
          belong to that organisation and are never listed here.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Listing, usage, storage, subscriptions, impersonation and audit logging land in the next
          phase on top of this foundation.
        </p>
      </section>
    </RoleShell>
  );
};

export default AdminConsole;
