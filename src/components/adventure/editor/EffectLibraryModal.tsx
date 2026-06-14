import { useMemo, useState } from "react";
import { Search, Upload, X } from "lucide-react";
import { ADVENTURE_EFFECTS, type EffectAsset } from "@/lib/adventure/effects";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (url: string, label: string) => void;
  onUpload?: (file: File) => Promise<{ url: string; label: string }>;
}

export default function EffectLibraryModal({ open, onClose, onPick, onUpload }: Props) {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const s = q.toLowerCase().trim();
    return s ? ADVENTURE_EFFECTS.filter((e) => e.label.toLowerCase().includes(s)) : ADVENTURE_EFFECTS;
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-semibold">Effect Library</div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 border-b p-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search effects…" className="h-8" />
          {onUpload && (
            <label className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent">
              <Upload className="h-3 w-3" /> Upload
              <input type="file" accept="video/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const { url, label } = await onUpload(f);
                onPick(url, label); onClose();
              }} />
            </label>
          )}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((e: EffectAsset) => (
            <button key={e.id}
              onClick={() => { onPick(e.url, e.label); onClose(); }}
              className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left hover:ring-2 hover:ring-primary"
            >
              <video src={e.url} muted loop autoPlay playsInline className="aspect-video w-full object-cover bg-black" style={{ mixBlendMode: "screen" }} />
              <div className="truncate px-2 py-1 text-[11px]">{e.label}</div>
            </button>
          ))}
          {items.length === 0 && <div className="col-span-full p-6 text-center text-sm text-muted-foreground">No effects match.</div>}
        </div>
        <div className="border-t p-2 text-right">
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
