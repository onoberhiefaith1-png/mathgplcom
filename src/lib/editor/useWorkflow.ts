import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { extractEditedAudio, TARGET_RATE } from "./audio";
import {
  detectLanguage,
  paraphraseSegment,
  shortenSegment,
  translateSegment,
} from "./ai.functions";
import {
  applySpeed,
  buildGeneratedTrack,
  decodeToMono,
  speakSegment,
  type MixSettings,
} from "./voice";
import { composeInstruction, defaultVoiceFor, findVoice, voiceLabel } from "./voice-catalog";
import { renderFinalVideo } from "./render-video";
import { buildCues, toSrt, toVtt, type Cue } from "./subtitles";
import { transcribeAudio } from "./transcribe";
import { detectSpeech, speechDurationIn } from "./vad";
import type { Clip } from "./types";
import {
  STAGES,
  finalScript,
  isTranslating,
  scriptLanguage,
  subtitleLanguageOf,
  resolveSegmentVoice,
  untranslatedIds as computeUntranslatedIds,
  clipsHash,
  createWorkflow,
  ORIGINAL_BRANCH,
  emptySnapshot,
  takeSnapshot,
  nextStage,
  type BranchSnapshot,
  type LanguageVersion,
  type StageMeta,
  type ParaphraseSegment,
  type SubtitleSettings,
  type StageId,
  type StageStatus,
  type TranscriptSegment,
  type WorkflowState,
  type SavedVersion,
  type GeneratedVideoMeta,
} from "./workflow";
import { blockerKey, computeBlockers, type StageBlocker } from "./blockers";

export type { StageBlocker };


export interface GeneratedVideoAsset {
  blob: Blob;
  url: string;
  meta: GeneratedVideoMeta;
}

export interface AudioAsset {
  blob: Blob;
  url: string;
  duration: number;
  peaks: number[];
  samples: Float32Array | null;
}

export interface SegmentStatus {
  state: "idle" | "generating" | "done" | "error";
  error?: string;
}

export interface WorkflowApi {
  state: WorkflowState;
  audio: AudioAsset | null;
  busy: StageId | null;
  progress: string;
  statusOf: (id: StageId) => StageStatus;
  staleParaphraseIds: string[];
  audioStale: boolean;
  transcriptStale: boolean;
  goTo: (id: StageId) => void;
  approve: (id: StageId) => void;
  extractAudio: () => Promise<void>;
  runTranscript: () => Promise<void>;
  editTranscript: (id: string, text: string) => void;
  runParaphrase: (ids?: string[]) => Promise<void>;
  editParaphrase: (id: string, text: string) => void;
  paraphraseStatus: Record<string, SegmentStatus>;
  setTone: (tone: string) => void;
  /** the paraphrase stage is opt-in */
  setParaphraseEnabled: (enabled: boolean) => void;
  keepDownstream: () => void;
  restore: (
    state: WorkflowState,
    audioBlob: Blob | null,
    voiceClips?: Record<string, Blob>,
    trackBlob?: Blob | null,
    versionTracks?: Record<string, Blob>,
    branchClips?: Record<string, Record<string, Blob>>,
    branchTracks?: Record<string, Blob>,
    videoBlob?: Blob | null,
  ) => void;

  /* language branch */
  branches: LanguageVersion[];
  activeBranch: string;
  addLanguageVersion: (input: { language: string; voice: string; style: string }) => void;
  switchBranch: (id: string) => void;
  deleteBranch: (id: string) => void;
  branchClips: Record<string, Record<string, Blob>>;
  branchTracks: Record<string, Blob>;

  /* stage 5 */
  script: { id: string; text: string }[];
  translationStaleIds: string[];
  translationStatus: Record<string, SegmentStatus>;
  setTargetLanguage: (language: string) => void;
  setSourceLanguage: (language: string) => void;
  /** true when the output language differs from the spoken source language */
  translating: boolean;
  /** segments still waiting for their translation into the target language */
  untranslatedIds: string[];
  runTranslation: (ids?: string[]) => Promise<Map<string, string>>;
  editTranslation: (id: string, text: string) => void;

  /* stage 6 */
  voiceClips: Record<string, Blob>;
  voiceUrls: Record<string, string>;
  voiceStaleIds: string[];
  /** segments that still need voice: missing, changed or not yet accepted */
  pendingVoiceIds: string[];
  voiceStatus: Record<string, SegmentStatus>;
  setVoiceName: (voice: string) => void;
  setVoiceInstructions: (instructions: string) => void;
  setDeliveryStyle: (style: string) => void;
  setSegmentVoice: (id: string, voice: string | null) => void;
  setSegmentStyle: (id: string, style: string | null) => void;
  clearVoiceOverrides: () => void;
  runVoice: (ids?: string[]) => Promise<void>;
  /** segments whose existing clip does not use the resolved default voice */
  voiceMismatchIds: string[];
  /** segments with script text but no generated clip yet */
  missingVoiceIds: string[];
  /** puts every segment back on the default voice and regenerates the odd ones */
  enforceDefaultVoice: () => Promise<void>;

  /* stage 7 */
  fits: TimingFit[];
  setSpeed: (id: string, speed: number) => void;
  setOffset: (id: string, offset: number) => void;
  autoFit: () => void;
  regenerateShorter: (id: string) => Promise<void>;
  setScriptText: (id: string, text: string) => void;

  /* stage 8 */
  cues: Cue[];
  setSubtitles: (settings: Partial<SubtitleSettings>) => void;
  exportSubtitles: (format: "srt" | "vtt") => void;
  /** language the captions are shown in */
  subtitleLanguage: string;
  setSubtitleLanguage: (language: string) => void;
  /** segments still missing a caption in the chosen subtitle language */
  subtitlePendingIds: string[];
  runSubtitleTranslation: (ids?: string[]) => Promise<void>;

  /* stage 9 + 10 */
  generatedTrack: AudioAsset | null;
  generatedVideo: GeneratedVideoAsset | null;
  renderVideo: (options?: { subtitles?: boolean }) => Promise<GeneratedVideoAsset | null>;
  downloadVideo: () => void;
  /** renders (if needed) and downloads the final video, with or without captions */
  downloadFinalVideo: (options: { subtitles: boolean }) => Promise<void>;
  setMix: (mix: Partial<MixSettings>) => void;
  buildTrack: () => Promise<void>;
  exportAudio: () => void;
  versions: SavedVersion[];
  saveVersion: (note: string) => void;
  deleteVersion: (id: string) => void;
  versionTracks: Record<string, Blob>;
  downloadVersion: (id: string) => void;
  publish: (note: string) => void;

  /* stated errors + "Proceed anyway" */
  /** every stated problem right now, including ones already accepted */
  blockers: StageBlocker[];
  /** unresolved problems for one stage — what the stage panel states */
  blockersFor: (stage: StageId) => StageBlocker[];
  /** true when this exact problem was accepted with "Proceed anyway" */
  isOverridden: (stage: StageId, code: string) => boolean;
  /** accept every non-fatal problem on this stage and carry on */
  proceedAnyway: (stage: StageId) => void;

}

export interface TimingFit {
  id: string;
  text: string;
  start: number;
  end: number;
  window: number;
  rawDuration: number;
  speed: number;
  fitted: number;
  overflow: number;
  offset: number;
  /** original spoken seconds inside the container — the speech budget */
  budget: number;
  /** silence that pads the container after the generated speech */
  silence: number;
  status: "none" | "synchronized" | "tight" | "over" | "manual";
}

interface Options {
  file: File | null;
  clips: Clip[];
  onDirty: () => void;
}

