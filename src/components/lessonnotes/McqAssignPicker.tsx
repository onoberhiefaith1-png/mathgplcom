// Assign → Multiple Choice: link THIS lesson-note solution (with its Floating
// Numbers) to one question that already exists in a subject's MCQ paper.
// Class → Subject → Paper → row of 10 → question. The question text is never
// copied; only the solution travels.
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { academiaForOrg, loadAcademiaTree, mySubjectIds, type AcademiaRow } from "@/lib/academia/api";
import { linkSolution, listPapers, type McqPaper } from "@/lib/academia/mcq/api";

type Tree = Awaited<ReturnType<typeof loadAcademiaTree>>;

const McqAssignPicker = ({ notebookId, subsectionId, orgId, onDone }: {
  notebookId: string;
  subsectionId: string | null;
  defaultTitle?: string;
  orgId: string | null;
  onDone: () => void;
}) => {
  const [academia, setAcademia] = useState<AcademiaRow | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [papers, setPapers] = useState<McqPaper[]>([]);
  const [paperId, setPaperId] = useState("");
  const [range, setRange] = useState<number | null>(null);
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let live = true;
    (async () => {
      try {
        const a = await academiaForOrg(orgId);
        const [t, ids] = await Promise.all([a ? loadAcademiaTree(a.id) : Promise.resolve(null), mySubjectIds()]);
        if (!live) return;
        setAcademia(a); setTree(t); setMine(new Set(ids));
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [orgId]);

  useEffect(() => {
    setPapers([]); setPaperId(""); setRange(null); setN(null);
    if (!subjectId) return;
    let live = true;
    void listPapers(subjectId).then((p) => { if (live) setPapers(p); }).catch(() => undefined);
    return () => { live = false; };
  }, [subjectId]);

  const subjects = useMemo(
    () => (tree?.subjects ?? []).filter((s) => s.class_id === classId && mine.has(s.id)),
    [tree, classId, mine],
  );
  const paper = papers.find((p) => p.id === paperId) ?? null;
  const qs = paper?.questions ?? [];
  const ranges = Math.ceil(qs.length / 10);
  const inRange = range == null ? [] : qs.slice(range * 10, range * 10 + 10);

  const select = (label: string, value: string, onChange: (v: string) => void, items: { id: string; name: string }[], empty: string, disabled = false) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50">
        <option value="">{items.length ? `Choose ${label.toLowerCase()}` : empty}</option>
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </div>
  );

  if (loading) return <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Opening Academia…</div>;
  if (!academia) return <p className="py-6 text-center text-sm text-muted-foreground">This school hasn't opened its Academia yet.</p>;
  if (!subsectionId) return <p className="py-6 text-center text-sm text-muted-foreground">Open the question whose solution you want to link first.</p>;

  const submit = async () => {
    if (!paper || n == null) return;
    setBusy(true);
    try {
      await linkSolution(paper.id, n, notebookId, subsectionId);
      toast({ title: "Solution linked", description: `Question ${n} of "${paper.title}" now has this solution.` });
      onDone();
    } catch (e) {
      toast({ title: "Could not link", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {select("Class", classId, (v) => { setClassId(v); setSubjectId(""); }, tree?.classes ?? [], "No classes yet")}
      {select("Subject", subjectId, setSubjectId, subjects, "No subjects assigned to you", !classId)}
      {select("Paper", paperId, (v) => { setPaperId(v); setRange(null); setN(null); }, papers.map((p) => ({ id: p.id, name: p.title })), "No papers on this subject yet", !subjectId)}
      {paper && (
        <div className="space-y-2">
          <Label>Which question? ({qs.length} in this paper)</Label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: ranges }, (_, i) => (
              <button key={i} type="button" onClick={() => { setRange(i); setN(null); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${range === i ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary/50"}`}>
                {i * 10 + 1}–{Math.min(qs.length, i * 10 + 10)}
              </button>
            ))}
          </div>
          {inRange.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border p-1">
              {inRange.map((q) => (
                <li key={q.n}>
                  <button type="button" onClick={() => setN(q.n)}
                    className={`w-full rounded px-2 py-1.5 text-left text-sm ${n === q.n ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>
                    {q.n}. {q.text.slice(0, 90)}{q.solution ? " · has solution" : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Button className="w-full" onClick={submit} disabled={busy || !paper || n == null}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Link solution{n != null ? ` to question ${n}` : ""}
      </Button>
    </div>
  );
};

export default McqAssignPicker;
