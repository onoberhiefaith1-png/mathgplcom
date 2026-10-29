// Async AI work follows a stable heading identity, never a cached offset or
// the current caret. Otherwise edits/normalization can move the target while
// the network request runs and put a solution above its own heading.
interface HeadingNode {
  type: { name: string };
  attrs?: Record<string, unknown>;
  nodeSize?: number;
}
interface HeadingDocument {
  nodeAt(position: number): HeadingNode | null;
  descendants(visit: (node: HeadingNode, position: number) => boolean | void): void;
}
export type AiSectionTarget =
  | { kind: "section"; id: string }
  | { kind: "solution"; owner: string }
  | { kind: "legacy"; node: HeadingNode };

export function captureAiSectionTarget(doc: HeadingDocument, position: number): AiSectionTarget | null {
  const node = doc.nodeAt(position);
  if (node?.type.name !== "heading") return null;
  const owner = node.attrs?.ownerQuestionId;
  if (typeof owner === "string" && owner) return { kind: "solution", owner };
  const id = node.attrs?.sectionId;
  if (typeof id === "string" && id) return { kind: "section", id };
  // Legacy nodes have no durable ID. Retain immutable node identity and refuse
  // a replacement; never guess from duplicate labels such as “Solution”.
  return { kind: "legacy", node };
}

export function resolveAiSectionTarget(doc: HeadingDocument, target: AiSectionTarget): number | null {
  const positions: number[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== "heading") return;
    const matches = target.kind === "solution" ? node.attrs?.ownerQuestionId === target.owner
      : target.kind === "section" ? node.attrs?.sectionId === target.id
      : node === target.node;
    if (matches) positions.push(position);
  });
  // Duplicated or deleted IDs are ambiguous. Saving nothing is safer than
  // silently writing into a different teacher question.
  return positions.length === 1 ? positions[0] : null;
}

/** Snapshot the body, not its heading: an empty “Solution” label is not work. */
export function readAiHeadingBody(
  doc: HeadingDocument, position: number, end: number,
  serialize: (from: number, to: number) => string,
): string {
  const node = doc.nodeAt(position);
  if (node?.type.name !== "heading" || !node.nodeSize || node.nodeSize < 1) return "";
  const from = position + node.nodeSize;
  return end > from ? serialize(from,end).trim() : "";
}
