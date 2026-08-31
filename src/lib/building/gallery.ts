/**
 * Built-in sample backgrounds for the building's surfaces.
 *
 * Each sample is a professional starting template. Teachers apply one to a
 * single surface via "Choose Template", or replace it with their own upload.
 * Samples are bundled app assets resolved through the `builtin:<key>` texture
 * path convention — storage paths keep the existing signed-URL flow.
 */
import surfaceModernAcademy from "@/assets/surfaces/surface-modern-academy.jpg";
import surfaceMathematics from "@/assets/surfaces/surface-mathematics.jpg";
import surfacePremiumDark from "@/assets/surfaces/surface-premium-dark.jpg";
import surfaceBrightClassroom from "@/assets/surfaces/surface-bright-classroom.jpg";
import surfaceScience from "@/assets/surfaces/surface-science.jpg";
import surfaceMinimal from "@/assets/surfaces/surface-minimal.jpg";
import surfaceFuturistic from "@/assets/surfaces/surface-futuristic.jpg";
import surfaceSchoolBranding from "@/assets/surfaces/surface-school-branding.jpg";
import panelReception from "@/assets/surfaces/panel-reception.png.asset.json";
import panelCreamBlue from "@/assets/surfaces/panel-cream-blue.png.asset.json";
import panelSlattedWarm from "@/assets/surfaces/panel-slatted-warm.png.asset.json";
import panelWalnutSlat from "@/assets/surfaces/panel-walnut-slat.png.asset.json";

export interface SurfaceSample {
  key: string;
  label: string;
  style: string;
  url: string;
}

export const SURFACE_SAMPLES: SurfaceSample[] = [
  { key: "modern-academy", label: "Modern Academy", style: "A", url: surfaceModernAcademy },
  { key: "mathematics", label: "Mathematics", style: "B", url: surfaceMathematics },
  { key: "premium-dark", label: "Premium Dark", style: "C", url: surfacePremiumDark },
  { key: "bright-classroom", label: "Bright Classroom", style: "D", url: surfaceBrightClassroom },
  { key: "science", label: "Science", style: "E", url: surfaceScience },
  { key: "minimal", label: "Minimal", style: "F", url: surfaceMinimal },
  { key: "futuristic", label: "Futuristic", style: "G", url: surfaceFuturistic },
  { key: "school-branding", label: "School Branding", style: "H", url: surfaceSchoolBranding },
  { key: "panel-reception", label: "Reception Panel", style: "I", url: panelReception.url },
  { key: "panel-cream-blue", label: "Cream & Blue Panel", style: "J", url: panelCreamBlue.url },
  { key: "panel-slatted-warm", label: "Warm Slatted Panel", style: "K", url: panelSlattedWarm.url },
  { key: "panel-walnut-slat", label: "Walnut Slat Panel", style: "L", url: panelWalnutSlat.url },
];

export const BUILTIN_PREFIX = "builtin:";

export const builtinTexturePath = (key: string): string => `${BUILTIN_PREFIX}${key}`;

export const isBuiltinTexturePath = (path: string | null | undefined): path is string =>
  Boolean(path && path.startsWith(BUILTIN_PREFIX));

/** Resolve a `builtin:<key>` texture path to its bundled asset URL. */
export const builtinTextureUrl = (path: string): string | null => {
  const key = path.slice(BUILTIN_PREFIX.length);
  return SURFACE_SAMPLES.find((s) => s.key === key)?.url ?? null;
};

/** Human-readable name of a built-in sample path (for "Current design"). */
export const builtinTextureLabel = (path: string): string | null => {
  const key = path.slice(BUILTIN_PREFIX.length);
  return SURFACE_SAMPLES.find((s) => s.key === key)?.label ?? null;
};