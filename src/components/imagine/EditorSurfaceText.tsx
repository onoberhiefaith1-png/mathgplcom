import type { CSSProperties } from "react";
import { editorWritingPresentation } from "@/lib/imagine/editorWriting";

/**
 * The editor's writing surface. It is a real text field so typing shows up
 * immediately, in the current size and colour. Play mode does not use it.
 *
 * The field owns the keystrokes (uncontrolled). A tap focuses it, which is
 * what iPhone Safari needs before it will open the keyboard. Size and colour
 * are paint, so they update without resetting the letters.
 */
export function EditorSurfaceText({
  value,
  label,
  colour,
  sizePx,
  textStyle,
  onChange,
}: {
  value: string;
  label: string;
  colour: string;
  sizePx: number;
  textStyle?: CSSProperties;
  active?: boolean;
  onChange: (value: string) => void;
}) {
  const presentation = editorWritingPresentation(sizePx, colour);
  return (
    <textarea
      aria-label={label}
      data-editor-writing=""
      defaultValue={value}
      placeholder="Type to preview"
      inputMode="text"
      enterKeyHint="done"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      rows={1}
      tabIndex={0}
      onPointerDown={(event) => {
        event.stopPropagation();
        // The tap itself focuses the field. iPhone Safari only opens the
        // keyboard from a user gesture, so this is not done in an effect.
        event.currentTarget.focus();
      }}
      onChange={(event) => onChange(event.currentTarget.value)}
      className="w-full resize-none bg-transparent outline-none placeholder:text-current placeholder:opacity-40"
      style={{
        ...textStyle,
        ...presentation,
        minHeight: "1.4em",
        lineHeight: textStyle?.lineHeight ?? 1.3,
        WebkitTextSizeAdjust: "100%",
      }}
    />
  );
}
