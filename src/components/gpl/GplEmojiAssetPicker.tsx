// Browses the official GPL assets published to the Emojis destination so a
// teacher can drop one straight into their own emoji session.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import GplAssetPreview from "@/components/admin/assets/GplAssetPreview";
import type { GplAsset } from "@/lib/gpl/assetLibrary";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (asset: GplAsset) => void;
}

const loadEmojiSurfaceAssets = async (): Promise<GplAsset[]> => {
  const usage = await supabase
    .from("gpl_asset_usage")
    .select("asset_id")
    .eq("surface", "emoji_library");
  const ids = ((usage.data ?? []) as { asset_id: string }[]).map((r) => r.asset_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("gpl_assets")
    .select("*")
    .in("id", ids)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as GplAsset[];
};

const GplEmojiAssetPicker = ({ open, onClose, onPick }: Props) => {
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void loadEmojiSurfaceAssets()
      .then(setAssets)
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My GPL assets</DialogTitle>
          <DialogDescription>
            Assets published to the Emojis destination. Pick one to add it to this session.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : assets.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No GPL assets are published to Emojis yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  onPick(asset);
                  onClose();
                }}
                className="rounded-xl border border-border/50 p-2 text-center transition hover:border-primary hover:bg-muted/40"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <GplAssetPreview asset={asset} />
                </div>
                <span className="mt-1 block truncate text-[11px]">{asset.name}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GplEmojiAssetPicker;
