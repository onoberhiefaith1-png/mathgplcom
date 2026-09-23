// A live voice conversation, as a plain state machine.
//
// This is the part that decides, from nothing but the microphone level and the
// words heard so far, when a person has finished their sentence, when they are
// only drawing breath, and when they have started talking over Aura. It owns no
// audio and no browser API, so the whole behaviour can be tested by replaying a
// trace of levels and transcripts.

export type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "waiting";

export type VoiceTuning = {
  /** Above this the microphone is hearing a voice. */
  speechLevel: number;
  /** Below this the room counts as quiet. */
  silenceLevel: number;
  /** Quiet for this long after speech ends the turn. */
  endOfTurnMs: number;
  /** A turn must carry at least this much speech before it can close. */
  minSpeechMs: number;
  /** While Aura speaks, only this loud counts as talking over her. */
  bargeLevel: number;
  /** And only when it lasts this long — a cough never cuts her off. */
  bargeMs: number;
  /** Speech must stand this far above the room's own noise. */
  speechOverNoise: number;
  /** Quiet is anything within this much of the room's own noise. */
  silenceOverNoise: number;
  /** Talking over her must stand this far above her own voice. */
  bargeOverSelf: number;
  /** How long a turn may wait for the last words before closing anyway. */
  finalWaitMs: number;
  /** No single turn may run longer than this. */
  maxTurnMs: number;
  /** The shortest pause she will ever wait, once she knows their rhythm. */
  minEndOfTurnMs: number;
  /** How much the pause shortens after each turn that closed cleanly. */
  rhythmStepMs: number;
  /** A last look before answering: speech inside this window cancels the turn. */
  graceMs: number;
};

export const VOICE_TUNING: VoiceTuning = {
  speechLevel: 0.1,
  silenceLevel: 0.06,
  endOfTurnMs: 900,
  minSpeechMs: 350,
  bargeLevel: 0.22,
  bargeMs: 240,
  speechOverNoise: 2.6,
  silenceOverNoise: 1.5,
  bargeOverSelf: 1.45,
  finalWaitMs: 1800,
  maxTurnMs: 30000,
  minEndOfTurnMs: 450,
  rhythmStepMs: 120,
  graceMs: 140,
};

/** Little noises that answer her rather than ask her anything. */
const ACKNOWLEDGEMENTS = new Set([
  "ok",
  "okay",
  "mm",
  "mmm",
  "mhm",
  "mm-hm",
  "uh huh",
  "uh-huh",
  "yeah",
  "yep",
  "yes",
  "right",
  "sure",
  "thanks",
  "thank you",
  "got it",
  "i see",
]);

/** True for a short noise of agreement said straight after she finished. */
export function isAcknowledgement(heard: string): boolean {
  const text = heard.toLowerCase().replace(/[.,!?…]/g, "").replace(/\s+/g, " ").trim();
  return ACKNOWLEDGEMENTS.has(text);
}

export type VoiceSample = {
  now: number;
  /** Microphone loudness, 0 to 1. */
  level: number;
  /** Everything heard in this turn so far, final words and live guess. */
  transcript: string;
  /** How loud Aura's own voice is right now, so she never cuts herself off. */
  selfLevel?: number;
  /** True while the listening engine still owes us the final words. */
  finalPending?: boolean;
};

export type VoiceEffect =
  /** The person finished their turn; send these words to Aura. */
  | { kind: "turn"; text: string }
  /** They are talking over her; stop her voice this instant. */
  | { kind: "cut" };

const LISTENING_STATES: VoiceState[] = ["listening", "waiting"];

export class VoiceSession {
  state: VoiceState = "idle";

  private tuning: VoiceTuning;
  /** When the current run of speech began, or null while quiet. */
  private speechStart: number | null = null;
  /** How much speech this turn has carried. */
  private spokenMs = 0;
  /** When the room went quiet, or null while a voice is present. */
  private quietSince: number | null = null;
  /** When the person started talking over her, or null. */
  private overSince: number | null = null;
  private lastNow = 0;
  /** The room's own background noise, learned continuously. */
  private noiseFloor = 0.015;
  /** The pause she waits for, shortened as she learns their rhythm. */
  private pauseMs: number;
  /** A turn ready to close, held back for one last look. */
  private pendingSince: number | null = null;
  /** True while the last thing that happened was her finishing a reply. */
  private justSpoke = false;

  constructor(tuning: VoiceTuning = VOICE_TUNING) {
    this.tuning = tuning;
    this.pauseMs = tuning.endOfTurnMs;
  }

  /** Open the session: she is attentive from this moment. */
  begin(now = 0): void {
    this.state = "listening";
    this.lastNow = now;
    this.noiseFloor = 0.015;
    this.resetTurn();
  }

  /** Close the session entirely. */
  end(): void {
    this.state = "idle";
    this.resetTurn();
  }

  /** Her answer has started arriving and her voice is playing. */
  replyStarted(): void {
    if (this.state === "idle") return;
    this.state = "speaking";
    this.overSince = null;
  }

  /** She has finished speaking and now waits. */
  replyEnded(): void {
    if (this.state === "idle") return;
    this.state = "waiting";
    this.resetTurn();
  }

