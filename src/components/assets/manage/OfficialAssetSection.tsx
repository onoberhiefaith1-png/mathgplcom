// The official (database) assets of one sub-session, with the manager controls
// for adding, editing and removing them. Non-managers only see the assets.

import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreVertical, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAssetManager } from "@/lib/gpl/useAssetManager";
import GplAssetPreview from "@/components/admin/assets/GplAssetPreview";
import GplAssetCopyButton from "@/components/assets/manage/GplAssetCopyButton";
import { DeleteDialog } from "@/components/admin/assets/GplDialogs";
import AssetFormDialog, { type AssetFormItem } from "./AssetFormDialog";
import {
  createAsset, deleteAsset, getSessionBySlug, getSubSessionBySlug, listAssets, listUsage,
  setUsage, updateAsset, uploadOfficialFile, type GplAsset, type GplSubSession,
} from "@/lib/gpl/assetLibrary";

interface Props {
  sessionSlug: string;
  subSlug: string;
  /** Bundled URLs already rendered elsewhere on the page. */
  excludeUrls?: Set<string>;
  heading?: string;
}

const OfficialAssetSection = ({ sessionSlug, subSlug, excludeUrls, heading }: Props) => {
  const { isManager } = useAssetManager();
  const { toast } = useToast();

  const [sub, setSub] = useState<GplSubSession | null>(null);
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [usage, setUsageMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GplAsset | null>(null);
  const [deleting, setDeleting] = useState<GplAsset | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const session = await getSessionBySlug(sessionSlug);
      const found = session ? await getSubSessionBySlug(session.id, subSlug) : null;
      setSub(found);
      if (!found) {
        setAssets([]);
        return;
      }
      const rows = await listAssets(found.id);
      setAssets(rows);
      setUsageMap(await listUsage(rows.map((r) => r.id)));
    } catch {
      setSub(null);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSlug, subSlug]);

  const visible = useMemo(
    () =>
      assets
        .filter((a) => a.is_active || isManager)
        .filter((a) => !(excludeUrls && a.external_url && excludeUrls.has(a.external_url))),
    [assets, isManager, excludeUrls],
  );

  const saveNew = async (items: AssetFormItem[]) => {
    if (!sub) return;
    let order = assets.length ? Math.max(...assets.map((a) => a.sort_order)) + 1 : 0;
    for (const item of items) {
      const storagePath = item.file
        ? await uploadOfficialFile(item.file, sessionSlug, subSlug)
        : null;
      const created = await createAsset({
        subsession_id: sub.id,
        name: item.name,
        description: item.description || undefined,
        asset_type: item.asset_type,
        glyph: item.glyph || null,
        external_url: item.external_url || null,
        storage_path: storagePath,
        media_type: item.asset_type === "video" ? "video" : "image",
        sort_order: order,
      });
      order += 1;
      if (item.surfaces.length) await setUsage(created.id, item.surfaces);
    }
    await refresh();
    toast({ title: items.length > 1 ? `${items.length} assets added` : "Asset added" });
  };

  if (loading && !sub) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!sub) {
    return isManager ? (
      <p className="text-xs text-muted-foreground">
        Import the existing library on the Assets page to add official assets to this folder.
      </p>
    ) : null;
  }

  if (!isManager && visible.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">
          {heading ?? "Official library"}
        </h2>
        {isManager && (
          <Button onClick={() => setAddOpen(true)} className="min-h-[44px] gap-2">
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No official assets in this folder yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((asset) => (
            <figure
              key={asset.id}
              className="group relative overflow-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur"
            >
              <div className="aspect-square w-full overflow-hidden bg-background/30 p-3">
                <GplAssetPreview asset={asset} />
              </div>
              <GplAssetCopyButton asset={asset} />

              <figcaption className="px-3 py-2 text-center text-sm font-medium">
                {asset.name}
                {!asset.is_active && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    Inactive
                  </span>
                )}
                {isManager && (usage[asset.id]?.length ?? 0) > 0 && (
                  <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                    {usage[asset.id]!.length} destination
                    {usage[asset.id]!.length === 1 ? "" : "s"}
                  </span>
                )}
              </figcaption>

              {isManager && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${asset.name}`}
                      className="absolute right-2 top-2 rounded-full bg-foreground/70 p-1.5 text-background opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(asset)}>
                      Edit name, description &amp; usage
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void updateAsset(asset.id, { is_active: !asset.is_active }).then(refresh);
                      }}
                    >
                      {asset.is_active ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(asset)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </figure>
          ))}
        </div>
      )}

      <AssetFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Asset"
        onSave={saveNew}
      />

      <AssetFormDialog
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
                surfaces: (usage[editing.id] ?? []) as AssetFormItem["surfaces"],
              }
            : undefined
        }
        onSave={async (items) => {
          const item = items[0];
          if (!editing || !item) return;
          await updateAsset(editing.id, {
            name: item.name,
            description: item.description || null,
            glyph: item.glyph || null,
            external_url: item.external_url || null,
          });
          await setUsage(editing.id, item.surfaces);
          await refresh();
        }}
      />

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        what={deleting ? `the asset “${deleting.name}”` : "this asset"}
        impact="Deleting removes the file everywhere it is offered. Deactivating hides it while keeping the file."
        onDeactivate={async () => {
          if (deleting) await updateAsset(deleting.id, { is_active: false });
          await refresh();
        }}
        onDelete={async () => {
          if (deleting) await deleteAsset(deleting);
          await refresh();
        }}
      />
    </div>
  );
};

export default OfficialAssetSection;
