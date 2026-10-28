// Auto-growing textarea used by every AI instruction box.
//
// Dictation arrives as paragraphs (see useVoiceInput.formatTranscript), so the
// box must grow with the text instead of scrolling sideways on one line. It
// starts at `minRows` and grows up to `maxRows` before scrolling.

import { useEffect, useRef } from "react";

interface Props extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  value: string;
  minRows?: number;
  maxRows?: number;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}

export function AutoTextarea({
  value, minRows = 3, maxRows = 10, textareaRef, style, ...rest
}: Props) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const attach = (el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    if (textareaRef) textareaRef.current = el;
  };

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const line = parseFloat(getComputedStyle(el).lineHeight || "20") || 20;
    const pad = el.offsetHeight - el.clientHeight;
    const min = line * minRows;
    const max = line * maxRows;
    el.style.height = "auto";
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight)) + pad}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={attach}
      value={value}
      rows={minRows}
      style={{ resize: "none", whiteSpace: "pre-wrap", ...style }}
      {...rest}
    />
  );
}

export default AutoTextarea;
