import type { LucideIcon } from "lucide-react";
import { sectionCardStyle, type SectionThemeKey } from "@/lib/theme/sectionThemes";

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
  /** Module identity from the shared section theme registry. */
  tone: SectionThemeKey;
  onClick?: () => void;
  active?: boolean;
}) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={sectionCardStyle(tone)}
      className={`group relative isolate overflow-hidden rounded-2xl border p-5 text-left text-section-ink shadow-[var(--shadow-section)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-section-hover)] active:translate-y-0 active:scale-[0.985] ${
        active ? "border-dash-gold ring-2 ring-dash-gold/40" : "border-section-ink/15"
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--section-scrim)" }}
      />
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-section-ink/15 text-section-ink shadow-inner backdrop-blur transition-transform duration-300 group-hover:scale-110"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-section-ink tabular-nums drop-shadow-sm">
        {value ?? "—"}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-section-ink-muted">
        {label}
      </div>
    </Tag>
  );
};

export default StatCard;
