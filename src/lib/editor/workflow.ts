import type { Clip } from "./types";
import { DEFAULT_STYLE_ID, DEFAULT_VOICE_ID } from "./voice-catalog";
import { DEFAULT_SOURCE_LANGUAGE } from "./languages";
import { DEFAULT_MIX, type MixSettings } from "./voice";
import type { SpeechRun } from "./vad";

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StageStatus =
  | "not-started"
  | "ready"
  | "processing"
  | "review"
  | "approved"
  | "stale";

export interface StageDef {
  id: StageId;
  key: string;
  name: string;
  summary: string;
  active: boolean;
  /** shown only while a language version is open */
  branch?: boolean;
  /** off by default — the user opts in from the transcript stage */
  optional?: boolean;
}

export const STAGES: StageDef[] = [
  { id: 1, key: "video", name: "Video", summary: "Upload, cut, trim, split and arrange the lesson footage.", active: true },
  { id: 2, key: "audio", name: "Audio", summary: "Extract the edited audio as its own asset — the AI never sees the video.", active: true },
  { id: 3, key: "transcript", name: "Transcript", summary: "Timestamped, segment-by-segment transcription of the extracted audio.", active: true },
  { id: 4, key: "paraphrase", name: "Paraphrase", summary: "Optional AI rewrite of the approved script, editable segment by segment.", active: true, optional: true },
  { id: 5, key: "language", name: "Language", summary: "Translate while preserving timing and terminology.", active: true, branch: true },
  { id: 6, key: "voice", name: "Voice", summary: "Original cloned voice or an AI voice for the new script.", active: true },
  { id: 7, key: "timing", name: "Timing", summary: "Fit every generated segment into its original window.", active: true },
  { id: 8, key: "subtitles", name: "Subtitles", summary: "Generate, restyle and re-time subtitles.", active: true },
  { id: 9, key: "preview", name: "Final Preview", summary: "Compare original audio against the generated version.", active: true },
  { id: 10, key: "publish", name: "Save / Publish", summary: "Attach the finished lesson video back to the course.", active: true },
];

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  /** where the teacher actually started speaking inside this container */
  speechStart?: number;
  speechEnd?: number;
  /** spoken seconds inside the container (silence excluded) — the voice budget */
  speechDuration?: number;
}

export interface ParaphraseSegment {
  id: string;
  text: string;
  /** transcript text this paraphrase was produced from */
  sourceText: string;
}

export interface VoiceMeta {
  /** script text this clip was generated from */
  sourceText: string;
  voice: string;
  duration: number;
  size: number;
  /** delivery style used for this clip */
  style?: string;
  /** original timing window this clip belongs to */
  start?: number;
  end?: number;
  /** fixed container length taken from the original clip */
  containerDuration?: number;
  /** original spoken duration this clip had to fit inside */
  budget?: number;
  /** generation attempts used before the clip was accepted */
  attempts?: number;
  fitStatus?: "synchronized" | "tight" | "over" | "manual";
}

export interface SegmentVoiceOverride {
  voice?: string;
  style?: string;
}

export interface SavedVersion {
  id: string;
  at: number;
  label: string;
  language: string;
  voiceLabel: string;
  style: string;
  note: string;
  duration: number;
  size: number;
}

export interface SubtitleSettings {
  maxCharsPerLine: number;
  maxLines: number;
  /** language the captions are shown in — defaults to the spoken script language */
  language?: string;
}

export const ORIGINAL_BRANCH = "original";

export interface LanguageVersion {
  id: string;
  language: string;
  /** voice + style chosen when the version was created */
  voice: string;
  style: string;
  createdAt: number;
}

/** Everything that belongs to one language version. Video/audio/transcript/paraphrase are shared. */
export interface BranchSnapshot {
  translation: ParaphraseSegment[];
  targetLanguage: string;
  voiceName: string;
  voiceInstructions: string;
  deliveryStyle: string;
  voiceOverrides: Record<string, SegmentVoiceOverride>;
  voice: Record<string, VoiceMeta>;
  timing: Record<string, number>;
  offsets: Record<string, number>;
  mix: MixSettings;
  subtitles: SubtitleSettings;
  subtitleTexts: Record<string, Record<string, string>>;
  generatedTrack?: { duration: number; size: number } | undefined;
  stages: Record<StageId, StageMeta>;
}

