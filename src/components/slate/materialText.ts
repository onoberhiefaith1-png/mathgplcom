import type { CSSProperties } from "react";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { WritingSettings } from "@/lib/slate/types";

/**
 * Builds the layered depth treatment for writing on a given material.
 * Carved letters sit in the surface (light catches the lower lip),
 * raised letters stand out of it (light catches the upper lip).
 */
export const materialTextStyle = (
  surface: SurfaceDef,
  w: WritingSettings,
  focus = 1,
): CSSProperties => {
  const treatment = w.style === "material" ? surface.treatment : w.style;
  const d = w.depth * focus;
  const b = w.bevel * focus;
  const s = w.shadow * focus;
  const h = w.highlight * focus;

  const layers: string[] = [];
  const extrude = (dir: number) => {
    for (let i = 1; i <= Math.round(4 * d); i++) {
      layers.push(`0 ${dir * i}px 0 ${surface.inkShadow}`);
    }
  };

  if (treatment === "carved") {
    layers.push(`0 ${-1.2 * b}px ${1.4 * b}px ${surface.inkShadow}`);
    extrude(-1);
    layers.push(`0 ${1.2 * b}px 0 ${surface.inkHighlight}`);
    layers.push(`0 ${2.2 * b}px ${2 * b}px rgba(255,255,255,${0.18 * h})`);
    layers.push(`0 ${3 * s}px ${6 * s}px rgba(0,0,0,${0.45 * s})`);
  } else {
    layers.push(`0 ${-1 * b}px 0 ${surface.inkHighlight}`);
    extrude(1);
    layers.push(`0 ${4 * d + 2}px ${4 * s}px rgba(0,0,0,${0.6 * s})`);
    layers.push(`0 ${7 * s}px ${12 * s}px rgba(0,0,0,${0.35 * s})`);
  }

  return {
    color: surface.ink,
    opacity: w.opacity,
    fontSize: `${w.size}px`,
    lineHeight: 1.5,
    letterSpacing: "0.01em",
    textShadow: layers.join(", "),
    fontWeight: 700,
  };
};

/**
 * Material-specific letterforms. Stone is deeply engraved, metal has a hard
 * bevel with a specular lip, glass is a thin luminous etch, ice reads as
 * embedded depth. Legibility is the ceiling: every recipe keeps the letter
 * body itself at full contrast.
 */
export const surfaceTextStyle = (
  surface: SurfaceDef,
  w: WritingSettings,
  focus = 1,
): CSSProperties => {
  const d = w.depth * focus;
  const b = Math.max(0.5, w.bevel * focus);
  const s = w.shadow * focus;
  const h = w.highlight * focus;
  const base: CSSProperties = {
    opacity: w.opacity,
    fontSize: `${w.size}px`,
    lineHeight: 1.45,
    fontWeight: 800,
  };

  switch (surface.id) {
    case "stone-wall":
    case "stone-tablet":
      return {
        ...base,
        color: surface.ink,
        letterSpacing: "0.035em",
        textShadow: [
          `0 ${-1.4 * b}px 0 rgba(0,0,0,0.9)`,
          `0 ${-2.6 * b}px ${2 * b}px rgba(0,0,0,0.8)`,
          `0 ${1.3 * b}px 0 ${surface.inkHighlight}`,
          `0 ${2.6 * b}px ${2.4 * b}px rgba(255,236,198,${0.22 * h})`,
          `0 ${4 * s}px ${8 * s}px rgba(0,0,0,${0.55 * s})`,
        ].join(", "),
      };
    case "wood":
    case "door":
    case "chest":
      return {
        ...base,
        color: surface.ink,
        letterSpacing: "0.02em",
        textShadow: [
          `0 ${-1 * b}px 0 rgba(255,222,170,${0.5 * h})`,
          `0 ${1.2 * d}px 0 rgba(38,19,4,0.95)`,
          `0 ${2.4 * d}px 0 rgba(26,13,3,0.85)`,
          `0 ${3.6 * d}px ${4 * s}px rgba(0,0,0,${0.6 * s})`,
        ].join(", "),
      };
    case "metal-plate":
    case "shield":
      return {
        ...base,
        color: surface.ink,
        letterSpacing: "0.05em",
        textShadow: [
          `0 ${-1 * b}px 0 rgba(0,0,0,0.95)`,
          `${0.6 * b}px ${-0.6 * b}px 0 rgba(0,0,0,0.7)`,
          `0 ${1 * b}px 0 rgba(255,255,255,${0.85 * h})`,
          `0 ${2 * b}px ${1.4 * b}px rgba(190,220,255,${0.32 * h})`,
          `0 ${3 * s}px ${7 * s}px rgba(0,0,0,${0.55 * s})`,
        ].join(", "),
      };
    case "scroll":
      return {
        ...base,
        color: surface.ink,
        fontWeight: 700,
        letterSpacing: "0.015em",
        textShadow: [
          `0 0 ${1.4 * b}px rgba(74,47,22,0.55)`,
          `0 ${1 * b}px 0 rgba(255,250,232,0.6)`,
          `0 ${2 * s}px ${3 * s}px rgba(96,64,26,${0.3 * s})`,
        ].join(", "),
      };
    case "glass":
      return {
        ...base,
        color: "rgba(240,252,255,0.96)",
        letterSpacing: "0.06em",
        textShadow: [
          `0 0 ${2 * b}px rgba(190,240,255,0.9)`,
          `0 0 ${6 * b}px rgba(120,215,255,${0.6 * h})`,
          `0 ${-1 * b}px 0 rgba(0,40,60,0.6)`,
          `0 ${1 * b}px 0 rgba(255,255,255,0.75)`,
        ].join(", "),
      };
    case "ice":
      return {
        ...base,
        color: "rgba(236,250,255,0.97)",
        letterSpacing: "0.04em",
        textShadow: [
          `0 ${-1.2 * b}px 0 rgba(6,44,76,0.85)`,
          `0 ${-2.4 * b}px ${2.4 * b}px rgba(10,60,100,0.7)`,
          `0 ${1.2 * b}px 0 rgba(255,255,255,0.9)`,
          `0 0 ${7 * b}px rgba(150,225,255,${0.5 * h})`,
          `0 ${3 * s}px ${7 * s}px rgba(4,30,52,${0.5 * s})`,
        ].join(", "),
      };
    default:
      return materialTextStyle(surface, w, focus);
  }
};
