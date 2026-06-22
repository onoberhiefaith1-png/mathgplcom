// Reasoning Page — walks the teacher through Element Detection, Law
// Detection, Law Application, and Proposed Floating Numbers for a single
// equation line. Read-only; the Approve button is on the Verification page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { detectElements, labelOf, type MathElement } from "@/lib/floating/elementDetector";
import { runLawPipeline, type LawTraceEntry, type ScaffoldShell } from "@/lib/floating/laws";
import { verify, type VerificationReport } from "@/lib/floating/verifier";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface State {
  original: string;
  elements: MathElement[];
  laws: LawTraceEntry[];
  chips: string[];
  scaffolds: ScaffoldShell[];
  verification: VerificationReport;
}

const ReasoningPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const original = search.get("eq") ?? "";
  const lineId = search.get("lineId") ?? "";

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<State | null>(null);
  const [restructure, setRestructure] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    // Compute locally first for instant render, then ask the edge function
    // for the canonical version (which re-runs verifier and may retry).
    try {
      const elements = detectElements(original);
      const { chips, scaffolds, trace } = runLawPipeline(original, elements);
      const verification = verify(original, chips);
      setState({ original, elements, laws: trace, chips, scaffolds, verification });
    } finally {
      setLoading(false);
    }

    // Background: persist a pending generation row so the Verification page
    // can resume by id.
    const session = (await supabase.auth.getSession()).data.session;
    if (session) {
      const elements = detectElements(original);
      const { chips, scaffolds, trace } = runLawPipeline(original, elements);
      const verification = verify(original, chips);
      const { data, error } = await supabase
        .from("floating_generations")
        .insert({
          notebook_id: notebookId,
          subsection_id: subsectionId,
          line_id: lineId,
          original,
          elements: elements as any,
          law_trace: trace as any,
          chips: chips as any,
          scaffolds: scaffolds as any,
          verification: verification as any,
          status: "pending",
        })
        .select("id")
        .maybeSingle();
      if (!error && data?.id) {
        sessionStorage.setItem(`floating-gen-${lineId}`, data.id);
      }
    }
  }, [original, notebookId, subsectionId, lineId]);

  useEffect(() => { run(); }, [run]);

  const regenerate = useCallback(async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("floating-reason", {
        body: { original, instruction: restructure || undefined },
      });
      if (error) throw error;
      setState({
        original,
        elements: (data as any).elements,
        laws: (data as any).laws,
        chips: (data as any).chips,
        scaffolds: (data as any).scaffolds,
        verification: (data as any).verification,
      });
    } catch (e: any) {
      toast({ title: "Regenerate failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [original, restructure]);

  const goVerify = useCallback(() => {
    if (!state) return;
    const params = new URLSearchParams({ eq: original, lineId });
    navigate(`/lesson-notes/${notebookId}/floating/${subsectionId}/verify?${params.toString()}`);
  }, [state, original, lineId, notebookId, subsectionId, navigate]);

  if (loading || !state) {
    return (
      <div className="flex h-screen items-center justify-center bg-amber-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-semibold text-amber-900">Reasoning</h1>
          <Button onClick={goVerify}>
            Continue to Verification <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Card className="p-5 space-y-2">
          <div className="text-sm font-semibold text-amber-800">Step 1 — Original Equation</div>
          <div className="font-mono text-lg">{state.original}</div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="text-sm font-semibold text-amber-800">
            Step 2 — Detected Elements ({state.elements.length})
          </div>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {state.elements.map((el, i) => (
              <li key={i}>{labelOf(el)}</li>
            ))}
          </ol>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="text-sm font-semibold text-amber-800">Step 3 — Applicable Laws</div>
          <div className="space-y-2">
            {state.laws.map((law, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-amber-200 bg-white p-3">
                <Badge variant={law.applies ? "default" : "secondary"}>{law.applies ? "✓" : "✗"}</Badge>
                <div className="flex-1">
                  <div className="font-medium">{law.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{law.reason}</div>
                  {law.action && <div className="text-xs mt-1"><span className="font-semibold">Action:</span> {law.action}</div>}
                  {law.result && <div className="text-xs mt-1 font-mono"><span className="font-semibold">Result:</span> {law.result}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="text-sm font-semibold text-amber-800">Step 4 — Proposed Floating Numbers</div>
          <div className="flex flex-wrap gap-2">
            {state.chips.map((c, i) => (
              <span key={i} className="rounded-full bg-amber-100 px-3 py-1 font-mono text-sm">{c}</span>
            ))}
          </div>
          {state.scaffolds.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Scaffolds: {state.scaffolds.map((s) => s.label).join(", ")}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="text-sm font-semibold text-amber-800">Restructure (optional)</div>
          <textarea
            value={restructure}
            onChange={(e) => setRestructure(e.target.value)}
            placeholder="Tell the AI what to change..."
            className="w-full rounded-md border border-amber-200 p-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={regenerate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Regenerate</span>
            </Button>
            <Button variant="outline" onClick={regenerate} disabled={submitting}>
              <Wand2 className="mr-2 h-4 w-4" /> Apply Restructure
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReasoningPage;
