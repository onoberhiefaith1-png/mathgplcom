import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, X, Building2, Users, GraduationCap, CalendarDays } from "lucide-react";
import { fetchAccountDetail } from "@/lib/accounts/platform.functions";

const Row = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex items-start justify-between gap-4 border-b border-dash-border/70 py-2.5 last:border-0">
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-dash-surface-muted">{label}</span>
    <span className="text-right text-sm font-medium text-dash-surface-foreground">{value ?? "—"}</span>
  </div>
);

/**
 * Preview an account before entering it: profile, organisation, subscription
 * and membership counts only. Never lesson notes, classes or student work.
 */
const AccountPreviewSheet = ({
  userId,
  onClose,
  onEnter,
}: {
  userId: string;
  onClose: () => void;
  onEnter: () => void;
}) => {
  const load = useServerFn(fetchAccountDetail);
  const detail = useQuery({
    queryKey: ["platform-account-detail", userId],
    queryFn: () => load({ data: { userId } }),
  });
  const d = detail.data;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button type="button" aria-label="Close preview" onClick={onClose} className="flex-1 bg-dash-navy/60 backdrop-blur-sm" />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-dash-border bg-dash-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-surface-muted">
              Account preview
            </div>
            <h2 className="mt-1 text-xl font-semibold text-dash-surface-foreground">{d?.name ?? "Loading…"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-dash-border p-1.5 text-dash-surface-muted transition hover:text-dash-surface-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {detail.isLoading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-dash-surface-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { icon: GraduationCap, label: "Teachers", value: d?.teachers ?? 0 },
                { icon: Users, label: "Students", value: d?.students ?? 0 },
                { icon: Users, label: "Parents", value: d?.parents ?? 0 },
                { icon: Building2, label: "Classes", value: d?.classes ?? 0 },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-dash-border p-3">
                  <m.icon className="h-4 w-4 text-dash-gold" />
                  <div className="mt-2 text-xl font-semibold tabular-nums text-dash-surface-foreground">{m.value}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-dash-border p-4">
              <Row label="Email" value={d?.email || "—"} />
              <Row label="Role" value={d?.role?.replace(/_/g, " ")} />
              <Row label="Organisation" value={d?.organisation} />
              <Row label="Status" value={d?.status} />
              <Row label="Subscription" value={d?.subscription} />
              <Row label="Joined" value={d?.joinedAt ? new Date(d.joinedAt).toLocaleDateString() : "—"} />
              <Row
                label="Last sign-in"
                value={d?.lastSignInAt ? new Date(d.lastSignInAt).toLocaleString() : "Never"}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEnter}
                className="rounded-xl bg-dash-navy px-4 py-2 text-sm font-semibold text-dash-surface transition hover:opacity-90"
              >
                Enter workspace
              </button>
              {d?.email && (
                <a
                  href={`mailto:${d.email}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dash-border px-4 py-2 text-sm font-medium text-dash-surface-foreground transition hover:border-dash-gold"
                >
                  <Mail className="h-4 w-4" /> Contact
                </a>
              )}
            </div>

            <p className="mt-4 inline-flex items-start gap-2 text-xs text-dash-surface-muted">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Preview shows account information only — this customer's lesson notes, classes and
              student work stay private until you enter the workspace.
            </p>
          </>
        )}
      </aside>
    </div>
  );
};

export default AccountPreviewSheet;