  /** True while she is listening for a turn rather than speaking. */
  get attentive(): boolean {
    return LISTENING_STATES.includes(this.state);
  }

  /** The room's own noise as currently measured — for diagnostics only. */
  get roomNoise(): number {
    return this.noiseFloor;
  }

  /** Loud enough to be a voice in this particular room. */
  private speechThreshold(): number {
    return Math.max(this.tuning.speechLevel, this.noiseFloor * this.tuning.speechOverNoise);
  }

  /** Quiet enough to count as the end of a sentence in this room. */
  private silenceThreshold(): number {
    return Math.max(this.tuning.silenceLevel, this.noiseFloor * this.tuning.silenceOverNoise);
  }

  private resetTurn() {
    this.speechStart = null;
    this.spokenMs = 0;
    this.quietSince = null;
    this.overSince = null;
  }

  /** One microphone reading. Returns whatever must happen because of it. */
  feed(sample: VoiceSample): VoiceEffect[] {
    const { now, level } = sample;
    const elapsed = Math.max(0, now - this.lastNow);
    this.lastNow = now;
    if (this.state === "idle" || this.state === "thinking") return [];

    // Learn the room: drop to a new quiet floor quickly, rise very slowly, so
    // speech can never train the floor up to its own level.
    if (level < this.noiseFloor) this.noiseFloor = this.noiseFloor * 0.7 + level * 0.3;
    else this.noiseFloor = Math.min(0.25, this.noiseFloor * 0.995 + level * 0.005);

    if (this.state === "speaking") {
      // Her own voice comes back through the loudspeaker; only speech clearly
      // above what she is producing counts as talking over her.
      const overSelf = (sample.selfLevel ?? 0) * this.tuning.bargeOverSelf;
      const threshold = Math.max(this.tuning.bargeLevel, this.speechThreshold(), overSelf);
      if (level >= threshold) {
        this.overSince ??= now;
        if (now - this.overSince >= this.tuning.bargeMs) {
          this.state = "interrupted";
          this.resetTurn();
          // The interruption itself is the start of their next turn.
          this.speechStart = now;
          return [{ kind: "cut" }];
        }
      } else {
        this.overSince = null;
      }
      return [];
    }

    // Listening, waiting, or just interrupted: build the turn.
    const heard = sample.transcript.trim();

    if (level >= this.speechThreshold()) {
      this.speechStart ??= now;
      this.spokenMs += elapsed;
      this.quietSince = null;
      if (this.state !== "listening") this.state = "listening";
      return this.overrunTurn(now, heard);
    }

    if (level <= this.silenceThreshold()) {
      if (this.speechStart === null) return [];
      this.quietSince ??= now;
      const quietFor = now - this.quietSince;
      // A noisy room needs the full pause; a quiet, settled one can be quicker.
      const pause = this.noiseFloor > 0.08 ? this.tuning.endOfTurnMs : this.pauseMs;
      const ready = quietFor >= pause && this.spokenMs >= this.tuning.minSpeechMs;
      // Never close on the timer alone while the last words are still coming.
      const stillListening = (sample.finalPending ?? false) && quietFor < this.tuning.finalWaitMs;
      if (ready && !stillListening && heard.length > 0) {
        // One last look before she answers, so she never steps on a last syllable.
        this.pendingSince ??= now;
        if (now - this.pendingSince >= this.tuning.graceMs) return this.closeTurn(heard);
        return [];
      }
      return this.overrunTurn(now, heard);
    }

    // Between the two thresholds: a breath, not the end of a sentence.
    return this.overrunTurn(now, heard);
  }

  /** A turn that has run far too long closes on whatever was heard. */
  private overrunTurn(now: number, heard: string): VoiceEffect[] {
    if (this.speechStart === null || heard.length === 0) return [];
    if (now - this.speechStart < this.tuning.maxTurnMs) return [];
    return this.closeTurn(heard);
  }

  private closeTurn(heard: string): VoiceEffect[] {
    // A short "mm-hm" straight after she finished is agreement, not a question.
    if (this.justSpoke && isAcknowledgement(heard)) {
      this.state = "waiting";
      this.resetTurn();
      return [];
    }
    // She learns their rhythm: each clean turn shortens the pause a little.
    this.pauseMs = Math.max(this.tuning.minEndOfTurnMs, this.pauseMs - this.tuning.rhythmStepMs);
    this.justSpoke = false;
    this.state = "thinking";
    this.resetTurn();
    return [{ kind: "turn", text: heard }];
  }
}

/** Plain words for the status line beside her name. */
export function describeVoiceState(state: VoiceState): string {
  switch (state) {
    case "listening":
      return "Listening…";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking…";
    case "interrupted":
      return "Go ahead…";
    case "waiting":
      return "Go ahead — I'm listening";
    default:
      return "Voice off";
  }
}

/**
 * Her reply, cut into sentences so each one can be spoken while the rest is
 * still being written. Returns whole sentences plus whatever is left over.
 */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;
  const pattern = /^[\s\S]*?[.!?…](\s|$)/;
  while (rest.trim().length > 0) {
    const match = pattern.exec(rest);
    if (!match) break;
    const piece = match[0].trim();
    if (piece.length < 2) break;
    sentences.push(piece);
    rest = rest.slice(match[0].length);
  }
  return { sentences, rest };
}
