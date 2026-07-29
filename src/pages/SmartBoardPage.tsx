import { useEffect } from "react";
import { useParams, useSearchParams } from "@/lib/router-compat";
import SmartboardShelf from "@/components/smartboard/SmartboardShelf";
import PresentationView from "@/components/smartboard/PresentationView";
import { supabase } from "@/integrations/supabase/client";

const openClassSmartBoard = async (classId: string, notebookId: string) => {
  const now = new Date().toISOString();

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

  const { error: stateError } = await supabase
    .from("class_smartboard_state")
    .upsert(
      { class_id: classId, notebook_id: notebookId, updated_at: now },
      { onConflict: "class_id" },
    );
  if (stateError) {
    console.warn("[class-smartboard] could not open class board state", stateError.message);
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
  return <PresentationView classId={classId} role="teacher" />;
};

export default SmartBoardPage;
