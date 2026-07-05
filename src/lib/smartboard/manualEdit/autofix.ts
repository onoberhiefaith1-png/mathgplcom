// Present mode — pure second writer.
//
// One click on the Presenter Preview writes the item's text to the
// Smartboard at the current sensor position. No beat sync, no earlier-
// line restoration, no verification, no autofix ladder. The teacher's
// second keyboard, running in parallel with the Floating Number system.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult, MirrorUiStatus } from "./types";
import { applyMirror } from "./mirror";

export type MirrorProgress = Omit<MirrorUiStatus, "key">;

export const runMirrorWithAutofix = async (
  target: EditTarget,
  ctrl: PresentationController,
  onProgress?: (p: MirrorProgress) => void,
): Promise<MirrorResult> => {
  onProgress?.({ phase: "applying", label: "Writing…" });
  try {
    await applyMirror(target, ctrl);
    const label = target.caption || target.kind;
    const msg = `✓ Written: ${label}`;
    onProgress?.({ phase: "ok", label: msg });
    return { ok: true, message: msg };
  } catch (err) {
    const msg = "✗ Could not write to the board.";
    onProgress?.({ phase: "failed", label: msg, detail: String(err) });
    return { ok: false, message: msg, detail: String(err) };
  }
};
