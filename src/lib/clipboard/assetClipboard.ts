// Shared copy/paste plumbing for GPL assets and teacher emoji items.
// Copying an image puts the real picture on the clipboard so it can be pasted
// straight into a lesson note, an emoji session or the asset dialog. Anything
// the clipboard cannot carry as a picture (video, audio, 3D) is copied as its
// link instead, which the same paste targets accept.

export interface CopyResult {
  ok: boolean;
  /** "image" when the picture itself was copied, "link" when the URL was. */
  as: "image" | "link";
  message: string;
}

const canWriteFiles = () =>
  typeof window !== "undefined" &&
  typeof ClipboardItem !== "undefined" &&
  !!navigator.clipboard &&
  "write" in navigator.clipboard;

/** Copies a media URL: the picture when possible, otherwise the link. */
export const copyMediaToClipboard = async (url: string): Promise<CopyResult> => {
  const fallback = async (): Promise<CopyResult> => {
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, as: "link", message: "Link copied — paste it anywhere" };
    } catch {
      return { ok: false, as: "link", message: "Could not copy" };
    }
  };

  if (!canWriteFiles()) return fallback();

  try {
    const res = await fetch(url);
    if (!res.ok) return fallback();
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return fallback();

    // Safari and Chrome only guarantee PNG support for image writes.
    const png = blob.type === "image/png" ? blob : await toPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return { ok: true, as: "image", message: "Picture copied — paste it anywhere" };
  } catch {
    return fallback();
  }
};

const toPng = (blob: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("no_canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((out) => {
        URL.revokeObjectURL(objectUrl);
        out ? resolve(out) : reject(new Error("encode_failed"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("decode_failed"));
    };
    img.src = objectUrl;
  });

/** Files carried by a paste or drop event (images, video, audio, models). */
export const filesFromTransfer = (dt: DataTransfer | null): File[] => {
  if (!dt) return [];
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  if (out.length === 0) out.push(...Array.from(dt.files ?? []));
  return out;
};

/** A pasted http(s) link, when the clipboard carried text instead of a file. */
export const linkFromTransfer = (dt: DataTransfer | null): string | null => {
  const text = dt?.getData("text/plain")?.trim();
  return text && /^https?:\/\//i.test(text) ? text : null;
};
