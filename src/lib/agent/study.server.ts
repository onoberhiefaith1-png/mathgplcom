// Autonomous System Exploration.
//
// The administrator names a mission — a purpose, not a checklist — and Aura
// explores the platform herself to serve it: she reads her own record of what
// she knows and does not know, picks the next thing that most reduces her
// unknowns, operates the real pages through her tools, writes down what she
// learns, and asks questions without ever waiting on an answer.
//
// Server-only. One call is one bounded stretch of work, so the panel can show
// her thinking and her actions as they happen instead of after the fact.

import { streamText, stepCountIs, tool, jsonSchema, type ModelMessage } from "ai";

import {
  AGENT_MODEL,
  RESPONSES_OPTIONS,
  apiKey,
  buildTools,
  provider,
  type AgentStep,
} from "./brain.server";
import type { AgentToolContext } from "./tools.server";
import { MODEL_LESSON_NOTE } from "./knowledge/editor";
import { knowledgeIndexPrompt } from "./knowledge";
import { learnedKnowledgePrompt } from "./hands.server";
import {
  PRACTICE_PREFIX,
  STUDY_TOOL_IDS,
  isPracticeTitle,
  isStudyWrite,
  practiceTitle,
} from "./studyPolicy";
import {
  applyLedgerPatch,
  askQuestion,
  emptyLedger,
  openQuestions,
  renderLedger,
  type MissionLedger,
} from "./missionLedger";

type AnyDb = { from: (table: string) => any };

export type StudyStep = {
  /** The mission: the purpose the exploration serves. */
  subject: string;
  transcript: { role: "user" | "assistant"; content: string }[];
  ledger?: MissionLedger | null;
  missionId?: string | null;
};

export type StudyResult = { say: string; steps: AgentStep[]; done: boolean; ledger: MissionLedger };

const OUTSIDE = (what: string) =>
  `Refused: ${what} A study run may only change a notebook whose title starts with "${PRACTICE_PREFIX}". Make one with create_lesson_note first, then work inside it.`;

/** Is this notebook one of her practice notebooks? */
async function practiceNotebook(ctx: AgentToolContext, notebookId: string): Promise<boolean> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data } = await db.from("notebooks").select("title").eq("id", notebookId).maybeSingle();
  return isPracticeTitle(data?.title ?? null);
}

/** Walk a session id back to the notebook it belongs to. */
async function notebookOfSubsection(ctx: AgentToolContext, subsectionId: string): Promise<string | null> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data: sub } = await db
    .from("notebook_subsections")
    .select("section_id")
    .eq("id", subsectionId)
    .maybeSingle();
  if (!sub?.section_id) return null;
  const { data: section } = await db
    .from("notebook_sections")
    .select("notebook_id")
    .eq("id", sub.section_id)
    .maybeSingle();
  return (section?.notebook_id as string | undefined) ?? null;
}

/** Walk a section id back to its notebook. */
async function notebookOfSection(ctx: AgentToolContext, sectionId: string): Promise<string | null> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data } = await db
    .from("notebook_sections")
    .select("notebook_id")
    .eq("id", sectionId)
    .maybeSingle();
  return (data?.notebook_id as string | undefined) ?? null;
}

/**
 * The fence. Reading anywhere is fine — her own real notes teach her most. Any
 * change has to land inside a practice notebook, and a new notebook has to be
 * marked as practice.
 */
async function studyGate(
  ctx: AgentToolContext,
  toolId: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  if (toolId === "create_lesson_note") {
    const title = typeof args["title"] === "string" ? args["title"] : "";
    if (!isPracticeTitle(title)) {
      return `Refused: a study notebook must be titled "${PRACTICE_PREFIX} ..." — for example "${practiceTitle(
        "quadratic equations",
      )}". Call this again with that title.`;
    }
    return null;
  }

  if (!isStudyWrite(toolId)) return null;

  const notebookId = typeof args["notebookId"] === "string" ? args["notebookId"] : null;
  const subsectionId = typeof args["subsectionId"] === "string" ? args["subsectionId"] : null;
  const sectionId = typeof args["sectionId"] === "string" ? args["sectionId"] : null;

  const target =
    notebookId ??
    (subsectionId ? await notebookOfSubsection(ctx, subsectionId) : null) ??
    (sectionId ? await notebookOfSection(ctx, sectionId) : null);

  if (!target) return OUTSIDE("I could not tell which notebook that change belongs to.");
  if (!(await practiceNotebook(ctx, target))) return OUTSIDE("that notebook is a real lesson note.");
  return null;
}

const strings = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];

/**
 * The three tools that belong to an exploration run: her own record, and the
 * question channel that never blocks her.
 */
