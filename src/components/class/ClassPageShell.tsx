import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";

/**
 * Premium chrome for class/session pages — the same navy canvas + light
 * elevated cards design language used by the account workspaces, so a class
 * no longer looks duller than the rest of the platform.
 */
const ClassPageShell = ({
  backTo,
  backLabel,
  title,
  subtitle,
  actions,
  children,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="min-h-screen w-full text-dash-surface" style={{ background: "var(--gradient-dash-canvas)" }}>
    <header className="mx-auto w-full max-w-7xl px-6 pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </Link>
          <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight text-dash-surface">{title}</h1>
          {subtitle && <div className="mt-1 max-w-2xl text-sm text-dash-surface/70">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>

    <main className="mx-auto w-full max-w-7xl px-6 pb-20 pt-8">{children}</main>
  </div>
);

export default ClassPageShell;
