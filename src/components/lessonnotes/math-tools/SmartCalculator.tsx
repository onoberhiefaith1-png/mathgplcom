// Smart Calculator dialog — two tabs:
//   - Standard: scientific calculator, evaluates via mathjs.
//   - Smart:    sends an expression/problem to the AI and returns
//               formula + substitution + steps + answer, which the
//               teacher can insert as a SmartCalc working block.

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Sparkles, Loader2, Plus } from "lucide-react";
import { create, all } from "mathjs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { SmartCalcAttrs } from "@/components/lessonnotes/extensions/SmartCalc";

const math = create(all, {});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsertWorking: (attrs: SmartCalcAttrs) => void;
}

const BUTTONS: { label: string; insert?: string; action?: "=" | "C" | "CE" | "DEG" }[][] = [
  [
    { label: "C", action: "C" }, { label: "CE", action: "CE" },
    { label: "(", insert: "(" }, { label: ")", insert: ")" },
    { label: "÷", insert: "/" },
  ],
  [
    { label: "sin", insert: "sin(" }, { label: "cos", insert: "cos(" }, { label: "tan", insert: "tan(" },
    { label: "π", insert: "pi" }, { label: "×", insert: "*" },
  ],
  [
    { label: "log", insert: "log10(" }, { label: "ln", insert: "log(" }, { label: "eˣ", insert: "exp(" },
    { label: "x²", insert: "^2" }, { label: "−", insert: "-" },
  ],
  [
    { label: "√", insert: "sqrt(" }, { label: "xʸ", insert: "^" }, { label: "1/x", insert: "^-1" },
    { label: "x!", insert: "!" }, { label: "+", insert: "+" },
  ],
  [
    { label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" },
    { label: ".", insert: "." }, { label: "=", action: "=" },
  ],
  [
    { label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" },
    { label: "0", insert: "0" }, { label: "DEG", action: "DEG" },
  ],
  [
    { label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" },
    { label: " ", insert: "" }, { label: " ", insert: "" },
  ],
];

export function SmartCalculator({ open, onOpenChange, onInsertWorking }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-4 w-4" /> Smart Calculator</DialogTitle>
          <DialogDescription>Quick scientific calculator, or show full working with AI.</DialogDescription>
        </DialogHeader>
        <SmartCalculatorBody
          onInsertWorking={onInsertWorking}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** The calculator itself, with no dialog chrome — reused by the Smartboard's
 *  floating Calculator workspace so both surfaces behave identically. */
export function SmartCalculatorBody({
  onInsertWorking,
  onDone,
}: {
  onInsertWorking: (attrs: SmartCalcAttrs) => void;
  onDone?: () => void;
}) {
  // Standard
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [angleMode, setAngleMode] = useState<"deg" | "rad">("deg");

  // Smart
  const [smartExpr, setSmartExpr] = useState("");
  const [smart, setSmart] = useState<SmartCalcAttrs | null>(null);
  const [busy, setBusy] = useState(false);

  const evaluate = (e = expr) => {
    if (!e.trim()) return;
    try {
      const prepared = angleMode === "deg"
        ? e.replace(/\b(sin|cos|tan)\(/g, "$1(unit(") .replace(/\)/g, " deg))").replace(/unit\((-?[\d.]+)\s+deg\)/g, "unit($1, 'deg')")
        : e;
      // Safe path: mathjs evaluate honors `pi`, `sqrt`, `exp`, `log`, `log10`, `!`.
      // For DEG mode we wrap trig args via degToRad replacement.
      const useExpr = angleMode === "deg"
        ? e.replace(/(sin|cos|tan)\(([^()]+)\)/g, (_m, fn, arg) => `${fn}((${arg}) * pi / 180)`)
        : e;
      const v = math.evaluate(useExpr);
      setResult(String(v));
    } catch {
      setResult("Error");
    }
  };

  const tap = (b: typeof BUTTONS[number][number]) => {
    if (b.action === "C") { setExpr(""); setResult(""); return; }
    if (b.action === "CE") { setExpr((p) => p.slice(0, -1)); return; }
    if (b.action === "DEG") { setAngleMode((m) => m === "deg" ? "rad" : "deg"); return; }
    if (b.action === "=") { evaluate(); return; }
    if (b.insert !== undefined) setExpr((p) => p + b.insert);
  };

  const runSmart = async () => {
    if (!smartExpr.trim()) return;
    setBusy(true);
    setSmart(null);
    try {
      const { data, error } = await supabase.functions.invoke("smart-calc", {
        body: { expression: smartExpr },
      });
      if (error) throw error;
      const r = data as Partial<SmartCalcAttrs>;
      setSmart({
        expression: smartExpr,
        formula: r.formula ?? "",
        substitution: r.substitution ?? "",
        steps: r.steps ?? [],
        answer: r.answer ?? "",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "AI calculation failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-4 w-4" /> Smart Calculator</DialogTitle>
          <DialogDescription>Quick scientific calculator, or show full working with AI.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="standard">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="standard">Standard</TabsTrigger>
            <TabsTrigger value="smart"><Sparkles className="h-3 w-3 mr-1" /> Smart</TabsTrigger>
          </TabsList>

          {/* STANDARD */}
          <TabsContent value="standard" className="space-y-2">
            <Input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") evaluate(); }}
              className="font-mono text-sm"
              placeholder="Type or tap…"
            />
            <div className="font-mono text-right text-lg min-h-[1.5em] px-1 text-neutral-800">
              {result}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-right text-muted-foreground">
              mode: {angleMode}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {BUTTONS.flat().map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(b)}
                  className={cn(
                    "h-9 text-[12px] rounded border border-neutral-200 bg-white hover:bg-muted text-black",
                    (b.action === "=" || b.label === "=") && "bg-yellow-400 hover:bg-yellow-300 border-yellow-500 font-semibold",
                  )}
                >{b.label}</button>
              ))}
            </div>
          </TabsContent>

          {/* SMART */}
          <TabsContent value="smart" className="space-y-2">
            <Textarea
              value={smartExpr}
              onChange={(e) => setSmartExpr(e.target.value)}
              placeholder='e.g. "Find log 55.24" or "Solve 2x² + 3x − 5 = 0"'
              className="min-h-[80px] font-mono text-[12px]"
            />
            <Button onClick={runSmart} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Show working
            </Button>
            {smart && (
              <div className="rounded border p-3 text-[12px] font-mono space-y-1.5 bg-neutral-50">
                {smart.formula && <div><span className="text-neutral-500 uppercase text-[10px] tracking-wide mr-2">formula</span>{smart.formula}</div>}
                {smart.substitution && <div><span className="text-neutral-500 uppercase text-[10px] tracking-wide mr-2">subst.</span>{smart.substitution}</div>}
                {smart.steps.map((s, i) => (
                  <div key={i} className="pl-4 text-neutral-800">= {s}</div>
                ))}
                {smart.answer && <div className="pt-1 font-semibold">∴ {smart.answer}</div>}
                <Button
                  size="sm" className="w-full mt-2"
                  onClick={() => { onInsertWorking(smart); onOpenChange(false); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Insert working into note
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
