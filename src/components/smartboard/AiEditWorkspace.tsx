// AiEditWorkspace — HEADLESS Live Mirror runner.
//
// Renders NOTHING. (The old floating status strip at the top of the
// screen physically covered the first lines of the Presenter Preview,
// making Line 1's note unclickable — it is gone for good.)
//
// Responsibilities:
//   • when a preview item is selected, mirror it onto the Smartboard
//     via the timing-safe mirror + 4-step auto-rectify ladder
//   • report live status (mirroring / fixing step n/4 / ✓ / ✗) through
//     `onStatus`, which the Presenter Preview shows as an inline badge
//     on the clicked item itself
//   • on exit, clear the board and resume normal playback

import { useEffect, useRef } from "react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorUiStatus } from "@/lib/smartboard/manualEdit/types";
import { editTargetKey } from "@/lib/smartboard/manualEdit/types";
import { clearBoard } from "@/lib/smartboard/manualEdit/mirror";
import { runMirrorWithAutofix } from "@/lib/smartboard/manualEdit/autofix";

interface Props {
  open: boolean;
  target: EditTarget | null;
  controller: PresentationController | null;
  onStatus?: (status: MirrorUiStatus | null) => void;
}

const AiEditWorkspace = ({ open, target, controller, onStatus }: Props) => {
  const runIdRef = useRef(0);
  const lastKeyRef = useRef<string | null>(null);
  const hasBeenOpenRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  // On open (and every fresh selection) mirror the target onto the board.
  useEffect(() => {
    if (!open || !controller) return;
    hasBeenOpenRef.current = true;

    // Entering mirror mode with no selection yet — just clear the board.
    if (!target) {
      clearBoard(controller);
      onStatusRef.current?.(null);
      lastKeyRef.current = null;
      return;
    }

    const key = editTargetKey(target);
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const myRun = ++runIdRef.current;
    (async () => {
      const result = await runMirrorWithAutofix(target, controller, (p) => {
        if (runIdRef.current === myRun) onStatusRef.current?.({ key, ...p });
      });
      if (runIdRef.current === myRun) {
        onStatusRef.current?.({
          key,
          phase: result.ok ? "ok" : "failed",
          label: result.message,
          detail: result.detail,
        });
      }
    })();
  }, [open, controller, target]);

  // On close — but ONLY after we were actually open once. This prevents
  // wiping the Smartboard when this mounts with open===false during
  // normal playback.
  useEffect(() => {
    if (open) return;
    if (!hasBeenOpenRef.current) return;
    runIdRef.current += 1; // cancel any in-flight run
    if (controller) clearBoard(controller);
    lastKeyRef.current = null;
    onStatusRef.current?.(null);
  }, [open, controller]);

  return null;
};

export default AiEditWorkspace;
