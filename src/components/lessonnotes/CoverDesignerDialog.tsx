// "Generate Note Cover (AI)" — pick one of 10 generated themes, edit every word on
// the cover, or let the AI paint an entirely new cover from a prompt.
import { useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import NotebookCover, { NotebookCoverData } from "./NotebookCover";
import {
  NotebookCoverConfig, readCoverConfig, suggestCoverThemes, themeById,
} from "@/lib/lessonnotes/coverThemes";
import { generateCoverArt } from "@/lib/lessonnotes/cover.functions";
import { uploadCoverArt } from "@/lib/lessonnotes/coverArt";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notebook: NotebookCoverData & { id: string };
  onSave: (cfg: NotebookCoverConfig) => Promise<void> | void;
}

const CoverDesignerDialog = ({ open, onOpenChange, notebook, onSave }: Props) => {
  const suggestions = useMemo(() => suggestCoverThemes(notebook), [notebook]);
  const [cfg, setCfg] = useState<NotebookCoverConfig>(() =>
    readCoverConfig(notebook.cover_config, notebook),
  );
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<NotebookCoverConfig>) => setCfg((c) => ({ ...c, ...p }));

  const generateArt = async () => {
    if (!prompt.trim()) {
      toast({ title: "Describe the cover you want", description: "e.g. modern dark-blue GCSE Algebra cover with geometric patterns." });
      return;
    }
    setBusy(true);
    try {
      const { b64 } = await generateCoverArt({
        data: { prompt: prompt.trim(), themeName: themeById(cfg.themeId).name },
      });
      const path = await uploadCoverArt(b64, notebook.id);
      patch({ artPath: path, artOpacity: cfg.artOpacity ?? 0.7 });
      toast({ title: "Cover artwork generated" });
    } catch (e) {
      toast({ title: "Generation failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(cfg);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Generate Note Cover (AI)
          </DialogTitle>
          <DialogDescription>
            Compare ten generated cover themes, then edit every word on the cover.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Themes
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {suggestions.map((s) => {
                  const t = themeById(s.themeId);
                  const active = cfg.themeId === s.themeId;
                  return (
                    <button
                      key={s.themeId}
                      type="button"
                      onClick={() => patch({ themeId: s.themeId })}
                      className={`rounded-lg p-1 text-left transition ${active ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border"}`}
                    >
                      <NotebookCover notebook={notebook} config={{ ...cfg, themeId: s.themeId }} />
                      <div className="mt-1 truncate text-[10px] text-muted-foreground">{t.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cover text — every line is editable
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Top line" value={cfg.eyebrow} onChange={(v) => patch({ eyebrow: v })} />
                <Field label="Title" value={cfg.title} onChange={(v) => patch({ title: v })} />
                <Field label="Subtitle" value={cfg.subtitle} onChange={(v) => patch({ subtitle: v })} />
                <Field label="Corner badge" value={cfg.badge} onChange={(v) => patch({ badge: v })} />
              </div>
              <div className="space-y-2">
                {cfg.rows.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={r.label}
                      placeholder="Label"
                      className="w-32"
                      onChange={(e) => {
                        const rows = [...cfg.rows];
                        rows[i] = { ...rows[i], label: e.target.value };
                        patch({ rows });
                      }}
                    />
                    <Input
                      value={r.value}
                      placeholder="Text"
                      onChange={(e) => {
                        const rows = [...cfg.rows];
                        rows[i] = { ...rows[i], value: e.target.value };
                        patch({ rows });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch({ rows: cfg.rows.filter((_, j) => j !== i) })}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => patch({ rows: [...cfg.rows, { label: "", value: "" }] })}
                >
                  Add line
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Generate cover artwork from a prompt
              </p>
              <Textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Create a modern dark-blue GCSE Algebra notebook cover with geometric patterns and gold typography."
              />
              <div className="flex items-center gap-3">
                <Button onClick={generateArt} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Generate cover
                </Button>
                {cfg.artPath && (
                  <>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Artwork strength
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={cfg.artOpacity ?? 0.7}
                        onChange={(e) => patch({ artOpacity: Number(e.target.value) })}
                      />
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => patch({ artPath: null })}>
                      Remove artwork
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <NotebookCover notebook={notebook} config={cfg} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Use this cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default CoverDesignerDialog;
