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
  // Aura's everyday brain: $0.05 / million in, $0.40 / million out.
  "openai/gpt-5-nano": { input: 0.05 / 1_000_000, output: 0.4 / 1_000_000 },
  // The heavy reasoning engine, kept for mathematics work only.
  "openai/gpt-6-astra": { input: 1.25 / 1_000_000, output: 10 / 1_000_000 },
};

export type TurnUsage = { input: number; output: number; pence: number };

export function turnCost(model: string, input: number, output: number): TurnUsage {
  const rate = MODEL_RATES[model] ?? MODEL_RATES["openai/gpt-5-nano"]!;
  const usd = input * rate.input + output * rate.output;
  return {
    input: Math.max(0, Math.round(input)),
    output: Math.max(0, Math.round(output)),
    pence: Math.max(0, usd * USD_TO_PENCE),
  };
}

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

export function recordSpend(pence: number, now = new Date()): DaySpend {
  const current = readSpend(now);
  const next: DaySpend = {
    day: current.day,
    pence: current.pence + Math.max(0, pence),
    turns: current.turns + 1,
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
  if (spendCeilingReached(spend)) {
    return `Today's Aura allowance is used up (${formatPence(spend.pence)}). She can still talk; bigger jobs resume tomorrow.`;
  }
  return `Aura today: ${formatPence(spend.pence)} across ${spend.turns} turn${spend.turns === 1 ? "" : "s"}.`;
}
