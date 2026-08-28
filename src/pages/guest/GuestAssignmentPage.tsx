// Guest Link — a shared Assignment Card, opened by anyone on the internet.
//
// The ORIGINAL questions compiled for the class are served by reference; guest
// marks live in the guest's own attempt and never reach the class results.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { ClipboardList } from "lucide-react";
import GuestBoard from "@/components/guests/GuestBoard";
import { fetchGuestPayload, type GuestAssignmentPayload } from "@/lib/guests/guestApi";
import { guestLinkDisplayName, guestLinkToken } from "@/lib/guests/guestSession";
import { GuestLoading, GuestNameGate, GuestUnavailable } from "./GuestGate";

const GuestAssignmentPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const code = String(slug ?? "");
  const [payload, setPayload] = useState<GuestAssignmentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [nameTick, setNameTick] = useState(0);
  const token = useMemo(() => guestLinkToken(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await fetchGuestPayload(code);
      if (!alive) return;
      if (p && p.kind === "assignment") setPayload(p);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [code]);

  const open = payload?.assessments.find((a) => a.id === openId) ?? null;
  if (loading) return <GuestLoading label="Opening assignment…" />;
  if (!payload) {
    return <GuestUnavailable message="The teacher may have turned this guest link off." />;
  }

  if (open) {
    return (
      <GuestBoard
        code={code}
        token={token}
        assessment={open}
        backLabel="Back to questions"
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <GuestNameGate askName={payload.askName} onDone={() => setNameTick((n) => n + 1)}>
      <div className="min-h-screen bg-slate-100 py-8" key={nameTick}>
        <div className="mx-auto max-w-2xl px-4">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
            <span>Guest access — marked instantly, kept separate from the class.</span>
            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm">{guestLinkDisplayName()}</span>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <ClipboardList className="h-5 w-5" /> {payload.title}
            </h1>
            <p className="text-xs text-slate-500">
              {[payload.subject, payload.subtopic].filter(Boolean).join(" • ")}
            </p>

            <ul className="mt-4 divide-y rounded-xl border">
              {payload.assessments.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">Question {i + 1}</span>
                    <span className="block truncate text-xs text-slate-500">{a.title}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-slate-500">{a.total_marks} marks</span>
                    <button
                      type="button"
                      onClick={() => setOpenId(a.id)}
                      className="min-h-[40px] rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                    >
                      Solve
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <footer className="py-8 text-center text-xs text-slate-500">
            <a className="underline" href="/">MathGPL — Mathematics Reimagined</a>
          </footer>
        </div>
      </div>
    </GuestNameGate>
  );
};

export default GuestAssignmentPage;
