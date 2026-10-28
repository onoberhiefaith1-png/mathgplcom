// Floating-number clipboard — copy/paste that keeps mathematical OBJECTS.
//
// A floating line is not a string: it is a list of complete Floating Terms
// (fillers), a list of empty structural shells (containers) and the equation
// they came from. Copying it must move that object, so pasting restores real
// floating-number chips — never an unstructured text blob.
//
// Two flavours, exactly like the Lesson Note structural clipboard:
//   • text/html  — a marked payload carrying the line as JSON. Paste reads it.
//   • text/plain — a readable "a + b = c" form so pasting into other apps and
//                  pasting FROM other apps both work.
//
// Plain text arriving from elsewhere is tokenized with the shared math
// tokenizer, so a structure such as \frac{a}{b} or a matrix stays one term,
// signs are preserved ("A − B" keeps its minus) and the first term is never
// given an artificial leading "+".

import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { sanitizeFillers } from "@/lib/smartboard/floatingExtractor";
import type { ContainerKind, FloatingLine } from "@/lib/lessonnotes/floatingCompile";

export const FLOATING_FLAG = "data-mathgpl-floating";

export interface FloatingClipboardPayload {
  equation: string;
  fillers: string[];
  containers: ContainerKind[];
  arrangement: number[];
}

const identityArrangement = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Readable form of a line's floating terms. */
export const payloadToPlainText = (p: FloatingClipboardPayload): string =>
  p.fillers.join(" ").trim() || p.equation || "";

export const lineToPayload = (line: FloatingLine): FloatingClipboardPayload => ({
  equation: String(line.equation ?? ""),
  fillers: (line.fillers ?? []).map((f) => String(f)),
  containers: (line.containers ?? []) as ContainerKind[],
  arrangement:
    Array.isArray(line.arrangement) && line.arrangement.length === (line.fillers ?? []).length
      ? line.arrangement.slice()
      : identityArrangement((line.fillers ?? []).length),
});

/** Serialise a payload into clipboard HTML. */
export const payloadToHtml = (p: FloatingClipboardPayload): string => {
  const holder = document.createElement("div");
  holder.setAttribute(FLOATING_FLAG, "");
  holder.setAttribute("data-floating-payload", JSON.stringify(p));
  holder.textContent = payloadToPlainText(p);
  return holder.outerHTML;
};

/** True when clipboard HTML carries our own structural floating payload. */
export const isFloatingHtml = (html: string | null | undefined): boolean =>
  !!html && html.includes(FLOATING_FLAG);

/** Parse clipboard HTML back into a payload (null when it is not ours). */
export const htmlToPayload = (html: string): FloatingClipboardPayload | null => {
  try {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    const src = holder.querySelector(`[${FLOATING_FLAG}]`) as HTMLElement | null;
    const raw = src?.getAttribute("data-floating-payload");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FloatingClipboardPayload>;
    const fillers = Array.isArray(parsed.fillers) ? parsed.fillers.map(String).filter(Boolean) : [];
    const containers = Array.isArray(parsed.containers)
      ? (parsed.containers.map(String) as ContainerKind[])
      : [];
    return {
      equation: String(parsed.equation ?? ""),
      fillers,
      containers,
      arrangement:
        Array.isArray(parsed.arrangement) && parsed.arrangement.length === fillers.length
          ? parsed.arrangement.map((n) => Number(n))
          : identityArrangement(fillers.length),
    };
  } catch {
    return null;
  }
};

/**
 * Parse pasted PLAIN TEXT into floating terms. Structures stay whole,
 * structural macros move to the Symbols row, a leading "−" survives and no
 * synthetic leading "+" is ever added.
 */
export const plainTextToPayload = (text: string): FloatingClipboardPayload | null => {
  const src = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!src) return null;
  const tokens = tokenizeMath(src).filter(Boolean);
  if (tokens.length === 0) return null;
  const { fillers, structures } = sanitizeFillers(tokens);
  const cleaned = fillers.filter(Boolean);
  if (cleaned.length === 0) return null;
  // SIGN LAW: the first term never receives an artificial "+".
  if (cleaned[0].startsWith("+")) cleaned[0] = cleaned[0].slice(1);
  const kept = cleaned.filter(Boolean);
  return {
    equation: src,
    fillers: kept,
    containers: structures as unknown as ContainerKind[],
    arrangement: identityArrangement(kept.length),
  };
};

/** Read the clipboard and return a payload, structured flavour preferred. */
export const readFloatingClipboard = async (): Promise<FloatingClipboardPayload | null> => {
  const nav = navigator as Navigator & { clipboard?: Clipboard };
  try {
    if (nav.clipboard?.read) {
      const items = await nav.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const html = await (await item.getType("text/html")).text();
          if (isFloatingHtml(html)) {
            const p = htmlToPayload(html);
            if (p) return p;
          }
        }
      }
    }
  } catch {
    /* fall through to plain text */
  }
  try {
    const text = await nav.clipboard?.readText();
    return text ? plainTextToPayload(text) : null;
  } catch {
    return null;
  }
};

/** Write both flavours to the system clipboard. */
export const writeFloatingClipboard = async (p: FloatingClipboardPayload): Promise<boolean> => {
  const html = payloadToHtml(p);
  const text = payloadToPlainText(p);
  const nav = navigator as Navigator & { clipboard?: Clipboard };
  const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (nav.clipboard?.write && CI) {
    try {
      await nav.clipboard.write([
        new CI({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    let ok = false;
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData("text/html", html);
      e.clipboardData?.setData("text/plain", text);
      ok = true;
    };
    document.addEventListener("copy", onCopy, true);
    document.execCommand("copy");
    document.removeEventListener("copy", onCopy, true);
    if (ok) return true;
  } catch {
    /* noop */
  }
  try {
    await nav.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** Apply a pasted payload onto a line, replacing its floating content. */
export const applyPayloadToLine = (
  line: FloatingLine,
  p: FloatingClipboardPayload,
): FloatingLine => ({
  ...line,
  fillers: p.fillers.slice(),
  containers: p.containers.slice(),
  arrangement: identityArrangement(p.fillers.length),
  fillersSelected: p.fillers.map(() => false),
  containersSelected: p.containers.map(() => false),
});
