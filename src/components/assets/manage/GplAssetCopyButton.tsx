// Copy any GPL asset to the clipboard: pictures travel as the picture itself,
// everything else as its link. Emojis copy as their character.

import { Clipboard, Check } from "lucide-react";
import { useState } from "react";
import { useSignedUrl } from "@/components/gamebuilder/SignedMedia";
import { copyMediaToClipboard } from "@/lib/clipboard/assetClipboard";
import { useToast } from "@/hooks/use-toast";
import type { GplAsset } from "@/lib/gpl/assetLibrary";

const GplAssetCopyButton = ({ asset }: { asset: GplAsset }) => {
  const signed = useSignedUrl(asset.storage_path);
  const { toast } = useToast();
  const [done, setDone] = useState(false);

  const copy = async () => {
    if (asset.asset_type === "emoji" && asset.glyph) {
      await navigator.clipboard.writeText(asset.glyph);
      toast({ title: "Emoji copied — paste it anywhere" });
    } else {
      const url = signed ?? asset.external_url;
      if (!url) {
        toast({ title: "Nothing to copy yet", variant: "destructive" });
        return;
      }
      const res = await copyMediaToClipboard(url);
      toast({ title: res.message, variant: res.ok ? "default" : "destructive" });
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1500);
  };

  return (
    <button
      type="button"
      aria-label={`Copy ${asset.name}`}
      title="Copy — paste into a lesson note, emoji session or upload box"
      onClick={() => void copy()}
      className="absolute left-2 top-2 rounded-full bg-foreground/70 p-1.5 text-background opacity-0 transition group-hover:opacity-100 focus:opacity-100"
    >
      {done ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
    </button>
  );
};

export default GplAssetCopyButton;
