/**
 * BUILT-IN DOOR ASSETS.
 *
 * Each style is a transparent-cutout door image used as a real door asset in
 * the hallway: the artwork is applied to a wall-aligned plane with an alpha
 * map, so the cutout stays transparent and the surrounding wall shows through.
 * Styles are bundled CDN assets, so they never require storage signing.
 */
import navyVision from "@/assets/doors/door-navy-vision.png.asset.json";
import charcoalFullGlass from "@/assets/doors/door-charcoal-full-glass.png.asset.json";
import charcoalVision from "@/assets/doors/door-charcoal-vision.png.asset.json";
import oakVision from "@/assets/doors/door-oak-vision.png.asset.json";
import steelWired from "@/assets/doors/door-steel-wired.png.asset.json";
import glassEntrance from "@/assets/doors/door-glass-entrance.png.asset.json";

export interface DoorStyle {
  key: string;
  label: string;
  url: string;
  /** width / height of the artwork, so the plane never distorts the door */
  aspect: number;
}

export const DOOR_STYLES: DoorStyle[] = [
  { key: "navy-vision", label: "Navy Vision Panel", url: navyVision.url, aspect: 1024 / 1536 },
  { key: "charcoal-full-glass", label: "Charcoal Full Glass", url: charcoalFullGlass.url, aspect: 1024 / 1536 },
  { key: "charcoal-vision", label: "Charcoal Vision Panel", url: charcoalVision.url, aspect: 1024 / 1536 },
  { key: "oak-vision", label: "Oak Vision Panel", url: oakVision.url, aspect: 1024 / 1536 },
  { key: "steel-wired", label: "Steel Wired Glass", url: steelWired.url, aspect: 1024 / 1536 },
  { key: "glass-entrance", label: "Glass Entrance", url: glassEntrance.url, aspect: 1024 / 1536 },
];

export const DEFAULT_DOOR_STYLE = DOOR_STYLES[0].key;

export const doorStyle = (key: string | null | undefined): DoorStyle =>
  DOOR_STYLES.find((s) => s.key === key) ?? DOOR_STYLES[0];

export const doorStyleUrl = (key: string | null | undefined): string => doorStyle(key).url;
