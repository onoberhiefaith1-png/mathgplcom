// Smart Card social snapshot.
//
// The shared preview image is not regenerated art — it is a pixel snapshot of
// the very card the teacher is looking at (background, title, question,
// emojis, maths, layout), composed onto a 1200x630 social canvas with a small
// MathGPL Life badge in the top-left corner.

import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";

export const PREVIEW_BUCKET = "smart-card-previews";
// Square poster (1:1) — the card should almost completely fill it.
const W = 1080;
const H = 1080;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Draw the MathGPL Life badge — branding on every shared card. */
const drawBadge = (ctx: CanvasRenderingContext2D) => {
  const x = 32;
  const y = 28;
  ctx.save();
  ctx.fillStyle = "#0f172a";
  const w = 196;
  const h = 44;
  const r = 22;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(x + 24, y + h / 2, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 20px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("MathGPL Life", x + 42, y + h / 2 + 1);
  ctx.restore();
};

/** Snapshot a live DOM node into a 1200x630 PNG blob. */
export async function renderCardSnapshot(node: HTMLElement): Promise<Blob | null> {
  try {
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      // Never bake the editor's preview zoom into the shared image.
      style: { transform: "none", transformOrigin: "top left" },
    });
    const img = await loadImage(dataUrl);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, W, H);

    // Fit the card inside the social frame, leaving room for the badge.
    const padX = 60;
    const padTop = 96;
    const padBottom = 48;
    const boxW = W - padX * 2;
    const boxH = H - padTop - padBottom;
    const scale = Math.min(boxW / img.width, boxH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (W - dw) / 2;
    const dy = padTop + (boxH - dh) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
    ctx.drawImage(img, dx, dy, dw, dh);

    drawBadge(ctx);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 0.92),
    );
  } catch {
    return null;
  }
}

/**
 * Capture + upload. Overwrites the previous snapshot so a republished card
 * always shares its latest look. Never throws — a failed snapshot must not
 * block publishing.
 */
export async function captureCardPreview(
  node: HTMLElement | null,
  cardId: string,
): Promise<string | null> {
  if (!node) return null;
  const blob = await renderCardSnapshot(node);
  if (!blob) return null;

  const path = `${cardId}.png`;
  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "60" });
  if (error) return null;

  await supabase
    .from("smart_cards")
    .update({ preview_image_path: path } as never)
    .eq("id", cardId);

  return path;
}
