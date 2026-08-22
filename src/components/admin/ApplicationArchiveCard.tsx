// Application Archive — retired application FEATURES (not content).
//
// A feature listed here has been taken out of the active interface but its
// implementation is preserved. "Restore" brings it back immediately.

import { Archive, Loader2, RotateCcw } from "lucide-react";
import { useApplicationArchive } from "@/hooks/useArchivedFeature";

const ApplicationArchiveCard = () => {
  const { rows, loading, error, setArchived } = useApplicationArchive();

  return (
    <section className="rounded-3xl border border-dash-border bg-dash-surface p-6 shadow-[var(--shadow-dash)]">
      <div className="flex items-center gap-2">
        <Archive className="h-4 w-4 text-dash-gold" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-surface-foreground">
          Application Archive
        </h2>
      </div>
      <p className="mt-1 text-xs text-dash-surface-muted">
        Features temporarily retired from the active interface. Nothing is deleted — restore one to
        bring it back.
      </p>

      <div className="mt-4 space-y-2">
        {loading && (
          <p className="inline-flex items-center gap-2 text-xs text-dash-surface-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        )}
        {!loading && error && <p className="text-xs text-destructive">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-xs text-dash-surface-muted">No features archived.</p>
        )}
        {rows.map((r) => (
          <div
            key={r.feature_key}
            className="flex items-center justify-between gap-3 rounded-2xl border border-dash-border bg-background/40 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-dash-surface-foreground">
                {r.display_name}
              </p>
              <p className="text-[11px] text-dash-surface-muted">
                {r.archived ? "Archived — hidden from the app" : "Active in the app"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void setArchived(r.feature_key, !r.archived)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dash-border px-2.5 py-1.5 text-xs font-medium text-dash-surface-foreground transition hover:border-dash-gold hover:bg-dash-gold/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {r.archived ? "Restore" : "Archive"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ApplicationArchiveCard;
