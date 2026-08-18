// Level 2 of the official GPL Asset library: the Sub-Sessions of one Session.

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "@/lib/router-compat";
import GplFolderCard from "@/components/admin/assets/GplFolderCard";
import { DeleteDialog, FolderDialog } from "@/components/admin/assets/GplDialogs";
import {
  countAssets, createSubSession, deleteSubSession, getSessionBySlug, listSubSessions,
  updateSubSession, type GplSession, type GplSubSession,
} from "@/lib/gpl/assetLibrary";

const GplSessionPage = () => {
  const { session: sessionSlug } = useParams<{ session: string }>();
  const { toast } = useToast();
  const [session, setSession] = useState<GplSession | null>(null);
  const [subs, setSubs] = useState<GplSubSession[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GplSubSession | null>(null);
  const [deleting, setDeleting] = useState<GplSubSession | null>(null);

  const refresh = async () => {
    setBusy(true);
    try {
      const parent = await getSessionBySlug(sessionSlug ?? "");
      setSession(parent);
      if (!parent) {
        setSubs([]);
        return;
      }
      const rows = await listSubSessions(parent.id);
      setSubs(rows);
      setCounts(await countAssets(rows.map((r) => r.id)));
    } catch (error) {
      toast({
        title: "Could not load this session",
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
  }, [sessionSlug]);

  const nextOrder = useMemo(
    () => (subs.length ? Math.max(...subs.map((s) => s.sort_order)) + 1 : 0),
    [subs],
  );

  return (
    <DashboardShell
      title={session?.name ?? "Session"}
      subtitle="Sub-sessions inside this session."
    >
      <nav className="mb-5 flex items-center gap-1 text-xs text-dash-surface/70">
        <Link to="/admin/assets" className="hover:text-dash-surface">GPL Assets</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-dash-surface">{session?.name ?? sessionSlug}</span>
      </nav>

      <div className="mb-5">
        <Button
          onClick={() => setAddOpen(true)}
          disabled={!session}
          className="min-h-[44px] gap-2"
        >
          <Plus className="h-4 w-4" /> Add Sub-Session
        </Button>
      </div>

      {busy ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-dash-surface/70" />
        </div>
      ) : !session ? (
        <p className="text-sm text-dash-surface/70">This session no longer exists.</p>
      ) : subs.length === 0 ? (
        <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-10 text-center text-sm text-dash-surface/70">
          No sub-sessions yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {subs.map((sub) => (
            <GplFolderCard
              key={sub.id}
              name={sub.name}
              description={sub.description}
              imageUrl={sub.image_url}
              countLabel={`${counts[sub.id] ?? 0} assets`}
              active={sub.is_active}
              to={`/admin/assets/${session.slug}/${sub.slug}`}
              onEdit={() => setEditing(sub)}
              onToggleActive={() => {
                void updateSubSession(sub.id, { is_active: !sub.is_active }).then(refresh);
              }}
              onDelete={() => setDeleting(sub)}
            />
          ))}
        </div>
      )}

      <FolderDialog
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

      <FolderDialog
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
    </DashboardShell>
  );
};

export default GplSessionPage;
