import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const ParaphraseInput = z.object({
  tone: z.string().max(120).default("clear and natural"),
  segments: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

const ParaphraseOutput = z.object({
  segments: z.array(z.object({ id: z.string(), text: z.string() })),
});

/**
 * Paraphrases APPROVED TRANSCRIPT TEXT ONLY. No audio and no video is sent.
 */
export const paraphraseSegments = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ParaphraseInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = [
      `Rewrite each lesson speech segment in a ${data.tone} style.`,
      "Rules: keep the meaning and every technical term exactly; keep roughly the same spoken length so it still fits the original timing window; return one rewritten segment per input id; never merge or drop segments; plain speech only, no markdown.",
      "",
      ...data.segments.map((s) => `[${s.id}] ${s.text}`),
    ].join("\n");

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        output: Output.object({ schema: ParaphraseOutput }),
        prompt,
      });
      const output = await result.output;
      const byId = new Map(output.segments.map((s) => [s.id, s.text]));
      return {
        segments: data.segments.map((s) => ({
          id: s.id,
          text: (byId.get(s.id) ?? s.text).trim(),
        })),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The AI returned an unusable paraphrase — try again.");
      }
      const message = error instanceof Error ? error.message : "Paraphrasing failed";
      if (message.includes("429")) throw new Error("Too many AI requests — wait a moment and retry.");
      if (message.includes("402")) throw new Error("Your AI credits are exhausted. Add credits to continue.");
      throw new Error(message);
    }
  });

const SingleParaphraseInput = z.object({
  tone: z.string().max(120).default("clear and natural"),
  text: z.string().min(1).max(4000),
});

/**
 * Paraphrases ONE transcript segment and returns plain text. No audio, no video.
 * Plain text avoids the strict-schema mode that the gateway does not enforce for
 * this model (which made the batch call fail with NoObjectGeneratedError).
 */
export const paraphraseSegment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SingleParaphraseInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      `You rewrite spoken lesson narration in a ${data.tone} style.`,
      "Rules: keep the meaning and every technical term exactly.",
      "Keep roughly the same spoken length as the original so it still fits its timing window.",
      "Never split, merge, summarise or add content.",
      "Reply with the rewritten sentence only — no quotes, no markdown, no commentary.",
    ].join(" ");

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        system,
        prompt: data.text,
      });
      const text = (await result.text).trim().replace(/^["“”']|["“”']$/g, "").trim();
      if (!text) throw new Error("The AI returned an empty paraphrase — try again.");
      return { text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Paraphrasing failed";
      if (message.includes("429")) throw new Error("Too many AI requests — wait a moment and retry.");
      if (message.includes("402")) throw new Error("Your AI credits are exhausted. Add credits to continue.");
      throw new Error(message);
    }
  });

const TranslateInput = z.object({
  language: z.string().min(2).max(60),
  segments: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

const SingleTranslateInput = z.object({
  language: z.string().min(2).max(60),
  text: z.string().min(1).max(4000),
});

/**
 * Translates ONE script segment and returns plain text. No audio, no video.
 * Plain text avoids the strict-schema mode that the gateway does not enforce
 * for this model (which made the batch call fail).
 */
export const translateSegment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SingleTranslateInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      `You translate spoken lesson narration into ${data.language}.`,
      "Keep mathematical and technical terminology accurate; keep numbers, formulas and symbols exactly.",
      "Keep roughly the same spoken length so it still fits its timing window.",
      "Never split, merge, summarise or add content.",
      "Reply with the translation only — no quotes, no markdown, no commentary.",
    ].join(" ");

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        system,
        prompt: data.text,
      });
      const text = (await result.text).trim().replace(/^["“”']|["“”']$/g, "").trim();
      if (!text) throw new Error("The AI returned an empty translation — try again.");
      return { text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Translation failed";
      if (message.includes("429")) throw new Error("Too many AI requests — wait a moment and retry.");
      if (message.includes("402")) throw new Error("Your AI credits are exhausted. Add credits to continue.");
      throw new Error(message);
    }
  });

const ShortenInput = z.object({
  text: z.string().min(1).max(4000),
  ratio: z.number().min(0.3).max(0.98),
  language: z.string().min(2).max(60).default("the same language"),
});

const DetectInput = z.object({ text: z.string().min(1).max(6000) });

/**
 * Detects the language the TRANSCRIPT TEXT is written in, so the project knows
 * what the lesson was actually spoken in. No audio and no video is sent.
 */
export const detectLanguage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DetectInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      "You identify the language of a piece of text.",
      "Reply with the English name of that language only — for example: English, French, Yoruba, Chinese (Mandarin).",
      "No punctuation, no explanation, no quotes.",
    ].join(" ");

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        system,
        prompt: data.text.slice(0, 4000),
      });
      const text = (await result.text).trim().replace(/[."'\n]/g, "").trim();
      if (!text || text.length > 40) throw new Error("Could not detect the language");
      return { language: text };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Language detection failed");
    }
  });

/** Rewrites ONE segment shorter so its speech fits the original timing window. */
export const shortenSegment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ShortenInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const percent = Math.round(data.ratio * 100);
    const system = [
      `You tighten spoken lesson narration written in ${data.language}.`,
      `Rewrite it to about ${percent}% of its current spoken length.`,
      "Keep the same language, the same meaning and every technical term, number and formula.",
      "Remove filler and redundancy only. Never add content.",
      "Reply with the shortened sentence only — no quotes, no markdown, no commentary.",
    ].join(" ");

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        system,
        prompt: data.text,
      });
      const text = (await result.text).trim().replace(/^["“”']|["“”']$/g, "").trim();
      if (!text) throw new Error("The AI returned an empty rewrite — try again.");
      return { text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rewrite failed";
      if (message.includes("429")) throw new Error("Too many AI requests — wait a moment and retry.");
      if (message.includes("402")) throw new Error("Your AI credits are exhausted. Add credits to continue.");
      throw new Error(message);
    }
  });

/**
 * Translates APPROVED SCRIPT TEXT ONLY, preserving segment boundaries so the
 * original timing windows still apply. No audio and no video is sent.
 */
export const translateSegments = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TranslateInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = [
      `Translate each lesson speech segment into ${data.language}.`,
      "Rules: keep mathematical and technical terminology accurate; keep numbers, formulas and symbols exactly; keep roughly the same spoken length so it still fits the original timing window; return one translation per input id; never merge or drop segments; plain speech only, no markdown.",
      "",
      ...data.segments.map((s) => `[${s.id}] ${s.text}`),
    ].join("\n");

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        output: Output.object({ schema: ParaphraseOutput }),
        prompt,
      });
      const output = await result.output;
      const byId = new Map(output.segments.map((s) => [s.id, s.text]));
      return {
        segments: data.segments.map((s) => ({
          id: s.id,
          text: (byId.get(s.id) ?? s.text).trim(),
        })),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The AI returned an unusable translation — try again.");
      }
      const message = error instanceof Error ? error.message : "Translation failed";
      if (message.includes("429")) throw new Error("Too many AI requests — wait a moment and retry.");
      if (message.includes("402")) throw new Error("Your AI credits are exhausted. Add credits to continue.");
      throw new Error(message);
    }
  });
