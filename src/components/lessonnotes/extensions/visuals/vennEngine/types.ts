// Universal Venn Diagram Engine — shared types.

export type SetLayout =
  | "twoIntersect" | "twoDisjoint"
  | "threeAll" | "threeOneDisjoint" | "threeChain" | "threeAllDisjoint"
  | "custom";

export type SetId = "A" | "B" | "C";

export const DEFAULT_SET_COLOURS: Record<SetId, string> = {
  A: "#3B82F6",
  B: "#F97316",
  C: "#22C55E",
};

export const DEFAULT_SET_FILL_OPACITY = 0.12;

export interface VennSet {
  id: SetId;
  label: string;
  radius: number;
  colour: string;
  fill: string;         // "none" or hex
  fillOpacity: number;
  thickness: number;
  visible: boolean;
  cx: number; cy: number;
  manualPlacement: boolean;
}

export interface VennRelations {
  AB: boolean; AC: boolean; BC: boolean;
}

export interface UniversalSet {
  show: boolean;
  padding: number;
  border: number;
  borderColour: string;
  background: string;       // "none" or hex
  backgroundOpacity: number;
}

export interface RegionOverride {
  /** Region key: sorted set-ids present, e.g. "A", "AB", "ABC", "" (outside). */
  key: string;
  text: string;
  fill: string;             // "none" or hex
  fillOpacity: number;
}

export interface UCEVennModel {
  presetId: string;
  layout: SetLayout;
  numSets: 2 | 3;
  relations: VennRelations;
  sets: VennSet[];
  universe: UniversalSet;
  regions: RegionOverride[];
  /** Non-physical write-up values: "union:AB", "inter:AB" (3-set), "universe". */
  expressions?: Record<string, string>;
  /** Semantic expression currently presented in teaching/focus mode. Missing = overview mode. */
  focusExpression?: string | null;
  width: number;
  height: number;
}

export const LAYOUT_LABEL: Record<SetLayout, string> = {
  twoIntersect: "Two sets — intersecting",
  twoDisjoint: "Two sets — disjoint",
  threeAll: "Three sets — all intersect",
  threeOneDisjoint: "Three sets — one disjoint",
  threeChain: "Three sets — chain",
  threeAllDisjoint: "Three sets — all disjoint",
  custom: "Custom",
};

export const DEFAULT_UNIVERSE: UniversalSet = {
  show: false,
  padding: 12,
  border: 1,
  borderColour: "#111827",
  background: "none",
  backgroundOpacity: 0.05,
};

export function defaultSet(id: SetId, cx: number, cy: number, colour: string): VennSet {
  return {
    id, label: id,
    radius: 55,
    colour, fill: colour, fillOpacity: DEFAULT_SET_FILL_OPACITY,
    thickness: 2,
    visible: true,
    cx, cy,
    manualPlacement: false,
  };
}