function missionTools(state: { ledger: MissionLedger }, steps: AgentStep[]) {
  const record = tool({
    description:
      "Write down what you just learned about this platform: what you now know, what you still do not know, what you tried, what failed, and how sure you are about one area. Call this after every real observation so your record survives into your next stretch of work.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        known: { type: ["array", "null"], items: { type: "string" }, description: "Things you confirmed yourself with a tool." },
        unknown: { type: ["array", "null"], items: { type: "string" }, description: "Things you still do not know." },
        tested: { type: ["array", "null"], items: { type: "string" }, description: "What you actually tried." },
        failed: { type: ["array", "null"], items: { type: "string" }, description: "What did not work, in its own words." },
        resolved: { type: ["array", "null"], items: { type: "string" }, description: "Unknowns you have now settled." },
        area: { type: ["string", "null"], description: "One area of the platform, in the app's real words." },
        state: { type: ["string", "null"], description: "confirmed, uncertain or untouched." },
      },
      required: ["known", "unknown", "tested", "failed", "resolved", "area", "state"],
      additionalProperties: false,
    } as never),
    execute: async (raw: unknown) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      state.ledger = applyLedgerPatch(state.ledger, {
        known: strings(args["known"]),
        unknown: strings(args["unknown"]),
        tested: strings(args["tested"]),
        failed: strings(args["failed"]),
        resolved: strings(args["resolved"]),
        area: typeof args["area"] === "string" ? args["area"] : undefined,
        state: typeof args["state"] === "string" ? args["state"] : undefined,
      });
      const summary =
        typeof args["area"] === "string" && args["area"].trim()
          ? `Recorded what I learned about ${args["area"]}.`
          : "Recorded what I learned.";
      steps.push({ toolId: "record_understanding", ok: true, summary });
      return { ok: true, open: state.ledger.unknown.length };
    },
  });

  const ask = tool({
    description:
      "Ask the supervisor one question you genuinely cannot settle yourself. This never waits: the question is logged and you carry straight on with another path. Come back to it later — if it is still unanswered, say so rather than guessing.",
    inputSchema: jsonSchema({
      type: "object",
      properties: { question: { type: "string", description: "One clear question, in plain words." } },
      required: ["question"],
      additionalProperties: false,
    } as never),
    execute: async (raw: unknown) => {
      const text = typeof (raw as Record<string, unknown>)?.["question"] === "string"
        ? String((raw as Record<string, unknown>)["question"])
        : "";
      if (!text.trim()) return { ok: false, error: "Write the question out." };
      const asked = askQuestion(state.ledger, text);
      state.ledger = asked.ledger;
      steps.push({ toolId: "ask_supervisor", ok: true, summary: `Asked: ${text.trim()}` });
      return {
        ok: true,
        questionId: asked.id,
        note: "Logged. Nobody is waiting — continue with another path and come back to this later.",
      };
    },
  });

  const resolve = tool({
    description:
      "Close one of your own questions because you have now settled it yourself or been told the answer.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        questionId: { type: "string", description: "The question id from ask_supervisor." },
        answer: { type: "string", description: "The settled answer." },
      },
      required: ["questionId", "answer"],
      additionalProperties: false,
    } as never),
    execute: async (raw: unknown) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const id = typeof args["questionId"] === "string" ? args["questionId"] : "";
      const answer = typeof args["answer"] === "string" ? args["answer"] : "";
      const found = state.ledger.questions.find((q) => q.id === id);
      if (!found) return { ok: false, error: "No question with that id." };
      state.ledger = {
        ...state.ledger,
        questions: state.ledger.questions.map((q) =>
          q.id === id ? { ...q, status: "answered" as const, answer } : q,
        ),
      };
      steps.push({ toolId: "resolve_question", ok: true, summary: `Settled: ${found.text}` });
      return { ok: true };
    },
  });

  return { record_understanding: record, ask_supervisor: ask, resolve_question: resolve };
}

