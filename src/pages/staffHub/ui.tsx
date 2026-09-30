import type { ReactNode } from "react";
import type { Priority, TaskStatus } from "@/lib/staffHub/api";
import { STATUS_LABEL } from "@/lib/staffHub/api";

export const Panel = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="rounded-2xl border border-border bg-card">
    <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const STATUS_TONE: Record<TaskStatus, string> = {
  assigned: "bg-muted text-foreground",
  in_progress: "bg-primary/15 text-primary",
  submitted: "bg-accent text-accent-foreground",
  changes_requested: "bg-destructive/15 text-destructive",
  completed: "bg-secondary text-secondary-foreground",
};
export const StatusPill = ({ status, overdue }: { status: string; overdue?: boolean }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${overdue ? "bg-destructive text-destructive-foreground" : STATUS_TONE[status as TaskStatus] ?? "bg-muted"}`}>
    {overdue ? "Overdue" : STATUS_LABEL[status as TaskStatus] ?? status}
  </span>
);

export const PriorityPill = ({ p }: { p: Priority | string }) => (
  <span
    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
      p === "urgent" ? "border-destructive text-destructive" : p === "high" ? "border-primary text-primary" : "border-border text-muted-foreground"
    }`}
  >
    {p}
  </span>
);

export const Avatar = ({ name, url }: { name: string; url?: string | null }) =>
  url ? (
    <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );

export const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
export const btn =
  "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
export const btnGhost =
  "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm transition hover:bg-muted disabled:opacity-50";
export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
);