/** The rendered final video: source picture + one continuous generated track. */
export interface GeneratedVideoMeta {
  duration: number;
  size: number;
  type: string;
  extension: string;
  language: string;
  voiceLabel: string;
  mode: "copy" | "encode" | "capture";
  at: number;
  /** captions burned into the picture */
  burnedSubtitles?: boolean;
  subtitleLanguage?: string;
  /** warnings the user accepted with "Proceed anyway" when this file was produced */
  overrides?: string[];
}


export interface StageMeta {
  status: StageStatus;
  approvedAt?: number;
  /** fingerprint of the inputs this stage was produced from */
  inputHash?: string;
}

export interface WorkflowState {
  current: StageId;
  stages: Record<StageId, StageMeta>;
  audio?: { duration: number; size: number; inputHash: string } | undefined;
  /** speech / silence map of the extracted original audio */
  speechMap: SpeechRun[];
  transcript: TranscriptSegment[];
  paraphrase: ParaphraseSegment[];
  /** the paraphrase stage is opt-in — the normal flow goes transcript → voice */
  paraphraseEnabled: boolean;
  paraphraseTone: string;
  translation: ParaphraseSegment[];
  targetLanguage: string;
  /** language the uploaded lesson is spoken in — the reference script */
  sourceLanguage: string;
  voiceName: string;
  voiceInstructions: string;
  deliveryStyle: string;
  /** per-segment voice / style overrides */
  voiceOverrides: Record<string, SegmentVoiceOverride>;
  voice: Record<string, VoiceMeta>;
  /** per-segment playback speed chosen in the timing stage */
  timing: Record<string, number>;
  /** per-segment start nudge in seconds */
  offsets: Record<string, number>;
  mix: MixSettings;
  subtitles: SubtitleSettings;
  /** cached caption text per subtitle language: language → segment id → text */
  subtitleTexts: Record<string, Record<string, string>>;
  generatedTrack?: { duration: number; size: number } | undefined;
  generatedVideo?: GeneratedVideoMeta | undefined;
  versions: SavedVersion[];
  published?: { at: number; note: string } | undefined;
  /** extra language versions of this same video (the original is implicit) */
  branches: LanguageVersion[];
  activeBranch: string;
  /** stored state of the branches that are not currently open */
  snapshots: Record<string, BranchSnapshot>;
  /**
   * Warnings the user accepted with "Proceed anyway": "stage:code" → the
   * content fingerprint that was accepted. Changing the content behind a
   * warning changes the fingerprint, which brings the warning back.
   */
  overrides: Record<string, string>;

}

export function createWorkflow(): WorkflowState {
  const stages = {} as Record<StageId, StageMeta>;
  for (const s of STAGES) {
    stages[s.id] = { status: s.id === 1 ? "ready" : "not-started" };
  }
  return {
    current: 1,
    stages,
    speechMap: [],
    transcript: [],
    paraphrase: [],
    paraphraseEnabled: false,
    paraphraseTone: "clear and natural",
    translation: [],
    targetLanguage: "English",
    sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
    voiceName: DEFAULT_VOICE_ID,
    voiceInstructions: "",
    deliveryStyle: DEFAULT_STYLE_ID,
    voiceOverrides: {},
    voice: {},
    timing: {},
    offsets: {},
    mix: { ...DEFAULT_MIX },
    subtitles: { maxCharsPerLine: 42, maxLines: 2 },
    subtitleTexts: {},
    versions: [],
    branches: [],
    activeBranch: ORIGINAL_BRANCH,
    snapshots: {},
    overrides: {},

  };
}

/**
 * Stages visible right now: the Language stage only exists inside a language
 * version, and Paraphrase only when the user switched it on.
 */
export function visibleStages(state: WorkflowState): StageDef[] {
  const inBranch = state.activeBranch !== ORIGINAL_BRANCH;
  return STAGES.filter(
    (s) => (!s.branch || inBranch) && (!s.optional || state.paraphraseEnabled),
  );
}

export function nextStage(state: WorkflowState, id: StageId): StageDef | undefined {
  const list = visibleStages(state);
  const index = list.findIndex((s) => s.id === id);
  return index >= 0 ? list[index + 1] : undefined;
}

export function previousStage(state: WorkflowState, id: StageId): StageDef | undefined {
  const list = visibleStages(state);
  const index = list.findIndex((s) => s.id === id);
  return index > 0 ? list[index - 1] : undefined;
}

export function takeSnapshot(state: WorkflowState): BranchSnapshot {
  return {
    translation: state.translation,
    targetLanguage: state.targetLanguage,
    voiceName: state.voiceName,
    voiceInstructions: state.voiceInstructions,
    deliveryStyle: state.deliveryStyle,
    voiceOverrides: state.voiceOverrides,
    voice: state.voice,
    timing: state.timing,
    offsets: state.offsets,
    mix: state.mix,
    subtitles: state.subtitles,
    subtitleTexts: state.subtitleTexts,
    generatedTrack: state.generatedTrack,
    stages: state.stages,
  };
}

