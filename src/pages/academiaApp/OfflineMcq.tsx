import McqExamPage from "@/pages/academia/mcq/McqExamPage";
import type { OfflinePaper } from "@/lib/offline/extendedActivities";
import { setKv } from "@/lib/offline/academiaStore";

/** The connected paper player, with device persistence instead of an account request. */
export default function OfflineMcq({ paper, onBack }: { paper: OfflinePaper; onBack: () => void }) {
  return <McqExamPage offline={{ paper, onBack, save: async (attempt) => {
    const id = crypto.randomUUID();
    await setKv(`mcq-attempt:${id}`, { ...attempt, id, submitted_at: new Date().toISOString() });
  } }} />;
}