const STUDY_RULES = `YOU ARE EXPLORING THIS PLATFORM ON YOUR OWN
The administrator has given you a mission — a purpose, not a list of steps — and
stepped back. Nobody is waiting on you: go in and work.

HOW YOU CHOOSE WHAT TO DO NEXT
- Read your own record first. Pick the single next action that most reduces what
  you do not know about THIS mission. The path is yours: one finding leads to the
  next question.
- Skip anything the mission does not need. Curiosity that serves the mission is
  good; wandering is not.
- Look at the real thing with your reading tools before you judge it. Read one of
  the teacher's own lesson notes to see how a good one is built. Never change a
  real note.
- Then do the work yourself inside a practice notebook of your own, titled
  "${PRACTICE_PREFIX} ..." — pick a topic, write it properly, highlight the
  solution, generate the Floating Numbers, open the board and look at what is
  actually there.
- Say what you are doing and what you see as you go, in short plain sentences, one
  idea at a time. Say when something is not what you expected, and what you tried
  next.

YOUR RECORD AND YOUR QUESTIONS
- Call record_understanding after every real observation: what you now know, what
  is still unknown, what you tested, what failed, and how sure you are about the
  area you just touched. Your record is the only thing that survives this stretch.
- When something genuinely cannot be settled from the interface or your tools, call
  ask_supervisor and carry straight on. Never freeze waiting for an answer. If an
  answer arrives, it appears at the top of your next stretch — fold it in at once
  and change direction if it contradicts you.
- Come back to unanswered questions later. If one is still unanswered at the end,
  report it as unresolved.
- Write each settled finding down with propose_knowledge too: status "observed" for
  what you saw with your own tools, "proposed" for what you were told or inferred.
  A finding is a proposal until the administrator approves it.
- Never record a fault as the correct way to work. Log a fault as a fault and
  carry on.

WORKING RULES THAT DO NOT BEND
- Before you generate Floating Numbers, settle the one real choice out loud: chips
  in solution order, or shuffled so students rebuild the line. Say which you chose
  and why. Never generate without saying it.
- Opening the board is not verifying it. After smartboard_test, call
  inspect_board_state and report only what that reading actually shows. If you did
  not read it back, say the board is untested.
- Session headings are Example, Exercise, Classwork, Homework and Assessment. Never
  head a session "Assignment".

THE FENCE — THESE ARE NOT MISTAKES, THEY ARE RULES
- You cannot assign, publish, share, delete or archive anything during an
  exploration, and nothing you make can reach a student. If you try, it is refused.
- Real lesson notes are read-only to you here. All your writing goes into your own
  practice notebooks.
- Your tools act through the platform's own pages and actions. If you cannot reach
  something that way, say it is out of reach — never claim you saw it.
- Report only what a tool actually returned. If it failed, say it failed.

ENDING A STRETCH
Stop when you have something worth reporting, and end your message with the next
thing you intend to try. Write "MISSION COMPLETE" on its own line only when the
mission is genuinely served and your findings are logged.`;

/** One bounded stretch of self-directed exploration. */
export async function runStudyStep(ctx: AgentToolContext, input: StudyStep): Promise<StudyResult> {
  const steps: AgentStep[] = [];
  const lovable = provider(apiKey());
  const learned = await learnedKnowledgePrompt(ctx).catch(() => null);
  const state = { ledger: input.ledger ?? emptyLedger() };

  const answered = state.ledger.questions.filter((q) => q.status === "answered" && q.answer);
  const still = openQuestions(state.ledger);

  const opening = [
    `MISSION: ${input.subject}`,
    answered.length
      ? `ANSWERS FROM THE SUPERVISOR — fold these in now:\n${answered
          .map((q) => `- ${q.text} → ${q.answer}`)
          .join("\n")}`
      : "",
    still.length
      ? `STILL UNANSWERED — do not wait on these:\n${still.map((q) => `- ${q.text}`).join("\n")}`
      : "",
    renderLedger(state.ledger),
    "Continue the exploration now, on your own.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: ModelMessage[] = input.transcript.length
    ? [
        ...input.transcript.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
        { role: "user", content: opening } as ModelMessage,
      ]
    : [{ role: "user", content: opening } as ModelMessage];

  const result = streamText({
    model: lovable.chat(AGENT_MODEL),
    system: [
      STUDY_RULES,
      MODEL_LESSON_NOTE,
      `WHAT EXISTS IN MATHGPL\n${knowledgeIndexPrompt()}`,
      learned ?? "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    messages,
    tools: buildTools(ctx, steps, {
      only: STUDY_TOOL_IDS,
      gate: (toolId, args) => studyGate(ctx, toolId, args),
      extra: missionTools(state, steps),
    }),
    stopWhen: stepCountIs(16),
    providerOptions: RESPONSES_OPTIONS as never,
  });

  const say = (await result.text).trim();

  // Best effort: keep the mission and its record on the server too. The table
  // arrives with the staged database change, so this stays quiet until then.
  if (input.missionId) {
    try {
      const db = ctx.supabase as unknown as AnyDb;
      await db
        .from("aura_missions")
        .upsert({
          id: input.missionId,
          user_id: ctx.userId,
          mission: input.subject,
          status: /MISSION COMPLETE/i.test(say) ? "done" : "running",
          ledger: state.ledger as never,
          updated_at: new Date().toISOString(),
        } as never);
    } catch {
      // No mission storage yet — the panel keeps the record in the meantime.
    }
  }

  return {
    say: say || steps.filter((s) => s.ok).map((s) => s.summary).join(" ") || "Nothing to report yet.",
    steps,
    done: /MISSION COMPLETE|STUDY COMPLETE/i.test(say),
    ledger: state.ledger,
  };
}
