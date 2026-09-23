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

import { turnCost, type TurnUsage } from "./spend";

import type { AuraPlatformContext } from "./context";
import { parseTeachingScript, type TeachingScript } from "./teachingScript";

/**
 * Aura's everyday brain: measured on this gateway as the cheapest model that
 * both drives the platform tools correctly and answers in about a second. The
 * previous choice spent its whole reply on hidden thinking and returned no words
 * at all, which is what made her feel silent and slow. Heavy mathematics stays
 * with the notebook generator, which is unchanged.
 */
export const AGENT_MODEL = "google/gemini-2.5-flash";

/**
 * The fast front of her voice: answers in well under a second, so she speaks the
 * moment the teacher stops while the brain above is still working.
 */
export const FAST_MODEL = "google/gemini-2.5-flash-lite";

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
  /** What this turn really cost, measured from the tokens the model reported. */
  usage?: TurnUsage;
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

export function provider(apiKey: string) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

/**
 * No hidden thinking tokens are bought on an ordinary turn: nothing is
 * summarised, nothing is returned encrypted. That removed both the long wait
 * before she answered and the great majority of what she used to cost.
 * `store: false` stays because the gateway keeps no conversation state.
 */
export const RESPONSES_OPTIONS = {
  openai: { store: false },
} as const;

/** A spoken turn uses the same lightweight settings. */
const CALL_RESPONSES_OPTIONS = RESPONSES_OPTIONS;

/** The everyday abilities a spoken turn almost always needs. */
const CALL_TOOL_IDS = new Set([
  "workspace_snapshot",
  "list_classes",
  "list_class_students",
  "list_lesson_notes",
  "read_lesson_note",
  "list_games",
  "agent_capabilities",
  "explain_workflow",
  "recall_knowledge",
  "teach_lesson",
  "navigate",
]);

/** Words that mean this spoken turn is going to change something real. */
const ACTION_WORDS =
  /\b(creat|make|add|writ|build|set up|setup|assign|attach|highlight|generate|publish|test|link|remove|delete|archive|move|edit|insert|repair|reorder|place|configure|approve|propose|open|upload|read (the )?(file|document|attachment))/i;

/**
 * A plain spoken exchange gets the small ability set, which is markedly faster.
 * Anything that sounds like real work gets every ability, unchanged. Permissions
 * and confirmation checks are untouched either way.
 */
function callNeedsFullAbilities(messages: ModelMessage[]): boolean {
  const last = [...messages].reverse().find((message) => message.role === "user");
  const text =
    typeof last?.content === "string"
      ? last.content
      : Array.isArray(last?.content)
        ? last.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join(" ")
        : "";
  return ACTION_WORDS.test(text);
}

export function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The assistant is not configured yet.");
  return key;
}

export type ToolGate = (toolId: string, args: Record<string, unknown>) => Promise<string | null> | string | null;

export function buildTools(
  ctx: AgentToolContext,
  steps: AgentStep[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: { only?: string[] | Set<string>; gate?: ToolGate; extra?: Record<string, any> },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = { ...(options?.extra ?? {}) };
  const only = options?.only
    ? options.only instanceof Set
      ? options.only
      : new Set(options.only)
    : null;
  for (const spec of AGENT_TOOL_MANIFEST.filter((entry) => !only || only.has(entry.id))) {
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

WHAT YOU ARE HEARING
- The words you receive come from a microphone, so they are an imperfect signal, not the teacher's exact sentence. Work out what they meant, not what was typed.
- Ignore filler, stutters, false starts and stray fragments. "Um, I want, I want you to, you know, open the lesson note" means "open the lesson note".
- Use the current topic and the previous turns to fill in a garbled or unfinished word, and act on the intended instruction.
- The teacher is speaking English. A fragment that looks like another language is a mishearing: rebuild the English meaning and always reply in English. Never switch language because the microphone was unclear.
- Never invent a task. If the instruction is genuinely ambiguous, ask one short question in a single sentence.
- A short acknowledgement on its own ("mm-hm", "okay", "yeah") is not a question; carry on.
`;


function turnFrom(reply: string, steps: AgentStep[], usage?: TurnUsage): AgentTurn {
  const navigations = steps.filter((s) => s.ok && s.navigateTo);
  const last = navigations[navigations.length - 1];
  return {
    reply: reply.trim() || steps.filter((s) => s.ok).map((s) => s.summary).join(" ") || "Done.",
    steps,
    ...(last?.navigateTo ? { navigateTo: last.navigateTo } : {}),
    ...(usage ? { usage } : {}),
  };
}

/** The tokens the model actually reported, priced honestly. Never guessed. */
async function measured(result: { usage: PromiseLike<unknown> }): Promise<TurnUsage | undefined> {
  try {
    const raw = (await result.usage) as
      | { inputTokens?: number; outputTokens?: number }
      | undefined;
    const input = raw?.inputTokens;
    const output = raw?.outputTokens;
    if (typeof input !== "number" || typeof output !== "number") return undefined;
    return turnCost(AGENT_MODEL, input, output);
  } catch {
    return undefined;
  }
}

/**
 * Her briefing — who she is, what she can do and everything you have approved —
 * is identical for every turn of one call, so it is built once and reused for
 * the life of that call instead of being rebuilt and re-fetched each time.
 */
const briefings = new Map<string, { system: string; at: number }>();
const BRIEFING_LIFE_MS = 15 * 60 * 1000;

async function callBriefing(
  ctx: AgentToolContext,
  hint: AgentSnapshotHint | undefined,
  context: AuraPlatformContext | null | undefined,
): Promise<string> {
  const key = `${ctx.userId}|${context?.path ?? ""}`;
  const cached = briefings.get(key);
  const now = Date.now();
  if (cached && now - cached.at < BRIEFING_LIFE_MS) return cached.system;
  const learned = await learnedKnowledgePrompt(ctx).catch(() => null);
  const system = `${buildAgentSystemPrompt(hint, context, learned)}${CALL_INSTRUCTION}`;
  briefings.set(key, { system, at: now });
  return system;
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

  if (options.call) {
    const full = callNeedsFullAbilities(messages);
    const result = streamText({
      model: lovable.chat(AGENT_MODEL),
      system: await callBriefing(ctx, hint, context),
      messages,
      tools: buildTools(ctx, steps, full ? undefined : { only: CALL_TOOL_IDS }),
      stopWhen: stepCountIs(full ? 50 : 6),
      providerOptions: CALL_RESPONSES_OPTIONS as never,
    });
    return { result, steps };
  }

  const learned = await learnedKnowledgePrompt(ctx).catch(() => null);
  const result = streamText({
    model: lovable.chat(AGENT_MODEL),
    system: buildAgentSystemPrompt(hint, context, learned),
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
  const reply = await result.text;
  return turnFrom(reply, steps, await measured(result));
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
    finish: async () => {
      const reply = await result.text;
      return turnFrom(reply, steps, await measured(result));
    },
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
    model: lovable.chat(AGENT_MODEL),
    system: buildAgentSystemPrompt(),
    prompt: `${AGENT_GREETING_INSTRUCTION}\n\nSNAPSHOT:\n${JSON.stringify(snapshot.data)}`,
    providerOptions: RESPONSES_OPTIONS as never,
  });

  const greeting = (await result.text).trim();
  return { greeting: greeting || "Hello — tell me what you'd like to set up and I'll do it." };
}
