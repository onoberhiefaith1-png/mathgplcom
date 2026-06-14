import f1 from "@/assets/adventure/card-frames/frame-1.png.asset.json";
import f2 from "@/assets/adventure/card-frames/frame-2.png.asset.json";
import f3 from "@/assets/adventure/card-frames/frame-3.png.asset.json";
import f4 from "@/assets/adventure/card-frames/frame-4.png.asset.json";
import f5 from "@/assets/adventure/card-frames/frame-5.png.asset.json";
import f6 from "@/assets/adventure/card-frames/frame-6.png.asset.json";
import f7 from "@/assets/adventure/card-frames/frame-7.png.asset.json";
import f8 from "@/assets/adventure/card-frames/frame-8.png.asset.json";

export interface CardFrame {
  index: number; // 1-8
  url: string;
  /** dominant accent (for topic/subtopic chips) */
  accent: string;
}

export const CARD_FRAMES: CardFrame[] = [
  { index: 1, url: f1.url, accent: "hsl(280 70% 60%)" },
  { index: 2, url: f2.url, accent: "hsl(215 80% 60%)" },
  { index: 3, url: f3.url, accent: "hsl(150 60% 50%)" },
  { index: 4, url: f4.url, accent: "hsl(28 80% 55%)" },
  { index: 5, url: f5.url, accent: "hsl(180 60% 50%)" },
  { index: 6, url: f6.url, accent: "hsl(40 85% 55%)" },
  { index: 7, url: f7.url, accent: "hsl(300 65% 60%)" },
  { index: 8, url: f8.url, accent: "hsl(220 80% 60%)" },
];

/** Resolve the frame for a card: explicit override if set, else cycle by position. */
export function pickFrame(position: number, override?: number | null): CardFrame {
  if (override && override >= 1 && override <= 8) return CARD_FRAMES[override - 1];
  const i = ((position % CARD_FRAMES.length) + CARD_FRAMES.length) % CARD_FRAMES.length;
  return CARD_FRAMES[i];
}