export function emptySnapshot(
  language: string,
  voice: string,
  style: string,
  shared: Record<StageId, StageMeta>,
): BranchSnapshot {
  const stages = {} as Record<StageId, StageMeta>;
  for (const s of STAGES) {
    stages[s.id] = s.id <= 4 ? { ...shared[s.id] } : { status: s.id === 5 ? "ready" : "not-started" };
  }
  return {
    translation: [],
    targetLanguage: language,
    voiceName: voice,
    voiceInstructions: "",
    deliveryStyle: style,
    voiceOverrides: {},
    voice: {},
    timing: {},
    offsets: {},
    mix: { ...DEFAULT_MIX },
    subtitles: { maxCharsPerLine: 42, maxLines: 2 },
    subtitleTexts: {},
    stages,
  };
}

export function clipsHash(clips: Clip[]): string {
  return clips.map((c) => `${c.sourceStart.toFixed(3)}-${c.sourceEnd.toFixed(3)}`).join("|");
}

export function transcriptHash(segments: TranscriptSegment[]): string {
  return segments.map((s) => `${s.id}:${s.text.trim()}`).join("|");
}

/**
 * The script the downstream stages speak.
 *
 * Language is a CHANGE, not an addition: once a target language other than the
 * source is chosen, every segment must come from the translation. A segment
 * without a translation yet returns empty text instead of falling back to the
 * source language, so the lesson can never mix two languages.
 */
export function finalScript(state: WorkflowState): { id: string; text: string }[] {
  const translating = isTranslating(state);
  const translation = new Map(state.translation.map((t) => [t.id, t.text]));
  const paraphrase = new Map(state.paraphrase.map((p) => [p.id, p.text]));
  return state.transcript.map((t) => ({
    id: t.id,
    text: translating
      ? (translation.get(t.id) ?? "").trim()
      : (paraphrase.get(t.id) ?? t.text).trim(),
  }));
}

/** True when the output language differs from the language actually spoken. */
export function isTranslating(state: WorkflowState): boolean {
  return state.targetLanguage.trim().toLowerCase() !== state.sourceLanguage.trim().toLowerCase();
}

/** The language the final script (and therefore the generated speech) is in. */
export function scriptLanguage(state: WorkflowState): string {
  return isTranslating(state) ? state.targetLanguage : state.sourceLanguage;
}

/** The language captions are shown in — the script language until changed. */
export function subtitleLanguageOf(state: WorkflowState): string {
  return (state.subtitles.language ?? "").trim() || scriptLanguage(state);
}

/**
 * The voice + style a segment MUST use: the teacher's default for the whole
 * lesson, unless that one segment was explicitly overridden.
 */
export function resolveSegmentVoice(
  state: WorkflowState,
  id: string,
): { voice: string; style: string } {
  const override = state.voiceOverrides[id];
  return {
    voice: override?.voice ?? state.voiceName,
    style: override?.style ?? state.deliveryStyle,
  };
}

/** Segments that still have no usable translation into the target language. */
export function untranslatedIds(state: WorkflowState): string[] {
  if (!isTranslating(state)) return [];
  const byId = new Map(state.translation.map((t) => [t.id, t]));
  const source = new Map(
    state.transcript.map((t) => [
      t.id,
      (state.paraphrase.find((p) => p.id === t.id)?.text ?? t.text).trim(),
    ]),
  );
  return state.transcript
    .filter((t) => {
      const done = byId.get(t.id);
      if (!done || !done.text.trim()) return Boolean(source.get(t.id));
      return done.sourceText.trim() !== (source.get(t.id) ?? "");
    })
    .map((t) => t.id);
}

export { VOICE_CATALOG as VOICES } from "./voice-catalog";

export const STATUS_LABEL: Record<StageStatus, string> = {
  "not-started": "Not started",
  ready: "Ready",
  processing: "Processing",
  review: "Needs review",
  approved: "Approved",
  stale: "Needs update",
};

export function statusTone(status: StageStatus): string {
  switch (status) {
    case "approved":
      return "bg-primary/15 text-primary";
    case "review":
      return "bg-amber-500/15 text-amber-400";
    case "stale":
      return "bg-destructive/15 text-destructive";
    case "processing":
      return "bg-secondary text-secondary-foreground";
    case "ready":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
