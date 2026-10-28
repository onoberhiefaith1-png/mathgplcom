// Foldable learning-point slots of one Academia Adventure: their questions
// (one scrollable row each), order, marks total and pass mark.
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, X } from "lucide-react";
import {
  listAdventureQuestions, listPassMarks, removeAdventureQuestion, saveOrder, setPassMark, type AdventureQuestion,
} from "@/lib/academia/adventureSlots";
import { DEFAULT_PASS_PCT, moveInOrder, pointTotalMarks, questionsForPoint } from "@/lib/academia/adventurePlay";

export type PointSlot = { sceneId: string; barId: string; label: string };

export default function AdventurePointSlots({ activityId, slots, openSceneId, onOpen, epoch = 0 }: {
  activityId: string; slots: PointSlot[]; openSceneId: string; onOpen: (sceneId: string) => void; epoch?: number;
}) {
  const [rows, setRows] = useState<AdventureQuestion[]>([]);
  const [pass, setPass] = useState<Record<string, number>>({});
  const reload = () => {
    void listAdventureQuestions(activityId).then(setRows).catch(() => setRows([]));
    void listPassMarks(activityId).then(setPass).catch(() => setPass({}));
  };
  useEffect(reload, [activityId, epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slots.length) return <p className="text-sm text-muted-foreground">This Adventure has no learning points with a progress bar yet.</p>;

  const move = async (sceneId: string, id: string, dir: -1 | 1) => {
    const ids = moveInOrder(questionsForPoint(rows, sceneId).map((q) => q.id), id, dir);
    setRows((cur) => cur.map((q) => (q.sceneId === sceneId ? { ...q, position: ids.indexOf(q.id) } : q)));
    await saveOrder(ids);
  };

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Progress bar</div>
      {slots.map((slot) => {
        const open = openSceneId === slot.sceneId;
        const qs = questionsForPoint(rows, slot.sceneId);
        const pct = pass[slot.sceneId] ?? DEFAULT_PASS_PCT;
        return (
          <div key={slot.sceneId} className="rounded-md border border-border">
            <button type="button" onClick={() => onOpen(open ? "" : slot.sceneId)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="flex-1 truncate font-medium">{slot.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{qs.length} Q · {pointTotalMarks(rows, slot.sceneId)} marks</span>
            </button>
            {open && (
              <div className="space-y-1 border-t border-border px-2 py-2">
                <label className="flex items-center gap-2 text-xs">
                  Pass mark
                  <input
                    type="number" min={1} max={100} defaultValue={pct} key={`${slot.sceneId}-${pct}`}
                    onBlur={(e) => { const v = Number(e.target.value); setPass((p) => ({ ...p, [slot.sceneId]: v })); void setPassMark(activityId, slot.sceneId, v); }}
                    className="w-16 rounded border border-input bg-background px-2 py-1"
                  /> %
                </label>
                {qs.length === 0 && <p className="text-xs text-muted-foreground">No questions yet. Assign this question to add it here.</p>}
                {qs.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-1 rounded bg-muted/40 px-2 py-1 text-xs">
                    <span className="shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
                    <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap" title={q.questionText ?? q.title}>{q.questionText || q.title}</div>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{q.totalMarks}</span>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => void move(slot.sceneId, q.id, -1)} className="rounded p-0.5 hover:bg-accent disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === qs.length - 1} onClick={() => void move(slot.sceneId, q.id, 1)} className="rounded p-0.5 hover:bg-accent disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Remove" onClick={() => void removeAdventureQuestion(q.id).then(reload)} className="rounded p-0.5 hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
