// AiEditWorkspace — HEADLESS Preview Channel runner.
//
// Renders NOTHING. When the teacher clicks a Presenter Preview item in
// Present mode, this runner sends the click through the independent
// PREVIEW CHANNEL (boardWriter/previewChannel): one click = one
// deterministic board action via the row ledger + dumb write primitive.
// No mirror replay, no autofix ladder, no beat-cursor waiting loops.
//
// LOOP SAFETY: the host object is rebuilt by the Smartboard whenever
// board state changes, so it must NEVER be an effect dependency here.
// The effect keys ONLY on (open, targetKey); everything else is read
// via refs.

import { useEffect, useRef } from "react";

import type { EditTarget, MirrorUiStatus } from "@/lib/smartboard/manualEdit/types";
import { editTargetKey } from "@/lib/smartboard/manualEdit/types";
import {
  previewWrite,
  type PreviewChannelHost,
} from "@/lib/smartboard/boardWriter/previewChannel";

interface Props {
  open: boolean;
  target: EditTarget | null;
  host: PreviewChannelHost | null;
  onStatus?: (status: MirrorUiStatus | null) => void;
}

const AiEditWorkspace = ({ open, target, host, onStatus }: Props) => {
  const lastKeyRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  // Live refs — never effect dependencies.
  const hostRef = useRef(host);
  hostRef.current = host;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const targetRef = useRef(target);
  targetRef.current = target;

  const key = open && target ? editTargetKey(target) : null;

  useEffect(() => {
    if (!open) {
      // Close transition — the board keeps whatever the teacher wrote.
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        lastKeyRef.current = null;
        onStatusRef.current?.(null);
      }
      return;
    }

    wasOpenRef.current = true;
    const h = hostRef.current;
    const t = targetRef.current;

    if (!h || !t || !key) {
      lastKeyRef.current = null;
      onStatusRef.current?.(null);
      return;
    }

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    try {
      previewWrite(t, h);
      // Success is silent — no chip on the panel for a good click.
      onStatusRef.current?.(null);
    } catch (err) {
      onStatusRef.current?.({
        key,
        phase: "failed",
        label: "✗ Could not write to the board.",
        detail: String(err),
      });
    }
  }, [open, key]);

  return null;
};

export default AiEditWorkspace;
