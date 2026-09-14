// A single MM:SS time field. Used by Floating Numbers for the question time and
// for a line's own time (the line time is what creates a Game Timer Reward).

import { useEffect, useState, type CSSProperties } from "react";
import { formatMmSs, parseMmSs } from "@/lib/time/mmss";

interface Props {
  /** Whole seconds, or null/undefined for no time. */
  value: number | null | undefined;
  onChange: (seconds: number | null) => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  placeholder?: string;
}

export const DurationInput = ({
  value, onChange, className, style, title, placeholder = "mm:ss",
}: Props) => {
  const [text, setText] = useState(value ? formatMmSs(value) : "");

  useEffect(() => {
    setText(value ? formatMmSs(value) : "");
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      title={title ?? "Time as MM:SS"}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const seconds = parseMmSs(text);
        setText(seconds ? formatMmSs(seconds) : "");
        onChange(seconds);
      }}
      className={className}
      style={style}
    />
  );
};

export default DurationInput;
