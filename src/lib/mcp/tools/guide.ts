import { defineTool } from "@lovable.dev/mcp-js";
import { GUIDE_VERSION, OPERATING_GUIDE, lessonStandardsText } from "../guide/operatingGuide";

export const getOperatingGuideTool = defineTool({
  name: "get_operating_guide",
  title: "Get the MathGPL operating guide",
  description:
    "Load FIRST in every conversation. Returns the current MathGPL Assistant Operating Guide: the workflow order, approval rules, recovery steps, costs and limits, plus guideVersion required by save_structured_lesson.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text" as const, text: OPERATING_GUIDE }],
    structuredContent: { guideVersion: GUIDE_VERSION },
  }),
});

export const getLessonStandardsTool = defineTool({
  name: "get_lesson_standards",
  title: "Get MathGPL lesson-note standards",
  description:
    "Returns the classroom standards MathGPL's Co-Pilot follows (solution micro-steps, notation, session pairing, integrity). Read before writing lesson content.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text" as const, text: lessonStandardsText() }],
    structuredContent: { guideVersion: GUIDE_VERSION },
  }),
});
