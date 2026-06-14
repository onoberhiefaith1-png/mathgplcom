import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { ADVENTURE_BACKGROUND_LIBRARY } from "@/lib/adventure/backgrounds";
import type { BackgroundRef } from "@/lib/adventure/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ref: BackgroundRef) => void;
}

export default function BackgroundLibraryModal({ open, onClose, onPick }: Props) {
  const [customUrl, setCustomUrl] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Choose Background</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {ADVENTURE_BACKGROUND_LIBRARY.map((b) => (
            <button
              key={b.id}
              onClick={() => { onPick({ kind: "library", ref: b.id, label: b.label }); onClose(); }}
              className="group relative aspect-video overflow-hidden rounded-md border border-border hover:border-primary"
            >
              <img src={b.url} alt={b.label} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-xs">{b.label}</span>
            </button>
          ))}
        </div>
        <div className="border-t pt-3 space-y-2">
          <div className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Custom background URL</div>
          <div className="flex gap-2">
            <Input placeholder="https://..." value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
            <Button
              disabled={!customUrl.trim()}
              onClick={() => { onPick({ kind: "url", ref: customUrl.trim() }); onClose(); }}
            >Use</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
