// Aura's operational knowledge: one node per real MathGPL workflow.
//
// A node is not a feature description. It answers, in order, what a teacher
// actually experiences: what this is, why it exists, who uses it, where it
// lives, what they do first, what follows, what saving creates, where the
// result shows up, what to do next, and what it connects to.
//
// Client-safe strings only, so tests can assert on the whole map.

export type KnowledgeNode = {
  /** Stable id used by the route selector and by `connectedTo`. */
  id: string;
  title: string;
  /** What it is and why it exists, in the teacher's words. */
  purpose: string;
  whoUses: string[];
  /** A real in-app path. May contain $params. */
  entryPath: string;
  firstStep: string;
  /** What MathGPL requires before anything can be saved. */
  inputs: string[];
  /** What can be done here, in the order a teacher meets them. */
  actions: string[];
  /** What saving actually creates. */
  onSave: string;
  /** Where the saved thing becomes visible, and to whom. */
  whereItAppears: string;
  /** The logical next steps, best first. */
  nextSteps: string[];
  /** Other node ids this depends on or feeds. */
  connectedTo: string[];
  /** Things Aura must never get wrong about this workflow. */
  pitfalls: string[];
};

export const REQUIRED_NODE_FIELDS: (keyof KnowledgeNode)[] = [
  "id",
  "title",
  "purpose",
  "whoUses",
  "entryPath",
  "firstStep",
  "inputs",
  "actions",
  "onSave",
  "whereItAppears",
  "nextSteps",
  "connectedTo",
  "pitfalls",
];

/** One node written out for the agent's system prompt. */
export function nodePrompt(node: KnowledgeNode): string {
  const list = (label: string, items: string[]) =>
    items.length ? `  ${label}: ${items.join(" | ")}` : "";
  return [
    `## ${node.title} [${node.id}]`,
    `  What & why: ${node.purpose}`,
    list("Who", node.whoUses),
    `  Where: ${node.entryPath}`,
    `  First step: ${node.firstStep}`,
    list("Needs", node.inputs),
    list("Can do", node.actions),
    `  On save: ${node.onSave}`,
    `  Appears: ${node.whereItAppears}`,
    list("Next", node.nextSteps),
    list("Connects to", node.connectedTo),
    list("Never get wrong", node.pitfalls),
  ]
    .filter(Boolean)
    .join("\n");
}

/** One line per node: Aura always carries this, so she never denies a feature exists. */
export function nodeIndexLine(node: KnowledgeNode): string {
  return `- ${node.title} [${node.id}] — ${node.entryPath} — ${node.purpose.split(". ")[0]}.`;
}
