import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SignedMedia from "./SignedMedia";
import ShareMenu from "@/components/community/ShareMenu";
import type { CommunityKind } from "@/lib/community/types";
import {
  deleteGameAsset,
  listGameAssets,
  renderPathOf,
  uploadGameAsset,
} from "@/lib/games/assets";
import type { AssetKind, GameAssetRow } from "@/lib/games/types";
import { PROGRESS_PRESETS } from "@/lib/games/progressPresets";

const TABS: { kind: AssetKind; label: string }[] = [
  { kind: "background", label: "Background" },
  { kind: "reward", label: "Reward" },
  { kind: "progress_bar", label: "Progress Bar" },
  { kind: "effect", label: "Effect" },
];

/** Game asset kind → the Community shelf it is published on. */
const COMMUNITY_KIND: Record<AssetKind, CommunityKind> = {
  background: "background",
  reward: "reward",
  progress_bar: "asset",
  effect: "effect",
};


interface AssetsPanelProps {
  onPick: (asset: GameAssetRow) => void;
  onPickPreset?: (presetId: string) => void;
  value?: string;
  onValueChange?: (v: string) => void;
}

const KindGrid = ({
  kind,
  onPick,
  onPickPreset,
}: {
  kind: AssetKind;
  onPick: (asset: GameAssetRow) => void;
  onPickPreset?: (presetId: string) => void;
}) => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<GameAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setAssets(await listGameAssets(kind));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const transparent = kind !== "background";
    try {
      for (const file of Array.from(files)) {
        toast({
          title: transparent ? "Uploading + removing background…" : "Uploading…",
          description: file.name,
        });
        await uploadGameAsset(file, kind, file.name.replace(/\.[^.]+$/, ""));
      }
      toast({ title: "Uploaded", description: "Added to your library." });
      await refresh();
    } catch (e) {
      console.error(e);
      toast({ title: "Upload failed", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (asset: GameAssetRow) => {
    try {
      await deleteGameAsset(asset);
      setAssets((a) => a.filter((x) => x.id !== asset.id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      {kind === "progress_bar" && onPickPreset && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            MathGPL Library
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PROGRESS_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickPreset(p.id)}
                title={p.name}
                className="block w-full overflow-hidden rounded-lg border border-border/50 bg-black/40 p-1 transition hover:border-primary/60"
              >
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="mx-auto h-24 w-auto object-contain"
                />
              </button>
            ))}
          </div>
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your uploads
          </p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        variant="secondary"
        className="w-full"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload {kind === "background" ? "background" : kind.replace("_", " ")}
      </Button>
      {kind !== "background" && (
        <p className="text-[11px] leading-tight text-muted-foreground">
          Background is auto-removed so it blends seamlessly. Videos keep their own transparency.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((a) => (
            <div key={a.id} className="group relative">
              <button
                type="button"
                onClick={() => onPick(a)}
                className="block w-full overflow-hidden rounded-lg border border-border/50 bg-[conic-gradient(#0000_90deg,#8883_0)] bg-[length:16px_16px]"
                title={a.title}
              >
                <div className="aspect-square w-full">
                  <SignedMedia
                    path={renderPathOf(a)}
                    mediaType={a.media_type}
                    fit="contain"
                    className="h-full w-full"
                  />
                </div>
              </button>
              <ShareMenu
                className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100"
                triggerClassName="h-7 w-7"
                kind={COMMUNITY_KIND[kind]}
                sourceId={a.id}
                title={a.title}
                hashtags={`#${kind.replace("_", "")}`}
                payload={{
                  asset_id: a.id,
                  asset_kind: kind,
                  storage_path: renderPathOf(a),
                  media_type: a.media_type,
                }}
                onDelete={() => remove(a)}
              />

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AssetsPanel = ({ onPick, onPickPreset, value, onValueChange }: AssetsPanelProps) => (
  <Tabs
    value={value}
    onValueChange={onValueChange}
    defaultValue={value ? undefined : "background"}
    className="flex h-full flex-col"
  >
    <TabsList className="grid w-full grid-cols-4">
      {TABS.map((t) => (
        <TabsTrigger key={t.kind} value={t.kind} className="text-[11px]">
          {t.label}
        </TabsTrigger>
      ))}
    </TabsList>
    <div className="mt-3 flex-1 overflow-y-auto pr-1">
      {TABS.map((t) => (
        <TabsContent key={t.kind} value={t.kind} className="mt-0">
          <KindGrid kind={t.kind} onPick={onPick} onPickPreset={onPickPreset} />
        </TabsContent>
      ))}
    </div>
  </Tabs>
);

export default AssetsPanel;
