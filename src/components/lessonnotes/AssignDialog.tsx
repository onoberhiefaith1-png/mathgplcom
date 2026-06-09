// Compact "Assign to Students" dialog. Opened from the 👥 icon on a Solution
// heading. The teacher picks the class + assignment type + title; on confirm we
// build a class assessment from the parent question section (solution hidden).

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  createAssessmentFromSubsection,
  type AssessmentKind,
} from "@/lib/assessments/createAssessment";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Resolved subsection id of the clicked Solution. */
  subsectionId: string | null;
  notebookId: string;
  defaultTitle: string;
}

const KIND_OPTIONS: { value: AssessmentKind; label: string }[] = [
  { value: "classwork", label: "Classwork" },
  { value: "homework", label: "Homework" },
  { value: "assessment", label: "Assessment" },
  { value: "practice", label: "Practice" },
];

export function AssignDialog({ open, onOpenChange, subsectionId, notebookId, defaultTitle }: Props) {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [kind, setKind] = useState<AssessmentKind>("classwork");
  const [title, setTitle] = useState(defaultTitle);
  const [scoreLabel, setScoreLabel] = useState("Marks");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: rows } = await supabase
        .from("classes")
        .select("id, name")
        .eq("owner_id", uid ?? "")
        .order("created_at", { ascending: true });
      const list = (rows ?? []).map((r: any) => ({ id: r.id, name: r.name ?? "Class" }));
      setClasses(list);
      if (list.length && !classId) setClassId(list[0].id);

      // Default the title from the notebook subtopic/title when none provided.
      let nbTitle = defaultTitle;
      if (!nbTitle && notebookId) {
        const { data: nb } = await supabase
          .from("notebooks")
          .select("subtopic, title")
          .eq("id", notebookId)
          .maybeSingle();
        nbTitle = (nb as any)?.subtopic || (nb as any)?.title || "Assignment";
      }
      setTitle(nbTitle || "Assignment");


      if (subsectionId) {
        const { data: ss } = await supabase
          .from("notebook_subsections")
          .select("floating_scoring")
          .eq("id", subsectionId)
          .maybeSingle();
        const lbl = (ss as any)?.floating_scoring?.label;
        if (lbl) setScoreLabel(String(lbl));
      }
      setLoading(false);
    })();
  }, [open, defaultTitle, subsectionId, notebookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async () => {
    if (!subsectionId) {
      toast({ title: "Save the lesson note first", description: "Floating numbers aren't ready yet.", variant: "destructive" });
      return;
    }
    if (!classId) {
      toast({ title: "Pick a class", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await createAssessmentFromSubsection({
        subsectionId,
        classId,
        notebookId,
        kind,
        title: title.trim() || defaultTitle,
        scoreLabel,
      });
      toast({ title: "Assigned", description: "Students can now open this assignment." });
      onOpenChange(false);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      toast({
        title: "Could not assign",
        description: msg === "no_floating_lines"
          ? "This question has no floating-number lines yet. Open Floating Numbers and generate them first."
          : msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Assign to Students
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading classes…
          </div>
        ) : classes.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            You have no classes yet. Create a class first, then assign.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AssessmentKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Assignment title"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Students receive the question and floating chips only — the solution and marking key stay hidden.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={assign} disabled={busy || loading || classes.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Users className="h-4 w-4 mr-1.5" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignDialog;
