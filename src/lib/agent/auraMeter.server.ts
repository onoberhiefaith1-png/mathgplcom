// Aura's own usage, written into the same ledger as everything else.
//
// Her replies were previously measured only for the figure on screen; nothing
// reached the account's records, so the dashboard reported zero for work that
// really happened. Every brain turn and every second of her voice now lands
// here, and a failure to record can never disturb a reply.

import { recordUsage } from "@/lib/costs/meter.server";
import { METRICS } from "@/lib/costs/categories";

/** Tokens a model reported for one turn, recorded per million as the book expects. */
export async function meterTurn(
  userId: string | null | undefined,
  model: string,
  input: number,
  output: number,
  feature: string,
): Promise<void> {
  if (!userId) return;
  await Promise.all([
    recordUsage({
      userId,
      metric: METRICS.aiInputTokens,
      quantity: Math.max(0, input) / 1_000_000,
      unit: "million tokens",
      model,
      feature,
    }),
    recordUsage({
      userId,
      metric: METRICS.aiOutputTokens,
      quantity: Math.max(0, output) / 1_000_000,
      unit: "million tokens",
      model,
      feature,
    }),
  ]);
}

/** Seconds of speech she actually produced, recorded in audio minutes. */
export async function meterSpeech(
  userId: string | null | undefined,
  model: string,
  seconds: number,
  feature = "aura.speech",
): Promise<void> {
  if (!userId || !Number.isFinite(seconds) || seconds <= 0) return;
  await recordUsage({
    userId,
    metric: METRICS.aiAudioMinutes,
    quantity: seconds / 60,
    unit: "audio minutes",
    model,
    feature,
  });
}
