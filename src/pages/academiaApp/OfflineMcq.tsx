import McqExamPage from "@/pages/academia/mcq/McqExamPage";
import type { OfflinePaper } from "@/lib/offline/extendedActivities";
import { setKv } from "@/lib/offline/academiaStore";

/** The connected paper player, with device persistence instead of an account request. */
export default function OfflineMcq({ paper, onBack, onContinue }: { paper: OfflinePaper; onBack: () => void; onContinue?: () => void }) {
  return <>
    {onContinue && <nav aria-label="Practice activities" className="flex justify-end bg-background px-4 py-2"><button type="button" onClick={onContinue} className="rounded-full border border-border px-4 py-2 text-sm">Next practice →</button></nav>}
    <McqExamPage offline={{ paper, onBack, save: async (attempt) => {
    const id = crypto.randomUUID();
    await setKv(`mcq-attempt:${id}`, { ...attempt, id, submitted_at: new Date().toISOString() });
  } }} />
  </>;
}
