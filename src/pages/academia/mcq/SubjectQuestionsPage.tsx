// ⋯ → View Questions: every multiple-choice paper assigned to one Subject.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import McqText from "@/components/academia/mcq/McqText";
import {
  canBuildSubject, deletePaper, listPapers, myLessonNotes, myPaperAttempts, previewNote, savePaper, subjectInfo,
} from "@/lib/academia/mcq/api";

export default function SubjectQuestionsPage() {
  const { subjectId } = useParams({ from: "/mcq/subject/$subjectId" });
  const router = useRouter();
  const qc = useQueryClient();
  const subjectQ = useQuery({ queryKey: ["mcq-subject", subjectId], queryFn: () => subjectInfo(subjectId) });
  const papersQ = useQuery({ queryKey: ["mcq-papers", subjectId], queryFn: () => listPapers(subjectId) });
  const buildQ = useQuery({ queryKey: ["mcq-can-build", subjectId], queryFn: () => canBuildSubject(subjectId) });
  const papers = papersQ.data ?? [];
  const attemptsQ = useQuery({
    queryKey: ["mcq-attempts", papers.map((p) => p.id).join(",")],
    enabled: papers.length > 0,
    queryFn: () => myPaperAttempts(papers.map((p) => p.id)),
  });
  const [adding, setAdding] = useState(false);
  const name = subjectQ.data?.name ?? "Subject";
  const refresh = () => qc.invalidateQueries({ queryKey: ["mcq-papers", subjectId] });

  return (
    <div className="mm-app mm-light min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <button type="button" onClick={() => router.history.back()} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name} — Multiple-Choice Questions</h1>
            <p className="mt-1 text-sm text-muted-foreground">Past questions and practice papers assigned to this subject.</p>
          </div>
          {buildQ.data && (
            <Button onClick={() => setAdding(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add from Lesson Note</Button>
          )}
        </header>

        {papersQ.isLoading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading papers…</p>
        ) : papersQ.error ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Questions aren't available yet. Please try again later.</p>
        ) : papers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No papers yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Papers such as JAMB, WAEC and NECO appear here once a teacher adds them.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {papers.map((p) => {
              const mine = (attemptsQ.data ?? []).filter((a) => a.paper_id === p.id);
              const best = mine.reduce((m, a) => Math.max(m, a.total ? Math.round((a.correct / a.total) * 100) : 0), -1);
              return (
                <li key={p.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.questions.length} question{p.questions.length === 1 ? "" : "s"}
                      {best >= 0 && <> · Best {best}% · {mine.length} attempt{mine.length === 1 ? "" : "s"}</>}
                    </p>
                  </div>
                  <Button asChild><Link to="/mcq/$paperId" params={{ paperId: p.id }}>{mine.length ? "Practise again" : "Start"}</Link></Button>
                  {buildQ.data && (
                    <button type="button" aria-label={`Remove ${p.title}`} className="text-muted-foreground hover:text-destructive"
                      onClick={async () => { if (confirm(`Remove "${p.title}" from ${name}?`)) { await deletePaper(p.id); refresh(); } }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {adding && <AddPaperDialog subjectId={subjectId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />}
    </div>
  );
}

function AddPaperDialog({ subjectId, onClose, onSaved }: { subjectId: string; onClose: () => void; onSaved: () => void }) {
  const notesQ = useQuery({ queryKey: ["mcq-my-notes"], queryFn: myLessonNotes });
  const [noteId, setNoteId] = useState("");
  const [title, setTitle] = useState("");
  const [range, setRange] = useState(0); // index of the chosen row of 10
  const [saving, setSaving] = useState(false);
  const previewQ = useQuery({ queryKey: ["mcq-preview", noteId], enabled: !!noteId, queryFn: () => previewNote(noteId) });
  const pv = previewQ.data;
  // Questions are assigned in rows of 10: 1–10, 11–20, … Each row becomes its
  // own paper, renumbered from 1.
  const ranges = pv ? Math.ceil(pv.questions.length / 10) : 0;
  const ranged = pv
    ? pv.questions.slice(range * 10, range * 10 + 10).map((q, i) => ({ ...q, n: i + 1 }))
    : [];
  const save = async () => {
    if (!pv || !ranged.length) return;
    setSaving(true);
    try {
      await savePaper(subjectId, noteId, title.trim() || pv.title, ranged);
      toast.success("Paper saved to this subject");
      onSaved();
    } catch (e) { toast.error((e as Error).message || "Couldn't save the paper."); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="mm-app mm-light max-h-[90vh] max-w-2xl overflow-y-auto bg-background text-foreground">
        <DialogHeader><DialogTitle>Convert a Lesson Note to Multiple-Choice</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Write each question as <b>Question 1</b>, the question, options <b>A. B. C. D.</b>, then <b>Correct Answer: B</b>.
        </p>
        <label className="text-sm font-medium">1 · Lesson Note</label>
        <select value={noteId} onChange={(e) => { setNoteId(e.target.value); setTitle(""); }}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
          <option value="">Choose a Lesson Note…</option>
          {(notesQ.data ?? []).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
        {noteId && (previewQ.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading questions…</p>
        ) : pv && (
          <>
            <label className="text-sm font-medium">2 · Paper name</label>
            <input value={title || pv.title} onChange={(e) => setTitle(e.target.value)} aria-label="Paper title"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold" />
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> {pv.questions.length} questions found</span>
              {pv.issues.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 font-medium text-warning"><AlertTriangle className="h-4 w-4" /> {pv.issues.length} to check</span>}
            </div>
            {pv.issues.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                {pv.issues.map((i, k) => <li key={k}>Question {i.n} {i.message}</li>)}
              </ul>
            )}
            {ranges > 1 && (
              <>
                <label className="text-sm font-medium">3 · Which questions?</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: ranges }, (_, i) => {
                    const from = i * 10 + 1;
                    const to = Math.min(pv.questions.length, i * 10 + 10);
                    return (
                      <button key={i} type="button" onClick={() => setRange(i)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${range === i ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}>
                        {from}–{to}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <ol className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3 text-sm">
              {ranged.map((q) => (
                <li key={q.n}>
                  <p className="font-semibold">{q.n}. <McqText text={q.text} k={`pv${q.n}`} /></p>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 text-muted-foreground">
                    {q.options.map((o) => <span key={o.label} className={o.label === q.answer ? "font-semibold text-primary" : ""}>{o.label}. <McqText text={o.text} k={`pv${q.n}${o.label}`} /></span>)}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={saving || ranged.length === 0}>{saving ? "Saving…" : `${ranges > 1 ? "4" : "3"} · Save to subject`}</Button>
            </div>
          </>
        ))}
      </DialogContent>
    </Dialog>
  );
}
