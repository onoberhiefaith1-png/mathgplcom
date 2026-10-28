import type { JSONContent } from "@tiptap/core";

/** Fragment.toJSON() returns null at paragraph boundaries, not an empty array. */
export function structuredSelectionReplacement(
  parent: JSONContent,
  before: JSONContent[] | null,
  generated: JSONContent[],
  after: JSONContent[] | null,
): JSONContent[] {
  return [
    ...(before?.length ? [{ ...parent, content: before }] : []),
    ...generated,
    ...(after?.length ? [{ ...parent, content: after }] : []),
  ];
}

/** Math atoms keep their source in attrs.value rather than child text. */
export function lessonAiLeafText(node: { attrs?: Record<string, unknown> }): string {
  const value = node.attrs?.value;
  return typeof value === "string" ? value : "\n";
}
