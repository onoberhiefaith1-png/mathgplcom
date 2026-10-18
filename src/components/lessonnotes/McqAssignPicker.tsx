// Assign → Multiple Choice: turn this lesson note's MCQ questions into a
// paper on a school subject. Class → Subject → paper name (defaults to the
// note's title, editable) → which row of 10 questions. Each assign creates a
// new paper; students find it on the subject's ⋯ menu.
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { academiaForOrg, loadAcademiaTree, mySubjectIds, type AcademiaRow } from "@/lib/academia/api";
import { previewNote, savePaper } from "@/lib/academia/mcq/api";

type Tree = Awaited<ReturnType<typeof loadAcademiaTree>>;

const McqAssignPicker = ({ notebookId, defaultTitle, orgId, onDone }: {
  notebookId: string;
  defaultTitle: string;
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
  const [title, setTitle] = useState(defaultTitle);
  const [range, setRange] = useState(0);
  const [pv, setPv] = useState<Awaited<ReturnType<typeof previewNote>> | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let live = true;
    (async () => {
      try {
        const a = await academiaForOrg(orgId);
        const [t, ids] = await Promise.all([
          a ? loadAcademiaTree(a.id) : Promise.resolve(null),
          mySubjectIds(),
        ]);
        if (!live) return;
        setAcademia(a);
        setTree(t);
        setMine(new Set(ids));
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [orgId]);

  useEffect(() => {
    let live = true;
    setPv(null);
    void previewNote(notebookId).then((r) => { if (live) setPv(r); }).catch(() => { if (live) setPv(null); });
    return () => { live = false; };
  }, [notebookId]);

  const subjects = useMemo(
    () => (tree?.subjects ?? []).filter((s) => s.class_id === classId && mine.has(s.id)),
    [tree, classId, mine],
  );
  const total = pv?.questions.length ?? 0;
  const ranges = Math.ceil(total / 10);
  const ranged = pv ? pv.questions.slice(range * 10, range * 10 + 10).map((q, i) => ({ ...q, n: i + 1 })) : [];

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

  const submit = async () => {
    if (!subjectId || !ranged.length) return;
    setBusy(true);
    try {
      await savePaper(subjectId, notebookId, title.trim() || defaultTitle, ranged);
      toast({ title: "Paper assigned", description: `"${title.trim() || defaultTitle}" is now on the subject for students.` });
      onDone();
    } catch (e) {
      toast({ title: "Could not assign", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {select("Class", classId, (v) => { setClassId(v); setSubjectId(""); }, tree?.classes ?? [], "No classes yet")}
      {select("Subject", subjectId, setSubjectId, subjects, "No subjects assigned to you", !classId)}
      <div className="space-y-1">
        <Label>Paper name</Label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <p className="text-[11px] text-muted-foreground">Defaults to this note's title — name it e.g. "2020" for a past paper.</p>
      </div>
      {!pv ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading questions…</p>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No multiple-choice questions found in this note. Write them as a numbered list with options A–D and a "Correct Answer:" line.
        </p>
      ) : (
        <div className="space-y-1">
          <Label>Which questions? ({total} found)</Label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: ranges }, (_, i) => {
              const from = i * 10 + 1;
              const to = Math.min(total, i * 10 + 10);
              return (
                <button key={i} type="button" onClick={() => setRange(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${range === i ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary/50"}`}>
                  {from}–{to}
                </button>
              );
            })}
          </div>
          {pv.issues.length > 0 && (
            <p className="text-[11px] text-warning">{pv.issues.length} question{pv.issues.length === 1 ? "" : "s"} need attention (missing options or answer).</p>
          )}
        </div>
      )}
      <Button className="w-full" onClick={submit} disabled={!subjectId || busy || ranged.length === 0}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Assign {ranged.length ? `${ranged.length} question${ranged.length === 1 ? "" : "s"}` : ""} as MCQ paper
      </Button>
    </div>
  );
};

export default McqAssignPicker;
