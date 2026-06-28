// Relationship — a teacher-editable mathematical fact attached to a
// selection in a diagram. Relationships can be AI-suggested (from the
// built-in theorem library or the AI editor) or teacher-authored.
//
// Stored on `scene.meta.relationships` keyed by a stable signature of
// the current selection so that approved relationships persist with the
// lesson and are reused next time the same parts are selected.

import type { SmartPartBase } from "./parts";

export type RelConfidence = "high" | "medium" | "teacher";

export interface Relationship {
  id: string;
  name: string;
  formula: string;          // generic / symbolic form
  applied?: string;         // substituted form using values from the diagram
  explanation: string;
  confidence: RelConfidence;
  source: "library" | "ai" | "teacher";
  pinned?: boolean;
  hidden?: boolean;
  /** Optional theorem id from the built-in library. */
  theoremId?: string;
}

/** Stable, order-independent signature of a selection. */
export function selectionSignature(parts: SmartPartBase[]): string {
  if (parts.length === 0) return "";
  return parts
    .map((p) => `${p.kind}:${p.label}`)
    .sort()
    .join("|");
}

export function genId(): string {
  return `rel_${Math.random().toString(36).slice(2, 9)}`;
}
