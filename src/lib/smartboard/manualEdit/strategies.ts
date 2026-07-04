// Manual AI Edit — strategy ladders. Each root cause maps to an ordered
// list of tactics. The operator tries them in order until Verify passes.
//
// The heavy-hitting invasive tactics (synthetic DOM click, side-door
// writes, force repaint, rebuild ownership) live in ./pipelineTactics
// and are appended to every non-empty ladder so any repair run has
// enough moves to actually land the change on the Smartboard.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, RootCause } from "./types";
import * as G from "./gestures";
import { pipelineLadderFor } from "./pipelineTactics";

export interface Tactic {
  name: string;
  run: (ctrl: PresentationController, target: EditTarget) => Promise<void>;
}

const lineIdxOf = (t: EditTarget) =>
  typeof t.lineIdx === "number" ? t.lineIdx : -1;

const fillerIdxOf = (t: EditTarget) =>
  typeof t.fillerIdx === "number" ? t.fillerIdx : 0;

const notesTactics: Tactic[] = [
  {
    name: "Replay note click",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      const raw = (ctrl.getActiveGuidedLines()[li]?.notebook ?? "").trim();
      if (raw) await G.clickNote(ctrl, li, raw);
    },
  },
  {
    name: "Erase then rewrite note",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      ctrl.eraseNoteAt?.(li);
      const raw = (ctrl.getActiveGuidedLines()[li]?.notebook ?? "").trim();
      if (raw) await G.clickNote(ctrl, li, raw);
    },
  },
  {
    name: "Scroll then rewrite note",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      await G.scrollIntoView(ctrl, li);
      await G.resetActiveLine(ctrl, li);
      const raw = (ctrl.getActiveGuidedLines()[li]?.notebook ?? "").trim();
      if (raw) await G.clickNote(ctrl, li, raw);
    },
  },
];

const chipTactics: Tactic[] = [
  {
    name: "Open # panel and pick chip",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      await G.clickHash(ctrl, li);
      await G.pickChip(ctrl, li, fillerIdxOf(t));
    },
  },
  {
    name: "Erase row, replay chips up to k",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      const k = fillerIdxOf(t);
      await G.eraseLineRow(ctrl, li);
      ctrl.moveSensorToSafeRow?.(li);
      await G.clickHash(ctrl, li);
      for (let i = 0; i <= k; i++) await G.pickChip(ctrl, li, i);
      ctrl.closeFloatingPanel?.();
    },
  },
  {
    name: "Fallback: writeEquationPrefix",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      ctrl.writeEquationPrefix(li, fillerIdxOf(t) + 1);
    },
  },
];

const lineTactics: Tactic[] = [
  {
    name: "Rewrite line from scratch",
    run: async (ctrl, t) => G.retryLineFromScratch(ctrl, lineIdxOf(t)),
  },
  {
    name: "Scroll + reset active line + rewrite",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      await G.scrollIntoView(ctrl, li);
      await G.resetActiveLine(ctrl, li);
      await G.retryLineFromScratch(ctrl, li);
    },
  },
];

const overlapTactics: Tactic[] = [
  {
    name: "Move sensor to safe row",
    run: async (ctrl, t) => {
      ctrl.moveSensorToSafeRow?.(lineIdxOf(t));
    },
  },
  {
    name: "Drop one extra row (fraction clearance)",
    run: async (ctrl, t) => {
      ctrl.moveSensorDown?.(1);
      ctrl.moveSensorToSafeRow?.(lineIdxOf(t));
    },
  },
  {
    name: "Erase row and replay",
    run: async (ctrl, t) => G.retryLineFromScratch(ctrl, lineIdxOf(t)),
  },
];

const viewportTactics: Tactic[] = [
  {
    name: "Scroll board to target",
    run: async (ctrl, t) => G.scrollIntoView(ctrl, lineIdxOf(t)),
  },
  {
    name: "Scroll preview card into view",
    run: async (ctrl, t) => {
      const el = ctrl.getPreviewCardEl?.(t.beatId);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
  },
];

const activeLineTactics: Tactic[] = [
  {
    name: "Reset active line then replay",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      await G.resetActiveLine(ctrl, li);
      if (t.kind === "teacher-note") {
        const raw = (ctrl.getActiveGuidedLines()[li]?.notebook ?? "").trim();
        if (raw) await G.clickNote(ctrl, li, raw);
      } else {
        await G.retryLineFromScratch(ctrl, li);
      }
    },
  },
];

const syncTactics: Tactic[] = [
  {
    name: "Reset beat cursor and active line",
    run: async (ctrl, t) => {
      await G.resetBeatCursor(ctrl, t.beatId);
      const li = lineIdxOf(t);
      if (li >= 0) await G.resetActiveLine(ctrl, li);
    },
  },
  {
    name: "Rewrite line",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      if (li >= 0) await G.retryLineFromScratch(ctrl, li);
    },
  },
];

const panelTactics: Tactic[] = [
  {
    name: "Close then reopen # panel",
    run: async (ctrl, t) => {
      ctrl.closeFloatingPanel?.();
      await G.clickHash(ctrl, lineIdxOf(t));
    },
  },
  {
    name: "Safe row then reopen # panel",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      ctrl.moveSensorToSafeRow?.(li);
      await G.clickHash(ctrl, li);
    },
  },
  {
    name: "Erase row and reopen # panel",
    run: async (ctrl, t) => {
      const li = lineIdxOf(t);
      await G.eraseLineRow(ctrl, li);
      await G.clickHash(ctrl, li);
    },
  },
];

export const strategyFor = (cause: RootCause, target: EditTarget): Tactic[] => {
  switch (cause) {
    case "click-not-fired":
      return target.kind === "teacher-note" ? notesTactics : lineTactics;
    case "panel-did-not-open":
      return panelTactics;
    case "chip-not-registered":
      return chipTactics;
    case "render-empty":
      return target.kind === "teacher-note" ? notesTactics : lineTactics;
    case "sync-lost":
    case "queue-missed":
      return syncTactics.concat(lineTactics);
    case "mapping-missing":
      return [];
    case "wrong-layer":
      return lineTactics;
    case "blocked-by-overlap":
      return overlapTactics;
    case "outside-viewport":
      return viewportTactics;
    case "active-line-drift":
      return activeLineTactics;
    case "structural":
    case "none":
    default:
      return [];
  }
};
