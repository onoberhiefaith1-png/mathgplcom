import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { getCategory } from "@/data/assets";
import { Button } from "@/components/ui/button";
import { useAssetManager } from "@/lib/gpl/useAssetManager";
import ManagedFolderCard from "@/components/assets/manage/ManagedFolderCard";
import FolderFormDialog from "@/components/assets/manage/FolderFormDialog";
import { DeleteDialog } from "@/components/admin/assets/GplDialogs";
import {
  countAssets, createSubSession, deleteSubSession, getSessionBySlug, listSubSessions,
  updateSubSession, type GplSession, type GplSubSession,
} from "@/lib/gpl/assetLibrary";

const AssetCategory = () => {
  const { category } = useParams();
  const cat = getCategory(category);
  const { isManager } = useAssetManager();

  const [session, setSession] = useState<GplSession | null>(null);
  const [subs, setSubs] = useState<GplSubSession[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GplSubSession | null>(null);
  const [deleting, setDeleting] = useState<GplSubSession | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const parent = await getSessionBySlug(category ?? "");
      setSession(parent);
      if (!parent) {
        setSubs([]);
        return;
      }
      const rows = await listSubSessions(parent.id);
      setSubs(rows);
      setCounts(await countAssets(rows.map((r) => r.id)));
    } catch {
      setSession(null);
      setSubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const managedSlugs = useMemo(() => new Set(subs.map((s) => s.slug)), [subs]);
  const bundledOnly = (cat?.subcategories ?? []).filter((s) => !managedSlugs.has(s.slug));
  const nextOrder = subs.length ? Math.max(...subs.map((s) => s.sort_order)) + 1 : 0;

  if (!cat && !loading && !session) return <Navigate to="/assets" replace />;

  const title = cat?.name ?? session?.name ?? "Assets";

  return (
    <main className="relative min-h-screen text-foreground animate-fade-in">
      <SeamlessBackground file={cat?.background ?? "ivory.png"} />

      <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm drop-shadow">
            Assets
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl drop-shadow">{title}</h1>
        </div>
        <Link
          to="/assets"
          className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        {isManager && (
          <div className="mb-5">
            <Button
              onClick={() => setAddOpen(true)}
              disabled={!session}
              className="min-h-[44px] gap-2"
            >
              <Plus className="h-4 w-4" /> Add Sub-Session
            </Button>
            {!session && (
              <p className="mt-2 text-xs text-muted-foreground">
                Import the existing library on the Assets page to make this folder editable.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {subs
              .filter((s) => s.is_active || isManager)
              .map((sub) => (
                <ManagedFolderCard
                  key={sub.id}
                  name={sub.name}
                  description={sub.description}
                  imageUrl={sub.image_url}
                  countLabel={`${counts[sub.id] ?? 0} asset${(counts[sub.id] ?? 0) === 1 ? "" : "s"}`}
                  active={sub.is_active}
                  to={`/assets/${category}/${sub.slug}`}
                  manager={isManager}
                  onEdit={() => setEditing(sub)}
                  onToggleActive={() => {
                    void updateSubSession(sub.id, { is_active: !sub.is_active }).then(refresh);
                  }}
                  onDelete={() => setDeleting(sub)}
                />
              ))}

            {bundledOnly.map((s) => (
              <ManagedFolderCard
                key={s.slug}
                name={s.name}
                to={`/assets/${cat?.slug ?? category}/${s.slug}`}
              />
            ))}
          </div>
        )}
      </section>

      <FolderFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Sub-Session"
        onSave={async (draft) => {
          if (!session) return;
          await createSubSession({
            session_id: session.id,
            name: draft.name,
            description: draft.description || undefined,
            image_url: draft.image_url || undefined,
            sort_order: nextOrder,
          });
          await refresh();
        }}
      />

      <FolderFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Sub-Session"
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                image_url: editing.image_url ?? "",
              }
            : undefined
        }
        onSave={async (draft) => {
          if (!editing) return;
          await updateSubSession(editing.id, {
            name: draft.name,
            description: draft.description || null,
            image_url: draft.image_url || null,
          });
          await refresh();
        }}
      />

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        what={deleting ? `the sub-session “${deleting.name}”` : "this sub-session"}
        impact={
          deleting
            ? `This removes the sub-session and its ${counts[deleting.id] ?? 0} assets. Deactivating hides it everywhere while keeping the assets.`
            : undefined
        }
        onDeactivate={async () => {
          if (deleting) await updateSubSession(deleting.id, { is_active: false });
          await refresh();
        }}
        onDelete={async () => {
          if (deleting) await deleteSubSession(deleting.id);
          await refresh();
        }}
      />
    </main>
  );
};

export default AssetCategory;
