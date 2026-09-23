// What a turn actually costs, in plain money.
//
// Client-safe and pure. The rates below are the gateway's published prices for
// the models Aura uses, in US dollars per token. They are turned into pence so a
// teacher can see the real figure instead of an abstract "credit".

/** Rounded conversion used only for display; labelled as approximate in the UI. */
export const USD_TO_PENCE = 79;

export type ModelRate = { input: number; output: number };

/** US dollars per token. */
export const MODEL_RATES: Record<string, ModelRate> = {
  // Aura's everyday brain: $0.30 / million in, $2.50 / million out.
  "google/gemini-2.5-flash": { input: 0.3 / 1_000_000, output: 2.5 / 1_000_000 },
  // The fast front of her voice: $0.10 / million in, $0.40 / million out.
  "google/gemini-2.5-flash-lite": { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
  "openai/gpt-5-nano": { input: 0.05 / 1_000_000, output: 0.4 / 1_000_000 },
  // The heavy reasoning engine, kept for mathematics work only.
  "openai/gpt-6-astra": { input: 1.25 / 1_000_000, output: 10 / 1_000_000 },
};

export type TurnUsage = { input: number; output: number; pence: number };

export function turnCost(model: string, input: number, output: number): TurnUsage {
  const rate = MODEL_RATES[model] ?? MODEL_RATES["google/gemini-2.5-flash"]!;
  const usd = input * rate.input + output * rate.output;
  return {
    input: Math.max(0, Math.round(input)),
    output: Math.max(0, Math.round(output)),
    pence: Math.max(0, usd * USD_TO_PENCE),
  };
}

// ------------------------------------------------------------------ her voice
//
// Speech is billed by the sound produced, so it is measured from the audio that
// was actually played. Gemini TTS bills audio output at $10 per million audio
// tokens, and a second of speech is about 25 of those tokens — the figure is
// therefore close but, unlike the text figures, not exact.
export const TTS_USD_PER_SECOND = (10 / 1_000_000) * 25;

/** The cost of sound she has actually made, in pence. */
export function audioCost(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * TTS_USD_PER_SECOND * USD_TO_PENCE;
}

// ---------------------------------------------------------------- credits view
//
// A credit is the unit the teacher's account is kept in. One credit is 30p, so
// every measured cost can be shown the same way Lovable shows it per message.
export const CREDIT_PENCE = 30;

export const creditsOf = (pence: number): number =>
  Math.max(0, pence) / CREDIT_PENCE;

/**
 * "0.00042" — a tiny turn must never round away to nothing, and a free turn is
 * plainly "0.0" rather than a misleading small number.
 */
export function formatCredits(credits: number): string {
  if (!Number.isFinite(credits) || credits <= 0) return "0.0";
  if (credits < 0.00001) return "<0.00001";
  if (credits < 1) return credits.toFixed(5).replace(/0+$/, "").replace(/\.$/, ".0");
  return credits.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
}

/** The line under a finished reply: what that one completion cost. */
export const describeTurnCredits = (pence: number): string =>
  `${formatCredits(creditsOf(pence))} credits`;

/** "0.04p" — small amounts stay readable instead of rounding to zero. */
export function formatPence(pence: number): string {
  if (pence <= 0) return "0p";
  if (pence < 0.01) return "<0.01p";
  if (pence < 1) return `${pence.toFixed(2)}p`;
  if (pence < 100) return `${pence.toFixed(1)}p`;
  return `£${(pence / 100).toFixed(2)}`;
}


// ---------------------------------------------------------------- daily ledger

const SPEND_KEY = "mathgpl:aura:spend";
/** A single teacher account cannot spend more than this on Aura in one day. */
export const DAILY_PENCE_CEILING = 30;

export type DaySpend = { day: string; pence: number; turns: number };

const day = (now = new Date()) => now.toISOString().slice(0, 10);

export function readSpend(now = new Date()): DaySpend {
  const fresh = { day: day(now), pence: 0, turns: 0 };
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.localStorage.getItem(SPEND_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<DaySpend>;
    if (parsed?.day !== fresh.day || typeof parsed.pence !== "number") return fresh;
    return {
      day: fresh.day,
      pence: Math.max(0, parsed.pence),
      turns: Math.max(0, Math.floor(parsed.turns ?? 0)),
    };
  } catch {
    return fresh;
  }
}

export function recordSpend(pence: number, now = new Date(), countTurn = true): DaySpend {
  const current = readSpend(now);
  const next: DaySpend = {
    day: current.day,
    pence: current.pence + Math.max(0, pence),
    turns: current.turns + (countTurn ? 1 : 0),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SPEND_KEY, JSON.stringify(next));
    } catch {
      /* a blocked store only means the figure restarts */
    }
  }
  return next;
}

export const spendCeilingReached = (spend: DaySpend): boolean =>
  spend.pence >= DAILY_PENCE_CEILING;

/** The teacher-only line: today's real cost, and a word when it is used up. */
export function describeSpend(spend: DaySpend): string {
  const money = `${formatCredits(creditsOf(spend.pence))} credits (${formatPence(spend.pence)})`;
  if (spendCeilingReached(spend)) {
    return `Today's Aura allowance is used up — ${money}. She can still talk; bigger jobs resume tomorrow.`;
  }
  return `Aura today: ${money} across ${spend.turns} turn${spend.turns === 1 ? "" : "s"}.`;
}

