// Auto-rectify ladder — when a mirrored item does not appear on the
// Smartboard, walk a fixed 4-step repair sequence, re-verifying after
// each step, until the item shows. The teacher sees each step as a
// live badge on the clicked preview item.
//
//   Step 1 — Retry: wait for state to settle, re-apply the same mirror.
//   Step 2 — Force section: explicitly re-set the beat cursor, wait for
//            the correct reservoir, re-apply.
//   Step 3 — Direct write: bypass all lookups and write the preview's
//            own captured text straight onto the board.
//   Step 4 — Ink clear + full rewrite: clear ink, restore every earlier
//            line (floating numbers as-is, then notes), direct-write
//            the item again.
//
// Additionally, BEFORE mirroring the clicked item, every EARLIER line
// of the same section is checked and any missing content is forced
// onto the board: floating numbers first (written exactly as they are,
// never solved), then the teacher note. The Presenter Preview is the
// source of truth, so once an item verifies ✓ it is on the board and
// playback can count on it.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult, MirrorUiStatus } from "./types";
import {
  applyMirror,
  clearInk,
  directWrite,
  li,
  resolveBeatIdx,
  verifyMirror,
  wait,
  waitForBeat,
} from "./mirror";

const TOTAL_STEPS = 4;

export type MirrorProgress = Omit<MirrorUiStatus, "key">;

/** Kinds that live inside a solution section and have "earlier lines". */
const LINE_SCOPED: ReadonlySet<string> = new Set([
  "solution-line",
  "floating-number",
  "teacher-note",
]);

/**
 * Walk every line BEFORE the clicked one and force any missing content
 * onto the board: floating numbers first (as-is, unsolved), then the
 * teacher note. Additive — lines already on the board are untouched.
 */
export const ensurePriorLines = async (
  target: EditTarget,
  ctrl: PresentationController,
  onProgress?: (p: MirrorProgress) => void,
): Promise<void> => {
  if (!LINE_SCOPED.has(target.kind)) return;
  const idx = li(target);
  if (idx <= 0) return;

  const lines = ctrl.getActiveGuidedLines();
  for (let i = 0; i < idx && i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // 1) The line's own content — floating numbers written exactly as
    //    they are (never solved), or the plain equation.
    const fillers = line.fillers ?? [];
    const eq = (line.equation ?? "").trim();
    const hasRow =
      !!ctrl.getBoardRowSignatureFor(i) ||
      (!!eq && (ctrl.boardHasTextRow?.(eq) ?? false));
    if (!hasRow && (fillers.length > 0 || eq)) {
      onProgress?.({ phase: "applying", label: `Restoring line ${i + 1}…` });
      ctrl.setActiveLineIdx(i);
      ctrl.moveSensorToSafeRow?.(i);
      if (fillers.length > 0) ctrl.writeEquationPrefix(i, fillers.length);
      else if (eq) ctrl.writeProseLineOnBoard(eq);
      await wait(90);
    }

    // 2) The line's teacher note.
    const note = (line.notebook ?? "").trim();
    if (note && ctrl.boardHasTextRow && !ctrl.boardHasTextRow(note)) {
      onProgress?.({ phase: "applying", label: `Restoring note ${i + 1}…` });
      ctrl.setActiveLineIdx(i);
      ctrl.eraseNoteAt?.(i);
      ctrl.moveSensorToSafeRow?.(i);
      ctrl.writeProseLineOnBoard(note);
      ctrl.markNotebookShown(i);
      await wait(90);
    }
  }
  ctrl.setActiveLineIdx(idx);
};

/** Verify after a DIRECT write — success = the preview's exact text is on the board. */
const verifyDirect = (target: EditTarget, ctrl: PresentationController): MirrorResult => {
  const label = target.caption || target.kind;
  if (target.kind === "floating-number") {
    const open = ctrl.isFloatingPanelOpen?.() ?? true;
    return open
      ? { ok: true, message: `✓ Floating Number panel is open` }
      : { ok: false, message: `✗ Panel did not open`, detail: `Line ${li(target) + 1}` };
  }
  const text = (target.text ?? target.caption ?? "").trim();
  if (!text) return { ok: true, message: `✓ Mirrored: ${label}` };
  if (!ctrl.boardHasTextRow) return verifyMirror(target, ctrl);
  return ctrl.boardHasTextRow(text)
    ? { ok: true, message: `✓ Shown on the board` }
    : { ok: false, message: `✗ Still not on the board`, detail: `Direct write produced no matching ink.` };
};

