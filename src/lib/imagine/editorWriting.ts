// Editor writing surface.
//
// The DOM game editor painted saved line text, or an ellipsis, and never
// focused a field. Keystrokes — a hardware keyboard or the iPhone keyboard —
// had nowhere to go, so changing text size and colour showed nothing new.
// The surface is now a real field. A tap focuses it (required for the iPhone
// keyboard), and the letters use the current size and colour.

export const EDITOR_WRITING_MIN_FONT_PX = 16;

export type EditorWritingPresentation = {
  fontSize: string;
  color: string;
  transform?: string;
  transformOrigin?: string;
};

/**
 * Paint the writing at `sizePx` in `colour`.
 * Below 16px the field stays at 16px and scales down, so iPhone Safari does
 * not zoom the page when the keyboard opens, while the letters still look
 * the size the teacher chose.
 */
export function editorWritingPresentation(sizePx: number, colour: string): EditorWritingPresentation {
  const size = Number.isFinite(sizePx) ? Math.min(160, Math.max(1, sizePx)) : EDITOR_WRITING_MIN_FONT_PX;
  const color = colour || "#173f91";
  if (size >= EDITOR_WRITING_MIN_FONT_PX) {
    return { fontSize: `${Math.round(size * 10) / 10}px`, color };
  }
  const scale = Math.round((size / EDITOR_WRITING_MIN_FONT_PX) * 1000) / 1000;
  return {
    fontSize: `${EDITOR_WRITING_MIN_FONT_PX}px`,
    color,
    transform: `scale(${scale})`,
    transformOrigin: "left center",
  };
}

/** One keystroke on the writing surface. Null means the key does not edit. */
export function applyWritingKey(value: string, key: string): string | null {
  if (key === "Backspace") return value.slice(0, -1);
  if (key === "Enter") return `${value}\n`;
  if (key.length === 1) return value + key;
  return null;
}
