import type { ReactNode } from "react";
import DashboardShell from "@/components/accounts/DashboardShell";

/**
 * Lets an admin page render either as its own dashboard page or as one section
 * inside a larger consolidated page. Embedded, it drops the page chrome
 * (heading, background picker, page actions) and contributes only its content.
 */
const EmbeddableShell = ({
  embedded,
  title,
  subtitle,
  actions,
  children,
}: {
  embedded?: boolean;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  if (embedded) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-dash-surface">{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-dash-surface/65">{subtitle}</p>}
        </div>
        {children}
      </section>
    );
  }
  return (
    <DashboardShell title={title} subtitle={subtitle} actions={actions}>
      {children}
    </DashboardShell>
  );
};

export default EmbeddableShell;
