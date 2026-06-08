import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import SmartboardShelf from "@/components/smartboard/SmartboardShelf";
import PresentationView from "@/components/smartboard/PresentationView";
import { supabase } from "@/integrations/supabase/client";

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
    // Teacher-side broadcast: upsert the active notebook for the class
    supabase
      .from("class_smartboard_state")
      .upsert(
        { class_id: classId, notebook_id: notebookId, updated_at: new Date().toISOString() },
        { onConflict: "class_id" },
      )
      .then(() => {});
  }, [classId, notebookId]);

  if (!notebookId) return <SmartboardShelf />;
  // viewer flag is currently informational; PresentationView already renders
  // content; preventing student input/control will be tightened in a later phase.
  void viewer;
  return <PresentationView />;
};

export default SmartBoardPage;
