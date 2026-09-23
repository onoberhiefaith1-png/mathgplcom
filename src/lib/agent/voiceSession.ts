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
};

export const VOICE_TUNING: VoiceTuning = {
  speechLevel: 0.1,
  silenceLevel: 0.06,
  endOfTurnMs: 900,
  minSpeechMs: 350,
  bargeLevel: 0.22,
  bargeMs: 240,
};

export type VoiceSample = {
  now: number;
  /** Microphone loudness, 0 to 1. */
  level: number;
  /** Everything heard in this turn so far, final words and live guess. */
  transcript: string;
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

  constructor(tuning: VoiceTuning = VOICE_TUNING) {
    this.tuning = tuning;
  }

  /** Open the session: she is attentive from this moment. */
  begin(now = 0): void {
    this.state = "listening";
    this.lastNow = now;
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

    if (this.state === "speaking") {
      if (level >= this.tuning.bargeLevel) {
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
    if (level >= this.tuning.speechLevel) {
      this.speechStart ??= now;
      this.spokenMs += elapsed;
      this.quietSince = null;
      if (this.state !== "listening") this.state = "listening";
      return [];
    }

    if (level <= this.tuning.silenceLevel) {
      if (this.speechStart === null) return [];
      this.quietSince ??= now;
      const quietFor = now - this.quietSince;
      const heard = sample.transcript.trim();
      if (
        quietFor >= this.tuning.endOfTurnMs &&
        this.spokenMs >= this.tuning.minSpeechMs &&
        heard.length > 0
      ) {
        this.state = "thinking";
        this.resetTurn();
        return [{ kind: "turn", text: heard }];
      }
      return [];
    }

    // Between the two thresholds: a breath, not the end of a sentence.
    return [];
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
