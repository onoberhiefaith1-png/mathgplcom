/**
 * "Add to Asset Library" dialog. Every saved object needs the two library
 * identities — a Standard Name and a Short Code — plus the section it belongs
 * to, exactly like a built-in asset.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { normaliseShortCode } from "@/lib/lessonnotes/assets/overrides";
import {
  LIBRARY_SECTIONS,
  DEFAULT_SECTION,
  createCustomAsset,
  type AssetSnapshot,
  type LibrarySectionId,
} from "@/lib/lessonnotes/assets/customAssets";

export function AddToLibraryDialog({
  snapshot,
  open,
  onOpenChange,
  onSaved,
}: {
  snapshot: AssetSnapshot | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [section, setSection] = useState<LibrarySectionId>(DEFAULT_SECTION);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !snapshot) return;
    setName(snapshot.suggestedName);
    setCode(normaliseShortCode(snapshot.suggestedName.replace(/[^A-Za-z0-9]/g, "").slice(0, 3)));
    setSection(snapshot.suggestedSection ?? DEFAULT_SECTION);
  }, [open, snapshot]);

  const save = async () => {
    if (!snapshot) return;
    setBusy(true);
    try {
      await createCustomAsset({
        name,
        shortCode: code,
        section,
        source: snapshot.source,
        node: snapshot.node,
      });
      toast({
        title: "Saved to your Asset Library",
        description: "Only you can see it. Share it with MathGPL Community from the library.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not save asset",
        description: String((e as Error)?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Asset Library</DialogTitle>
          <DialogDescription>
            This object becomes a reusable asset in your own library — nobody else can see it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Standard Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Labelled right triangle" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Short Code</label>
            <Input
              value={code}
              onChange={(e) => setCode(normaliseShortCode(e.target.value))}
              placeholder="e.g. RT"
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Section</label>
            <div className="grid gap-1">
              {LIBRARY_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                    section === s.id
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy || !snapshot}>
            {busy ? "Saving…" : "Add to library"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddToLibraryDialog;
