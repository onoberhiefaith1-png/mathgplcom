import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import PresentationView from "@/components/smartboard/PresentationView";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

/**
 * The school watching a class board live. It renders the same shared board row
 * the class renders, forced into view-only mode: administrators monitor
 * teaching, they never take over the board.
 */
const SharedSmartboardMirrorPage = ({ userId, classId }: { userId: string; classId: string }) => {
  const { person } = useSharedMember(userId);
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [{ data: cls }, { data: state }] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        supabase.from("class_smartboard_state").select("notebook_id").eq("class_id", classId).maybeSingle(),
      ]);
      if (cancelled) return;
      setClassName(((cls as { name?: string } | null)?.name) ?? "");
      setNotebookId(((state as { notebook_id?: string | null } | null)?.notebook_id) ?? null);
      setLoading(false);
    };

    void load();

    // The board the teacher opens can change mid-lesson; follow it live.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      await ensureRealtimeAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`school-board-watch:${classId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
          () => void load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [classId]);

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="smartboard"
      title={className ? `Smartboard · ${className}` : "Smartboard"}
      subtitle="Live mirror of the teacher's board. Everything here is view only."
    >
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
        <Eye className="h-3.5 w-3.5" /> Watching — you cannot write on this board
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting to the board…
        </p>
      ) : !notebookId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          The teacher has not opened a board for this class yet. This page follows the board live — it will appear here
          as soon as teaching starts.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="pointer-events-none relative min-h-[520px]">
            <PresentationView notebookId={notebookId} classId={classId} role="student" viewOnly />
          </div>
        </div>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedSmartboardMirrorPage;
