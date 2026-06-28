// Renders an AI-generated calculation as an editable working block.

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { SmartCalcAttrs } from "@/components/lessonnotes/extensions/SmartCalc";

export function SmartCalcView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as unknown as SmartCalcAttrs;
  const update = (patch: Partial<SmartCalcAttrs>) => updateAttributes(patch as Record<string, unknown>);
  const [busy, setBusy] = useState(false);

  const recompute = async () => {
    if (!a.expression.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-calc", {
        body: { expression: a.expression },
      });
      if (error) throw error;
      const r = data as Partial<SmartCalcAttrs>;
      update({
        formula: r.formula ?? "",
        substitution: r.substitution ?? "",
        steps: r.steps ?? [],
        answer: r.answer ?? "",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Couldn't recompute", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn("my-4 rounded-md border bg-white text-black", selected ? "border-yellow-400 shadow" : "border-neutral-200")}
      data-drag-handle
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-neutral-50 text-[12px]">
        <span className="font-semibold">Smart Calculator</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={recompute} disabled={busy} className="h-7 text-[11px]">
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Recompute
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteNode()} className="h-7 text-[11px] text-red-600">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 font-mono text-[13px]" data-no-drag>
        <Row label="Expression" value={a.expression} onChange={(v) => update({ expression: v })} />
        <Row label="Formula" value={a.formula} onChange={(v) => update({ formula: v })} />
        <Row label="Substitute" value={a.substitution} onChange={(v) => update({ substitution: v })} />
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 pt-1">Steps</div>
        {(a.steps ?? []).map((s, i) => (
          <Textarea
            key={i} value={s}
            onChange={(e) => update({ steps: a.steps.map((ss, j) => j === i ? e.target.value : ss) })}
            className="min-h-[34px] font-mono text-[12px] bg-white"
          />
        ))}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">Answer</span>
          <input
            value={a.answer}
            onChange={(e) => update({ answer: e.target.value })}
            className="flex-1 font-mono text-[14px] font-semibold border-b border-black/20 focus:border-yellow-400 outline-none bg-transparent"
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function Row({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-neutral-500 w-20">{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 font-mono text-[12px] border-b border-neutral-200 focus:border-yellow-400 outline-none bg-transparent"
      />
    </div>
  );
}
