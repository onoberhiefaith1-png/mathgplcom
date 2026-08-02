import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listCourses, type CourseSummary } from "@/lib/courses/api";

/** A course *selector*, never an editor: courses are authored in Skill Builder. */
const AssignCourseDialog = ({
  open,
  onOpenChange,
  assignedIds,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignedIds: string[];
  onAssign: (courseId: string) => Promise<void>;
}) => {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listCourses()
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      [c.title, c.subject, c.topic, c.subtopic].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [courses, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign an existing course</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses"
            className="pl-9"
          />
        </div>

        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your courses…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No courses found. Create one in Skill Builder first.
            </p>
          ) : (
            filtered.map((c) => {
              const already = assignedIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {c.title || "Untitled course"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[c.subject, c.topic, c.subtopic].filter(Boolean).join(" · ") || "No topic set"}
                      {" · "}
                      {c.status === "published" ? "Published" : "Draft"}
                    </div>
                  </div>
                  {already ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5" /> Already assigned
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy === c.id}
                      onClick={async () => {
                        setBusy(c.id);
                        try {
                          await onAssign(c.id);
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignCourseDialog;
