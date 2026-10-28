// Mounted by every question board. It tells Tutor "a question is open here"
// and opens the Guide beside the board when Tutor is asked for a tutorial.
// Only staff can open Tutor, so the Guide never reaches students this way.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import TutorGuide from "./TutorGuide";
import { publishScreen, registerTutorAction } from "@/lib/assistant/actions";
import type { GuideLine } from "@/lib/assistant/guide";

export default function TutorGuideHost({ lines, currentLine = 0, question }: {
  lines: GuideLine[]; currentLine?: number; question?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const hasSolution = useMemo(() => lines.some((l) => l.equation?.trim()), [lines]);

  useEffect(() => publishScreen({ page: "question", question: question ?? null, hasSolution }), [question, hasSolution]);

  // While the Guide is closed, Tutor's "guide me" opens it here.
  useEffect(() => {
    if (open) return;
    const a = registerTutorAction("guide.start", () => {
      if (!hasSolution) return { ok: false, say: "This question has no saved solution yet, so I can't guide it step by step." };
      setAutoStart(true);
      setOpen(true);
      return { ok: true, say: "Here's the guide for this question." };
    });
    const b = registerTutorAction("guide.stop", () => ({ ok: true, say: "The guide isn't running." }));
    return () => { a(); b(); };
  }, [open, hasSolution]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed bottom-20 left-4 top-20 z-[59] flex w-[min(92vw,360px)] flex-col overflow-hidden rounded-xl border border-border shadow-2xl">
      <TutorGuide lines={lines} currentLine={currentLine} autoStart={autoStart} onClose={() => { setOpen(false); setAutoStart(false); }} />
    </div>,
    document.body,
  );
}
