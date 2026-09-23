// Phase 2 — the agent brain: the reasoning loop that plans, calls the platform
// tools from Phase 1, inspects the results and corrects itself.
//
// Server-only. The teacher's own authenticated database client is threaded into
// every tool execution, so row-level security applies exactly as in the UI.

import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, jsonSchema, stepCountIs, type ModelMessage } from "ai";

import { AGENT_TOOL_MANIFEST, type AgentToolParam, type AgentToolResult } from "./toolTypes";
import { buildAgentSystemPrompt, AGENT_GREETING_INSTRUCTION, type AgentSnapshotHint } from "./systemPrompt";
import { executeAgentTool, type AgentToolContext } from "./tools.server";
import { learnedKnowledgePrompt } from "./hands.server";

import type { AuraPlatformContext } from "./context";
import { parseTeachingScript, type TeachingScript } from "./teachingScript";

const AGENT_MODEL = "openai/gpt-6-astra";

export type AgentStep = {
  toolId: string;
  ok: boolean;
  summary: string;
  navigateTo?: string;
  /** Set by teach_lesson: the spoken lesson the cockpit performs. */
  teach?: TeachingScript;
};

export type AgentTurn = {
  reply: string;
  steps: AgentStep[];
  navigateTo?: string;
};

function jsonType(type: AgentToolParam["type"]) {
  switch (type) {
    case "number":
      return { type: "number" as const };
    case "boolean":
      return { type: "boolean" as const };
    case "string[]":
      return { type: "array" as const, items: { type: "string" as const } };
    case "number[]":
      return { type: "array" as const, items: { type: "number" as const } };
    default:
      return { type: "string" as const };
  }
}

/**
 * Strict-compatible JSON schema for one tool: every property listed in
 * `required`, optional inputs expressed as nullable, no defaults.
 */
function toolSchema(params: AgentToolParam[]) {
  const properties: Record<string, unknown> = {};
  for (const p of params) {
    const base = jsonType(p.type);
    properties[p.name] = p.required
      ? { ...base, description: p.description }
      : { ...base, type: [base.type, "null"], description: p.description };
  }
  return jsonSchema({
    type: "object",
    properties,
    required: params.map((p) => p.name),
    additionalProperties: false,
  } as never);
}

function provider(apiKey: string) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

const RESPONSES_OPTIONS = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The assistant is not configured yet.");
  return key;
}

function buildTools(ctx: AgentToolContext, steps: AgentStep[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};
  for (const spec of AGENT_TOOL_MANIFEST) {
    tools[spec.id] = tool({
      description: spec.description,
      inputSchema: toolSchema(
        spec.needsConfirmation
          ? [
              ...spec.params,
              {
                name: "confirmed",
                type: "boolean" as const,
                required: false,
                description:
                  "True only after the teacher has clearly agreed to this exact action in the conversation.",
              },
            ]
          : spec.params,
      ),
      execute: async (raw: unknown) => {
        const args: Record<string, unknown> = {};
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (v !== null && v !== undefined) args[k] = v;
          }
        }
        let result: AgentToolResult;
        try {
          result = await executeAgentTool(ctx, spec.id, args);
        } catch (error) {
          result = { ok: false, toolId: spec.id, error: (error as Error).message };
        }
        steps.push({
          toolId: spec.id,
          ok: result.ok,
          summary: result.ok ? result.summary : result.error,
          ...(result.ok && result.navigateTo ? { navigateTo: result.navigateTo } : {}),
          ...(result.ok && spec.id === "teach_lesson"
            ? (() => {
                const teach = parseTeachingScript(result.data);
                return teach ? { teach } : {};
              })()
            : {}),
        });
        return result;
      },
    });
  }
  return tools;
}

/**
 * On a call she is speaking, not writing: short warm turns that sound natural
 * out loud. Her platform abilities and the mathematics rules are unchanged.
 */
const CALL_INSTRUCTION = `
LIVE CALL
You are on a live voice call with the teacher right now. Everything you say is spoken aloud.
- Answer in one or two short spoken sentences. Never use headings, bullet points, asterisks or numbered lists.
- Say numbers and symbols the way a teacher says them out loud.
- When you do something on the platform, confirm it in a single sentence and stop.
- If a task needs a long explanation, say the short version and offer to put the detail on screen.
`;

function turnFrom(reply: string, steps: AgentStep[]): AgentTurn {
  const navigations = steps.filter((s) => s.ok && s.navigateTo);
  const last = navigations[navigations.length - 1];
  return {
    reply: reply.trim() || steps.filter((s) => s.ok).map((s) => s.summary).join(" ") || "Done.",
    steps,
    ...(last?.navigateTo ? { navigateTo: last.navigateTo } : {}),
  };
}

async function startTurn(
  ctx: AgentToolContext,
  messages: ModelMessage[],
  options: { call?: boolean },
  hint?: AgentSnapshotHint,
  context?: AuraPlatformContext | null,
) {
  const steps: AgentStep[] = [];
  const lovable = provider(apiKey());
  const learned = await learnedKnowledgePrompt(ctx).catch(() => null);
  const system = `${buildAgentSystemPrompt(hint, context, learned)}${options.call ? CALL_INSTRUCTION : ""}`;

  const result = streamText({
    model: lovable.responses(AGENT_MODEL),
    system,
    messages,
    tools: buildTools(ctx, steps),
    stopWhen: stepCountIs(50),
    providerOptions: RESPONSES_OPTIONS as never,
  });

  return { result, steps };
}

/** One conversational turn: the agent plans, acts and answers. */
export async function runAgentTurn(
  ctx: AgentToolContext,
  messages: ModelMessage[],
  hint?: AgentSnapshotHint,
  context?: AuraPlatformContext | null,
): Promise<AgentTurn> {
  const { result, steps } = await startTurn(ctx, messages, {}, hint, context);
  return turnFrom(await result.text, steps);
}

export type AgentTurnStream = {
  /** Her answer as it is written, so the first clause can be spoken at once. */
  text: AsyncIterable<string>;
  /** The finished turn, including everything she did. */
  finish: () => Promise<AgentTurn>;
  abort: () => void;
};

/** The same turn, streamed — used by the call so she talks while she thinks. */
export async function streamAgentTurn(
  ctx: AgentToolContext,
  messages: ModelMessage[],
  options: { call?: boolean } = {},
  hint?: AgentSnapshotHint,
  context?: AuraPlatformContext | null,
): Promise<AgentTurnStream> {
  const { result, steps } = await startTurn(ctx, messages, options, hint, context);
  return {
    text: result.textStream,
    finish: async () => turnFrom(await result.text, steps),
    abort: () => {
      /* the reply is abandoned by dropping the stream */
    },
  };
}

/**
 * The proactive opening line the teacher sees on arrival: built from a real
 * workspace snapshot, never a generic hello.
 */
export async function runAgentGreeting(ctx: AgentToolContext): Promise<{ greeting: string }> {
  const snapshot = await executeAgentTool(ctx, "workspace_snapshot", {});
  if (!snapshot.ok) return { greeting: "Hello — tell me what you'd like to set up and I'll do it." };

  const lovable = provider(apiKey());
  const result = streamText({
    model: lovable.responses(AGENT_MODEL),
    system: buildAgentSystemPrompt(),
    prompt: `${AGENT_GREETING_INSTRUCTION}\n\nSNAPSHOT:\n${JSON.stringify(snapshot.data)}`,
    providerOptions: RESPONSES_OPTIONS as never,
  });

  const greeting = (await result.text).trim();
  return { greeting: greeting || "Hello — tell me what you'd like to set up and I'll do it." };
}
