// Built-in cinematic progress-bar frame designs.
import preset01 from "@/assets/progress/preset-01.png";
import preset02 from "@/assets/progress/preset-02.png";
import preset03 from "@/assets/progress/preset-03.png";
import preset04 from "@/assets/progress/preset-04.png";
import preset05 from "@/assets/progress/preset-05.png";
import preset06 from "@/assets/progress/preset-06.png";
import preset07 from "@/assets/progress/preset-07.png";
import preset08 from "@/assets/progress/preset-08.png";
import preset09 from "@/assets/progress/preset-09.png";
import preset10 from "@/assets/progress/preset-10.png";

export interface SlotGeometry {
  left: number;
  right: number;
  top: number;
  bottom: number;
  gap: number;
}

export interface ProgressPreset {
  id: string;
  name: string;
  image: string;
  aspect: number;
  slotGeometry: SlotGeometry;
  glowTint: string;
}

const ASPECT = 768 / 1536;

export const PROGRESS_PRESETS: ProgressPreset[] = [
  { id: "crystal-reactor",  name: "Crystal Reactor",         image: preset01, aspect: ASPECT, slotGeometry: { left: 37.2, right: 37.4, top: 18.6, bottom: 11.2, gap: 0 }, glowTint: "150,190,255" },
  { id: "molten-forge",     name: "Molten Forge",            image: preset02, aspect: ASPECT, slotGeometry: { left: 39.8, right: 38.4, top: 16.4, bottom: 13.2, gap: 0 }, glowTint: "255,140,60" },
  { id: "arcane-rune",      name: "Arcane Rune Pillar",      image: preset03, aspect: ASPECT, slotGeometry: { left: 38.4, right: 38.4, top: 12.9, bottom: 12.1, gap: 0 }, glowTint: "190,120,255" },
  { id: "neon-core",        name: "Neon Cyber Core",         image: preset04, aspect: ASPECT, slotGeometry: { left: 37.2, right: 37.4, top: 14,   bottom: 12,   gap: 0 }, glowTint: "80,200,255" },
  { id: "royal-column",     name: "Gilded Royal Column",     image: preset05, aspect: ASPECT, slotGeometry: { left: 37.6, right: 38,   top: 13.7, bottom: 16.8, gap: 0 }, glowTint: "90,230,140" },
  { id: "coral-reef",       name: "Bio-luminescent Coral",   image: preset06, aspect: ASPECT, slotGeometry: { left: 37.9, right: 37.9, top: 14.5, bottom: 10.1, gap: 0 }, glowTint: "80,230,220" },
  { id: "ice-tower",        name: "Ice Shard Tower",         image: preset07, aspect: ASPECT, slotGeometry: { left: 37,   right: 37.1, top: 17.6, bottom: 10.6, gap: 0 }, glowTint: "150,210,255" },
  { id: "obsidian",         name: "Volcanic Obsidian",       image: preset08, aspect: ASPECT, slotGeometry: { left: 38.2, right: 39.6, top: 15,   bottom: 10.6, gap: 0 }, glowTint: "255,90,50" },
  { id: "star-spire",       name: "Celestial Star-Spire",    image: preset09, aspect: ASPECT, slotGeometry: { left: 41,   right: 41.3, top: 21,   bottom: 9,    gap: 0 }, glowTint: "255,215,120" },
  { id: "stone-monolith",   name: "Ancient Stone Monolith",  image: preset10, aspect: ASPECT, slotGeometry: { left: 37,   right: 37,   top: 13.3, bottom: 10,   gap: 0 }, glowTint: "90,220,150" },
];

export const getPreset = (id?: string): ProgressPreset | undefined =>
  id ? PROGRESS_PRESETS.find((p) => p.id === id) : undefined;

export const DEFAULT_PRESET_ID = PROGRESS_PRESETS[0].id;
