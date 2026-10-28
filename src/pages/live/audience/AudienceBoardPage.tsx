import { useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";

import AudienceShell from "./AudienceShell";
import { useAudienceAccess } from "@/lib/live/useAudienceAccess";
import { supabase } from "@/integrations/supabase/client";
import PresentationView from "@/components/smartboard/PresentationView";

/**
 * The live SmartBoard, mirrored to the audience. The teacher writes; audience
 * members watch the same board through the existing sync engine.
 */
const AudienceBoardPage = () => {
  const { sessionId } = useParams();
  const access = useAudienceAccess(sessionId);
  const classId = access.session?.class_id ?? null;
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!classId || access.decision !== "enter") return;
    (async () => {
      const { data } = await supabase
        .from("class_smartboard_state")
        .select("notebook_id")
        .eq("class_id", classId)
        .maybeSingle();
      setNotebookId((data as { notebook_id?: string | null } | null)?.notebook_id ?? null);
      setChecked(true);
    })();
  }, [classId, access.decision]);

  return (
    <AudienceShell access={access} title="Session" backTo={`/live/s/${sessionId}`}>
      <h1 className="text-xl font-semibold sm:text-2xl">SmartBoard</h1>
      {!checked ? (
        <p className="mt-4 text-sm text-muted-foreground">Connecting to the board…</p>
      ) : notebookId ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <PresentationView notebookId={notebookId} classId={classId} role="student" viewOnly />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          The teacher has not opened the SmartBoard for this session yet.
        </p>
      )}
    </AudienceShell>
  );
};

export default AudienceBoardPage;
