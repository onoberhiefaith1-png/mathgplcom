import { useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { ClipboardList, Gamepad2 } from "lucide-react";

import AudienceShell from "./AudienceShell";
import { useAudienceAccess } from "@/lib/live/useAudienceAccess";
import { supabase } from "@/integrations/supabase/client";
import PresentationView from "@/components/smartboard/PresentationView";
import { guestToken } from "@/lib/live/guest";

type Row = { id: string; notebook_id: string; game_id: string | null; title: string | null };

/**
 * Challenge and Game Challenge for the audience — the same engines the class
 * uses, opened without an account. Nothing is recorded against a member: work
 * lives in this sitting only.
 */
const AudienceChallengePage = ({ mode }: { mode: "assignment" | "adventure" }) => {
  const { sessionId } = useParams();
  const access = useAudienceAccess(sessionId);
  const classId = access.session?.class_id ?? null;
  const [rows, setRows] = useState<Row[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const label = mode === "adventure" ? "Game Challenge" : "Challenge";
  const Icon = mode === "adventure" ? Gamepad2 : ClipboardList;

  useEffect(() => {
    if (!classId || access.decision !== "enter") return;
    (async () => {
      const { data } = await supabase
        .from("learning_assignments")
        .select("id, notebook_id, game_id, title")
        .eq("class_id", classId)
        .eq("mode", mode)
        .eq("status", "active");
      setRows((data ?? []) as unknown as Row[]);
    })();
  }, [classId, mode, access.decision]);

  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <AudienceShell access={access} title="Session" backTo={`/live/s/${sessionId}`}>
      <h1 className="text-xl font-semibold sm:text-2xl">{label}</h1>

      {open ? (
        <div className="mt-4 space-y-4">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="min-h-[44px] rounded-xl border border-border px-4 text-sm hover:bg-accent"
          >
            All {label.toLowerCase()}s
          </button>
          <div className="overflow-hidden rounded-2xl border border-border">
            <PresentationView
              key={open.id}
              notebookId={open.notebook_id}
              classId={classId}
              role="student"
              workspace={mode === "adventure" ? "adventure" : "assignment"}
              gameId={open.game_id}
              boardStudentId={guestToken()}
              participantKey={guestToken()}
            />
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          The teacher has not set a {label.toLowerCase()} for this session yet.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/40"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold">{row.title ?? label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AudienceShell>
  );
};

export default AudienceChallengePage;
