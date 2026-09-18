// Surface registry. Adding a new physical surface = adding one entry here.
// Nothing else in the slate engine changes.

import stoneWall from "@/assets/surfaces/stone-wall.jpg";
import stoneTablet from "@/assets/surfaces/stone-tablet.jpg";
import wood from "@/assets/surfaces/wood.jpg";
import door from "@/assets/surfaces/door.jpg";
import metalPlate from "@/assets/surfaces/metal-plate.jpg";
import scroll from "@/assets/surfaces/scroll.jpg";
import chest from "@/assets/surfaces/chest.jpg";
import shield from "@/assets/surfaces/shield.jpg";
import glass from "@/assets/surfaces/glass.jpg";
import ice from "@/assets/surfaces/ice.jpg";

export type TextTreatment = "carved" | "raised";

export interface SurfaceDef {
  id: string;
  label: string;
  /** Tiling material texture for the slate body. */
  texture: string;
  /** Repeat height of the texture in px at scale 1. */
  tile: number;
  /** Single writing colour for the whole surface. */
  ink: string;
  /** Highlight colour used for the lit edge of the letterforms. */
  inkHighlight: string;
  /** Shadow colour used for the recessed edge of the letterforms. */
  inkShadow: string;
  treatment: TextTreatment;
  /** Panel (writing area) look, expressed as material recipes. */
  panel: {
    background: string;
    border: string;
    inset: string;
    radius: string;
  };
  /** Frame around the whole slate. */
  frame: string;
  /** Ambient light of the material, used by reward glow and focus. */
  accent: string;
  /**
   * No material at all: the writing area is an invisible spatial surface and
   * the world behind it stays fully visible. Only a faint outline remains.
   */
  transparent?: boolean;
  /** A true absence of writing material; unlike transparent, no outline exists. */
  none?: boolean;
  /** Optional compact silhouette treatment layered over the base material. */
  ornament?: "royal" | "leaf" | "magic" | "cloud" | "silk";
  /** Selector grouping only; original entries intentionally omit this. */
  collection?: "new";
  /** Dedicated adaptive physical renderer for the reference collection. */
  newKind?:
    | "plain"
    | "parchment"
    | "royal"
    | "crystal"
    | "wood"
    | "stone"
    | "leaf"
    | "magic"
    | "cloud"
    | "metal"
    | "silk";
}

