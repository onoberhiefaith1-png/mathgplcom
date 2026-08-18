// Level 3 of the official GPL Asset library: the assets inside one Sub-Session.

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, MoreVertical, Plus } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "@/lib/router-compat";
import GplAssetPreview from "@/components/admin/assets/GplAssetPreview";
import { AssetDialog, DeleteDialog } from "@/components/admin/assets/GplDialogs";
import {
  createAsset, deleteAsset, getSessionBySlug, getSubSessionBySlug, listAssets, listUsage,
  setUsage, updateAsset, uploadOfficialFile, SURFACE_LABEL,
  type GplAsset, type GplSession, type GplSubSession, type GplSurface,
} from "@/lib/gpl/assetLibrary";
import { invalidateOfficialEmoji, EMOJI_SESSION_SLUG } from "@/lib/gpl/officialEmoji";

const GplSubSessionPage = () => {
  const { session: sessionSlug, subsession: subSlug } = useParams<{
    session: string;
    subsession: string;
  }>();
  const { toast } = useToast();

  const [session, setSession] = useState<GplSession | null>(null);
  const [sub, setSub] = useState<GplSubSession | null>(null);
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [usage, setUsageMap] = useState<Record<string, GplSurface[]>>({});
  const [busy, setBusy] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GplAsset | null>(null);
  const [deleting, setDeleting] = useState<GplAsset | null>(null);
  const [detail, setDetail] = useState<GplAsset | null>(null);

  const refresh = async () => {
    setBusy(true);
    try {
      const parent = await getSessionBySlug(sessionSlug ?? "");
      setSession(parent);
      if (!parent) return;
      const child = await getSubSessionBySlug(parent.id, subSlug ?? "");
      setSub(child);
      if (!child) return;
      const rows = await listAssets(child.id);
      setAssets(rows);
      setUsageMap(await listUsage(rows.map((r) => r.id)));
      if (parent.slug === EMOJI_SESSION_SLUG) invalidateOfficialEmoji();
    } catch (error) {
      toast({
        title: "Could not load these assets",
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
  }, [sessionSlug, subSlug]);

  const nextOrder = useMemo(
    () => (assets.length ? Math.max(...assets.map((a) => a.sort_order)) + 1 : 0),
    [assets],
  );

  const dateOf = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric",
    });

  return (
    <DashboardShell title={sub?.name ?? "Sub-session"} subtitle="Assets in this sub-session.">
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-dash-surface/70">
        <Link to="/admin/assets" className="hover:text-dash-surface">GPL Assets</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/admin/assets/${sessionSlug}`} className="hover:text-dash-surface">
          {session?.name ?? sessionSlug}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-dash-surface">{sub?.name ?? subSlug}</span>
      </nav>

      <div className="mb-5">
        <Button onClick={() => setAddOpen(true)} disabled={!sub} className="min-h-[44px] gap-2">
          <Plus className="h-4 w-4" /> Add Asset
        </Button>
      </div>

      {busy ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-dash-surface/70" />
        </div>
      ) : !sub ? (
        <p className="text-sm text-dash-surface/70">This sub-session no longer exists.</p>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-10 text-center text-sm text-dash-surface/70">
          No assets yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative overflow-hidden rounded-2xl border border-dash-surface/15 bg-dash-surface/5 backdrop-blur"
            >
              <button
                type="button"
                onClick={() => setDetail(asset)}
                className="block w-full"
                title={asset.name}
              >
                <div className="h-28 w-full bg-dash-surface/10">
                  <GplAssetPreview asset={asset} />
                </div>
                <div className="p-3 text-left">
                  <p className="truncate text-xs font-semibold text-dash-surface">{asset.name}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-dash-surface/50">
                    {asset.asset_type}
                    {!asset.is_active && " · inactive"}
                  </p>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Actions for ${asset.name}`}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDetail(asset)}>Preview</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditing(asset)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void updateAsset(asset.id, { is_active: !asset.is_active }).then(refresh);
                    }}
                  >
                    {asset.is_active ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleting(asset)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="mt-6 rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
          <div className="flex flex-wrap items-start gap-5">
            <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-dash-surface/10">
              <GplAssetPreview asset={detail} />
            </div>
            <dl className="grid flex-1 gap-2 text-sm text-dash-surface/80 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Name</dt><dd>{detail.name}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Type</dt><dd>{detail.asset_type}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Session</dt><dd>{session?.name}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Sub-session</dt><dd>{sub?.name}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Status</dt><dd>{detail.is_active ? "Active" : "Inactive"}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Used in</dt><dd>{(usage[detail.id] ?? []).map((s) => SURFACE_LABEL[s]).join(", ") || "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Created</dt><dd>{dateOf(detail.created_at)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-dash-surface/50">Updated</dt><dd>{dateOf(detail.updated_at)}</dd></div>
              {detail.description && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-dash-surface/50">Description</dt>
                  <dd>{detail.description}</dd>
                </div>
              )}
            </dl>
            <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
          </div>
        </div>
      )}

      <AssetDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Asset"
        onSave={async (draft) => {
          if (!sub || !session) return;
          let storagePath: string | null = null;
          if (draft.file) {
            storagePath = await uploadOfficialFile(draft.file, session.slug, sub.slug);
          }
          const created = await createAsset({
            subsession_id: sub.id,
            name: draft.name,
            asset_type: draft.asset_type,
            description: draft.description || undefined,
            storage_path: storagePath,
            external_url: draft.external_url || null,
            glyph: draft.asset_type === "emoji" ? draft.glyph : null,
            media_type: draft.asset_type === "video" ? "video" : "image",
            sort_order: nextOrder,
          });
          await setUsage(created.id, draft.surfaces);
          invalidateOfficialEmoji();
          await refresh();
        }}
      />

      <AssetDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Asset"
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                asset_type: editing.asset_type,
                glyph: editing.glyph ?? "",
                external_url: editing.external_url ?? "",
                surfaces: usage[editing.id] ?? [],
              }
            : undefined
        }
        onSave={async (draft) => {
          if (!editing || !sub || !session) return;
          const patch: Partial<GplAsset> = {
            name: draft.name,
            description: draft.description || null,
            asset_type: draft.asset_type,
            glyph: draft.asset_type === "emoji" ? draft.glyph : null,
            external_url: draft.external_url || null,
            media_type: draft.asset_type === "video" ? "video" : "image",
          };
          if (draft.file) {
            patch.storage_path = await uploadOfficialFile(draft.file, session.slug, sub.slug);
          }
          await updateAsset(editing.id, patch);
          await setUsage(editing.id, draft.surfaces);
          invalidateOfficialEmoji();
          await refresh();
        }}
      />

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        what={deleting ? `the asset “${deleting.name}”` : "this asset"}
        impact="Deleting also removes its uploaded file. Deactivating keeps the file but hides the asset everywhere."
        onDeactivate={async () => {
          if (deleting) await updateAsset(deleting.id, { is_active: false });
          invalidateOfficialEmoji();
          await refresh();
        }}
        onDelete={async () => {
          if (deleting) await deleteAsset(deleting);
          invalidateOfficialEmoji();
          setDetail(null);
          await refresh();
        }}
      />
    </DashboardShell>
  );
};

export default GplSubSessionPage;