export function useWorkflow({ file, clips, onDirty }: Options): WorkflowApi {
  const [state, setState] = useState<WorkflowState>(createWorkflow);
  const [audio, setAudio] = useState<AudioAsset | null>(null);
  const [voiceClips, setVoiceClips] = useState<Record<string, Blob>>({});
  const [voiceUrls, setVoiceUrls] = useState<Record<string, string>>({});
  const [generatedTrack, setGeneratedTrack] = useState<AudioAsset | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideoAsset | null>(null);
  const [busy, setBusy] = useState<StageId | null>(null);
  const [paraphraseStatus, setParaphraseStatus] = useState<Record<string, SegmentStatus>>({});
  const [translationStatus, setTranslationStatus] = useState<Record<string, SegmentStatus>>({});
  const [voiceStatus, setVoiceStatus] = useState<Record<string, SegmentStatus>>({});
  const [versionTracks, setVersionTracks] = useState<Record<string, Blob>>({});
  const [branchClips, setBranchClips] = useState<Record<string, Record<string, Blob>>>({});
  const [branchTracks, setBranchTracks] = useState<Record<string, Blob>>({});
  const [progress, setProgress] = useState("");
  const acknowledged = useRef<string | null>(null);

  const liveRef = useRef({
    branch: ORIGINAL_BRANCH,
    clips: {} as Record<string, Blob>,
    track: null as AudioAsset | null,
  });
  liveRef.current = { branch: state.activeBranch, clips: voiceClips, track: generatedTrack };

  const hash = clipsHash(clips);
  const audioStale = Boolean(
    state.audio && state.audio.inputHash !== hash && acknowledged.current !== hash,
  );
  const transcriptStale = Boolean(
    state.transcript.length > 0 &&
    state.audio &&
    state.stages[3].inputHash !== undefined &&
    state.stages[3].inputHash !== state.audio.inputHash &&
    acknowledged.current !== hash,
  );

  const staleParaphraseIds = useMemo(() => {
    const byId = new Map(state.paraphrase.map((p) => [p.id, p]));
    return state.transcript
      .filter((t) => {
        const p = byId.get(t.id);
        return !p || p.sourceText.trim() !== t.text.trim();
      })
      .map((t) => t.id);
  }, [state.paraphrase, state.transcript]);

  const goTo = useCallback((id: StageId) => setState((s) => ({ ...s, current: id })), []);

  const approve = useCallback(
    (id: StageId) => {
      setState((s) => {
        const next = nextStage(s, id);
        const stages = {
          ...s.stages,
          [id]: { ...s.stages[id], status: "approved" as StageStatus, approvedAt: Date.now() },
        };
        if (next && stages[next.id as StageId].status === "not-started") {
          stages[next.id as StageId] = { ...stages[next.id as StageId], status: "ready" };
        }
        return { ...s, stages, current: (next?.id ?? id) as StageId };
      });
      onDirty();
      toast.success(`Stage ${id} approved — you can still come back and change it`);
    },
    [onDirty],
  );

  const keepDownstream = useCallback(() => {
    acknowledged.current = hash;
    setState((s) => ({ ...s }));
  }, [hash]);

  const extractAudio = useCallback(async () => {
    if (!file) return;
    setBusy(2);
    setProgress("Extracting audio from the edited timeline…");
    try {
      const result = await extractEditedAudio(file, clips, setProgress);
      setProgress("Mapping speech and silence in the original audio…");
      const speechMap = detectSpeech(result.samples);
      setAudio((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          blob: result.blob,
          url: URL.createObjectURL(result.blob),
          duration: result.duration,
          peaks: result.peaks,
          samples: result.samples,
        };
      });
      acknowledged.current = null;
      setState((s) => ({
        ...s,
        audio: { duration: result.duration, size: result.blob.size, inputHash: hash },
        speechMap,
        stages: { ...s.stages, 2: { ...s.stages[2], status: "review" } },
      }));
      onDirty();
      toast.success("Audio extracted — the AI works from this asset, never the video");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audio extraction failed");
    } finally {
      setBusy(null);
      setProgress("");
    }
  }, [clips, file, hash, onDirty]);

  const runTranscript = useCallback(async () => {
    if (!audio) return;
    setBusy(3);
    setProgress("Preparing the extracted audio…");
    try {
      let samples = audio.samples;
      if (!samples) samples = await decodeToSamples(audio.blob);
      const speechMap = state.speechMap.length > 0 ? state.speechMap : detectSpeech(samples);
      const segments = await transcribeAudio(samples, setProgress, speechMap);
      setState((s) => ({
        ...s,
        speechMap,
        transcript: segments,
        stages: {
          ...s.stages,
          3: {
            ...s.stages[3],
            status: "review" as StageStatus,
            ...(s.audio ? { inputHash: s.audio.inputHash } : {}),
          },
        },
      }));
      onDirty();
      toast.success(`Transcribed ${segments.length} segments from the extracted audio`);

      // The project now knows what the lesson is actually spoken in, so the
      // script, the voice and the captions all start from that language.
      const sample = segments
        .map((segment) => segment.text)
        .join(" ")
        .slice(0, 1500)
        .trim();
      if (sample) {
        setProgress("Detecting the spoken language…");
        try {
          const { language } = await detectLanguage({ data: { text: sample } });
          setState((s) => {
            if (!language || language.toLowerCase() === s.sourceLanguage.toLowerCase()) return s;
            const wasUntranslated = !isTranslating(s);
            return {
              ...s,
              sourceLanguage: language,
              targetLanguage: wasUntranslated ? language : s.targetLanguage,
            };
          });
          toast.success(`Detected spoken language: ${language}`);
        } catch {
          /* detection is best effort — the user can still set it by hand */
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transcription failed");
    } finally {
      setBusy(null);
      setProgress("");
    }
  }, [audio, onDirty, state.speechMap]);

  const editTranscript = useCallback(
    (id: string, text: string) => {
      setState((s) => ({
        ...s,
        transcript: s.transcript.map((t) => (t.id === id ? { ...t, text } : t)),
      }));
      onDirty();
    },
    [onDirty],
  );

  const setTone = useCallback(
    (tone: string) => setState((s) => ({ ...s, paraphraseTone: tone })),
    [],
  );

  const setParaphraseEnabled = useCallback(
    (enabled: boolean) => {
      setState((s) => ({
        ...s,
        paraphraseEnabled: enabled,
        paraphrase: enabled ? s.paraphrase : [],
        stages: {
          ...s.stages,
          4: enabled ? { ...s.stages[4], status: "ready" } : { status: "not-started" },
        },
        current: enabled ? (4 as StageId) : s.current === 4 ? (3 as StageId) : s.current,
      }));
      onDirty();
    },
    [onDirty],
  );

  const runParaphrase = useCallback(
    async (ids?: string[]) => {
      const targets = state.transcript.filter((t) => !ids || ids.includes(t.id));
      if (targets.length === 0) return;
      const tone = state.paraphraseTone;

      setParaphraseStatus((prev) => {
        const next = { ...prev };
        for (const t of targets) next[t.id] = { state: "generating" };
        return next;
      });
      setBusy(4);

      let done = 0;
      let failed = 0;
      setProgress(`Paraphrasing 0 of ${targets.length} segments…`);

      const runOne = async (segment: TranscriptSegment) => {
        try {
          const result = await paraphraseSegment({ data: { tone, text: segment.text } });
          const produced: ParaphraseSegment = {
            id: segment.id,
            text: result.text,
            sourceText: segment.text,
          };
          setState((s) => {
            const map = new Map(s.paraphrase.map((p) => [p.id, p]));
            map.set(produced.id, produced);
            const ordered = s.transcript
              .map((t) => map.get(t.id))
              .filter(Boolean) as ParaphraseSegment[];
            return {
              ...s,
              paraphrase: ordered,
              stages: { ...s.stages, 4: { ...s.stages[4], status: "review" } },
            };
          });
          setParaphraseStatus((prev) => ({ ...prev, [segment.id]: { state: "done" } }));
          onDirty();
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Paraphrasing failed";
          setParaphraseStatus((prev) => ({
            ...prev,
            [segment.id]: { state: "error", error: message },
          }));
        } finally {
          done += 1;
          setProgress(`Paraphrasing ${done} of ${targets.length} segments…`);
        }
      };

      try {
        const concurrency = 3;
        const queue = [...targets];
        const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
          for (;;) {
            const next = queue.shift();
            if (!next) return;
            await runOne(next);
          }
        });
        await Promise.all(workers);

        const ok = targets.length - failed;
        if (ok > 0) toast.success(`Paraphrased ${ok} segment${ok === 1 ? "" : "s"}`);
        if (failed > 0)
          toast.error(
            `${failed} segment${failed === 1 ? "" : "s"} failed — retry them individually`,
          );
      } finally {
        setBusy(null);
        setProgress("");
      }
    },
    [onDirty, state.paraphraseTone, state.transcript],
  );

  const editParaphrase = useCallback(
    (id: string, text: string) => {
      setState((s) => ({
        ...s,
        paraphrase: s.paraphrase.map((p) => (p.id === id ? { ...p, text } : p)),
      }));
      onDirty();
    },
    [onDirty],
  );

  /* ---------------- Stage 5 — Language ---------------- */

  const script = useMemo(() => finalScript(state), [state]);

  const translationStaleIds = useMemo(() => {
    if (state.translation.length === 0) return [];
    const byId = new Map(state.translation.map((t) => [t.id, t]));
    const sources = new Map(
      state.transcript.map((t) => [
        t.id,
        (state.paraphrase.find((p) => p.id === t.id)?.text ?? t.text).trim(),
      ]),
    );
    return state.transcript
      .filter((t) => {
        const translated = byId.get(t.id);
        return !translated || translated.sourceText.trim() !== (sources.get(t.id) ?? "");
      })
      .map((t) => t.id);
  }, [state.paraphrase, state.transcript, state.translation]);

  const setTargetLanguage = useCallback(
    (language: string) =>
      setState((s) => {
        if (s.targetLanguage === language) return s;
        // Language is a CHANGE, not an addition: everything spoken in the old
        // language is dropped so the lesson can never mix two languages.
        const voice = defaultVoiceFor(language, findVoice(s.voiceName).accent).id;
        return {
          ...s,
          targetLanguage: language,
          voiceName: voice,
          voiceOverrides: {},
          translation: [],
          voice: {},
          timing: {},
          offsets: {},
          generatedTrack: undefined,
          generatedVideo: undefined,
        };
      }),
    [],
  );

  const setSourceLanguage = useCallback(
    (language: string) => {
      setState((s) => ({ ...s, sourceLanguage: language }));
      onDirty();
    },
    [onDirty],
  );

  const translating = useMemo(() => isTranslating(state), [state]);
  const untranslatedIds = useMemo(() => computeUntranslatedIds(state), [state]);

  const runTranslation = useCallback(
    async (ids?: string[]): Promise<Map<string, string>> => {
      const produced = new Map<string, string>();
      const base = state.transcript.map((t) => ({
        id: t.id,
        text: (state.paraphrase.find((p) => p.id === t.id)?.text ?? t.text).trim(),
      }));
      const targets = base.filter((b) => (!ids || ids.includes(b.id)) && b.text);
      if (targets.length === 0) return produced;
      setBusy(5);
      setTranslationStatus((prev) => {
        const next = { ...prev };
        for (const t of targets) next[t.id] = { state: "generating" };
        return next;
      });

      let done = 0;
      let failed = 0;
      const language = state.targetLanguage;
      setProgress(`Translating 0 of ${targets.length} segments…`);

      const runOne = async (segment: { id: string; text: string }) => {
        try {
          const result = await translateSegment({ data: { language, text: segment.text } });
          produced.set(segment.id, result.text);
          const made: ParaphraseSegment = {
            id: segment.id,
            text: result.text,
            sourceText: segment.text,
          };
          setState((s) => {
            const map = new Map(s.translation.map((t) => [t.id, t]));
            map.set(made.id, made);
            const ordered = s.transcript
              .map((t) => map.get(t.id))
              .filter(Boolean) as ParaphraseSegment[];
            return {
              ...s,
              translation: ordered,
              stages: { ...s.stages, 5: { ...s.stages[5], status: "review" } },
            };
          });
          setTranslationStatus((prev) => ({ ...prev, [segment.id]: { state: "done" } }));
          onDirty();
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Translation failed";
          setTranslationStatus((prev) => ({
            ...prev,
            [segment.id]: { state: "error", error: message },
          }));
        } finally {
          done += 1;
          setProgress(`Translating ${done} of ${targets.length} segments…`);
        }
      };

      try {
        const queue = [...targets];
        await Promise.all(
          Array.from({ length: Math.min(3, queue.length) }, async () => {
            for (;;) {
              const next = queue.shift();
              if (!next) return;
              await runOne(next);
            }
          }),
        );
        const ok = targets.length - failed;
        if (ok > 0)
          toast.success(`Translated ${ok} segment${ok === 1 ? "" : "s"} into ${language}`);
        if (failed > 0)
          toast.error(
            `${failed} segment${failed === 1 ? "" : "s"} failed — retry them individually`,
          );
      } finally {
        setBusy(null);
        setProgress("");
      }
      return produced;
    },
    [onDirty, state.paraphrase, state.targetLanguage, state.transcript, state.translation],
  );

  const editTranslation = useCallback(
    (id: string, text: string) => {
      setState((s) => ({
        ...s,
        translation: s.translation.map((t) => (t.id === id ? { ...t, text } : t)),
      }));
      onDirty();
    },
    [onDirty],
  );

  /* ---------------- Stage 6 — Voice ---------------- */

  const voiceStaleIds = useMemo(
    () =>
      script
        .filter((item) => {
          const meta = state.voice[item.id];
          const override = state.voiceOverrides[item.id];
          const voice = override?.voice ?? state.voiceName;
          const style = override?.style ?? state.deliveryStyle;
          return (
            !meta ||
            meta.sourceText.trim() !== item.text ||
            meta.voice !== voice ||
            (meta.style ?? state.deliveryStyle) !== style
          );
        })
        .map((item) => item.id),
    [script, state.deliveryStyle, state.voice, state.voiceName, state.voiceOverrides],
  );

  /**
   * Segments that still need work: never re-generate a clip that already fits.
   * Accepted (synchronized / tight) clips are left exactly as they are.
   */
  const pendingVoiceIds = useMemo(() => {
    const stale = new Set(voiceStaleIds);
    return script
      .filter((item) => {
        const meta = state.voice[item.id];
        if (!meta) return true;
        if (stale.has(item.id)) return true;
        return meta.fitStatus === "over" || meta.fitStatus === "manual";
      })
      .map((item) => item.id);
  }, [script, state.voice, voiceStaleIds]);

  const setVoiceName = useCallback(
    (voice: string) => setState((s) => ({ ...s, voiceName: voice })),
    [],
  );
  const setVoiceInstructions = useCallback(
    (instructions: string) => setState((s) => ({ ...s, voiceInstructions: instructions })),
    [],
  );
  const setDeliveryStyle = useCallback(
    (style: string) => setState((s) => ({ ...s, deliveryStyle: style })),
    [],
  );
  const setSegmentVoice = useCallback((id: string, voice: string | null) => {
    setState((s) => {
      const overrides = { ...s.voiceOverrides };
      const current = { ...(overrides[id] ?? {}) };
      if (voice) current.voice = voice;
      else delete current.voice;
      if (Object.keys(current).length === 0) delete overrides[id];
      else overrides[id] = current;
      return { ...s, voiceOverrides: overrides };
    });
  }, []);
  const setSegmentStyle = useCallback((id: string, style: string | null) => {
    setState((s) => {
      const overrides = { ...s.voiceOverrides };
      const current = { ...(overrides[id] ?? {}) };
      if (style) current.style = style;
      else delete current.style;
      if (Object.keys(current).length === 0) delete overrides[id];
      else overrides[id] = current;
      return { ...s, voiceOverrides: overrides };
    });
  }, []);

  /** Puts every segment back on the project voice and style. */
  const clearVoiceOverrides = useCallback(() => {
    setState((s) => ({ ...s, voiceOverrides: {} }));
    onDirty();
  }, [onDirty]);

  /** Writes back to whichever script layer the segment currently speaks from. */
  const applyScriptText = useCallback(
    (id: string, text: string) => {
      setState((s) => {
        if (s.translation.some((t) => t.id === id)) {
          return {
            ...s,
            translation: s.translation.map((t) => (t.id === id ? { ...t, text } : t)),
          };
        }
        if (s.paraphrase.some((p) => p.id === id)) {
          return { ...s, paraphrase: s.paraphrase.map((p) => (p.id === id ? { ...p, text } : p)) };
        }
        return { ...s, transcript: s.transcript.map((t) => (t.id === id ? { ...t, text } : t)) };
      });
      onDirty();
    },
    [onDirty],
  );

  const runVoice = useCallback(
    async (ids?: string[]) => {
      // No ids means "repair what is not done" — accepted clips are never touched.
      const wanted = ids ?? pendingVoiceIds;
      const texts = new Map(script.map((item) => [item.id, item.text]));

      // A translated lesson is spoken only in the target language: any segment
      // still missing its translation is translated first, never voiced in the
      // original language.
      if (isTranslating(state)) {
        const missing = computeUntranslatedIds(state).filter((id) => wanted.includes(id));
        if (missing.length > 0) {
          setProgress(`Translating ${missing.length} remaining segment(s)…`);
          const produced = await runTranslation(missing);
          for (const [id, text] of produced) texts.set(id, text.trim());
        }
      }

      const targets = script
        .filter((item) => wanted.includes(item.id))
        .map((item) => ({ id: item.id, text: (texts.get(item.id) ?? "").trim() }))
        .filter((item) => item.text);
      if (targets.length === 0) {
        if (!ids) toast.success("Every segment already fits — nothing to regenerate");
        return;
      }
      setBusy(6);
      setVoiceStatus((prev) => {
        const next = { ...prev };
        for (const t of targets) next[t.id] = { state: "generating" };
        return next;
      });

      let done = 0;
      let failed = 0;
      setProgress(`Generating voice — 0 of ${targets.length}…`);

      const runOne = async (item: { id: string; text: string }) => {
        try {
          const override = state.voiceOverrides[item.id];
          const voiceId = override?.voice ?? state.voiceName;
          const styleId = override?.style ?? state.deliveryStyle;
          const voice = findVoice(voiceId);
          const segment = state.transcript.find((t) => t.id === item.id);
          const container = segment ? Math.max(segment.end - segment.start, 0.4) : 0;
          const budget = segment ? segmentBudget(segment, state.speechMap, container) : 0;

          // Generated speech may never be longer than the ORIGINAL spoken time.
          // Over-long takes are rejected and regenerated shorter, never cut.
          let text = item.text;
          let blob: Blob | null = null;
          let duration = 0;
          let attempts = 0;
          let exhausted = false;
          const maxAttempts = 3;
          for (;;) {
            attempts += 1;
            const take = await speakSegment(
              text,
              voice.engineVoice,
              composeInstruction(voiceId, styleId, state.voiceInstructions, state.targetLanguage),
            );
            const samples = await decodeToMono(take);
            const takeDuration = samples.length / TARGET_RATE;
            blob = take;
            duration = takeDuration;
            if (budget <= 0 || takeDuration <= budget + 0.05) break;
            if (attempts >= maxAttempts) {
              exhausted = true;
              break;
            }
            setProgress(
              `Segment too long (${takeDuration.toFixed(1)}s > ${budget.toFixed(1)}s) — rewriting shorter…`,
            );
            const ratio = Math.min(0.95, Math.max(0.4, budget / takeDuration));
            try {
              const shorter = await shortenSegment({
                data: { text, ratio, language: state.targetLanguage },
              });
              if (!shorter.text || shorter.text === text) {
                exhausted = true;
                break;
              }
              text = shorter.text;
            } catch {
              exhausted = true;
              break;
            }
          }
          if (!blob) throw new Error("Voice generation failed");
          if (text !== item.text) applyScriptText(item.id, text);

          // Last automatic step: a mild, natural speech-rate adjustment.
          const speed =
            budget > 0 && duration > budget + 0.05
              ? clampSpeed(Math.min(duration / budget, 1.15))
              : 1;
          const fitted = duration / speed;
          const clipBlob = blob;
          setVoiceClips((prev) => ({ ...prev, [item.id]: blob }));
          setVoiceUrls((prev) => {
            const next = { ...prev };
            if (next[item.id]) URL.revokeObjectURL(next[item.id]!);
            next[item.id] = URL.createObjectURL(clipBlob);
            return next;
          });
          setState((s) => {
            const current = s.transcript.find((t) => t.id === item.id);
            const window = current ? Math.max(current.end - current.start, 0.4) : duration;
            return {
              ...s,
              voice: {
                ...s.voice,
                [item.id]: {
                  sourceText: text,
                  voice: voiceId,
                  style: styleId,
                  duration,
                  size: clipBlob.size,
                  start: current?.start ?? 0,
                  end: current?.end ?? 0,
                  containerDuration: window,
                  budget,
                  attempts,
                  fitStatus:
                    fitted > window + 0.05
                      ? exhausted
                        ? "manual"
                        : "over"
                      : budget > 0 && fitted > budget + 0.05
                        ? "tight"
                        : "synchronized",
                },
              },
              timing: { ...s.timing, [item.id]: speed },
              stages: { ...s.stages, 6: { ...s.stages[6], status: "review" } },
            };
          });
          setVoiceStatus((prev) => ({ ...prev, [item.id]: { state: "done" } }));
          onDirty();
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Voice generation failed";
          setVoiceStatus((prev) => ({ ...prev, [item.id]: { state: "error", error: message } }));
        } finally {
          done += 1;
          setProgress(`Generating voice — ${done} of ${targets.length}…`);
        }
      };

      try {
        const queue = [...targets];
        await Promise.all(
          Array.from({ length: Math.min(2, queue.length) }, async () => {
            for (;;) {
              const next = queue.shift();
              if (!next) return;
              await runOne(next);
            }
          }),
        );
        const ok = targets.length - failed;
        if (ok > 0) toast.success(`Generated ${ok} voice segment${ok === 1 ? "" : "s"}`);
        if (failed > 0)
          toast.error(
            `${failed} segment${failed === 1 ? "" : "s"} failed — retry them individually`,
          );
      } finally {
        setBusy(null);
        setProgress("");
      }
    },
    [
      onDirty,
      script,
      applyScriptText,
      pendingVoiceIds,
      state,
      runTranslation,
      state.deliveryStyle,
      state.speechMap,
      state.targetLanguage,
      state.transcript,
      state.voiceInstructions,
      state.voiceName,
      state.voiceOverrides,
    ],
  );

  /**
   * VOICE LOCK — the voice the teacher chose is the voice of the whole lesson.
   * Any clip that was produced with a different voice or style than the one
   * this segment resolves to right now is a mismatch and must be regenerated,
   * so the finished track can never switch voices halfway through.
   */
  const voiceMismatchIds = useMemo(
    () =>
      script
        .filter((item) => {
          const meta = state.voice[item.id];
          if (!meta) return false;
          const resolved = resolveSegmentVoice(state, item.id);
          return (
            meta.voice !== resolved.voice ||
            (meta.style ?? state.deliveryStyle) !== resolved.style
          );
        })
        .map((item) => item.id),
    [script, state],
  );

  const missingVoiceIds = useMemo(
    () => script.filter((item) => item.text && !state.voice[item.id]).map((item) => item.id),
    [script, state.voice],
  );

  const enforceDefaultVoice = useCallback(async () => {
    const ids = new Set([...voiceMismatchIds, ...missingVoiceIds]);
    setState((s) => ({ ...s, voiceOverrides: {} }));
    onDirty();
    if (ids.size === 0) {
      toast.success("Every segment already uses your selected voice");
      return;
    }
    await runVoice([...ids]);
  }, [missingVoiceIds, onDirty, runVoice, voiceMismatchIds]);

  /* ---------------- Stage 7 — Timing ---------------- */

  const fits = useMemo<TimingFit[]>(
    () =>
      state.transcript.map((segment) => {
        const meta = state.voice[segment.id];
        const window = Math.max(segment.end - segment.start, 0.1);
        const budget = segmentBudget(segment, state.speechMap, window);
        const rawDuration = meta?.duration ?? 0;
        const speed = state.timing[segment.id] ?? 1;
        const fitted = speed > 0 ? rawDuration / speed : rawDuration;
        const status: TimingFit["status"] =
          rawDuration <= 0
            ? "none"
            : fitted > window + 0.05
              ? meta?.fitStatus === "manual"
                ? "manual"
                : "over"
              : fitted > budget + 0.05
                ? "tight"
                : "synchronized";
        return {
          id: segment.id,
          text: script.find((s) => s.id === segment.id)?.text ?? segment.text,
          start: segment.start,
          end: segment.end,
          window,
          rawDuration,
          speed,
          fitted,
          overflow: fitted - window,
          offset: state.offsets[segment.id] ?? 0,
          budget,
          silence: Math.max(0, window - fitted),
          status,
        };
      }),
    [script, state.offsets, state.speechMap, state.timing, state.transcript, state.voice],
  );

  const setSpeed = useCallback(
    (id: string, speed: number) => {
      setState((s) => ({ ...s, timing: { ...s.timing, [id]: clampSpeed(speed) } }));
      onDirty();
    },
    [onDirty],
  );

  const autoFit = useCallback(() => {
    setState((s) => {
      const timing = { ...s.timing };
      for (const segment of s.transcript) {
        const meta = s.voice[segment.id];
        if (!meta) continue;
        const container = Math.max(segment.end - segment.start, 0.4);
        const budget = segmentBudget(segment, s.speechMap, container);
        timing[segment.id] = meta.duration > budget + 0.05 ? clampSpeed(meta.duration / budget) : 1;
      }
      return { ...s, timing, stages: { ...s.stages, 7: { ...s.stages[7], status: "review" } } };
    });
    onDirty();
    toast.success("Every segment refitted inside its original spoken time");
  }, [onDirty]);

  const setOffset = useCallback(
    (id: string, offset: number) => {
      const clamped = Math.round(Math.min(Math.max(offset, -2), 2) * 100) / 100;
      setState((s) => ({ ...s, offsets: { ...s.offsets, [id]: clamped } }));
      onDirty();
    },
    [onDirty],
  );

  const setScriptText = applyScriptText;

  const regenerateShorter = useCallback(
    async (id: string) => {
      const item = script.find((s) => s.id === id);
      const fit = fits.find((f) => f.id === id);
      if (!item || !fit || fit.rawDuration <= 0) return;
      const ratio = Math.min(0.95, Math.max(0.4, fit.budget / Math.max(fit.rawDuration, 0.1)));
      setBusy(7);
      setProgress("Rewriting this segment shorter…");
      try {
        const result = await shortenSegment({
          data: { text: item.text, ratio, language: state.targetLanguage },
        });
        setScriptText(id, result.text);
        toast.success("Segment rewritten shorter — regenerating its voice");
        setBusy(null);
        setProgress("");
        await runVoice([id]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not rewrite this segment");
        setBusy(null);
        setProgress("");
      }
    },
    [fits, runVoice, script, setScriptText, state.targetLanguage],
  );

  /* ---------------- Stage 8 — Subtitles ---------------- */

  const subtitleLanguage = useMemo(() => subtitleLanguageOf(state), [state]);
  const spokenLanguage = useMemo(() => scriptLanguage(state), [state]);
  const subtitlesTranslated = useMemo(
    () => subtitleLanguage.trim().toLowerCase() !== spokenLanguage.trim().toLowerCase(),
    [spokenLanguage, subtitleLanguage],
  );
  const subtitleTexts = useMemo(
    () => state.subtitleTexts[subtitleLanguage] ?? {},
    [state.subtitleTexts, subtitleLanguage],
  );

  const subtitlePendingIds = useMemo(
    () =>
      subtitlesTranslated
        ? script.filter((item) => item.text && !subtitleTexts[item.id]).map((item) => item.id)
        : [],
    [script, subtitleTexts, subtitlesTranslated],
  );

  const captionText = useCallback(
    (id: string, fallback: string) =>
      subtitlesTranslated ? (subtitleTexts[id] ?? fallback) : fallback,
    [subtitleTexts, subtitlesTranslated],
  );

  const cues = useMemo(
    () =>
      buildCues(
        state.transcript.map((segment) => {
          const spoken = script.find((s) => s.id === segment.id)?.text ?? segment.text;
          return {
            start: segment.start,
            end: segment.end,
            text: captionText(segment.id, spoken),
          };
        }),
        state.subtitles,
      ),
    [captionText, script, state.subtitles, state.transcript],
  );

  const setSubtitleLanguage = useCallback(
    (language: string) => {
      setState((s) => ({ ...s, subtitles: { ...s.subtitles, language } }));
      onDirty();
    },
    [onDirty],
  );

  /** Translates the captions only — the spoken track is never touched. */
  const runSubtitleTranslation = useCallback(
    async (ids?: string[]) => {
      const language = subtitleLanguage;
      const targets = script.filter(
        (item) => item.text && (ids ? ids.includes(item.id) : !subtitleTexts[item.id]),
      );
      if (targets.length === 0) {
        toast.success(`Captions are already in ${language}`);
        return;
      }
      setBusy(8);
      let done = 0;
      let failed = 0;
      setProgress(`Translating captions — 0 of ${targets.length}…`);
      const runOne = async (item: { id: string; text: string }) => {
        try {
          const result = await translateSegment({ data: { language, text: item.text } });
          setState((s) => ({
            ...s,
            subtitleTexts: {
              ...s.subtitleTexts,
              [language]: { ...(s.subtitleTexts[language] ?? {}), [item.id]: result.text },
            },
          }));
          onDirty();
        } catch {
          failed += 1;
        } finally {
          done += 1;
          setProgress(`Translating captions — ${done} of ${targets.length}…`);
        }
      };
      try {
        const queue = [...targets];
        await Promise.all(
          Array.from({ length: Math.min(3, queue.length) }, async () => {
            for (;;) {
              const next = queue.shift();
              if (!next) return;
              await runOne(next);
            }
          }),
        );
        const ok = targets.length - failed;
        if (ok > 0) toast.success(`${ok} caption(s) translated into ${language}`);
        if (failed > 0) toast.error(`${failed} caption(s) failed — try again`);
      } finally {
        setBusy(null);
        setProgress("");
      }
    },
    [onDirty, script, subtitleLanguage, subtitleTexts],
  );

  const setSubtitles = useCallback(
    (settings: Partial<SubtitleSettings>) => {
      setState((s) => ({ ...s, subtitles: { ...s.subtitles, ...settings } }));
      onDirty();
    },
    [onDirty],
  );

  /* ---------------- Stated errors + "Proceed anyway" ---------------- */

  const blockers = useMemo(
    () =>
      computeBlockers({
        state,
        hasFile: Boolean(file),
        clipCount: clips.length,
        hasAudio: Boolean(state.audio),
        audioStale,
        transcriptStale,
        staleParaphraseIds,
        translating,
        untranslatedIds,
        missingVoiceIds,
        voiceMismatchIds,
        pendingVoiceIds,
        fits,
        cueCount: cues.length,
        subtitlePendingIds,
        hasTrack: Boolean(generatedTrack),
        hasVideo: Boolean(generatedVideo),
      }),
    [
      audioStale,
      clips.length,
      cues.length,
      file,
      fits,
      generatedTrack,
      generatedVideo,
      missingVoiceIds,
      pendingVoiceIds,
      staleParaphraseIds,
      state,
      subtitlePendingIds,
      transcriptStale,
      translating,
      untranslatedIds,
      voiceMismatchIds,
    ],
  );

  const overrides = state.overrides ?? {};

  /** A problem counts as accepted only while the content behind it is unchanged. */
  const accepted = useCallback(
    (blocker: StageBlocker) => overrides[blockerKey(blocker)] === blocker.signature,
    [overrides],
  );

  const blockersFor = useCallback(
    (stage: StageId) => blockers.filter((b) => b.stage === stage && !accepted(b)),
    [accepted, blockers],
  );

  const isOverridden = useCallback(
    (stage: StageId, code: string) => {
      const blocker = blockers.find((b) => b.stage === stage && b.code === code);
      return blocker ? accepted(blocker) : false;
    },
    [accepted, blockers],
  );

  const proceedAnyway = useCallback(
    (stage: StageId) => {
      const codes = new Set(
        blockers.filter((b) => b.stage === stage && !b.fatal).map((b) => b.code),
      );
      // Accepting a problem accepts it wherever it is stated: the same overflow
      // is reported by the timing stage and the final preview.
      const open = blockers.filter((b) => !b.fatal && codes.has(b.code) && !accepted(b));
      if (open.length === 0) return;
      setState((s) => {
        const next = { ...(s.overrides ?? {}) };
        for (const b of open) next[blockerKey(b)] = b.signature;
        return { ...s, overrides: next };
      });
      onDirty();
      toast.success(
        open.length === 1
          ? "Accepted — continuing with that warning"
          : `Accepted ${open.length} warnings — continuing`,
      );
    },
    [accepted, blockers, onDirty],
  );

  /** Names of the accepted warnings, for labelling rendered files. */
  const acceptedLabels = useCallback(
    () => blockers.filter(accepted).map((b) => `${b.stage}:${b.code}`),
    [accepted, blockers],
  );


  const exportSubtitles = useCallback(
    (format: "srt" | "vtt") => {
      if (cues.length === 0) {
        toast.error("There are no subtitles to export yet");
        return;
      }
      const content = format === "srt" ? toSrt(cues) : toVtt(cues);
      downloadFile(`lesson-subtitles.${format}`, content, "text/plain;charset=utf-8");
    },
    [cues],
  );

  /* ---------------- Stage 9 + 10 ---------------- */

  const setMix = useCallback(
    (mix: Partial<MixSettings>) => {
      setState((s) => ({ ...s, mix: { ...s.mix, ...mix } }));
      onDirty();
    },
    [onDirty],
  );

  /** Renders the untouched source picture with the generated track under it. */
  const renderVideo = useCallback(
    async (options?: { subtitles?: boolean }): Promise<GeneratedVideoAsset | null> => {
      const withSubtitles = options?.subtitles ?? false;
    if (!file) {
      toast.error("The source video is missing");
      return null;
    }
    if (!generatedTrack) {
      toast.error("Build the final audio track first");
      return null;
    }
    setBusy(9);
    setProgress("Rendering the final video…");
    try {
      const rendered = await renderFinalVideo({
        videoFile: file,
        fileName: file.name,
        audioBlob: generatedTrack.blob,
        duration: generatedTrack.duration,
        ...(withSubtitles && cues.length > 0
          ? {
              subtitles: toSrt(cues),
              captions: cues.map((cue) => ({
                start: cue.start,
                end: cue.end,
                lines: cue.lines,
              })),
            }
          : {}),
        onProgress: setProgress,
      });
      const meta: GeneratedVideoMeta = {
        duration: rendered.duration,
        size: rendered.blob.size,
        type: rendered.type,
        extension: rendered.extension,
        language: state.targetLanguage,
        voiceLabel: voiceLabel(state.voiceName),
        mode: rendered.mode,
        at: Date.now(),
        burnedSubtitles: Boolean(rendered.burnedSubtitles),
        ...(rendered.burnedSubtitles ? { subtitleLanguage } : {}),
        ...(acceptedLabels().length > 0 ? { overrides: acceptedLabels() } : {}),
      };

      const asset: GeneratedVideoAsset = {
        blob: rendered.blob,
        url: URL.createObjectURL(rendered.blob),
        meta,
      };
      setGeneratedVideo((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return asset;
      });
      setState((s) => ({
        ...s,
        generatedVideo: meta,
        stages: { ...s.stages, 9: { ...s.stages[9], status: "review" } },
      }));
      onDirty();
      toast.success("Final video rendered — ready to download");
      return asset;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Final render failed");
      return null;
    } finally {
      setBusy(null);
      setProgress("");
    }
    },
    [
      acceptedLabels,
      cues,
      file,
      generatedTrack,
      onDirty,
      state.targetLanguage,
      state.voiceName,
      subtitleLanguage,
    ],
  );


  const downloadVideo = useCallback(() => {
    if (!generatedVideo) {
      toast.error("Render the final video first");
      return;
    }
    const suffix = generatedVideo.meta.burnedSubtitles ? "-subtitled" : "";
    const name = `${(state.targetLanguage || "lesson").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-final${suffix}.${generatedVideo.meta.extension}`;
    downloadFile(name, generatedVideo.blob, generatedVideo.meta.type);
  }, [generatedVideo, state.targetLanguage]);

  /**
   * The download always points at a freshly matching render: if the file on
   * hand does not match the requested subtitle choice, it is rendered first.
   */
  const downloadFinalVideo = useCallback(
    async ({ subtitles }: { subtitles: boolean }) => {
      const current = generatedVideo;
      const matches =
        current &&
        Boolean(current.meta.burnedSubtitles) === subtitles &&
        (!subtitles || current.meta.subtitleLanguage === subtitleLanguage);
      if (matches) {
        downloadVideo();
        return;
      }
      const asset = await renderVideo({ subtitles });
      if (!asset) return;
      const suffix = asset.meta.burnedSubtitles ? "-subtitled" : "";
      const name = `${(state.targetLanguage || "lesson").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-final${suffix}.${asset.meta.extension}`;
      downloadFile(name, asset.blob, asset.meta.type);
    },
    [downloadVideo, generatedVideo, renderVideo, state.targetLanguage, subtitleLanguage],
  );

  const buildTrack = useCallback(async () => {
    const ready = state.transcript.filter((segment) => voiceClips[segment.id]);
    if (ready.length === 0) {
      toast.error("Generate the voice segments first");
      return;
    }
    setBusy(9);
    try {
      // Everything that would stop the mix is stated on the stage. Only the
      // warnings that have NOT been accepted with "Proceed anyway" stop it here.
      const open = blockersFor(9).filter((b) => b.code !== "track-missing");
      if (open.length > 0) {
        toast.error(`${open[0]!.message} — see the stage for details, or Proceed anyway`);
        setBusy(null);
        return;
      }
      // Overflow accepted → the speech keeps its full length and is allowed to
      // run past the end of its clip instead of being clamped to it.
      const overflowAccepted = isOverridden(9, "overflow");
      const overflowIds = new Set(
        fits.filter((f) => f.status === "over" || f.status === "manual").map((f) => f.id),
      );
      const placed = [];
      let latest = 0;
      for (let i = 0; i < ready.length; i++) {
        const segment = ready[i]!;
        setProgress(`Mixing generated audio — ${i + 1} of ${ready.length}…`);
        const samples = await decodeToMono(voiceClips[segment.id]!);
        const start = Math.max(0, segment.start + (state.offsets[segment.id] ?? 0));
        const scaled = applySpeed(samples, state.timing[segment.id] ?? 1);
        const runOver = overflowAccepted && overflowIds.has(segment.id);
        latest = Math.max(latest, start + scaled.length / TARGET_RATE);
        placed.push({
          start,
          // The container is fixed: speech first, silence after, never spilling
          // into the next clip — unless the user accepted the overflow.
          ...(runOver ? {} : { containerEnd: segment.end }),
          samples: scaled,
        });
      }

      const total = Math.max(
        state.audio?.duration ?? 0,
        latest,
        ...ready.map((segment) => segment.end),
      );
      let bed: Float32Array | null = null;
      if (state.mix.keepOriginal && audio) {
        setProgress("Mixing the original audio underneath…");
        bed = audio.samples ?? (await decodeToSamples(audio.blob));
      }
      const result = buildGeneratedTrack(placed, total, state.mix, bed);
      setGeneratedTrack((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          blob: result.blob,
          url: URL.createObjectURL(result.blob),
          duration: result.duration,
          peaks: result.peaks,
          samples: null,
        };
      });
      setState((s) => ({
        ...s,
        generatedTrack: { duration: result.duration, size: result.blob.size },
        stages: { ...s.stages, 9: { ...s.stages[9], status: "review" } },
      }));
      // The rendered MP4 is now out of date — it is rebuilt from the new mix.
      setGeneratedVideo((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      onDirty();
      toast.success(
        overflowAccepted
          ? "Generated audio track assembled — accepted segments run over their clip"
          : "Generated audio track assembled against the original timing",
      );

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the generated track");
    } finally {
      setBusy(null);
      setProgress("");
    }
  }, [
    audio,
    blockersFor,
    fits,
    isOverridden,
    onDirty,
    state.audio,
    state.mix,
    state.offsets,
    state.timing,
    state.transcript,
    voiceClips,
  ]);


  const exportAudio = useCallback(() => {
    if (!generatedTrack) {
      toast.error("Build the generated track first");
      return;
    }
    downloadFile("lesson-generated-audio.wav", generatedTrack.blob);
  }, [generatedTrack]);

  const publish = useCallback(
    (note: string) => {
      setState((s) => ({
        ...s,
        published: { at: Date.now(), note },
        stages: {
          ...s.stages,
          10: { ...s.stages[10], status: "approved", approvedAt: Date.now() },
        },
      }));
      onDirty();
      toast.success("Lesson marked ready and attached to the course project");
    },
    [onDirty],
  );

  const saveVersion = useCallback(
    (note: string) => {
      if (!generatedTrack) {
        toast.error("Build the generated track before saving a version");
        return;
      }
      const blob = generatedTrack.blob;
      const id = `v-${Date.now()}`;
      setVersionTracks((prev) => ({ ...prev, [id]: blob }));
      setState((s) => ({
        ...s,
        versions: [
          ...s.versions,
          {
            id,
            at: Date.now(),
            label: `${s.targetLanguage} · ${voiceLabel(s.voiceName)}`,
            language: s.targetLanguage,
            voiceLabel: voiceLabel(s.voiceName),
            style: s.deliveryStyle,
            note,
            duration: generatedTrack.duration,
            size: blob.size,
          },
        ],
      }));
      onDirty();
      toast.success("Version saved — the original upload is untouched");
    },
    [generatedTrack, onDirty],
  );

  const deleteVersion = useCallback(
    (id: string) => {
      setVersionTracks((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setState((s) => ({ ...s, versions: s.versions.filter((v) => v.id !== id) }));
      onDirty();
    },
    [onDirty],
  );

  const downloadVersion = useCallback(
    (id: string) => {
      const blob = versionTracks[id];
      const version = state.versions.find((v) => v.id === id);
      if (!blob) {
        toast.error("This version's audio is not available in this browser");
        return;
      }
      downloadFile(`lesson-${version?.language ?? "version"}-${id}.wav`.toLowerCase(), blob);
    },
    [state.versions, versionTracks],
  );

  const statusOf = useCallback(
    (id: StageId): StageStatus => {
      if (busy === id) return "processing";
      const meta = state.stages[id];
      if (id === 2 && audioStale && meta.status !== "not-started") return "stale";
      if (id === 3 && transcriptStale && meta.status !== "not-started") return "stale";
      if (id === 4 && state.paraphrase.length > 0 && staleParaphraseIds.length > 0) return "stale";
      if (id === 5 && state.translation.length > 0 && translationStaleIds.length > 0)
        return "stale";
      if (id === 6 && Object.keys(state.voice).length > 0 && voiceStaleIds.length > 0)
        return "stale";
      return meta.status;
    },
    [
      audioStale,
      busy,
      staleParaphraseIds.length,
      state.paraphrase.length,
      state.stages,
      state.translation.length,
      state.voice,
      transcriptStale,
      translationStaleIds.length,
      voiceStaleIds.length,
    ],
  );

  const restore = useCallback(
    (
      next: WorkflowState,
      blob: Blob | null,
      clips?: Record<string, Blob>,
      trackBlob?: Blob | null,
      versions?: Record<string, Blob>,
      storedBranchClips?: Record<string, Record<string, Blob>>,
      storedBranchTracks?: Record<string, Blob>,
      videoBlob?: Blob | null,
    ) => {
      setState({ ...createWorkflow(), ...next });
      if (versions) setVersionTracks(versions);
      if (storedBranchClips) setBranchClips(storedBranchClips);
      if (storedBranchTracks) setBranchTracks(storedBranchTracks);
      if (blob) {
        setAudio({
          blob,
          url: URL.createObjectURL(blob),
          duration: next.audio?.duration ?? 0,
          peaks: [],
          samples: null,
        });
      }
      if (clips) {
        setVoiceClips(clips);
        const urls: Record<string, string> = {};
        for (const [id, clip] of Object.entries(clips)) urls[id] = URL.createObjectURL(clip);
        setVoiceUrls(urls);
      }
      if (trackBlob) {
        setGeneratedTrack({
          blob: trackBlob,
          url: URL.createObjectURL(trackBlob),
          duration: next.generatedTrack?.duration ?? 0,
          peaks: [],
          samples: null,
        });
      }
      if (videoBlob && next.generatedVideo) {
        setGeneratedVideo({
          blob: videoBlob,
          url: URL.createObjectURL(videoBlob),
          meta: next.generatedVideo,
        });
      }
    },
    [],
  );

  /* ---------------- Language versions (optional branch) ---------------- */

  /** Parks the open version's clips so switching never mixes two languages. */
  const parkLiveBlobs = useCallback(() => {
    const { branch, clips, track } = liveRef.current;
    setBranchClips((prev) => ({ ...prev, [branch]: clips }));
    setBranchTracks((prev) => {
      const next = { ...prev };
      if (track) next[branch] = track.blob;
      else delete next[branch];
      return next;
    });
  }, []);

  const loadBranchBlobs = useCallback(
    (id: string, meta?: { duration: number } | undefined) => {
      setVoiceClips(() => {
        const clips = branchClips[id] ?? {};
        setVoiceUrls((prevUrls) => {
          for (const url of Object.values(prevUrls)) URL.revokeObjectURL(url);
          const urls: Record<string, string> = {};
          for (const [segmentId, clip] of Object.entries(clips)) {
            urls[segmentId] = URL.createObjectURL(clip);
          }
          return urls;
        });
        return clips;
      });
      const track = branchTracks[id];
      setGeneratedTrack((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        if (!track) return null;
        return {
          blob: track,
          url: URL.createObjectURL(track),
          duration: meta?.duration ?? 0,
          peaks: [],
          samples: null,
        };
      });
    },
    [branchClips, branchTracks],
  );

  const switchBranch = useCallback(
    (id: string) => {
      if (id === liveRef.current.branch) return;
      parkLiveBlobs();
      let targetMeta: { duration: number } | undefined;
      setState((s) => {
        const snapshots = { ...s.snapshots, [s.activeBranch]: takeSnapshot(s) };
        const target = snapshots[id];
        if (!target) return s;
        targetMeta = target.generatedTrack;
        const stages = { ...target.stages } as Record<StageId, StageMeta>;
        for (const shared of [1, 2, 3, 4] as StageId[]) stages[shared] = s.stages[shared];
        return {
          ...s,
          ...target,
          stages,
          snapshots,
          activeBranch: id,
          current: id === ORIGINAL_BRANCH ? (6 as StageId) : (5 as StageId),
        };
      });
      loadBranchBlobs(id, targetMeta);
      setVoiceStatus({});
      setTranslationStatus({});
      onDirty();
    },
    [loadBranchBlobs, onDirty, parkLiveBlobs],
  );

  const addLanguageVersion = useCallback(
    ({ language, voice, style }: { language: string; voice: string; style: string }) => {
      parkLiveBlobs();
      const id = `lang_${Math.random().toString(36).slice(2, 9)}`;
      setState((s) => {
        const snapshots = { ...s.snapshots, [s.activeBranch]: takeSnapshot(s) };
        const fresh = emptySnapshot(language, voice, style, s.stages);
        snapshots[id] = fresh;
        const branch: LanguageVersion = { id, language, voice, style, createdAt: Date.now() };
        return {
          ...s,
          ...fresh,
          snapshots,
          branches: [...s.branches, branch],
          activeBranch: id,
          current: 5 as StageId,
        };
      });
      loadBranchBlobs(id, undefined);
      setVoiceStatus({});
      setTranslationStatus({});
      onDirty();
      toast.success(`${language} version created — the original video stays untouched`);
    },
    [loadBranchBlobs, onDirty, parkLiveBlobs],
  );

  const deleteBranch = useCallback(
    (id: string) => {
      if (id === ORIGINAL_BRANCH) return;
      const wasActive = liveRef.current.branch === id;
      if (wasActive) parkLiveBlobs();
      setState((s) => {
        const snapshots = { ...s.snapshots };
        const original = snapshots[ORIGINAL_BRANCH];
        delete snapshots[id];
        const branches = s.branches.filter((b) => b.id !== id);
        if (!wasActive) return { ...s, snapshots, branches };
        const base = original ?? takeSnapshot(s);
        const stages = { ...base.stages } as Record<StageId, StageMeta>;
        for (const shared of [1, 2, 3, 4] as StageId[]) stages[shared] = s.stages[shared];
        return { ...s, ...base, stages, snapshots, branches, activeBranch: ORIGINAL_BRANCH };
      });
      if (wasActive) loadBranchBlobs(ORIGINAL_BRANCH, undefined);
      setBranchClips((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setBranchTracks((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onDirty();
      toast.success("Language version removed");
    },
    [loadBranchBlobs, onDirty, parkLiveBlobs],
  );

  return {
    state,
    audio,
    busy,
    progress,
    statusOf,
    staleParaphraseIds,
    audioStale,
    transcriptStale,
    goTo,
    approve,
    extractAudio,
    runTranscript,
    editTranscript,
    runParaphrase,
    editParaphrase,
    paraphraseStatus,
    setTone,
    setParaphraseEnabled,
    keepDownstream,
    restore,
    script,
    translationStaleIds,
    translationStatus,
    setTargetLanguage,
    setSourceLanguage,
    translating,
    untranslatedIds,
    runTranslation,
    editTranslation,
    voiceClips,
    voiceUrls,
    voiceStaleIds,
    pendingVoiceIds,
    voiceStatus,
    setVoiceName,
    setVoiceInstructions,
    setDeliveryStyle,
    setSegmentVoice,
    setSegmentStyle,
    clearVoiceOverrides,
    runVoice,
    voiceMismatchIds,
    missingVoiceIds,
    enforceDefaultVoice,
    fits,
    setSpeed,
    setOffset,
    autoFit,
    regenerateShorter,
    setScriptText,
    cues,
    setSubtitles,
    exportSubtitles,
    subtitleLanguage,
    setSubtitleLanguage,
    subtitlePendingIds,
    runSubtitleTranslation,
    generatedTrack,
    generatedVideo,
    renderVideo,
    downloadVideo,
    downloadFinalVideo,
    setMix,
    buildTrack,
    exportAudio,
    versions: state.versions,
    saveVersion,
    deleteVersion,
    versionTracks,
    downloadVersion,
    publish,
    branches: state.branches,
    activeBranch: state.activeBranch,
    addLanguageVersion,
    switchBranch,
    deleteBranch,
    branchClips,
    branchTracks,
    blockers,
    blockersFor,
    isOverridden,
    proceedAnyway,

  };
}

async function decodeToSamples(blob: Blob): Promise<Float32Array> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("This browser cannot decode audio");
  const ctx = new Ctor();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buffer.sampleRate === TARGET_RATE) return buffer.getChannelData(0).slice();
    const ratio = buffer.sampleRate / TARGET_RATE;
    const source = buffer.getChannelData(0);
    const out = new Float32Array(Math.floor(source.length / ratio));
    for (let i = 0; i < out.length; i++) out[i] = source[Math.floor(i * ratio)] ?? 0;
    return out;
  } finally {
    void ctx.close();
  }
}

export type { TranscriptSegment };

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 1;
  return Math.round(Math.min(Math.max(speed, 0.5), 3) * 100) / 100;
}

/**
 * The speech budget for a segment: the seconds the teacher actually spoke
 * inside this container. Falls back to the container length for projects
 * recorded before the speech map existed.
 */
function segmentBudget(
  segment: TranscriptSegment,
  speechMap: { start: number; end: number }[],
  window: number,
): number {
  if (segment.speechDuration && segment.speechDuration > 0.05) {
    return Math.min(segment.speechDuration, window);
  }
  if (speechMap.length > 0) {
    const measured = speechDurationIn(speechMap, segment.start, segment.end);
    if (measured > 0.05) return Math.min(measured, window);
  }
  return window;
}

function downloadFile(name: string, content: Blob | string, type = "application/octet-stream") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
