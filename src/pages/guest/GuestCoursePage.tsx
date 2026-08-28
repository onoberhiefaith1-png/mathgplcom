// Guest Link — a shared Course, opened by anyone on the internet.
//
// The ORIGINAL course, sections, videos and Exercise Cards are streamed by
// reference. Nothing is duplicated per guest, and every mark is written to the
// guest's own attempt, never to a student's progress.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router-compat";
import StudentView from "@/components/coursebuilder/StudentView";
import GuestBoard from "@/components/guests/GuestBoard";
import { setGuestMediaResolver } from "@/lib/courses/media";
import { fetchGuestExercise, fetchGuestMediaUrl, fetchGuestPayload, type GuestCoursePayload } from "@/lib/guests/guestApi";
import { guestLinkDisplayName, guestLinkToken } from "@/lib/guests/guestSession";
import { GuestLoading, GuestNameGate, GuestUnavailable } from "./GuestGate";

type OpenBoard = { assessmentId: string; title: string; questions: any[]; blockId: string } | null;

const GuestCoursePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const code = String(slug ?? "");
  const [payload, setPayload] = useState<GuestCoursePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [board, setBoard] = useState<OpenBoard>(null);
  const [nameTick, setNameTick] = useState(0);
  const token = useMemo(() => guestLinkToken(), []);

  // Media is signed by the link's own endpoint — the guest has no account.
  useEffect(() => {
    setGuestMediaResolver((path) => fetchGuestMediaUrl(code, path));
    return () => setGuestMediaResolver(null);
  }, [code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await fetchGuestPayload(code);
      if (!alive) return;
      if (!p || p.kind !== "course") {
        setFailure("The teacher may have turned this guest link off.");
      } else {
        setPayload(p);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [code]);

  const openExercise = useCallback(async (blockId: string) => {
    const res = await fetchGuestExercise(code, blockId);
    if (!res?.assessment) {
      setFailure("This exercise isn't ready yet. Ask the teacher to reopen the guest link.");
      return;
    }
    setBoard({
      assessmentId: res.assessment.id,
      title: res.assessment.title,
      questions: res.assessment.questions ?? [],
      blockId,
    });
  }, [code]);

  if (loading) return <GuestLoading label="Opening course…" />;
  if (!payload) return <GuestUnavailable message={failure ?? "This course is not shared."} />;

  if (board) {
    return (
      <GuestBoard
        code={code}
        token={token}
        blockId={board.blockId}
        assessment={{ id: board.assessmentId, title: board.title, questions: board.questions as never }}
        backLabel="Back to course"
        onBack={() => setBoard(null)}
      />
    );
  }

  return (
    <GuestNameGate askName={payload.askName} onDone={() => setNameTick((n) => n + 1)}>
      <div className="min-h-screen bg-slate-100 py-6" key={nameTick}>
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
            <span>Guest access — your work is marked instantly and kept separate.</span>
            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm">{guestLinkDisplayName()}</span>
          </div>
          <StudentView tree={payload.tree} onOpenExercise={(id) => void openExercise(id)} />
          {failure && <p className="mt-3 rounded-lg bg-amber-100 p-3 text-xs text-amber-800">{failure}</p>}
          <footer className="py-8 text-center text-xs text-slate-500">
            <a className="underline" href="/">MathGPL — Mathematics Reimagined</a>
          </footer>
        </div>
      </div>
    </GuestNameGate>
  );
};

export default GuestCoursePage;
