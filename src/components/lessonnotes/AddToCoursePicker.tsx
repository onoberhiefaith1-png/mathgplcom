// "Assign to a course" — links this lesson-note question to an Exercise Card
// inside Courses. The question itself is never copied: only a reference
// is stored, so editing the note updates the course automatically.
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { linkQuestionToExercise, loadAssignTargets, type AssignTargets } from "@/lib/courses/api";
import type { QuestionRef } from "@/lib/assignments/pipeline";

interface Props {
  notebookId: string;
  questionRef: QuestionRef;
  label: string;
  totalMarks: number;
  onDone: () => void;
}

const AddToCoursePicker = ({ notebookId, questionRef, label, totalMarks, onDone }: Props) => {
  const [targets, setTargets] = useState<AssignTargets>({ courses: [], sections: [], exercises: [] });
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadAssignTargets()
      .then((t) => {
        setTargets(t);
        setCourseId(t.courses[0]?.id ?? "");
      })
      .catch((e: unknown) =>
        toast({ title: "Could not load courses", description: String((e as Error)?.message ?? e), variant: "destructive" }),
      )
      .finally(() => setLoading(false));
  }, []);

  const sections = targets.sections.filter((s) => s.course_id === courseId);
  const exercises = targets.exercises.filter((e) => e.section_id === sectionId);

  const add = async () => {
    if (!exerciseId) return;
    setBusy(true);
    try {
      await linkQuestionToExercise({
        blockId: exerciseId,
        notebookId,
        subsectionId: questionRef.subsectionId,
        sectionId: questionRef.sectionId,
        questionKey: questionRef.questionKey,
        label,
        totalMarks,
      });
      toast({ title: "Question added to the Exercise Card" });
      onDone();
    } catch (e: unknown) {
      toast({ title: "Could not add", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your courses…
      </div>
    );
  }

  if (targets.courses.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        You have no courses yet. Create one in Courses, add an Exercise Card, then come back.
      </p>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label>Course</Label>
        <Select
          value={courseId}
          onValueChange={(v) => {
            setCourseId(v);
            setSectionId("");
            setExerciseId("");
          }}
        >
          <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
          <SelectContent>
            {targets.courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Section</Label>
        <Select
          value={sectionId}
          onValueChange={(v) => {
            setSectionId(v);
            setExerciseId("");
          }}
        >
          <SelectTrigger><SelectValue placeholder={sections.length ? "Choose a section" : "No sections yet"} /></SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Exercise Card</Label>
        <Select value={exerciseId} onValueChange={setExerciseId}>
          <SelectTrigger><SelectValue placeholder={exercises.length ? "Choose an exercise" : "No exercise cards yet"} /></SelectTrigger>
          <SelectContent>
            {exercises.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Adds this question ({totalMarks || 0} marks) to the Exercise Card. The question stays linked to this lesson note.
      </p>

      <Button type="button" onClick={add} disabled={busy || !exerciseId} className="w-full">
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-1.5 h-4 w-4" />}
        Add to course
      </Button>
    </div>
  );
};

export default AddToCoursePicker;
