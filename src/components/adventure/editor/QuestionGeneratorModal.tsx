import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Sparkles } from "lucide-react";
import { addSceneQuestion, deleteSceneQuestion, listSceneQuestions } from "@/lib/adventure/api";
import type { AdventureSceneQuestion, SceneKind } from "@/lib/adventure/types";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  sceneId: string;
  sceneKind: SceneKind;
  vaultId?: string | null;
}

/**
 * Lightweight question editor for adventure scenes. Reuses the same payload
 * shape the Lesson Note generator produces (`{ prompt, answer }`) so existing
 * solution / floating tooling can read these later.
 *
 * Sections shown: Game Questions list + AI Generate stub + Marks.
 * Sections hidden: Introduction, Conclusion, document Sections.
 */
export default function QuestionGeneratorModal({ open, onClose, sceneId, sceneKind, vaultId }: Props) {
  const [items, setItems] = useState<AdventureSceneQuestion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [marks, setMarks] = useState(10);
  const claimOnce = sceneKind !== "obstacle";
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const all = await listSceneQuestions(sceneId);
      setItems(vaultId ? all.filter((q) => q.vault_id === vaultId) : all);
    } catch (e: unknown) {
      toast({ title: "Could not load questions", description: msg(e), variant: "destructive" });
    }
  };

  useEffect(() => { if (open) refresh(); }, [open, sceneId, vaultId]);

  const add = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      await addSceneQuestion({
        scene_id: sceneId,
        vault_id: vaultId ?? null,
        prompt: prompt.trim(),
        answer: answer.trim(),
        marks,
        claim_once: claimOnce,
        order_index: items.length,
      });
      setPrompt(""); setAnswer("");
      await refresh();
    } catch (e: unknown) {
      toast({ title: "Could not add question", description: msg(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await deleteSceneQuestion(id); await refresh(); }
    catch (e: unknown) { toast({ title: "Delete failed", description: msg(e), variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Game Questions{vaultId ? ` — Vault ${vaultId}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border p-3 space-y-2">
            <Label>New question prompt</Label>
            <Textarea placeholder="e.g. Factorise 2x² + 7x + 3" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <Label>Expected answer (optional)</Label>
            <Input placeholder="(2x + 1)(x + 3)" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Marks</Label>
                <Input type="number" min={1} value={marks} onChange={(e) => setMarks(parseInt(e.target.value) || 0)} className="w-20" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={claimOnce} disabled />
                Claim-once {sceneKind === "obstacle" ? "(off — shared progress)" : "(on)"}
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" disabled title="Coming soon">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> AI Generate
              </Button>
              <Button onClick={add} disabled={busy || !prompt.trim()}>Add question</Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No questions yet.</div>
            ) : items.map((q, i) => (
              <div key={q.id} className="flex items-start gap-2 rounded border p-2">
                <span className="text-xs text-muted-foreground w-6">Q{i + 1}</span>
                <div className="flex-1 text-sm">
                  <div>{q.question_payload?.prompt as string}</div>
                  {q.question_payload?.answer ? (
                    <div className="text-xs text-muted-foreground">ans: {q.question_payload.answer as string}</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">{q.marks} marks{q.claim_once ? " · claim-once" : " · shared"}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
