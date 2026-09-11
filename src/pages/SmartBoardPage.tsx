import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "@/lib/router-compat";
import SmartboardShelf from "@/components/smartboard/SmartboardShelf";
import PresentationView from "@/components/smartboard/PresentationView";
import { supabase } from "@/integrations/supabase/client";
import { publishActiveNote } from "@/lib/smartboard/classBoardState";
import { hydrateFloatingFromOrigin } from "@/lib/lessonnotes/hydrateFloatingFromOrigin";
import { toast } from "sonner";

const openClassSmartBoard = async (classId: string, notebookId: string) => {
  const now = new Date().toISOString();

  const { data: previousState } = await supabase
    .from("class_smartboard_state")
    .select("notebook_id")
    .eq("class_id", classId)
    .maybeSingle();
  const notebookChanged = !!previousState?.notebook_id && previousState.notebook_id !== notebookId;

  const { error: classError } = await supabase
    .from("classes")
    .update({ smartboard_visibility: "student_access_enabled" })
    .eq("id", classId);
  if (classError) {
    console.warn("[class-smartboard] could not enable student access", classError.message);
  }

  const { error: noteError } = await supabase
    .from("class_lesson_notes")
    .upsert(
      { class_id: classId, notebook_id: notebookId, visibility: "student_access_enabled", added_at: now },
      { onConflict: "class_id,notebook_id" },
    );
  if (noteError) {
    console.warn("[class-smartboard] could not share notebook with class", noteError.message);
  }

  // Students render whatever this field says. If it does not move, the whole
  // class keeps watching the previous lesson note — so the write is verified
  // and any failure is shown to the teacher instead of only logged.
  const result = await publishActiveNote(classId, notebookId, { clearSnapshot: notebookChanged });
  if (!result.ok) {
    console.warn("[class-smartboard] could not publish the live lesson note", result.error);
    toast.error("Students are not seeing this lesson note yet", {
      description: "Reopen it from the class SmartBoard. If it keeps happening, refresh the page.",
    });
  }
};

/**
 * /smartboard           → shelf picker (notebooks)
 * /smartboard/:id       → live presentation of that notebook
 *
 * When opened with ?classId=… (teacher launching from a class), the active
 * notebook id is upserted to `class_smartboard_state` so approved students
 * subscribed via the StudentSmartBoardPage receive the change in realtime.
 */
const SmartBoardPage = () => {
  const { notebookId } = useParams<{ notebookId: string }>();
  const [params] = useSearchParams();
  const classId = params.get("classId");
  const viewer = params.get("viewer"); // students arrive with ?viewer=class:<id>

  // A stored class copy of a lesson note can be missing the prepared Floating
  // Numbers, which live on each question row rather than in the page text. They
  // are brought across from the original note BEFORE the board mounts, so the
  // first render already holds the same structure the Test board uses.
  const [sourceReady, setSourceReady] = useState(false);
  useEffect(() => {
    if (!notebookId) return;
    let alive = true;
    setSourceReady(false);
    void hydrateFloatingFromOrigin(notebookId)
      .catch((error) => {
        console.warn("[smartboard] prepared floating numbers not hydrated", error);
      })
      .finally(() => {
        if (alive) setSourceReady(true);
      });
    return () => {
      alive = false;
    };
  }, [notebookId]);

  useEffect(() => {
    if (!classId || !notebookId) return;
    // Teacher-side open: make the class visible, make the notebook readable,
    // then publish the active notebook as the one source of truth for students.
    void openClassSmartBoard(classId, notebookId);
  }, [classId, notebookId]);


  if (!notebookId) return <SmartboardShelf />;
  // viewer flag is currently informational; PresentationView already renders
  // content; preventing student input/control will be tightened in a later phase.
  void viewer;
  if (!sourceReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Opening the lesson…
      </div>
    );
  }
  return <PresentationView classId={classId} role="teacher" />;
};

export default SmartBoardPage;
