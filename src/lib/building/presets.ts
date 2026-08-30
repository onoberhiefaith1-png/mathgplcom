/**
 * Surface design presets for the editable building environment.
 * Each preset maps to concrete three.js material parameters; the renderer
 * falls back to the preset's colour whenever a texture is not uploaded.
 */

export interface MaterialPreset {
  label: string;
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export const SURFACE_PRESETS: Record<string, MaterialPreset> = {
  modern: { label: "Modern", color: "#334155", roughness: 0.5, metalness: 0.25 },
  classroom: { label: "Classroom", color: "#8fb996", roughness: 0.7, metalness: 0 },
  academic: { label: "Academic", color: "#3a4763", roughness: 0.6, metalness: 0.15 },
  minimal: { label: "Minimal", color: "#e8e6e1", roughness: 0.8, metalness: 0 },
  futuristic: {
    label: "Futuristic",
    color: "#1e293b",
    roughness: 0.3,
    metalness: 0.6,
    emissive: "#38bdf8",
    emissiveIntensity: 0.06,
  },
  dark: { label: "Dark", color: "#0f172a", roughness: 0.5, metalness: 0.2 },
  bright: { label: "Bright", color: "#f1f5f9", roughness: 0.6, metalness: 0 },
  mathematics: {
    label: "Mathematics",
    color: "#312e81",
    roughness: 0.55,
    metalness: 0.1,
    emissive: "#818cf8",
    emissiveIntensity: 0.05,
  },
  technology: {
    label: "Technology",
    color: "#134e4a",
    roughness: 0.4,
    metalness: 0.35,
    emissive: "#2dd4bf",
    emissiveIntensity: 0.05,
  },
  premium: {
    label: "Premium",
    color: "#1c1917",
    roughness: 0.35,
    metalness: 0.5,
    emissive: "#f59e0b",
    emissiveIntensity: 0.04,
  },
  neutral: { label: "Neutral", color: "#3f3f46", roughness: 0.6, metalness: 0.1 },
};

export const SURFACE_PRESET_LIST = Object.entries(SURFACE_PRESETS).map(([value, preset]) => ({
  value,
  label: preset.label,
}));

/** Material parameters for a surface, from preset + overrides. */
export const presetMaterial = (
  presetKey: string,
  colorOverride?: string,
): MaterialPreset => {
  const base = SURFACE_PRESETS[presetKey] ?? SURFACE_PRESETS.academic;
  return colorOverride ? { ...base, color: colorOverride } : base;
};