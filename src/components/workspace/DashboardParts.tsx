import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Link } from "@/lib/router-compat";

/** One real figure from the database — never a placeholder number. */
export const StatCard = ({
  label,
  value,
  suffix,
  icon: Icon,
  to,
  loading,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  to?: string;
  loading?: boolean;
}) => {
  const body = (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-tight">
          {loading ? "—" : `${value}${suffix ?? ""}`}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
};

/** A titled block in the right-hand context rail. */
export const RailCard = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: { to: string; label: string };
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <h2 className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
      {action && (
        <Link to={action.to} className="shrink-0 text-xs text-primary hover:underline">
          {action.label}
        </Link>
      )}
    </div>
    {children}
  </section>
);

/** Honest empty state: says what is missing instead of inventing content. */
export const EmptyNote = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">{children}</p>
);

export const ActivityList = ({
  items,
  empty,
}: {
  items: { id: string; title: string; detail: string; at: string | null }[];
  empty: string;
}) => {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs text-muted-foreground">
            <span className="truncate">{item.detail}</span>
            {item.at && <span className="shrink-0">{new Date(item.at).toLocaleDateString()}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
};
