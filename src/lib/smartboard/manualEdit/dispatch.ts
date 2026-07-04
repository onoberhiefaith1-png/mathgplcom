// Live Mirror Mode — thin adapter kept for backwards compatibility with
// callers that used to invoke the autonomous operator. All requests now
// route straight to the mirror mapping.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult } from "./types";
import { applyMirror, clearBoard, verifyMirror } from "./mirror";

export { applyMirror, clearBoard, verifyMirror };

/** Apply mirror + verify in one call. */
export const runMirror = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<MirrorResult> => {
  await applyMirror(target, ctrl);
  // Let React flush any state the controller wrote before we read back.
  await new Promise((r) => setTimeout(r, 60));
  return verifyMirror(target, ctrl);
};
