// The fast brain: one tiny call that answers the instant the teacher stops.
//
// It does two jobs at once, which is why it is fast and nearly free: it rebuilds
// what the teacher meant from the imperfect microphone words, and it produces the
// one line Aura speaks immediately. When the request needs real work it says so,
// and the deep worker carries on in the background behind that same voice.

import { generateText } from "ai";

import { apiKey, FAST_MODEL, provider } from "./brain.server";
import { parseFastTurn, type FastTurn } from "./meaning";
import { turnCost, type TurnUsage } from "./spend";

const SYSTEM = `
You are the fast front of Aura, a teacher's assistant inside MathGPL. You are on a live voice call.

You receive the last words a microphone heard. They are an imperfect signal, never the teacher's exact sentence.

Do two things and nothing else:
1. MEANING — rewrite the teacher's turn as one clear English instruction or question. Drop filler, stutters, false starts and stray fragments. Use the previous turns to repair a garbled or unfinished word. A fragment that looks like another language is a mishearing: rebuild the English. If a later turn shows an earlier wording was wrong, use the intended meaning. Never invent a task that was not asked for.
2. REPLY — the single short sentence Aura says out loud right now, as a warm human colleague would, using MathGPL's own words. If the request can be answered completely in one spoken sentence, answer it. If it needs real work (creating, editing, solving, exploring, researching, multi-step jobs), say naturally that you are on it — do not promise a result you have not produced, and do not describe steps.

Then decide DEEP: true when real work or genuine thinking is required, false for a greeting, an acknowledgement or a small question you have just answered in full.

Answer with JSON only, no prose and no code fence:
{"meaning":"...","reply":"...","deep":true|false}
`.trim();

export type FastTurnResult = FastTurn & { usage?: TurnUsage };

/** The immediate line plus the reconstructed meaning. Never throws. */
export async function fastTurn(
  recent: { role: "user" | "assistant"; content: string }[],
  heard: string,
): Promise<FastTurnResult> {
  const conversation = recent
    .slice(-6)
    .map((message) => `${message.role === "user" ? "TEACHER" : "AURA"}: ${message.content}`)
    .join("\n");

  try {
    const lovable = provider(apiKey());
    const result = await generateText({
      model: lovable.chat(FAST_MODEL),
      system: SYSTEM,
      prompt: `RECENT CONVERSATION:\n${conversation || "(nothing yet)"}\n\nHEARD JUST NOW:\n${heard}`,
      maxOutputTokens: 220,
    });
    const parsed = parseFastTurn(result.text, heard);
    const input = result.usage?.inputTokens;
    const output = result.usage?.outputTokens;
    return typeof input === "number" && typeof output === "number"
      ? { ...parsed, usage: turnCost(FAST_MODEL, input, output) }
      : parsed;
  } catch {
    // The call must never die because the quick line failed: fall back to the
    // repaired transcript and let the deep worker answer on its own.
    return parseFastTurn("", heard);
  }
}
