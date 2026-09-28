/**
 * The one Academia navigation bar: Back (one level up) + breadcrumb.
 * Used on every Academia page for Students, Teachers and Schools.
 */
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, ChevronRight } from "lucide-react";

export type Crumb = { label: string; to?: string };

const AcademiaTopBar = ({ back, crumbs }: { back?: string | null; crumbs: Crumb[] }) => {
  const navigate = useNavigate();
  return (
    <nav aria-label="Academia" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/80 px-3 py-2">
      <button
        type="button"
        onClick={() => (back ? navigate(back) : navigate(-1))}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-primary/60 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate hover:text-foreground">{c.label}</Link>
            ) : (
              <span className={`truncate ${i === crumbs.length - 1 ? "font-medium text-foreground" : ""}`}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default AcademiaTopBar;
