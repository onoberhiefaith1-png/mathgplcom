import type { StageId, WorkflowState } from "./workflow";
import type { TimingFit } from "./useWorkflow";

/**
 * A stage blocker is a stated reason a stage cannot continue. Every blocker is
 * shown on the stage itself (never only as a toast) and — unless it is fatal —
 * can be accepted with "Proceed anyway".
 */
export interface StageBlocker {
  stage: StageId;
  code: string;
  /** plain-language statement of the problem */
  message: string;
  /** how to fix it properly */
  fix?: string;
  /** what happens when the user proceeds anyway */
  proceed: string;
  /** segments this problem affects, when it is segment-level */
  segmentIds: string[];
  /**
   * Fatal blockers cannot be overridden — the work is physically impossible
   * (for example the source file is no longer held by this browser).
   */
  fatal?: boolean;
  /** fingerprint of the underlying content — an override only holds while it matches */
  signature: string;
}

export function blockerKey(blocker: Pick<StageBlocker, "stage" | "code">): string {
  return `${blocker.stage}:${blocker.code}`;
}

interface Input {
  state: WorkflowState;
  hasFile: boolean;
  clipCount: number;
  hasAudio: boolean;
  audioStale: boolean;
  transcriptStale: boolean;
  staleParaphraseIds: string[];
  translating: boolean;
  untranslatedIds: string[];
  missingVoiceIds: string[];
  voiceMismatchIds: string[];
  pendingVoiceIds: string[];
  fits: TimingFit[];
  cueCount: number;
  subtitlePendingIds: string[];
  hasTrack: boolean;
  hasVideo: boolean;
}

