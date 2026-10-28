import { useEffect, useState } from "react";
import { Loader2, School } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { assignCourseToClass, listOwnedClasses } from "@/lib/courses/classCourses";

/** Step 2 of the assign flow started from Courses: pick the class, then
 *  land straight in that class's Courses workspace. */
const AssignToClassDialog = ({
  open,
  onOpenChange,
  courseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
}) => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listOwnedClasses()
      .then(setClasses)
      .finally(() => setLoading(false));
  }, [open]);

  const pick = async (classId: string) => {
    setBusy(classId);
    try {
      await assignCourseToClass(classId, courseId);
      onOpenChange(false);
      navigate(`/teaching-hub/classes/${classId}/courses`);
    } catch (e: unknown) {
      toast({ title: "Assign failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to a class</DialogTitle>
        </DialogHeader>
        <div className="max-h-[20rem] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your classes…
            </div>
          ) : classes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You have no classes yet. Create one in Classes first.
            </p>
          ) : (
            classes.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy === c.id}
                onClick={() => pick(c.id)}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:border-primary disabled:opacity-60"
              >
                {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <School className="h-4 w-4" />}
                <span className="truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignToClassDialog;
