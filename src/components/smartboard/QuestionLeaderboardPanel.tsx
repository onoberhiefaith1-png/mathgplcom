// Per-question class ranking drawer.
//
// Opened from the Best Time chip on the board. It only reads the timed-attempt
// layer — it never navigates, resets work, or touches the timer, so the board
// behind it keeps running exactly as it was.

import { useCallback, useEffect, useState } from "react";
import { X, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import useEscapeClose from "@/hooks/useEscapeClose";
import { formatAttemptTime } from "@/hooks/useQuestionTimerAttempt";
import {
  loadQuestionLeaderboard,
  type QuestionLeaderboard,
} from "@/lib/assessments/questionLeaderboard";

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`;

export const QuestionLeaderboardPanel = ({
  assessmentId,
  questionId,
  classId,
  viewerId,
  questionLabel,
  onClose,
  palette,
}: {
  assessmentId: string;
  questionId: string;
  classId: string | null;
  viewerId?: string | null;
  questionLabel?: string | null;
  onClose: () => void;
  palette: { chromeBg: string; chromeFg: string; chromeBorder: string; hoverBg: string; accent: string };
}) => {
  const [board, setBoard] = useState<QuestionLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEscapeClose(onClose, true);

  const load = useCallback(async () => {
    if (!classId) { setBoard({ ranked: [], notStarted: [] }); setLoading(false); return; }
    const next = await loadQuestionLeaderboard({ assessmentId, questionId, classId });
    setBoard(next);
    setLoading(false);
  }, [assessmentId, questionId, classId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Live: any new/better time for this assessment repositions the board.
  useEffect(() => {
    if (!classId) return;
    const ch = supabase
      .channel(`question-leaderboard-${assessmentId}-${questionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assessment_timer_attempts",
          filter: `assessment_id=eq.${assessmentId}`,
        },
        () => { void load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [assessmentId, questionId, classId, load]);

  const rowStyle = (mine: boolean) =>
    mine
      ? { background: palette.accent, color: palette.chromeBg }
      : { background: palette.hoverBg, color: palette.chromeFg };

  return (
    <aside
      className="absolute inset-y-0 left-0 z-40 flex w-[19rem] max-w-[85vw] flex-col border-r shadow-2xl"
      style={{ background: palette.chromeBg, color: palette.chromeFg, borderColor: palette.chromeBorder }}
      aria-label="Class leaderboard"
    >
      <header
        className="flex items-start justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: palette.chromeBorder }}
      >
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4" /> Class Leaderboard
          </h2>
          <p className="mt-0.5 truncate text-[11px] opacity-70">
            {questionLabel ? questionLabel : "This question"} · best times
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-black/10"
          aria-label="Close leaderboard"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3 text-sm">
        {loading && <p className="px-1 text-xs opacity-70">Loading…</p>}

        {!loading && board && board.ranked.length === 0 && (
          <p className="px-1 text-xs opacity-70">No recorded times yet.</p>
        )}

        {board?.ranked.map((r) => (
          <div
            key={r.userId}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            style={rowStyle(!!viewerId && r.userId === viewerId)}
          >
            <span className="w-9 shrink-0 text-[11px] font-bold tabular-nums opacity-80">
              {ordinal(r.place)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="shrink-0 text-xs font-bold tabular-nums">{formatAttemptTime(r.ms)}</span>
          </div>
        ))}

        {board && board.notStarted.length > 0 && (
          <div className="pt-2">
            {board.notStarted.map((m) => (
              <div
                key={m.userId}
                className="mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 opacity-70"
                style={{ background: palette.hoverBg }}
              >
                <span className="w-9 shrink-0 text-center text-[11px] opacity-60">—</span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="shrink-0 text-[11px]">Not started</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default QuestionLeaderboardPanel;
