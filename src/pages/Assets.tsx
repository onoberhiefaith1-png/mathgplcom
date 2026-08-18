import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Download, Loader2, Plus, Sparkles } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { assetCategories } from "@/data/assets";
import QuestionProgressContainer from "@/components/assets/QuestionProgressContainer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAssetManager } from "@/lib/gpl/useAssetManager";
import ManagedFolderCard from "@/components/assets/manage/ManagedFolderCard";
import FolderFormDialog from "@/components/assets/manage/FolderFormDialog";
import { DeleteDialog } from "@/components/admin/assets/GplDialogs";
import {
  countSubSessions, createSession, deleteSession, importBundledCatalogue, listSessions,
  updateSession, type GplSession,
} from "@/lib/gpl/assetLibrary";

/** Library folders: database sessions first, with the bundled catalogue behind them. */
const Assets = () => {
  const { isManager } = useAssetManager();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<GplSession[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GplSession | null>(null);
  const [deleting, setDeleting] = useState<GplSession | null>(null);
  const [importing, setImporting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listSessions();
      setSessions(rows);
      setCounts(await countSubSessions());
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const managedSlugs = useMemo(() => new Set(sessions.map((s) => s.slug)), [sessions]);
  const bundledOnly = assetCategories.filter((c) => !managedSlugs.has(c.slug));
  const nextOrder = sessions.length ? Math.max(...sessions.map((s) => s.sort_order)) + 1 : 0;

  const runImport = async () => {
    setImporting(true);
    try {
      const report = await importBundledCatalogue();
      toast({
        title: "Existing library imported",
        description: `${report.sessions} sessions, ${report.subSessions} sub-sessions and ${report.assets} assets are now editable.`,
      });
      await refresh();
    } catch (error) {
      toast({ title: "Import failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="relative min-h-screen text-foreground animate-fade-in">
      <SeamlessBackground file="ivory.png" />

      <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm drop-shadow">
            Game Assets
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl drop-shadow">Assets</h1>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
          Interactive
        </h2>
        <Link
          to="/assets/interactive/question-progress"
          className="group flex items-center gap-5 rounded-xl border border-primary/40 bg-background/60 p-5 backdrop-blur transition hover:border-primary hover:bg-background/80"
        >
          <QuestionProgressContainer
            
            current={6}
            max={10}
            theme="purple"
            width={88}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Question Progress Container
            </div>
            <div className="text-xs text-muted-foreground">
              Reusable crystal vessel with live liquid fill driven by current ÷ max. Configurable themes.
            </div>
          </div>
        </Link>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Library</h2>
          {isManager && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAddOpen(true)} className="min-h-[44px] gap-2">
                <Plus className="h-4 w-4" /> Add Session
              </Button>
              {bundledOnly.length > 0 && (
                <Button
                  variant="secondary"
                  className="min-h-[44px] gap-2"
                  disabled={importing}
                  onClick={() => void runImport()}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Import existing library
                </Button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {sessions
              .filter((s) => s.is_active || isManager)
              .map((session) => (
                <ManagedFolderCard
                  key={session.id}
                  name={session.name}
                  description={session.description}
                  icon={session.icon}
                  imageUrl={session.image_url}
                  countLabel={`${counts[session.id] ?? 0} folder${(counts[session.id] ?? 0) === 1 ? "" : "s"}`}
                  active={session.is_active}
                  to={`/assets/${session.slug}`}
                  manager={isManager}
                  onEdit={() => setEditing(session)}
                  onToggleActive={() => {
                    void updateSession(session.id, { is_active: !session.is_active }).then(refresh);
                  }}
                  onDelete={() => setDeleting(session)}
                />
              ))}

            {bundledOnly.map((c) => (
              <ManagedFolderCard
                key={c.slug}
                name={c.name}
                countLabel={`${c.subcategories.length} folder${c.subcategories.length === 1 ? "" : "s"}`}
                to={`/assets/${c.slug}`}
              />
            ))}
          </div>
        )}
      </section>

      <FolderFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Session"
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

      <FolderFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Session"
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                icon: editing.icon ?? "",
                image_url: editing.image_url ?? "",
              }
            : undefined
        }
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
            ? `This removes the session and its ${counts[deleting.id] ?? 0} sub-sessions with their assets. Deactivating hides it everywhere while keeping everything.`
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
    </main>
  );
};

export default Assets;
