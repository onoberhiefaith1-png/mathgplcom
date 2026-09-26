import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

interface Props {
  value: string;
  editable: boolean;
  style: CSSProperties;
  placeholder?: string | undefined;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * The writing layer is intentionally thin: it renders whatever content the
 * provider gives it and reports edits back. Replacing plain text with a real
 * mathematics interaction engine means swapping this component only.
 */
export function WritingLayer({
  value,
  editable,
  style,
  placeholder,
  onChange,
  onFocus,
  onBlur,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerText !== value) el.innerText = value;
  }, [value]);

  return (
    <div className="relative">
      {!value && placeholder ? (
        <div
          className="pointer-events-none absolute inset-0 select-none"
          style={{ ...style, opacity: 0.25 }}
        >
          {placeholder}
        </div>
      ) : null}
      <div
        ref={ref}
        role="textbox"
        tabIndex={editable ? 0 : -1}
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="min-h-[1.5em] w-full whitespace-pre-wrap break-words outline-none"
        style={style}
      />
    </div>
  );
}
