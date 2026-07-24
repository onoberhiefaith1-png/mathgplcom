// Verification Page — Coverage check + Reconstruction test. Approve is
// disabled until status === PASS AND exactMatch === true.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { detectElements } from "@/lib/floating/elementDetector";
import { runLawPipeline } from "@/lib/floating/laws";
import { verify, type VerificationReport } from "@/lib/floating/verifier";
import { proposeLaw, type LawDraft } from "@/lib/floating/lawDiscovery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VerificationPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const original = search.get("eq") ?? "";
  const lineId = search.get("lineId") ?? "";

  const [chips, setChips] = useState<string[]>([]);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const [draft, setDraft] = useState<LawDraft | null>(null);
  const [approving, setApproving] = useState(false);

  const recompute = useCallback(() => {
    const elements = detectElements(original);
    const { chips: c } = runLawPipeline(original, elements);
    setChips(c);
    setVerification(verify(original, c));
  }, [original]);

  useEffect(() => { recompute(); }, [recompute]);

  const canApprove = verification?.status === "PASS" && verification.exactMatch;

  const approve = useCallback(async () => {
    if (!verification || !canApprove) return;
    setApproving(true);
    try {
      const genId = sessionStorage.getItem(`floating-gen-${lineId}`);
      if (genId) {
        await supabase
          .from("floating_generations")
          .update({
            chips: chips as any,
            verification: verification as any,
            status: "approved",
          })
          .eq("id", genId);
      }
      // Try to propose a law (heuristic; teacher will explicitly approve).
      const proposed = proposeLaw({
        original,
        beforeChips: chips,
        afterChips: chips,
        beforeLawIds: [],
      });
      setDraft(proposed);
      toast({ title: "Approved", description: "Floating numbers verified and saved." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setApproving(false);
    }
  }, [verification, canApprove, chips, original, lineId]);

  const approveLaw = useCallback(async () => {
    if (!draft) return;
    const { data: nextRow } = await supabase
      .from("floating_law_library")
      .select("law_number")
      .order("law_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (nextRow?.law_number ?? 0) + 1;
    const { error } = await supabase.from("floating_law_library").insert({
      law_number: nextNumber,
      name: draft.name,
      rule: draft.rule,
      reason: draft.reason,
      conditions: draft.conditions as any,
      exceptions: draft.exceptions as any,
      examples: draft.examples as any,
      source_generation_id: sessionStorage.getItem(`floating-gen-${lineId}`),
    });
    if (error) {
      toast({ title: "Could not save law", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Law #${nextNumber} approved`, description: draft.name });
    setDraft(null);
  }, [draft, lineId]);

  if (!verification) {
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
          <BackButton className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-black/5" iconClassName="mr-2 h-4 w-4">
            Back to Reasoning
          </BackButton>
          <h1 className="text-2xl font-semibold text-amber-900">Verification</h1>
          <Button onClick={approve} disabled={!canApprove || approving}>
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span className="ml-2">Approve</span>
          </Button>
        </div>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-amber-800">Coverage</div>
            <Badge variant={verification.status === "PASS" ? "default" : "destructive"}>
              {verification.coveragePct}% — {verification.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium mb-2">Original Elements</div>
              <ul className="space-y-1">
                {verification.coverage.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    {c.found >= c.required
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-red-600" />}
                    <span>{c.label}</span>
                    {c.required > 1 && <span className="text-muted-foreground">×{c.required}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium mb-2">Generated Elements</div>
              <ul className="space-y-1">
                {verification.coverage.map((c) => (
                  <li key={`g-${c.key}`} className="flex items-center gap-2">
                    {c.found >= c.required
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-red-600" />}
                    <span>{c.label}</span>
                    <span className="text-muted-foreground">{c.found}/{c.required}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="text-sm font-semibold text-amber-800">Reconstruction Test</div>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div>
              <div className="text-xs text-muted-foreground">Original (canonical)</div>
              <div>{verification.originalCanonical}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Reconstructed</div>
              <div>{verification.reconstructed}</div>
            </div>
          </div>
          <Badge variant={verification.exactMatch ? "default" : "destructive"}>
            {verification.exactMatch ? "Exact Match" : "Mismatch"}
          </Badge>
        </Card>

        {verification.missing.length > 0 && (
          <Card className="p-5 border-red-300 bg-red-50">
            <div className="text-sm font-semibold text-red-700">Missing</div>
            <ul className="text-sm mt-2 space-y-1">
              {verification.missing.map((m) => (
                <li key={`m-${m.key}`}>• {m.label} ({m.found}/{m.required})</li>
              ))}
            </ul>
          </Card>
        )}

        {draft && (
          <Card className="p-5 border-amber-300 bg-amber-100">
            <div className="text-sm font-semibold text-amber-800">Pending Law Proposal</div>
            <div className="font-medium mt-2">{draft.name}</div>
            <div className="text-sm mt-1">{draft.rule}</div>
            <div className="text-xs mt-1 text-muted-foreground">{draft.reason}</div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={approveLaw}>Approve Law</Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Reject Law</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VerificationPage;
