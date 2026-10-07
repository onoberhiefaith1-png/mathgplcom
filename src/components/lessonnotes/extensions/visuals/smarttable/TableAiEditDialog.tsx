// Conversational AI Edit for ONE Smart Table. The current table stays
// visible; the teacher says what to change; the AI's proposal is checked by
// the app's own calculator and applied to the SAME table — never a new one.
import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { tableProblems, verifiedRepair, type Subcells } from "@/lib/lessonnotes/ai/deriveSubcells";

export interface TableShape { headers: string[]; cells: string[][]; subcells?: Subcells }

function Preview({ t }: { t: TableShape }) {
  return (
    <div className="max-h-[45vh] overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead><tr>{t.headers.map((h, c) => <th key={c} className="border border-border bg-muted px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {t.cells.map((row, r) => (
            <tr key={r}>{row.map((v, c) => {
              const s = t.subcells?.[`${r}:${c}`];
              return (
                <td key={c} className="border border-border px-2 py-1 align-bottom">
                  {s && <div className="border-b-2 border-primary pb-0.5 text-xs text-primary">{s.expr}</div>}
                  <div>{v || <span className="text-destructive">—</span>}</div>
                </td>
              );
            })}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableAiEditDialog({ open, onOpenChange, table, onApply }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  table: TableShape;
  onApply: (next: TableShape) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [proposal, setProposal] = useState<(TableShape & { note?: string }) | null>(null);
  const problems = useMemo(() => tableProblems(table.headers, table.cells, table.subcells ?? {}), [table]);

  const run = async () => {
    setBusy(true); setErr(null); setProposal(null);
    try {
      const { data, error } = await supabase.functions.invoke("notebook-ai", {
        body: {
          mode: "table_edit",
          instruction: text.trim() || "Complete the table.",
          problems,
          table: { headers: table.headers, cells: table.cells, subcells: Object.fromEntries(Object.entries(table.subcells ?? {}).map(([k, v]) => [k, v.expr])) },
        },
      });
      if (error) throw new Error((data as any)?.error ?? error.message);
      const d = data as { headers?: string[]; cells: string[][]; subcells?: Record<string, string>; note?: string };
      const headers = Array.isArray(d.headers) && d.headers.length ? d.headers.map(String) : table.headers;
      const cells = d.cells.map((r) => r.map((v) => String(v ?? "")));
      const keep = headers.length === table.headers.length && cells.length === table.cells.length ? table.subcells ?? {} : {};
      setProposal({ headers, cells, subcells: verifiedRepair(headers, cells, d.subcells ?? {}, keep), note: d.note });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setProposal(null); setErr(null); } onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Edit — this table</DialogTitle></DialogHeader>
        <Preview t={proposal ?? table} />
        {!proposal && (problems.length
          ? <p className="text-xs text-destructive">Incomplete: {problems.slice(0, 3).join(" ")}{problems.length > 3 ? ` (+${problems.length - 3} more)` : ""}</p>
          : <p className="text-xs text-muted-foreground">Table complete.</p>)}
        {proposal?.note && <p className="text-sm text-muted-foreground">{proposal.note}</p>}
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!proposal ? (
          <>
            <label className="text-sm font-medium">What would you like me to change or complete in this table?</label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Complete the table · Fill the fx² column · Redo row 4" rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={run} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Send</Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setProposal(null)}>Discard</Button>
            <Button onClick={() => { onApply(proposal); setProposal(null); setText(""); onOpenChange(false); }}>Apply to this table</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
