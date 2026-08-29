import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  createPlanEntry,
  deletePlanEntry,
  formatPlanDate,
  listPlanEntries,
  updatePlanEntry,
  type PlanScope,
  type SchedulePlanEntry,
} from "@/lib/schedule/plan";

const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

/**
 * The teaching plan: dated entries saying what will be taught. The teacher
 * edits; everyone else reads. One component for Class and Live Session.
 */
const SchedulePlanPanel = ({
  scope,
  scopeId,
  canEdit,
}: {
  scope: PlanScope;
  scopeId: string;
  canEdit: boolean;
}) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<SchedulePlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setEntries(await listPlanEntries(scope, scopeId));
    setLoading(false);
  }, [scope, scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!topic.trim()) {
      toast({ title: "A topic is required", variant: "destructive" });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setSaving(true);
    const { error } = await createPlanEntry(scope, scopeId, userData.user.id, {
      entryDate: date || null,
      weekLabel: week.trim() || null,
      topic,
      description: description.trim() || null,
      position: entries.length,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not add", description: String((error as { message?: string }).message ?? ""), variant: "destructive" });
      return;
    }
    setDate("");
    setWeek("");
    setTopic("");
    setDescription("");
    await load();
  };

  const patch = async (entry: SchedulePlanEntry, changes: Partial<SchedulePlanEntry>) => {
    const next = { ...entry, ...changes };
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? next : e)));
    const { error } = await updatePlanEntry(entry.id, {
      entryDate: next.entryDate,
      weekLabel: next.weekLabel,
      topic: next.topic,
      description: next.description,
    });
    if (error) toast({ title: "Could not save", variant: "destructive" });
  };

  const remove = async (entry: SchedulePlanEntry) => {
    if (!window.confirm(`Remove "${entry.topic}" from the schedule?`)) return;
    const { error } = await deletePlanEntry(entry.id);
    if (error) {
      toast({ title: "Could not remove", variant: "destructive" });
      return;
    }
    await load();
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading schedule…</div>;
  }

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {canEdit
            ? "No teaching plan yet. Add the first date and topic below."
            : "Your teacher has not published the teaching plan yet."}
        </div>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry, index) => (
            <li key={entry.id} className="rounded-xl border border-border bg-card/40 p-4">
              {canEdit ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[10rem_10rem_minmax(0,1fr)_auto]">
                    <Input
                      type="date"
                      className={FIELD}
                      aria-label="Date"
                      value={entry.entryDate ?? ""}
                      onChange={(e) => patch(entry, { entryDate: e.target.value || null })}
                    />
                    <Input
                      className={FIELD}
                      aria-label="Week label"
                      placeholder={`Week ${index + 1}`}
                      value={entry.weekLabel ?? ""}
                      onChange={(e) => patch(entry, { weekLabel: e.target.value || null })}
                    />
                    <Input
                      className={FIELD}
                      aria-label="Topic"
                      placeholder="Topic"
                      value={entry.topic}
                      onChange={(e) => patch(entry, { topic: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => remove(entry)}
                      aria-label="Remove entry"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    className={FIELD}
                    rows={2}
                    aria-label="Description"
                    placeholder="Description (optional)"
                    value={entry.description ?? ""}
                    onChange={(e) => patch(entry, { description: e.target.value || null })}
                  />
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="font-semibold">
                      {entry.weekLabel || `Week ${index + 1}`}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatPlanDate(entry.entryDate)}
                    </span>
                  </div>
                  <div className="mt-1 font-medium">{entry.topic}</div>
                  {entry.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <Label>Add a teaching plan entry</Label>
          <div className="grid gap-2 sm:grid-cols-[10rem_10rem_minmax(0,1fr)]">
            <Input type="date" className={FIELD} aria-label="New date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input className={FIELD} aria-label="New week label" placeholder={`Week ${entries.length + 1}`} value={week} onChange={(e) => setWeek(e.target.value)} />
            <Input className={FIELD} aria-label="New topic" placeholder="Topic — e.g. Quadratic Formula" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <Textarea
            className={FIELD}
            rows={2}
            aria-label="New description"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            onClick={add}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {saving ? "Adding…" : "Add to schedule"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SchedulePlanPanel;
