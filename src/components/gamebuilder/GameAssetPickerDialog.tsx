import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SignedMedia from "./SignedMedia";
import { listGameAssets, renderPathOf } from "@/lib/games/assets";
import type { AssetKind, GameAssetRow, MediaType } from "@/lib/games/types";

export interface GameAssetPick {
  path: string;
  mediaType: MediaType;
  title: string;
}

const KINDS: { kind: AssetKind; label: string }[] = [
  { kind: "background", label: "Backgrounds" },
  { kind: "reward", label: "Rewards" },
  { kind: "progress_bar", label: "Progress" },
  { kind: "effect", label: "Effects" },
];

const Grid = ({ kind, onPick }: { kind: AssetKind; onPick: (p: GameAssetPick) => void }) => {
  const [assets, setAssets] = useState<GameAssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void listGameAssets(kind)
      .then((rows) => {
        if (alive) setAssets(rows);
      })
      .catch(console.error)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (assets.length === 0) {
    return <p className="py-10 text-center text-xs text-muted-foreground">Nothing saved here yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {assets.map((a) => (
        <button
          key={a.id}
          type="button"
          title={a.title}
          onClick={() =>
            onPick({ path: renderPathOf(a), mediaType: a.media_type as MediaType, title: a.title })
          }
          className="overflow-hidden rounded-xl border border-border/50 bg-black/30 transition hover:border-primary/60"
        >
          <div className="aspect-video w-full">
            <SignedMedia
              path={renderPathOf(a)}
              mediaType={a.media_type}
              fit="cover"
              className="h-full w-full"
            />
          </div>
          <p className="truncate px-2 py-1.5 text-left text-[11px]">{a.title}</p>
        </button>
      ))}
    </div>
  );
};

/** Pick an already-saved GPL asset — no upload, no duplicate copy. */
const GameAssetPickerDialog = ({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (pick: GameAssetPick) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>GPL Assets</DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="background">
        <TabsList className="grid w-full grid-cols-4">
          {KINDS.map((k) => (
            <TabsTrigger key={k.kind} value={k.kind} className="text-[11px]">
              {k.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
          {KINDS.map((k) => (
            <TabsContent key={k.kind} value={k.kind} className="mt-0">
              <Grid
                kind={k.kind}
                onPick={(p) => {
                  onPick(p);
                  onOpenChange(false);
                }}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </DialogContent>
  </Dialog>
);

export default GameAssetPickerDialog;
