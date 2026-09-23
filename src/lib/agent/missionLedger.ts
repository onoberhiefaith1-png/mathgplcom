// The record Aura keeps of her own exploration of the platform.
//
// Client-safe: the training page reads it to draw the exploration map and the
// open questions, and the server reads it back to her at the start of every
// stretch of work so she picks up where she left off instead of starting over.

export type MissionQuestionStatus = "open" | "answered";

export type MissionQuestion = {
  id: string;
  text: string;
  status: MissionQuestionStatus;
  answer?: string;
};

export type MissionAreaState = "confirmed" | "uncertain" | "untouched";

export type MissionLedger = {
  /** Things she confirmed herself with a tool. */
  known: string[];
  /** Things she still does not know. */
  unknown: string[];
  /** What she actually tried. */
  tested: string[];
  /** What broke, in its own words. */
  failed: string[];
  /** Questions for the supervisor — she never waits on one. */
  questions: MissionQuestion[];
  /** Answers and instructions the supervisor gave her. */
  corrections: string[];
  /** Area of the platform → how sure she is about it. */
  map: Record<string, MissionAreaState>;
};

const CAP = 80;

export function emptyLedger(): MissionLedger {
  return { known: [], unknown: [], tested: [], failed: [], questions: [], corrections: [], map: {} };
}

function merge(existing: string[], incoming: unknown): string[] {
  if (!Array.isArray(incoming)) return existing;
  const out = [...existing];
  for (const raw of incoming) {
    if (typeof raw !== "string") continue;
    const line = raw.trim();
    if (!line) continue;
    if (!out.some((x) => x.toLowerCase() === line.toLowerCase())) out.push(line);
  }
  return out.slice(-CAP);
}

/** Drop anything she has now settled from the unknown list. */
function settle(unknown: string[], resolved: unknown): string[] {
  if (!Array.isArray(resolved)) return unknown;
  const gone = resolved
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (gone.length === 0) return unknown;
  return unknown.filter((u) => !gone.some((g) => u.toLowerCase().includes(g) || g.includes(u.toLowerCase())));
}

export type LedgerPatch = {
  known?: unknown;
  unknown?: unknown;
  tested?: unknown;
  failed?: unknown;
  resolved?: unknown;
  area?: unknown;
  state?: unknown;
};

export function applyLedgerPatch(ledger: MissionLedger, patch: LedgerPatch): MissionLedger {
  const next: MissionLedger = {
    ...ledger,
    known: merge(ledger.known, patch.known),
    tested: merge(ledger.tested, patch.tested),
    failed: merge(ledger.failed, patch.failed),
    unknown: settle(merge(ledger.unknown, patch.unknown), patch.resolved),
    map: { ...ledger.map },
    questions: [...ledger.questions],
    corrections: [...ledger.corrections],
  };

  const area = typeof patch.area === "string" ? patch.area.trim() : "";
  if (area) {
    const state = patch.state;
    next.map[area] =
      state === "confirmed" || state === "uncertain" || state === "untouched" ? state : "uncertain";
  }
  return next;
}

export function newQuestionId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function askQuestion(ledger: MissionLedger, text: string): { ledger: MissionLedger; id: string } {
  const clean = text.trim();
  const existing = ledger.questions.find((q) => q.text.toLowerCase() === clean.toLowerCase());
  if (existing) return { ledger, id: existing.id };
  const id = newQuestionId();
  return {
    ledger: {
      ...ledger,
      questions: [...ledger.questions, { id, text: clean, status: "open" as const }].slice(-CAP),
    },
    id,
  };
}

export function answerQuestion(ledger: MissionLedger, id: string, answer: string): MissionLedger {
  const clean = answer.trim();
  if (!clean) return ledger;
  return {
    ...ledger,
    questions: ledger.questions.map((q) =>
      q.id === id ? { ...q, status: "answered" as const, answer: clean } : q,
    ),
    corrections: merge(ledger.corrections, [clean]),
  };
}

export function openQuestions(ledger: MissionLedger): MissionQuestion[] {
  return ledger.questions.filter((q) => q.status === "open");
}

function list(title: string, items: string[]): string {
  if (items.length === 0) return `${title}\n- (nothing yet)`;
  return `${title}\n${items.map((i) => `- ${i}`).join("\n")}`;
}

/** The record, written out for her to read at the top of a stretch. */
export function renderLedger(ledger: MissionLedger): string {
  const areas = Object.entries(ledger.map);
  return [
    "YOUR OWN RECORD SO FAR",
    list("KNOWN — confirmed with my own tools", ledger.known),
    list("UNKNOWN — still open", ledger.unknown),
    list("TESTED — what I tried", ledger.tested),
    list("FAILED — what did not work", ledger.failed),
    list(
      "QUESTIONS I ASKED",
      ledger.questions.map((q) =>
        q.status === "answered" ? `${q.text} → answered: ${q.answer}` : `${q.text} → still unanswered`,
      ),
    ),
    list("WHAT THE SUPERVISOR TOLD ME", ledger.corrections),
    list(
      "AREAS",
      areas.map(([area, state]) => `${area}: ${state}`),
    ),
  ].join("\n\n");
}
