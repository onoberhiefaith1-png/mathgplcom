// Central asset registry types. Every insertable item in the @-menu is
// declared as a plain data object — adding a new asset means appending
// one AssetDef, no editor code changes required.

export type AssetCategory =
  | "Symbols"
  | "Structures"
  | "Diagrams"
  | "Graphs"
  | "Tables"
  | "Manipulatives"
  | "Measurement"
  | "Real-world";

export type AssetRender =
  /** Inline unicode text — inserted as plain text. */
  | { kind: "symbol"; char: string }
  /** Elastic structure with N editable inline slots. */
  | { kind: "structure"; structure: string; slots: number; attrs?: Record<string, unknown> }
  /** Atomic SVG / visual node. */
  | { kind: "visual"; visual: string; attrs?: Record<string, unknown> }
  /** Drill-down submenu of variants. */
  | { kind: "variants"; children: AssetDef[] };

export interface AssetDef {
  id: string;
  /** Standard Name — descriptive, shown in menus and the Asset Library. */
  label: string;
  /**
   * Short Code — uppercase keyboard shortcut used by the @-command menu.
   * Optional at author time; the registry auto-derives a unique default
   * for every asset that omits it.
   */
  shortCode?: string;
  category: AssetCategory;
  /** Optional sub-group inside the category (e.g. "Basic", "Greek"). */
  group?: string;
  keywords: string[];
  render: AssetRender;
  /** Hint shown on the right side of the menu row. */
  hint?: string;
  /**
   * Optional pre-insert dialog id. When set, clicking the tile opens a
   * dialog that gathers parameters (rows, cols, bracket…) before insert.
   */
  openDialog?: "matrix" | "matrixColVec" | "matrixRowVec" | "matrixIdentity" | "matrixAugmented";
}

