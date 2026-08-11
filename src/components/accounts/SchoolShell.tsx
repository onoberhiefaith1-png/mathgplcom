import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import SchoolCommandNav from "@/components/accounts/SchoolCommandNav";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";

/**
 * Chrome for the School Console — an administrative console, not a teaching
 * surface: the rotating building lives at home, the administration lives here,
 * and there is never a Teaching Hub in a school account's navigation.
 *
 * Directory pages (Teachers, Students) set `nav={false}`: those pages are
 * about the real people connected to the school, so the people come first and
 * the console cards stay on the dashboard.
 */

const SchoolShell = ({
  title,
  subtitle,
  children,
  nav = true,
  backTo = "/",
  backLabel = "Home",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  nav?: boolean;
  backTo?: string;
  backLabel?: string;
}) => (
  <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
      <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>
      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">School Command Centre</span>
      <WorkspaceSwitcher compact />
    </header>

    <main className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {nav && <SchoolCommandNav />}
      {children}
    </main>
  </div>
);

export default SchoolShell;
