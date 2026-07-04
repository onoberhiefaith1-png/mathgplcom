// Manual AI Edit — the autonomous Smartboard Operator loop.
//
//   diagnose → reproduce → observe → root-cause → repair → verify
//
// The operator acts on the Smartboard the same way a teacher would:
// clicking notes, opening the # panel, picking chips, erasing rows,
// scrolling. It uses probes (read-only) to test whether the board
// matches the Presenter Preview, chooses a tactic ladder from the
// root cause, and retries until the verify probe passes or the
// ladder is exhausted.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type {
  EditIntent,
  EditReport,
  EditTarget,
  OperatorEvent,
  RootCause,
} from "./types";
import {
  probeActiveLine,
  probeFloating,
  probeLine,
  probeNote,
  probeScroll,
} from "./probes";
import { diagnose } from "./rootCause";
import { strategyFor } from "./strategies";
import * as G from "./gestures";

const MAX_TACTICS = 10;

export interface OperatorOptions {
  intent?: EditIntent;
  forcedCause?: RootCause;
  onEvent?: (e: OperatorEvent) => void;
}

const now = () =>
  (typeof performance !== "undefined" ? performance.now() : Date.now());

const verify = (
  ctrl: PresentationController,
  target: EditTarget,
): { ok: boolean; detail: string } => {
  const li = typeof target.lineIdx === "number" ? target.lineIdx : -1;
  switch (target.kind) {
    case "teacher-note": {
      if (li < 0) return { ok: false, detail: "No line index." };
      const n = probeNote(ctrl, li);
      if (!n.inPreview) return { ok: true, detail: "No note in Preview — nothing to verify." };
      return { ok: n.onBoard, detail: n.onBoard ? "Note on board." : "Note still missing." };
    }
    case "floating-number": {
      if (li < 0) return { ok: false, detail: "No line index." };
      const f = probeFloating(ctrl, li, target.fillerIdx ?? 0);
      return { ok: f.matches, detail: f.matches ? "Chip landed." : "Chip missing." };
    }
    case "solution-line":
    case "question":
    case "math-structure": {
      if (li < 0) return { ok: false, detail: "No line index." };
      const l = probeLine(ctrl, li);
      return { ok: l.matches, detail: l.matches ? "Line matches Preview." : "Line still differs." };
    }
    default: {
      const s = probeScroll(ctrl, target);
      return { ok: s.inView, detail: s.inView ? "In view." : "Off screen." };
    }
  }
};

/** Run the autonomous operator against a selection. */
export const runOperator = async (
  target: EditTarget,
  ctrl: PresentationController,
  opts: OperatorOptions = {},
): Promise<EditReport> => {
  const events: OperatorEvent[] = [];
  const push = (e: OperatorEvent) => {
    events.push(e);
    opts.onEvent?.(e);
  };
  const step = async <T,>(
    phase: OperatorEvent["phase"],
    label: string,
    fn: () => Promise<T> | T,
    detail?: string,
  ): Promise<T> => {
    const t0 = now();
    try {
      const v = await fn();
      push({ phase, label, ok: true, detail, tookMs: Math.round(now() - t0) });
      return v;
    } catch (err) {
      push({
        phase,
        label,
        ok: false,
        detail: (err as Error).message || detail,
        tookMs: Math.round(now() - t0),
      });
      throw err;
    }
  };

  // Align cursor with target's beat before anything else.
  try {
    await step("diagnose", "Sync beat cursor", () =>
      G.resetBeatCursor(ctrl, target.beatId),
    );
  } catch {
    /* non-fatal */
  }

  // Phase 1 — Diagnose (probes only).
  const initialCheck = verify(ctrl, target);
  push({
    phase: "diagnose",
    label: "Initial verification",
    ok: initialCheck.ok,
    detail: initialCheck.detail,
  });
  if (initialCheck.ok && !opts.forcedCause) {
    return {
      ok: true,
      intent: opts.intent ?? "unknown",
      rootCause: "none",
      message: "Board already matches the Presenter Preview.",
      actions: [],
      events,
    };
  }

  // Phase 2 — root cause (may be forced by a Quick Suggestion).
  const diag = opts.forcedCause
    ? { cause: opts.forcedCause, detail: "Forced by workflow." }
    : diagnose(ctrl, target);
  push({
    phase: "root-cause",
    label: `Root cause: ${diag.cause}`,
    ok: diag.cause !== "structural" && diag.cause !== "mapping-missing",
    detail: diag.detail,
  });

  if (diag.cause === "none") {
    return {
      ok: true,
      intent: opts.intent ?? "unknown",
      rootCause: "none",
      message: "Nothing to repair.",
      actions: [],
      events,
    };
  }

  if (diag.cause === "structural" || diag.cause === "mapping-missing") {
    return {
      ok: false,
      intent: opts.intent ?? "unknown",
      rootCause: diag.cause,
      message: "Cannot repair automatically — this is a structural application issue.",
      actions: [],
      events,
      escalate: {
        reason:
          diag.cause === "structural"
            ? "The Presenter Preview contains the item but the Smartboard pipeline never registers it."
            : "The selected target cannot be mapped to a Smartboard address.",
        trail: events,
      },
    };
  }

  // Phase 3 — try tactics in order until Verify passes.
  const ladder = strategyFor(diag.cause, target).slice(0, MAX_TACTICS);
  if (ladder.length === 0) {
    return {
      ok: false,
      intent: opts.intent ?? "unknown",
      rootCause: diag.cause,
      message: "No repair tactic available for this root cause.",
      actions: [],
      events,
    };
  }

  let lastMessage = "No tactic succeeded.";
  for (let i = 0; i < ladder.length; i++) {
    const tac = ladder[i];
    try {
      await step("repair", `Tactic ${i + 1}: ${tac.name}`, () => tac.run(ctrl, target));
    } catch (err) {
      lastMessage = (err as Error).message || lastMessage;
      continue;
    }
    const v = verify(ctrl, target);
    push({
      phase: "verify",
      label: `Verify after: ${tac.name}`,
      ok: v.ok,
      detail: v.detail,
    });
    if (v.ok) {
      return {
        ok: true,
        intent: opts.intent ?? "unknown",
        rootCause: diag.cause,
        message: `Repaired via: ${tac.name}.`,
        actions: [],
        events,
      };
    }
    lastMessage = v.detail;
  }

  return {
    ok: false,
    intent: opts.intent ?? "unknown",
    rootCause: diag.cause,
    message: lastMessage,
    actions: [],
    events,
    escalate: {
      reason:
        "Exhausted the tactic ladder for this root cause; the issue is likely a structural application problem rather than a presentation issue.",
      trail: events,
    },
  };
};
