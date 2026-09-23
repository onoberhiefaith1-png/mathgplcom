// Phase 4 — Aura's voice. Server-only: the speech request that turns her reply
// into natural spoken audio. The key never leaves the server.

const BASE_URL = "https://ai.gateway.lovable.dev";
export const SPEECH_MODEL = "google/gemini-3.1-flash-tts-preview";
const MODEL = SPEECH_MODEL;
const VOICE = "Kore";

export function speechBody(text: string) {
  return {
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `Say warmly, like a teacher: ${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
    stream_format: "sse",
  };
}

export async function requestSpeech(text: string, signal?: AbortSignal) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  return fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(speechBody(text)),
    ...(signal ? { signal } : {}),
  });
}
