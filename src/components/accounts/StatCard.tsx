import type { LucideIcon } from "lucide-react";

/**
 * Premium dashboard stat card: own colour identity, icon, title, number,
 * hover lift and click feedback. Light surface on the navy canvas.
 */
const StatCard = ({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string | undefined;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`group relative overflow-hidden rounded-2xl border bg-dash-surface p-5 text-left shadow-[var(--shadow-dash)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_54px_-24px_hsl(224_60%_6%/0.7)] active:translate-y-0 active:scale-[0.985] ${
        active ? "border-dash-gold ring-2 ring-dash-gold/40" : "border-dash-border"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone}`}
      />
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-dash-surface shadow-md transition-transform duration-200 group-hover:scale-110`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-dash-surface-foreground tabular-nums">
        {value ?? "—"}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">
        {label}
      </div>
    </Tag>
  );
};

export default StatCard;
