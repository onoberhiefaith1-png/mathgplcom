// Liquid Fill progress-bar styles — the crystal vessel designs whose liquid
// rises as the student's marks increase. Behaviour is unchanged; this file only
// catalogues the designs so they can be picked from Progress Bar → Style.
import blueFrame from "@/assets/qpc/frame-blue.png.asset.json";
import greenFrame from "@/assets/qpc/frame-green.png.asset.json";
import purpleFrame from "@/assets/qpc/frame-purple.png.asset.json";
import orangeFrame from "@/assets/qpc/frame-orange.png.asset.json";
import goldFrame from "@/assets/qpc/frame-gold.png.asset.json";
import chambers from "@/assets/qpc/chambers.json";
import type { CrystalTheme } from "@/components/assets/QuestionProgressContainer";

export interface LiquidStyle {
  id: CrystalTheme;
  name: string;
  image: string;
  /** width / height of the vessel artwork. */
  aspect: number;
}

const dims = chambers as Record<CrystalTheme, { w: number; h: number }>;
const aspectOf = (id: CrystalTheme) => dims[id].w / dims[id].h;

export const LIQUID_STYLES: LiquidStyle[] = [
  { id: "blue", name: "Blue Crystal Vessel", image: blueFrame.url, aspect: aspectOf("blue") },
  { id: "green", name: "Green Crystal Vessel", image: greenFrame.url, aspect: aspectOf("green") },
  { id: "purple", name: "Purple Crystal Vessel", image: purpleFrame.url, aspect: aspectOf("purple") },
  { id: "orange", name: "Orange Crystal Vessel", image: orangeFrame.url, aspect: aspectOf("orange") },
  { id: "gold", name: "Gold Crystal Vessel", image: goldFrame.url, aspect: aspectOf("gold") },
];

export const DEFAULT_LIQUID_STYLE: CrystalTheme = "blue";

export const getLiquidStyle = (id?: string): LiquidStyle =>
  LIQUID_STYLES.find((s) => s.id === id) ?? LIQUID_STYLES[0];
