// Workspace Tool Manifest — the single list of platform tools the AI
// Generator is allowed to drive.
//
// The manifest is DERIVED, not hand-written:
//   • every entry of the Asset Library registry (symbols, structures,
//     diagrams, graphs, tables, manipulatives, measurement, real-world)
//   • every editor node that represents a workspace tool
//
// Adding a new asset or a new workspace node therefore grants the AI
// permission to use it with no further work — the future-proof rule.

import { ALL_ASSETS, searchAssets } from "@/lib/lessonnotes/assets/registry";
import type { AssetDef } from "@/lib/lessonnotes/assets/types";
import { SOLID_DEFS } from "@/lib/geometry3d/scene3d";

export interface WorkspaceTool {
  /** Directive id the AI writes, e.g. `smartTable`. */
  id: string;
  label: string;
  /** One-line description injected into the AI prompt. */
  usage: string;
  /** Example directive shown to the model. */
  example: string;
}

/** Node-backed workspace tools (the toolbar buttons a teacher would press). */
export const NODE_TOOLS: WorkspaceTool[] = [
  {
    id: "smartTable",
    label: "Smart Table",
    usage:
      "ANY table (frequency, mean, statistics, function, two-way, tally, grouped data). Never type a table by hand.",
    example:
      '[[tool:smartTable headers="x | x - x̄ | |x - x̄|" rows="6 | -3.71 | 3.71 ; 7 | -2.71 | 2.71"]]',
  },
  {
    id: "graph",
    label: "Graph Workspace",
    usage:
      "Plotting equations, curves, coordinate points, bar/line data. Never draw a graph with characters.",
    example: '[[tool:graph equation="x^2-4*x+3" xMin="-2" xMax="6" xLabel="x" yLabel="y"]]',
  },
  {
    id: "diagram",
    label: "2D Diagram / Asset Library",
    usage:
      "Any 2D shape, angle, chart or diagram. Give the Asset Library name; the platform inserts the real editable object.",
    example: '[[tool:diagram asset="triangleRight" label="ABC"]]',
  },
  {
    id: "solid3d",
    label: "3D Objects",
    usage:
      `Any solid: ${Object.keys(SOLID_DEFS).join(", ")}. Supply dimensions as params.`,
    example: '[[tool:solid3d kind="sphere" radius="3"]]',
  },
  {
    id: "calc",
    label: "Calculator Engine",
    usage:
      "Show a worked calculation (formula → substitution → steps → answer) as an editable calculator object.",
    example:
      '[[tool:calc expression="16.29/7" formula="MD = Σ|x - x̄| / N" substitution="16.29 / 7" steps="16.29 ÷ 7" answer="2.33"]]',
  },
  {
    id: "structure",
    label: "Mathematical Structure",
    usage:
      "Fractions, roots, powers and other elastic structures that must stay editable slot-by-slot.",
    example: '[[tool:structure kind="fraction" slots="Σ|x - x̄| | N"]]',
  },
  {
    id: "asset",
    label: "Asset Library search",
    usage:
      "Reuse ANY existing library asset by name when nothing more specific fits.",
    example: '[[tool:asset query="venn diagram"]]',
  },
];

/** Asset-library entries, condensed for prompting. */
export function assetCatalogForPrompt(limit = 220): string {
  const byCategory = new Map<string, string[]>();
  for (const a of ALL_ASSETS) {
    const list = byCategory.get(a.category) ?? [];
    if (list.length < 60) list.push(a.id);
    byCategory.set(a.category, list);
  }
  const lines: string[] = [];
  let count = 0;
  for (const [cat, ids] of byCategory) {
    if (count >= limit) break;
    const slice = ids.slice(0, Math.max(0, limit - count));
    count += slice.length;
    lines.push(`${cat}: ${slice.join(", ")}`);
  }
  return lines.join("\n");
}

/** Full manifest text sent to the edge function on every generation. */
export function buildWorkspaceManifest(): string {
  const tools = NODE_TOOLS.map(
    (t) => `• ${t.id} — ${t.label}. ${t.usage}\n  ${t.example}`,
  ).join("\n");
  return [
    "WORKSPACE TOOLS (use these instead of typing content by hand):",
    tools,
    "",
    "ASSET LIBRARY (ids usable with [[tool:diagram asset=\"…\"]] or [[tool:asset query=\"…\"]]):",
    assetCatalogForPrompt(),
  ].join("\n");
}

/** Resolve an Asset Library entry by id first, then by fuzzy search. */
export function resolveAsset(query: string): AssetDef | null {
  if (!query) return null;
  const q = query.trim();
  const exact = ALL_ASSETS.find((a) => a.id.toLowerCase() === q.toLowerCase());
  if (exact) return exact;
  const hits = searchAssets(q, 1);
  return hits[0] ?? null;
}

export const WORKSPACE_TOOL_IDS = NODE_TOOLS.map((t) => t.id);