function make(
  stage: StageId,
  code: string,
  message: string,
  proceed: string,
  options?: { fix?: string; segmentIds?: string[]; fatal?: boolean },
): StageBlocker {
  const segmentIds = options?.segmentIds ?? [];
  return {
    stage,
    code,
    message,
    proceed,
    segmentIds,
    ...(options?.fix ? { fix: options.fix } : {}),
    ...(options?.fatal ? { fatal: true } : {}),
    signature: `${code}:${segmentIds.length}:${segmentIds.slice(0, 200).join(",")}`,
  };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Every stated problem in the workflow right now, in stage order. */
export function computeBlockers(input: Input): StageBlocker[] {
  const {
    state,
    hasFile,
    clipCount,
    hasAudio,
    audioStale,
    transcriptStale,
    staleParaphraseIds,
    translating,
    untranslatedIds,
    missingVoiceIds,
    voiceMismatchIds,
    pendingVoiceIds,
    fits,
    cueCount,
    subtitlePendingIds,
    hasTrack,
    hasVideo,
  } = input;
  const list: StageBlocker[] = [];

  /* ---- Stage 1 — Video ---- */
  if (!hasFile) {
    list.push(
      make(
        1,
        "source-missing",
        "The source video file is not held by this browser any more.",
        "Nothing can be produced without the file — re-attach the same video first.",
        { fix: "Re-upload the same lesson video to continue where you left off.", fatal: true },
      ),
    );
  }
  if (hasFile && clipCount === 0) {
    list.push(
      make(
        1,
        "no-clips",
        "There is nothing on the timeline yet.",
        "The uploaded video is used exactly as it is, with no cuts.",
        { fix: "Add or restore clips on the timeline above." },
      ),
    );
  }

  /* ---- Stage 2 — Audio ---- */
  if (!hasAudio) {
    list.push(
      make(2, "audio-missing", "The edited audio has not been extracted yet.", "Continues without extracted audio — later stages will have nothing to work from.", {
        fix: "Press Extract audio on this stage.",
      }),
    );
  } else if (audioStale) {
    list.push(
      make(2, "audio-stale", "The timeline changed after this audio was extracted.", "Keeps the existing audio, which no longer matches your edit.", {
        fix: "Extract the audio again so it matches the current timeline.",
      }),
    );
  }

  /* ---- Stage 3 — Transcript ---- */
  if (state.transcript.length === 0) {
    list.push(
      make(3, "transcript-missing", "Nothing has been transcribed yet.", "Continues with an empty transcript.", {
        fix: "Run the transcription on this stage.",
      }),
    );
  } else if (transcriptStale) {
    list.push(
      make(3, "transcript-stale", "The audio changed after this transcript was produced.", "Keeps the existing transcript against the new audio.", {
        fix: "Transcribe again from the current audio.",
      }),
    );
  }

  /* ---- Stage 4 — Paraphrase (opt-in) ---- */
  if (state.paraphraseEnabled) {
    if (state.paraphrase.length === 0) {
      list.push(
        make(4, "paraphrase-missing", "No segment has been paraphrased yet.", "Continues with the original transcript wording.", {
          fix: "Paraphrase the script, or switch the paraphrase stage off.",
        }),
      );
    } else if (staleParaphraseIds.length > 0) {
      list.push(
        make(
          4,
          "paraphrase-stale",
          `${plural(staleParaphraseIds.length, "segment")} ${staleParaphraseIds.length === 1 ? "is" : "are"} out of date with the transcript.`,
          "Accepts the current wording as it stands.",
          { fix: "Re-paraphrase the listed segments.", segmentIds: staleParaphraseIds },
        ),
      );
    }
  }

  /* ---- Stage 5 — Language ---- */
  if (translating && untranslatedIds.length > 0) {
    list.push(
      make(
        5,
        "untranslated",
        `${plural(untranslatedIds.length, "segment")} ${untranslatedIds.length === 1 ? "has" : "have"} no ${state.targetLanguage} translation.`,
        `Continues with those lines still in the source language.`,
        { fix: "Translate the listed segments.", segmentIds: untranslatedIds },
      ),
    );
  }

  /* ---- Stage 6 — Voice ---- */
  if (missingVoiceIds.length > 0) {
    list.push(
      make(
        6,
        "voice-missing",
        `${plural(missingVoiceIds.length, "segment")} ${missingVoiceIds.length === 1 ? "has" : "have"} script text but no generated voice clip.`,
        "Those segments stay silent in the final mix.",
        { fix: "Generate voice for the listed segments.", segmentIds: missingVoiceIds },
      ),
    );
  }
  if (voiceMismatchIds.length > 0) {
    list.push(
      make(
        6,
        "voice-mismatch",
        `${plural(voiceMismatchIds.length, "segment")} ${voiceMismatchIds.length === 1 ? "was" : "were"} generated with a different voice from your default.`,
        "The lesson keeps more than one voice.",
        { fix: "Regenerate the listed segments with your default voice.", segmentIds: voiceMismatchIds },
      ),
    );
  }
  const pendingOnly = pendingVoiceIds.filter(
    (id) => !missingVoiceIds.includes(id) && !voiceMismatchIds.includes(id),
  );
  if (pendingOnly.length > 0) {
    list.push(
      make(
        6,
        "voice-pending",
        `${plural(pendingOnly.length, "segment")} ${pendingOnly.length === 1 ? "is" : "are"} out of date with the current script.`,
        "Keeps the existing clips even though the script has changed.",
        { fix: "Regenerate the listed segments.", segmentIds: pendingOnly },
      ),
    );
  }

  /* ---- Stage 7 — Timing ---- */
  const overflowing = fits.filter((fit) => fit.status === "over" || fit.status === "manual");
  if (!fits.some((fit) => fit.rawDuration > 0)) {
    list.push(
      make(7, "timing-missing", "There is no generated audio to fit yet.", "Continues without any timing information.", {
        fix: "Generate the voice segments in the voice stage first.",
      }),
    );
  }
  if (overflowing.length > 0) {
    const overflowMessage = `${plural(overflowing.length, "segment")} ${overflowing.length === 1 ? "is" : "are"} longer than its original clip.`;
    const overflowProceed =
      "The speech is kept at full length and is allowed to run over the end of its clip — nothing is cut or sped up, so it may overlap what follows.";
    list.push(
      make(7, "overflow", overflowMessage, overflowProceed, {
        fix: "Shorten the wording, raise the speed, or nudge the start of the listed segments.",
        segmentIds: overflowing.map((fit) => fit.id),
      }),
    );
    list.push(
      make(9, "overflow", overflowMessage, overflowProceed, {
        fix: "Fix the listed segments in the timing stage.",
        segmentIds: overflowing.map((fit) => fit.id),
      }),
    );
  }

  /* ---- Stage 8 — Subtitles ---- */
  if (cueCount === 0) {
    list.push(
      make(8, "captions-missing", "There are no subtitles yet.", "Continues without subtitles — the video renders with no captions.", {
        fix: "Generate the captions on this stage.",
      }),
    );
  }
  if (subtitlePendingIds.length > 0) {
    list.push(
      make(
        8,
        "captions-untranslated",
        `${plural(subtitlePendingIds.length, "caption")} ${subtitlePendingIds.length === 1 ? "is" : "are"} missing in the chosen subtitle language.`,
        "Those captions fall back to the spoken script language.",
        { fix: "Translate the listed captions.", segmentIds: subtitlePendingIds },
      ),
    );
  }

  /* ---- Stage 9 — Final preview ---- */
  if (missingVoiceIds.length > 0) {
    list.push(
      make(
        9,
        "voice-missing",
        `${plural(missingVoiceIds.length, "segment")} will be silent — no voice clip was generated.`,
        "Builds the mix with those gaps left silent.",
        { fix: "Generate the missing voice clips.", segmentIds: missingVoiceIds },
      ),
    );
  }
  if (voiceMismatchIds.length > 0) {
    list.push(
      make(
        9,
        "voice-mismatch",
        `${plural(voiceMismatchIds.length, "segment")} use a different voice from your default.`,
        "Builds the mix with more than one voice in it.",
        { fix: "Regenerate them with your default voice in the voice stage.", segmentIds: voiceMismatchIds },
      ),
    );
  }
  if (!hasTrack) {
    list.push(
      make(9, "track-missing", "The final audio track has not been assembled yet.", "Continues without an assembled track — there is nothing to render.", {
        fix: "Press Build the generated track on this stage.",
      }),
    );
  }

  /* ---- Stage 10 — Publish ---- */
  if (!hasTrack) {
    list.push(
      make(10, "track-missing", "The final audio track has not been assembled yet.", "Finishes without a generated audio track.", {
        fix: "Assemble the track in the final preview stage.",
      }),
    );
  }
  if (!hasVideo) {
    list.push(
      make(10, "video-missing", "The final video has not been rendered yet.", "Finishes without a rendered video file.", {
        fix: "Render the final video in the final preview stage.",
      }),
    );
  }

  return list;
}
