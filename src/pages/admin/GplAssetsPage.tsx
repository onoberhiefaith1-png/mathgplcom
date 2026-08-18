// Level 1 of the official GPL Asset library: the Sessions.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, DownloadCloud } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/lib/router-compat";
import GplFolderCard from "@/components/admin/assets/GplFolderCard";
import { DeleteDialog, FolderDialog } from "@/components/admin/assets/GplDialogs";
import {
  countSubSessions, createSession, deleteSession, importBundledCatalogue,
  listSessions, searchLibrary, updateSession,
  type GplSearchHit, type GplSession,
} from "@/lib/gpl/assetLibrary";

const GplAssetsPage = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<GplSession[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [importing, setImporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GplSession | null>(null);
  const [deleting, setDeleting] = useState<GplSession | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GplSearchHit[]>([]);

  const refresh = async () => {
    setBusy(true);
    try {
      const [rows, subCounts] = await Promise.all([listSessions(), countSubSessions()]);
      setSessions(rows);
      setCounts(subCounts);
    } catch (error) {
      toast({
        title: "Could not load the library",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      searchLibrary(q)
        .then((r) => alive && setHits(r))
        .catch(() => undefined);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const nextOrder = useMemo(
    () => (sessions.length ? Math.max(...sessions.map((s) => s.sort_order)) + 1 : 0),
    [sessions],
  );

  const runImport = async () => {
    setImporting(true);
    try {
      const report = await importBundledCatalogue();
      toast({
        title: "Existing library imported",
        description: `${report.sessions} sessions, ${report.subSessions} sub-sessions, ${report.assets} assets added. ${report.skipped} already present.`,
      });
      await refresh();
    } catch (error) {
      toast({
        title: "Import failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const hitPath = (hit: GplSearchHit) =>
    hit.subSessionSlug
      ? `/admin/assets/${hit.sessionSlug}/${hit.subSessionSlug}`
      : `/admin/assets/${hit.sessionSlug}`;

  return (
    <DashboardShell
      title="GPL Assets"
      subtitle="Sessions, sub-sessions and assets — the official MathGPL library."
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, sub-sessions, assets…"
            className="min-h-[44px] bg-white pl-9 text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <Button onClick={() => setAddOpen(true)} className="min-h-[44px] gap-2">
          <Plus className="h-4 w-4" /> Add Session
        </Button>
        <Button
          variant="secondary"
          className="min-h-[44px] gap-2"
          disabled={importing}
          onClick={() => void runImport()}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DownloadCloud className="h-4 w-4" />
          )}
          Import existing library
        </Button>
      </div>

      {hits.length > 0 && (
        <div className="mb-6 rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/70">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <Link
                  to={hitPath(hit)}
                  className="block rounded-lg px-2 py-1.5 text-sm text-dash-surface/85 hover:bg-dash-surface/10"
                >
                  {hit.path}
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-dash-surface/50">
                    {hit.kind === "subsession" ? "sub-session" : hit.kind}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {busy ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-dash-surface/70" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-10 text-center text-sm text-dash-surface/70">
          No sessions yet. Add one, or import the existing library to bring the current
          catalogue in as sessions and sub-sessions.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sessions.map((session) => (
            <GplFolderCard
              key={session.id}
              name={session.name}
              description={session.description}
              icon={session.icon}
              imageUrl={session.image_url}
              countLabel={`${counts[session.id] ?? 0} sub-sessions`}
              active={session.is_active}
              to={`/admin/assets/${session.slug}`}
              onEdit={() => setEditing(session)}
              onToggleActive={() => {
                void updateSession(session.id, { is_active: !session.is_active }).then(refresh);
              }}
              onDelete={() => setDeleting(session)}
            />
          ))}
        </div>
      )}

      <FolderDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Session"
        withIcon
        onSave={async (draft) => {
          await createSession({
            name: draft.name,
            description: draft.description || undefined,
            icon: draft.icon || undefined,
            image_url: draft.image_url || undefined,
            sort_order: nextOrder,
          });
          await refresh();
        }}
      />

      <FolderDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Session"
        withIcon
        initial={editing ?? undefined}
        onSave={async (draft) => {
          if (!editing) return;
          await updateSession(editing.id, {
            name: draft.name,
            description: draft.description || null,
            icon: draft.icon || null,
            image_url: draft.image_url || null,
          });
          await refresh();
        }}
      />

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        what={deleting ? `the session “${deleting.name}”` : "this session"}
        impact={
          deleting
            ? `This removes the session and its ${counts[deleting.id] ?? 0} sub-sessions together with every asset inside them. Deactivating hides it everywhere while keeping the contents.`
            : undefined
        }
        onDeactivate={async () => {
          if (deleting) await updateSession(deleting.id, { is_active: false });
          await refresh();
        }}
        onDelete={async () => {
          if (deleting) await deleteSession(deleting.id);
          await refresh();
        }}
      />
    </DashboardShell>
  );
};

export default GplAssetsPage;
