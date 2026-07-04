// Presentation AI — Lovable prompt generator.
// Turns an unresolved Issue into a copy-pasteable Lovable prompt so the
// teacher never has to describe the bug in prose.

import type { Issue } from "./types";
import type { SpeedPreset } from "./types";

export interface PromptContext {
  notebookId?: string | null;
  notebookTitle?: string | null;
  speed?: SpeedPreset;
}

// Best-guess component pointers per issue kind. Keep this list short — it's
// a hint, not a diagnosis.
const componentHint = (kind: Issue["kind"]): string => {
  switch (kind) {
    case "note-missing":
      return "src/components/smartboard/PresentationView.tsx (note-attention useEffect ~line 2007)";
    case "floating-missing":
      return "src/lib/smartboard/floatingExtractor.ts + Floating Number generation edge function";
    case "highlight-wrong":
    case "beat-cursor-drift":
    case "line-cursor-drift":
      return "src/components/smartboard/PresentationView.tsx (beatCursor / activeLineIdx state)";
    case "scroll-out-of-view":
      return "src/components/smartboard/PresenterPreviewPanel.tsx (auto-scroll rAF loop)";
    case "rendering-broken":
      return "src/lib/notebook/mathRender.ts + SmartboardLessonText";
    case "structural":
      return "src/lib/smartboard/presentation.ts (buildBeats / buildReservoirs)";
    case "section-missing":
      return "src/hooks/useNotebook.ts (section loader) + notebook data";
  }
};

export const buildLovablePrompt = (
  issue: Issue,
  ctx: PromptContext,
): string => {
  const lines = [
    "Presentation AI detected an unresolvable issue during Autoplay.",
    "",
    `Component: ${componentHint(issue.kind)}`,
    `Section: ${issue.section}`,
    `Line: ${issue.lineIdx !== null ? issue.lineIdx + 1 : "n/a"}`,
    `Issue type: ${issue.kind}`,
    "",
    `Problem: ${issue.summary}`,
    `Expected (from Presenter Preview): ${issue.expected}`,
    `Actual (on Smartboard): ${issue.actual}`,
    `Probable cause: ${issue.probableCause}`,
    `Suggested implementation: ${issue.suggestedFix}`,
    "",
    "Repro:",
    `  1. Open notebook ${ctx.notebookTitle ?? ""} (id: ${ctx.notebookId ?? "?"}).`,
    `  2. Start Presentation AI Autoplay at ${ctx.speed ?? "standard"} preset.`,
    `  3. Wait for beat "${issue.section}"${issue.lineIdx !== null ? `, line ${issue.lineIdx + 1}` : ""}.`,
    "  4. Observe the mismatch above.",
    "",
    "Expected behaviour: the Smartboard must reproduce the Presenter Preview exactly. The Presenter Preview is the source of truth.",
    "",
    "Please implement the fix inside the presentation pipeline without changing lesson content, floating extraction, or the student-facing sync protocol.",
  ];
  return lines.join("\n");
};
