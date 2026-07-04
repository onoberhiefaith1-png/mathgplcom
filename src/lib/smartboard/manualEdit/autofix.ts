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
//   Step 4 — Board reset + rewrite: clear ink fully, direct-write again.
//
// The information is already in the Presenter Preview, so by step 3/4
// there is no remaining reason for it not to show.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult, MirrorUiStatus } from "./types";
import {
  applyMirror,
  clearInk,
  directWrite,
  li,
  verifyMirror,
  wait,
  waitForBeat,
} from "./mirror";

const TOTAL_STEPS = 4;

export type MirrorProgress = Omit<MirrorUiStatus, "key">;

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

  // Initial 1:1 mirror.
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

  // ── Step 4: full ink clear + rewrite from preview text ───────────
  onProgress?.({
    phase: "fixing",
    step: 4,
    totalSteps: TOTAL_STEPS,
    label: "Fixing… step 4/4 — clearing board and rewriting",
  });
  clearInk(ctrl);
  await wait(160);
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
