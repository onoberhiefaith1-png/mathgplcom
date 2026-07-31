import { useState, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { useAccount } from "@/lib/accounts/useAccount";
import { ROLE_LABEL, ROLE_NAV } from "@/lib/accounts/roles";
import { DASHBOARD_BACKGROUNDS, useDashboardBackground } from "@/lib/accounts/dashboardBackground";
import ImpersonationBanner from "./ImpersonationBanner";

/**
 * Premium chrome shared by the Platform, School and Family dashboards.
 * Navy canvas, light elevated cards, gold accents — the same design language
 * across every account type. The canvas itself is owner-customisable.
 */
const DashboardShell = ({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  const { role } = useAccount();
  const nav = role ? ROLE_NAV[role] : [];
  const { id: bgId, css, choose } = useDashboardBackground();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="min-h-screen w-full text-dash-surface" style={{ background: css }}>
      <ImpersonationBanner />

      <header className="mx-auto w-full max-w-7xl px-6 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> MathGPL
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-dash-surface">{title}</h1>
            {subtitle && <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <span className="inline-flex items-center gap-2 rounded-full border border-dash-gold/40 bg-dash-navy/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-gold backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              {role ? ROLE_LABEL[role] : ""}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-3 py-1.5 text-xs font-medium text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Change background
              </button>
              {pickerOpen && (
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-dash-border bg-dash-surface p-3 shadow-[var(--shadow-dash)]">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">
                    Dashboard background
                  </div>
                  <ul className="space-y-1.5">
                    {DASHBOARD_BACKGROUNDS.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void choose(b.id);
                            setPickerOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-dash-border/70 p-2 text-left text-sm text-dash-surface-foreground transition hover:border-dash-gold"
                        >
                          <span className="h-7 w-12 shrink-0 rounded-md border border-dash-border" style={{ background: b.css }} />
                          <span className="flex-1 truncate">{b.label}</span>
                          {bgId === b.id && <Check className="h-4 w-4 text-dash-gold" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="mt-7 flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.to + item.label}
              to={item.to}
              className="rounded-full border border-dash-surface/20 bg-dash-surface/10 px-4 py-1.5 text-sm text-dash-surface/85 backdrop-blur transition hover:border-dash-gold/60 hover:bg-dash-surface/20 hover:text-dash-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-20 pt-8">{children}</main>
    </div>
  );
};

export default DashboardShell;
