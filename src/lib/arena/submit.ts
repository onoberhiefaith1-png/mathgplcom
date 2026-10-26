/**
 * Timer Arena — getting a finished question to the server, reliably.
 *
 * The old path was fire-and-forget: a lost `start`, a slow marking write, a
 * dropped connection or a closed group all ended in a silent `.catch(() => {})`
 * and the student never saw why their time was missing. This module keeps the
 * retry rules pure (injected post/sleep/emit) so they can be tested, and keeps
 * unsent results in an outbox so a refresh or a reconnect can finish the job.
 */

export class ArenaApiError extends Error {
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "ArenaApiError";
    this.status = status;
  }
}

/** Server answers that retrying can never fix. */
const DEFINITIVE = new Set([
  "closed",
  "not_joined",
  "not_in_session",
  "bad_request",
  "not_found",
  "no_open_attempt",
]);

export const isDefinitiveError = (e: unknown): boolean =>
  e instanceof ArenaApiError &&
  (DEFINITIVE.has(e.message) ||
    (e.status >= 400 &&
      e.status < 500 &&
      e.status !== 408 &&
      e.status !== 429));

export const FRIENDLY: Record<string, string> = {
  closed: "Your teacher has closed this group, so this time can't be added.",
  not_joined:
    "You haven't joined this group on this device. Open your teacher's group link again.",
  not_in_session: "This question isn't part of the group's Session.",
  not_found: "This group link is no longer valid.",
  bad_request: "That result could not be read by the Arena.",
  no_open_attempt: "The Arena never saw this attempt begin.",
};

export type SubmitState = "sending" | "waiting" | "saved" | "failed";
export type SubmitEvent = {
  assessmentId: string;
  state: SubmitState;
  message?: string;
  retryable?: boolean;
  counted?: boolean;
  newBest?: boolean;
  ms?: number;
  /** 1-based send number, for tests and the status line. */
  attempt: number;
};

export type SubmitDeps = {
  post: (
    code: string,
    body: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  sleep: (ms: number) => Promise<void>;
  emit: (e: SubmitEvent) => void;
};

export type CompletionArgs = {
  code: string;
  token: string;
  assessmentId: string;
  questionId: string;
  elapsedMs: number;
};

/** Waits between sends: marking can land a few seconds after the board's tick. */
export const COMPLETE_BACKOFF_MS = [
  1200, 2000, 3000, 4500, 6500, 9000,
] as const;
export const START_BACKOFF_MS = [800, 1600, 3200] as const;

/** Send a finished question until the server counts it or gives a final answer. */
export async function recordCompletion(
  deps: SubmitDeps,
  a: CompletionArgs,
): Promise<SubmitEvent> {
  const max = COMPLETE_BACKOFF_MS.length + 1;
  let last: SubmitEvent = {
    assessmentId: a.assessmentId,
    state: "sending",
    attempt: 0,
  };
  for (let n = 1; n <= max; n++) {
    deps.emit({
      assessmentId: a.assessmentId,
      state:
        n === 1 ? "sending" : last.state === "waiting" ? "waiting" : "sending",
      attempt: n,
    });
    try {
      const r = await deps.post(a.code, {
        action: "complete",
        token: a.token,
        assessmentId: a.assessmentId,
        questionId: a.questionId,
        elapsedMs: a.elapsedMs,
      });
      if (r["pending"]) {
        last = {
          assessmentId: a.assessmentId,
          state: "waiting",
          attempt: n,
          message: "Checking your answer with the Arena…",
        };
        deps.emit(last);
      } else {
        const done: SubmitEvent = {
          assessmentId: a.assessmentId,
          state: "saved",
          attempt: n,
          counted: r["counted"] === true,
          newBest: r["newBest"] === true,
          ms: typeof r["ms"] === "number" ? (r["ms"] as number) : undefined,
        };
        deps.emit(done);
        return done;
      }
    } catch (e) {
      if (isDefinitiveError(e)) {
        const code = (e as Error).message;
        const failed: SubmitEvent = {
          assessmentId: a.assessmentId,
          state: "failed",
          attempt: n,
          retryable: false,
          message: FRIENDLY[code] ?? "The Arena could not save this time.",
        };
        deps.emit(failed);
        return failed;
      }
      last = {
        assessmentId: a.assessmentId,
        state: "sending",
        attempt: n,
        message: "Connection problem — trying again…",
      };
      deps.emit(last);
    }
    if (n < max) await deps.sleep(COMPLETE_BACKOFF_MS[n - 1]!);
  }
  const failed: SubmitEvent = {
    assessmentId: a.assessmentId,
    state: "failed",
    attempt: max,
    retryable: true,
    message:
      last.state === "waiting"
        ? "Your answer is correct, but the Arena couldn't confirm it yet. Tap Retry."
        : "Your time couldn't reach the Arena. Check your connection and tap Retry.",
  };
  deps.emit(failed);
  return failed;
}

/** Tell the server the attempt began; retried quietly, never blocks the board. */
export async function recordStart(
  deps: Pick<SubmitDeps, "post" | "sleep">,
  a: { code: string; token: string; assessmentId: string; questionId: string },
): Promise<boolean> {
  for (let n = 0; n <= START_BACKOFF_MS.length; n++) {
    try {
      await deps.post(a.code, {
        action: "start",
        token: a.token,
        assessmentId: a.assessmentId,
        questionId: a.questionId,
      });
      return true;
    } catch (e) {
      if (isDefinitiveError(e)) return false;
      if (n < START_BACKOFF_MS.length) await deps.sleep(START_BACKOFF_MS[n]!);
    }
  }
  return false;
}

/* ── Outbox: results that could not be delivered yet ─────────────────────── */

export type OutboxItem = CompletionArgs & { queuedAt: number };
type KV = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
};
const OUTBOX_KEY = "mathgpl.arena.outbox.v1";
export const OUTBOX_MAX = 20;
export const OUTBOX_TTL_MS = 6 * 60 * 60 * 1000;

export function readOutbox(store: KV, now = Date.now()): OutboxItem[] {
  try {
    const raw = JSON.parse(store.getItem(OUTBOX_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is OutboxItem =>
        !!x &&
        typeof x.code === "string" &&
        typeof x.token === "string" &&
        typeof x.assessmentId === "string" &&
        typeof x.questionId === "string" &&
        typeof x.elapsedMs === "number" &&
        typeof x.queuedAt === "number" &&
        now - x.queuedAt < OUTBOX_TTL_MS,
    );
  } catch {
    return [];
  }
}

const writeOutbox = (store: KV, items: OutboxItem[]) => {
  try {
    store.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-OUTBOX_MAX)));
  } catch {
    /* private mode */
  }
};

/** One pending result per question: a newer one replaces an older one. */
export function enqueueOutbox(
  store: KV,
  item: CompletionArgs,
  now = Date.now(),
): void {
  const rest = readOutbox(store, now).filter(
    (x) =>
      !(
        x.code === item.code &&
        x.token === item.token &&
        x.assessmentId === item.assessmentId
      ),
  );
  writeOutbox(store, [...rest, { ...item, queuedAt: now }]);
}

export function dropOutbox(
  store: KV,
  item: Pick<CompletionArgs, "code" | "token" | "assessmentId">,
): void {
  writeOutbox(
    store,
    readOutbox(store).filter(
      (x) =>
        !(
          x.code === item.code &&
          x.token === item.token &&
          x.assessmentId === item.assessmentId
        ),
    ),
  );
}