/**
 * Mirror the target and, if it does not appear, run the 4-step
 * auto-rectify ladder. `onProgress` receives live status updates for
 * the inline badge.
 */
export const runMirrorWithAutofix = async (
  target: EditTarget,
  ctrl: PresentationController,
  onProgress?: (p: MirrorProgress) => void,
): Promise<MirrorResult> => {
  onProgress?.({ phase: "applying", label: "Mirroring…" });

  // Point at the right section, then make sure every EARLIER line of
  // this section is already on the board (floating numbers, notes).
  const settled = await waitForBeat(target, ctrl);
  if (!settled && LINE_SCOPED.has(target.kind)) {
    // The section could not be located AND settled — writing now would
    // land on the wrong surface and falsely verify. Fail loudly.
    if (resolveBeatIdx(target, ctrl) < 0) {
      const failed: MirrorResult = {
        ok: false,
        message: "✗ Section not found on the board.",
        detail: "The board and preview are out of sync — reopen the Smartboard.",
      };
      onProgress?.({ phase: "failed", label: failed.message, detail: failed.detail });
      return failed;
    }
  }
  await ensurePriorLines(target, ctrl, onProgress);

  // Initial 1:1 mirror of the clicked item.
  onProgress?.({ phase: "applying", label: "Mirroring…" });
  await applyMirror(target, ctrl);
  await wait(140);
  let r = verifyMirror(target, ctrl);
  if (r.ok) {
    onProgress?.({ phase: "ok", label: r.message });
    return r;
  }

  // ── Step 1: retry after letting state settle ─────────────────────
  onProgress?.({
    phase: "fixing",
    step: 1,
    totalSteps: TOTAL_STEPS,
    label: "Fixing… step 1/4 — retrying mirror",
  });
  await wait(300);
  await applyMirror(target, ctrl);
  await wait(180);
  r = verifyMirror(target, ctrl);
  if (r.ok) {
    onProgress?.({ phase: "ok", label: `${r.message} (fixed on step 1)` });
    return { ...r, message: `${r.message} (fixed on step 1)` };
  }

  // ── Step 2: force the section/beat, then re-apply ────────────────
  onProgress?.({
    phase: "fixing",
    step: 2,
    totalSteps: TOTAL_STEPS,
    label: "Fixing… step 2/4 — forcing section",
  });
  const beatIdx = ctrl.beats.findIndex((b) => b.id === target.beatId);
  if (beatIdx >= 0) ctrl.setBeatCursor(beatIdx);
  await wait(350);
  await waitForBeat(target, ctrl);
  await applyMirror(target, ctrl);
  await wait(180);
  r = verifyMirror(target, ctrl);
  if (r.ok) {
    onProgress?.({ phase: "ok", label: `${r.message} (fixed on step 2)` });
    return { ...r, message: `${r.message} (fixed on step 2)` };
  }

  // ── Step 3: direct write of the preview's captured text ──────────
  onProgress?.({
    phase: "fixing",
    step: 3,
    totalSteps: TOTAL_STEPS,
    label: "Fixing… step 3/4 — writing preview text directly",
  });
  directWrite(target, ctrl);
  await wait(200);
  r = verifyDirect(target, ctrl);
  if (r.ok) {
    onProgress?.({ phase: "ok", label: `${r.message} (fixed on step 3)` });
    return { ...r, message: `${r.message} (fixed on step 3)` };
  }

  // ── Step 4: ink clear + full section rewrite from preview text ───
  onProgress?.({
    phase: "fixing",
    step: 4,
    totalSteps: TOTAL_STEPS,
    label: "Fixing… step 4/4 — clearing ink and rewriting",
  });
  clearInk(ctrl);
  await wait(160);
  await ensurePriorLines(target, ctrl, onProgress);
  directWrite(target, ctrl);
  await wait(220);
  r = verifyDirect(target, ctrl);
  if (r.ok) {
    onProgress?.({ phase: "ok", label: `${r.message} (fixed on step 4)` });
    return { ...r, message: `${r.message} (fixed on step 4)` };
  }

  const failed: MirrorResult = {
    ok: false,
    message: r.message || "✗ Could not display this item.",
    detail: r.detail,
  };
  onProgress?.({ phase: "failed", label: failed.message, detail: failed.detail });
  return failed;
};
