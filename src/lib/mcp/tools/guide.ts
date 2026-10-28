import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import {
  GUIDE_VERSION,
  OPERATING_GUIDE,
  lessonStandardsText,
} from "../guide/operatingGuide";
import { requireUser } from "../supabase-user";

type Approved = {
  version: number;
  approvedAt: string;
  mandatory: string;
  recommended: string;
  techniques: string;
  examples: {
    title: string;
    kind: string;
    verdict: string;
    explanation: string;
    snapshot: unknown;
  }[];
};

/** Administrator-approved guidance only; null when none is approved yet. */
export async function loadApprovedGuidance(
  ctx: ToolContext,
): Promise<Approved | null> {
  const authed = await requireUser(ctx);
  if ("error" in authed) return null;
  const { data, error } = await authed.client.rpc(
    "approved_assistant_guidance",
  );
  if (error || !data) return null;
  return data as Approved;
}

export function approvedGuidanceText(g: Approved | null): string {
  if (!g) return "";
  const cut = (s: unknown, n: number) => {
    const t = typeof s === "string" ? s : JSON.stringify(s ?? null);
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };
  return [
    `\n\n7. ADMINISTRATOR-APPROVED GUIDANCE — version ${g.version}`,
    g.mandatory && `MANDATORY platform requirements:\n${g.mandatory}`,
    g.recommended &&
      `RECOMMENDED teaching practice (a teacher's preference may override these):\n${g.recommended}`,
    g.techniques &&
      `TECHNIQUES illustrated by examples (not compulsory rules):\n${g.techniques}`,
    g.examples.length
      ? `REFERENCE EXAMPLES:\n${g.examples.map((e) => `- ${e.title} [${e.kind}, ${e.verdict}]: ${e.explanation}\n  data: ${cut(e.snapshot, 3000)}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const getOperatingGuideTool = defineTool({
  name: "get_operating_guide",
  title: "Get the MathGPL operating guide",
  description:
    "Load FIRST in every conversation. Returns the current MathGPL Assistant Operating Guide: the workflow order, approval rules, recovery steps, costs and limits, plus the administrator-approved guidance and reference examples, and guideVersion required by save_structured_lesson.",
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (_args, ctx) => {
    const approved = await loadApprovedGuidance(ctx);
    return {
      content: [
        {
          type: "text" as const,
          text: OPERATING_GUIDE + approvedGuidanceText(approved),
        },
      ],
      structuredContent: {
        guideVersion: GUIDE_VERSION,
        approvedGuidanceVersion: approved?.version ?? null,
      },
    };
  },
});

export const getLessonStandardsTool = defineTool({
  name: "get_lesson_standards",
  title: "Get MathGPL lesson-note standards",
  description:
    "Returns the classroom standards MathGPL's Co-Pilot follows (solution micro-steps, notation, session pairing, integrity). Read before writing lesson content.",
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: () => ({
    content: [{ type: "text" as const, text: lessonStandardsText() }],
    structuredContent: { guideVersion: GUIDE_VERSION },
  }),
});
