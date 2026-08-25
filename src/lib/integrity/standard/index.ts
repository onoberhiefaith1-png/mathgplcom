/**
 * MathGPL Permanent System Standard — registry.
 *
 * Phase 1 deliverable: the inventory itself. Nothing here runs automatically and
 * nothing here changes application behaviour. The future Administrator-triggered
 * CHECK SYSTEM screen reads `ALL_DOMAINS` and walks it requirement by
 * requirement.
 *
 * Ids are stable and are never renumbered or reused. A requirement that is
 * retired keeps its id with permanent: "RETIRED".
 */
import type { Requirement, RequirementDomain } from "../types";
import { platformCore } from "./core";
import { authentication, accounts, workspaces } from "./identity";
import { rotatingBuilding, publicSite } from "./building";
import { lessonNotes, mathEditing, tables, charts } from "./lessonNotes";
import { geometry2d, area, geometryProperties, geometry3d, diagrams } from "./geometry";
import { smartboard, floating, slides } from "./smartboard";
import { classes, assessment, reports, adventure, courses, live, community } from "./classroom";
import { commerce, gateway, adminConsole, assets, aiLayers, stability, design } from "./platformOps";

export const ALL_DOMAINS: RequirementDomain[] = [
  platformCore,
  authentication,
  accounts,
  workspaces,
  rotatingBuilding,
  publicSite,
  lessonNotes,
  mathEditing,
  tables,
  charts,
  geometry2d,
  area,
  geometryProperties,
  geometry3d,
  diagrams,
  smartboard,
  floating,
  slides,
  classes,
  assessment,
  reports,
  adventure,
  courses,
  live,
  community,
  commerce,
  gateway,
  adminConsole,
  assets,
  aiLayers,
  stability,
  design,
];

export const ALL_REQUIREMENTS: Requirement[] = ALL_DOMAINS.flatMap((d) => d.requirements);

export function requirementById(id: string): Requirement | undefined {
  return ALL_REQUIREMENTS.find((r) => r.id === id);
}

export function domainOf(id: string): RequirementDomain | undefined {
  return ALL_DOMAINS.find((d) => d.requirements.some((r) => r.id === id));
}

/** Requirement ids that must be re-checked when the given requirement changes. */
export function dependentsOf(id: string): string[] {
  return ALL_REQUIREMENTS.filter((r) => r.dependencies?.includes(id)).map((r) => r.id);
}

/** Duplicate-id guard: an id collision would corrupt permanent approval records. */
export function duplicateIds(): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of ALL_REQUIREMENTS) {
    if (seen.has(r.id)) dupes.push(r.id);
    seen.add(r.id);
  }
  return dupes;
}

/** Requirements whose dependencies point at ids that do not exist. */
export function danglingDependencies(): Array<{ id: string; missing: string[] }> {
  const ids = new Set(ALL_REQUIREMENTS.map((r) => r.id));
  const out: Array<{ id: string; missing: string[] }> = [];
  for (const r of ALL_REQUIREMENTS) {
    const missing = (r.dependencies ?? []).filter((d) => !ids.has(d));
    if (missing.length) out.push({ id: r.id, missing });
  }
  return out;
}

export { platformCore, authentication, accounts, workspaces, rotatingBuilding, publicSite };
export { lessonNotes, mathEditing, tables, charts };
export { geometry2d, area, geometryProperties, geometry3d, diagrams };
export { smartboard, floating, slides };
export { classes, assessment, reports, adventure, courses, live, community };
export { commerce, gateway, adminConsole, assets, aiLayers, stability, design };
