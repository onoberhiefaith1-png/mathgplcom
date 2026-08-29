import { chunkAudio } from "./audio";
import type { TranscriptSegment } from "./workflow";
import { alignUnits, splitIntoUnits } from "./segmentation";
import type { SpeechRun } from "./vad";

async function transcribeChunk(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", new File([blob], "audio.wav", { type: "audio/wav" }));
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Transcription failed (${response.status})`);
  return payload.text ?? "";
}

/**
 * Transcribes the EXTRACTED AUDIO only, chunk by chunk, reporting progress.
 * The chunk transcript is treated as a master script: punctuation decides the
 * unit boundaries, and the measured speech runs decide where each unit sits.
 */
export async function transcribeAudio(
  samples: Float32Array,
  onProgress: (message: string) => void,
  speechRuns: SpeechRun[] = [],
): Promise<TranscriptSegment[]> {
  const chunks = chunkAudio(samples);
  if (chunks.length === 0) throw new Error("There is no audio to transcribe");
  const segments: TranscriptSegment[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    onProgress(`Transcribing extracted audio — part ${i + 1} of ${chunks.length}…`);
    const text = await transcribeChunk(chunk.blob);
    const units = splitIntoUnits(text.trim());
    if (units.length === 0) continue;
    segments.push(...alignUnits(units, chunk.start, chunk.end, speechRuns));
  }
  if (segments.length === 0) throw new Error("No speech was detected in the extracted audio");
  return segments;
}