export const SURFACES: SurfaceDef[] = [
  {
    id: "stone-wall",
    label: "Stone Wall",
    texture: stoneWall,
    tile: 240,
    ink: "#f2dfb4",
    inkHighlight: "rgba(255,240,205,0.75)",
    inkShadow: "rgba(24,12,4,0.95)",
    treatment: "carved",
    panel: {
      background:
        "linear-gradient(180deg, rgba(20,12,5,0.42), rgba(10,6,2,0.26))",
      border: "rgba(214,170,96,0.45)",
      inset:
        "inset 0 3px 10px rgba(0,0,0,0.75), inset 0 -2px 0 rgba(255,214,150,0.18)",
      radius: "6px",
    },
    frame: "rgba(190,146,78,0.55)",
    accent: "#f0b45a",
  },
  {
    id: "stone-tablet",
    label: "Stone Tablet",
    texture: stoneTablet,
    tile: 300,
    ink: "#3d3226",
    inkHighlight: "rgba(255,248,230,0.55)",
    inkShadow: "rgba(30,22,12,0.85)",
    treatment: "carved",
    panel: {
      background:
        "linear-gradient(180deg, rgba(40,32,20,0.22), rgba(20,16,10,0.1))",
      border: "rgba(60,48,30,0.4)",
      inset:
        "inset 0 3px 8px rgba(0,0,0,0.45), inset 0 -2px 0 rgba(255,255,235,0.25)",
      radius: "4px",
    },
    frame: "rgba(90,74,48,0.5)",
    accent: "#c9a76a",
  },
  {
    id: "wood",
    label: "Wooden Plank",
    texture: wood,
    tile: 230,
    ink: "#ffd89a",
    inkHighlight: "rgba(255,236,190,0.8)",
    inkShadow: "rgba(28,14,4,0.95)",
    treatment: "raised",
    panel: {
      background:
        "linear-gradient(180deg, rgba(28,15,5,0.38), rgba(12,7,2,0.22))",
      border: "rgba(226,168,86,0.4)",
      inset:
        "inset 0 2px 8px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(255,206,132,0.22)",
      radius: "10px",
    },
    frame: "rgba(180,120,55,0.55)",
    accent: "#ffb257",
  },
  {
    id: "door",
    label: "Ancient Door",
    texture: door,
    tile: 260,
    ink: "#ffd07a",
    inkHighlight: "rgba(255,226,168,0.8)",
    inkShadow: "rgba(20,10,2,0.95)",
    treatment: "raised",
    panel: {
      background:
        "linear-gradient(180deg, rgba(22,12,4,0.45), rgba(10,5,1,0.25))",
      border: "rgba(212,158,72,0.5)",
      inset:
        "inset 0 3px 10px rgba(0,0,0,0.7), inset 0 -3px 0 rgba(255,198,110,0.2)",
      radius: "14px",
    },
    frame: "rgba(168,112,44,0.6)",
    accent: "#ffab3d",
  },
  {
    id: "metal-plate",
    label: "Engraved Metal Plate",
    texture: metalPlate,
    tile: 260,
    ink: "#ffe2ac",
    inkHighlight: "rgba(255,246,214,0.85)",
    inkShadow: "rgba(14,8,2,0.95)",
    treatment: "carved",
    panel: {
      background:
        "linear-gradient(180deg, rgba(12,8,2,0.5), rgba(6,4,1,0.3))",
      border: "rgba(224,182,102,0.45)",
      inset:
        "inset 0 3px 12px rgba(0,0,0,0.8), inset 0 -2px 0 rgba(255,222,150,0.24)",
      radius: "6px",
    },
    frame: "rgba(196,150,78,0.6)",
    accent: "#f5c46a",
  },
  {
    id: "scroll",
    label: "Ancient Scroll",
    texture: scroll,
    tile: 320,
    ink: "#4a2f16",
    inkHighlight: "rgba(255,248,224,0.7)",
    inkShadow: "rgba(60,36,14,0.5)",
    treatment: "carved",
    panel: {
      background:
        "linear-gradient(180deg, rgba(120,86,40,0.12), rgba(90,64,28,0.06))",
      border: "rgba(120,86,40,0.3)",
      inset:
        "inset 0 2px 6px rgba(90,60,24,0.25), inset 0 -2px 0 rgba(255,250,230,0.5)",
      radius: "4px",
    },
    frame: "rgba(130,94,46,0.45)",
    accent: "#c08b3e",
  },
  {
    id: "chest",
    label: "Treasure Chest",
    texture: chest,
    tile: 250,
    ink: "#ffcf86",
    inkHighlight: "rgba(255,232,180,0.8)",
    inkShadow: "rgba(16,8,2,0.95)",
    treatment: "raised",
    panel: {
      background:
        "linear-gradient(180deg, rgba(18,10,3,0.5), rgba(8,4,1,0.3))",
      border: "rgba(206,154,70,0.45)",
      inset:
        "inset 0 3px 10px rgba(0,0,0,0.75), inset 0 -2px 0 rgba(255,196,104,0.2)",
      radius: "8px",
    },
    frame: "rgba(160,108,42,0.6)",
    accent: "#ffb545",
  },
  {
    id: "shield",
    label: "Shield / Armour",
    texture: shield,
    tile: 280,
    ink: "#eef4ff",
    inkHighlight: "rgba(255,255,255,0.9)",
    inkShadow: "rgba(10,18,32,0.9)",
    treatment: "raised",
    panel: {
      background:
        "linear-gradient(180deg, rgba(16,24,38,0.4), rgba(8,12,20,0.22))",
      border: "rgba(214,178,96,0.45)",
      inset:
        "inset 0 3px 10px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(255,255,255,0.28)",
      radius: "8px",
    },
    frame: "rgba(198,162,88,0.55)",
    accent: "#dcc27a",
  },
  {
    id: "glass",
    label: "Glass Pane",
    texture: glass,
    tile: 340,
    ink: "#dff6ff",
    inkHighlight: "rgba(255,255,255,0.85)",
    inkShadow: "rgba(0,20,30,0.75)",
    treatment: "carved",
    panel: {
      background:
        "linear-gradient(180deg, rgba(160,220,240,0.08), rgba(40,80,100,0.05))",
      border: "rgba(190,235,255,0.28)",
      inset:
        "inset 0 2px 12px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.4)",
      radius: "3px",
    },
    frame: "rgba(190,235,255,0.3)",
    accent: "#8fd8f0",
  },
  {
    id: "ice",
    label: "Ice Surface",
    texture: ice,
    tile: 260,
    ink: "#eaf9ff",
    inkHighlight: "rgba(255,255,255,0.95)",
    inkShadow: "rgba(6,44,76,0.85)",
    treatment: "raised",
    panel: {
      background:
        "linear-gradient(180deg, rgba(180,230,255,0.14), rgba(30,80,120,0.1))",
      border: "rgba(210,245,255,0.4)",
      inset:
        "inset 0 3px 12px rgba(10,50,90,0.45), inset 0 -2px 0 rgba(255,255,255,0.55)",
      radius: "10px",
    },
    frame: "rgba(200,240,255,0.4)",
    accent: "#7fd8ff",
  },
  {
    id: "royal-paper",
    label: "Royal Paper / Plaque",
    texture: scroll,
    tile: 300,
    ink: "#173f91",
    inkHighlight: "rgba(255,245,200,0.9)",
    inkShadow: "rgba(58,24,8,0.72)",
    treatment: "raised",
    panel: { background: "#f3dba4", border: "#d7a72f", inset: "none", radius: "8px" },
    frame: "#d7a72f",
    accent: "#ffd466",
    ornament: "royal",
  },
  {
    id: "leaf-frame",
    label: "Leaf Frame",
    texture: scroll,
    tile: 300,
    ink: "#244d25",
    inkHighlight: "rgba(244,255,221,0.82)",
    inkShadow: "rgba(22,52,20,0.72)",
    treatment: "raised",
    panel: { background: "#eee1bd", border: "#4f853b", inset: "none", radius: "12px" },
    frame: "#4f853b",
    accent: "#8ed35a",
    ornament: "leaf",
  },
  {
    id: "magical-aura",
    label: "Magical Material / Aura",
    texture: glass,
    tile: 340,
    ink: "#fff0ff",
    inkHighlight: "rgba(255,255,255,0.95)",
    inkShadow: "rgba(55,16,90,0.78)",
    treatment: "raised",
    panel: { background: "rgba(160,82,220,0.18)", border: "rgba(225,166,255,0.75)", inset: "none", radius: "10px" },
    frame: "rgba(218,145,255,0.8)",
    accent: "#d886ff",
    ornament: "magic",
  },
  {
    id: "cloud",
    label: "Cloud",
    texture: ice,
    tile: 300,
    ink: "#173f91",
    inkHighlight: "rgba(255,255,255,0.95)",
    inkShadow: "rgba(44,78,116,0.6)",
    treatment: "raised",
    panel: { background: "rgba(240,248,255,0.82)", border: "rgba(210,235,255,0.8)", inset: "none", radius: "18px" },
    frame: "rgba(225,244,255,0.9)",
    accent: "#dff4ff",
    ornament: "cloud",
  },
  {
    id: "silk-ribbon",
    label: "Silk Ribbon",
    texture: scroll,
    tile: 300,
    ink: "#fff3c4",
    inkHighlight: "rgba(255,255,255,0.9)",
    inkShadow: "rgba(92,4,30,0.7)",
    treatment: "raised",
    panel: { background: "#c82052", border: "#efbd49", inset: "none", radius: "10px" },
    frame: "#efbd49",
    accent: "#ffcf58",
    ornament: "silk",
  },
  {
    id: "transparent",
    label: "Transparent Slate",
    texture: glass,
    tile: 340,
    ink: "#ffffff",
    inkHighlight: "rgba(255,255,255,0.9)",
    inkShadow: "rgba(0,0,0,0.85)",
    treatment: "raised",
    panel: {
      background: "transparent",
      border: "rgba(255,255,255,0.18)",
      inset: "none",
      radius: "4px",
    },
    frame: "rgba(255,255,255,0.14)",
    accent: "#cfe6ff",
    transparent: true,
  },
  {
    id: "none",
    label: "None",
    texture: glass,
    tile: 340,
    ink: "#ffffff",
    inkHighlight: "rgba(255,255,255,0.9)",
    inkShadow: "rgba(0,0,0,0.85)",
    treatment: "raised",
    panel: { background: "transparent", border: "transparent", inset: "none", radius: "0" },
    frame: "transparent",
    accent: "#ffffff",
    none: true,
    collection: "new",
  },
  {
    id: "plain",
    label: "Plain",
    texture: glass,
    tile: 340,
    ink: "#172033",
    inkHighlight: "rgba(255,255,255,0.82)",
    inkShadow: "rgba(0,0,0,0.62)",
    treatment: "raised",
    panel: { background: "#f4ead7", border: "rgba(255,255,255,0.4)", inset: "none", radius: "6px" },
    frame: "rgba(255,255,255,0.28)",
    accent: "#f4ead7",
    collection: "new",
    newKind: "plain",
  },
  {
    id: "new-parchment-scroll", label: "Parchment Scroll", texture: scroll, tile: 320,
    ink: "#4a2f16", inkHighlight: "rgba(255,248,224,0.7)", inkShadow: "rgba(60,36,14,0.5)", treatment: "carved",
    panel: { background: "#e7c98e", border: "#9a5a22", inset: "none", radius: "4px" }, frame: "#9a5a22", accent: "#ffd96b",
    collection: "new", newKind: "parchment",
  },
  {
    id: "new-royal-plaque", label: "Royal Plaque", texture: scroll, tile: 300,
    ink: "#173f91", inkHighlight: "rgba(255,245,200,0.9)", inkShadow: "rgba(58,24,8,0.72)", treatment: "raised",
    panel: { background: "#f1dfb9", border: "#e4aa29", inset: "none", radius: "8px" }, frame: "#e4aa29", accent: "#ffd96b",
    collection: "new", newKind: "royal",
  },
  {
    id: "new-crystal-glass", label: "Crystal Glass", texture: glass, tile: 340,
    ink: "#dff6ff", inkHighlight: "rgba(255,255,255,0.9)", inkShadow: "rgba(0,20,30,0.72)", treatment: "raised",
    panel: { background: "rgba(219,234,255,0.16)", border: "rgba(168,239,255,0.9)", inset: "none", radius: "8px" }, frame: "rgba(222,239,255,0.82)", accent: "#64e9ff",
    collection: "new", newKind: "crystal",
  },
  {
    id: "new-wooden-sign", label: "Wooden Sign", texture: wood, tile: 230,
    ink: "#ffd89a", inkHighlight: "rgba(255,236,190,0.8)", inkShadow: "rgba(28,14,4,0.95)", treatment: "raised",
    panel: { background: "#6f3919", border: "#9d6031", inset: "none", radius: "6px" }, frame: "#6a3518", accent: "#d48b42",
    collection: "new", newKind: "wood",
  },
  {
    id: "new-stone-tablet", label: "Stone Tablet", texture: stoneTablet, tile: 300,
    ink: "#3d3226", inkHighlight: "rgba(255,248,230,0.55)", inkShadow: "rgba(30,22,12,0.85)", treatment: "carved",
    panel: { background: "#78736c", border: "#4b4742", inset: "none", radius: "10px" }, frame: "#5a554e", accent: "#aaa39a",
    collection: "new", newKind: "stone",
  },
  {
    id: "new-leaf-frame", label: "Leaf Frame", texture: scroll, tile: 300,
    ink: "#244d25", inkHighlight: "rgba(244,255,221,0.82)", inkShadow: "rgba(22,52,20,0.72)", treatment: "raised",
    panel: { background: "#eee1bd", border: "#4f853b", inset: "none", radius: "12px" }, frame: "#4f853b", accent: "#8ed35a",
    collection: "new", newKind: "leaf",
  },
  {
    id: "new-magical-aura", label: "Magical Aura", texture: glass, tile: 340,
    ink: "#3c2458", inkHighlight: "rgba(255,250,224,0.95)", inkShadow: "rgba(55,16,90,0.7)", treatment: "raised",
    panel: { background: "#eed8aa", border: "rgba(100,233,255,0.86)", inset: "none", radius: "10px" }, frame: "rgba(165,60,255,0.88)", accent: "#64e9ff",
    collection: "new", newKind: "magic",
  },
  {
    id: "new-cloud-panel", label: "Cloud Panel", texture: ice, tile: 300,
    ink: "#173f91", inkHighlight: "rgba(255,255,255,0.95)", inkShadow: "rgba(44,78,116,0.6)", treatment: "raised",
    panel: { background: "rgba(247,251,255,0.9)", border: "rgba(191,228,255,0.9)", inset: "none", radius: "18px" }, frame: "rgba(211,232,251,0.94)", accent: "#f7fbff",
    collection: "new", newKind: "cloud",
  },
  {
    id: "new-metal-plate", label: "Metal Plate", texture: metalPlate, tile: 260,
    ink: "#172033", inkHighlight: "rgba(255,255,255,0.85)", inkShadow: "rgba(0,0,0,0.82)", treatment: "carved",
    panel: { background: "#7f858b", border: "#c7ccd0", inset: "none", radius: "5px" }, frame: "#656a70", accent: "#d9dde1",
    collection: "new", newKind: "metal",
  },
  {
    id: "new-silk-ribbon", label: "Silk Ribbon", texture: scroll, tile: 300,
    ink: "#fff3c4", inkHighlight: "rgba(255,255,255,0.9)", inkShadow: "rgba(92,4,30,0.7)", treatment: "raised",
    panel: { background: "#c80d35", border: "#e4aa29", inset: "none", radius: "10px" }, frame: "#e4aa29", accent: "#ffd96b",
    collection: "new", newKind: "silk",
  },
];

export const EXISTING_SURFACES = SURFACES.filter((surface) => !surface.collection);
export const NEW_SURFACES = SURFACES.filter((surface) => surface.collection === "new");

export const getSurface = (id: string): SurfaceDef =>
  SURFACES.find((s) => s.id === id) ?? {
    id: "stone-wall", label: "Stone Wall", texture: stoneWall, tile: 240,
    ink: "#f2dfb4", inkHighlight: "rgba(255,240,205,0.75)", inkShadow: "rgba(24,12,4,0.95)", treatment: "carved",
    panel: { background: "rgba(20,12,5,0.42)", border: "rgba(214,170,96,0.45)", inset: "inset 0 3px 10px rgba(0,0,0,0.75)", radius: "6px" },
    frame: "rgba(190,146,78,0.55)", accent: "#f0b45a",
  };
