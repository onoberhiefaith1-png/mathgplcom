// AiEditWorkspace — HEADLESS Live Mirror runner.
//
// Renders NOTHING. Responsibilities:
//   • when a preview item is selected, mirror it onto the Smartboard
//     via the timing-safe mirror + auto-rectify ladder (additive — the
//     board is never wiped by entering/leaving Edit mode)
//   • report live status (mirroring / fixing step n/4 / ✓ / ✗) through
//     `onStatus`, which the Presenter Preview shows as an inline badge
//
// LOOP SAFETY: the controller object is rebuilt by the host whenever
// board state changes, so it must NEVER be an effect dependency here —
// that caused an infinite clear→rebuild→clear render loop. The effect
// keys ONLY on (open, targetKey); everything else is read via refs.

import { useEffect, useRef } from "react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorUiStatus } from "@/lib/smartboard/manualEdit/types";
import { editTargetKey } from "@/lib/smartboard/manualEdit/types";
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
  const wasOpenRef = useRef(false);

  // Live refs — never effect dependencies.
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const targetRef = useRef(target);
  targetRef.current = target;

  const key = open && target ? editTargetKey(target) : null;

  useEffect(() => {
    if (!open) {
      // Close transition only — and never wipe the board: whatever the
      // teacher forced onto the board in Edit mode STAYS there, and
      // normal playback (Next/Prev) continues from the current beat.
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        runIdRef.current += 1; // cancel any in-flight run
        controllerRef.current?.closeFloatingPanel?.();
        lastKeyRef.current = null;
        onStatusRef.current?.(null);
      }
      return;
    }

    wasOpenRef.current = true;
    const ctrl = controllerRef.current;
    const t = targetRef.current;

    if (!ctrl || !t || !key) {
      // Entering Edit with no selection — do nothing (board untouched).
      lastKeyRef.current = null;
      onStatusRef.current?.(null);
      return;
    }

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const myRun = ++runIdRef.current;
    void runMirrorWithAutofix(t, ctrl, (p) => {
      if (runIdRef.current === myRun) onStatusRef.current?.({ key, ...p });
    }).then((result) => {
      if (runIdRef.current === myRun) {
        onStatusRef.current?.({
          key,
          phase: result.ok ? "ok" : "failed",
          label: result.message,
          detail: result.detail,
        });
      }
    });
  }, [open, key]);

  return null;
};

export default AiEditWorkspace;
