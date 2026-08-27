/**
 * Copy plain text to the clipboard.
 *
 * The async Clipboard API is blocked in several ordinary situations (an
 * embedded frame, a page that lost focus, an insecure context). A share link
 * that "cannot be copied" is a broken feature, so we always fall back to a
 * hidden-selection copy before reporting failure.
 */
export async function copyText(value: string): Promise<boolean> {
  const text = String(value ?? "");
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the selection fallback */
  }

  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Select the whole contents of an element so the user can copy by hand. */
export const selectAllIn = (el: HTMLElement | null): void => {
  if (!el || typeof window === "undefined") return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};
