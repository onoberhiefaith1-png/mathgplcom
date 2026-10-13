import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { GUIDE_VERSION } from "../guide/operatingGuide";
import { draftInputSchema, toStructured } from "../guide/lessonSchema";
import { draftDigest, reviewLessonDraft, type LessonDraft } from "../guide/lessonDraft";
import { err, ok } from "../supabase-user";

export default defineTool({
  name: "preview_structured_lesson",
  title: "Review a ChatGPT-authored lesson draft",
  description: "Read-only: validates ChatGPT's own full lesson draft, exact teacher counts, question/solution structure, notation and supplied numerical answer checks. Returns approvalDigest for this exact payload. Never writes, calls Copilot/AI Edit, invokes an AI model or uses MathGPL generation credits. Show the lesson and checking limits to the teacher before asking for acceptance.",
  inputSchema: { guideVersion: z.string().describe("Version returned by the current get_operating_guide."), ...draftInputSchema },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ guideVersion, ...input }) => {
    if (guideVersion !== GUIDE_VERSION) return err("Load the current get_operating_guide before previewing this lesson.");
    const draft: LessonDraft = { ...input, sections: toStructured(input.sections) };
    const review = reviewLessonDraft(draft);
    const approvalDigest = review.ok ? await draftDigest(draft) : null;
    return {
      ...ok(review.ok ? "Draft reviewed; nothing saved. Show the full draft and checking limits, then wait for acceptance." : "Draft needs correction; nothing saved. Fix the reported problems and preview again."),
      ...(review.ok ? {} : { isError: true }),
      structuredContent: { saved: false, guideVersion: GUIDE_VERSION, approvalDigest, ...review, mathgplGenerationCredits: 0 },
    };
  },
});
