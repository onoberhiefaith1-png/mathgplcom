// Floating Number Archive.
//
// Every generate / reset / assistant apply snapshots the chips it is about to
// replace, so a previously generated configuration is never lost. This panel
// lists those snapshots as restorable versions.

import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2, RotateCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { ContainerKind } from "@/lib/lessonnotes/floatingCompile";

export interface ArchivedLine {
  lineId: string;
  chips: string[];
  containers: ContainerKind[];
}

export interface ArchivedVersion {
  key: string;
  createdAt: string;
  source: string;
  lines: ArchivedLine[];
}

const SOURCE_LABELS: Record<string, string> = {
  "pre-generate": "Before Generate",
  "pre-reset": "Before Reset",
  "pre-assistant-apply": "Before AI edit",
  "pre-table-generate": "Before table generate",
};

const label = (source: string) => SOURCE_LABELS[source] ?? source.replace(/[-_]/g, " ");

/** Snapshots written within the same second by the same action are one version. */
const bucketKey = (createdAt: string, source: string) =>
  `${source}|${new Date(createdAt).toISOString().slice(0, 19)}`;

const FloatingArchivePanel = ({
  subsectionId,
  onClose,
  onRestore,
}: {
  subsectionId: string;
  onClose: () => void;
  onRestore: (version: ArchivedVersion) => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ArchivedVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("floating_chip_snapshots")
      .select("id, line_id, chips, scaffolds, source, created_at")
      .eq("subsection_id", subsectionId)
      .order("created_at", { ascending: false })
      .limit(400);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const map = new Map<string, ArchivedVersion>();
    for (const row of (data ?? []) as {
      line_id: string; chips: unknown; scaffolds: unknown; source: string | null; created_at: string;
    }[]) {
      const source = row.source ?? "snapshot";
      const key = bucketKey(row.created_at, source);
      const existing = map.get(key) ?? { key, createdAt: row.created_at, source, lines: [] };
      existing.lines.push({
        lineId: row.line_id,
        chips: Array.isArray(row.chips) ? (row.chips as string[]).map(String) : [],
        containers: Array.isArray(row.scaffolds) ? (row.scaffolds as ContainerKind[]) : [],
      });
      map.set(key, existing);
    }
    setVersions([...map.values()]);
    setLoading(false);
  }, [subsectionId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-sm flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Archive</span>
        <button onClick={onClose} className="ml-auto rounded p-1 hover:bg-muted" aria-label="Close archive">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
          </p>
        )}
        {!loading && error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && versions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No archived configurations yet. Each Generate or Reset stores the version it replaced.
          </p>
        )}
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label(v.source)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()} · {v.lines.length} line
                    {v.lines.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 shrink-0 px-2" onClick={() => onRestore(v)}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                </Button>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                {v.lines.flatMap((l) => l.chips).slice(0, 12).join("  ") || "empty configuration"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FloatingArchivePanel;
