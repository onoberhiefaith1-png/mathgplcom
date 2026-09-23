// Native objects in AI Edit. When the teacher hands AI Edit an object that is
// already a MathGPL object (geometry, table, graph, matrix, maths), it is
// duplicated/edited from its own data — never from a screenshot.

type Node = any;

const NATIVE_TYPES = new Set([
  "geometryDiagram", "mathVisual", "mathStructure", "mathTable", "mathInline",
  "mathBlock", "smartGraph", "smartCalc", "scene3DDiagram", "mathObject",
]);

/** Flatten a selection JSON (array, fragment or doc) into top-level nodes. */
function nodesOf(json: unknown): Node[] {
  if (Array.isArray(json)) return json;
  const j = json as any;
  if (Array.isArray(j?.content)) return j.content;
  return j ? [j] : [];
}

/** The native object types present in a selection. */
export function nativeTypesIn(json: unknown): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (!n || typeof n !== "object") return;
    if (NATIVE_TYPES.has(n.type)) out.add(n.type);
    (n.content ?? []).forEach(walk);
  };
  nodesOf(json).forEach(walk);
  return [...out];
}

export const isDuplicateInstruction = (s: string) =>
  /\b(duplicate|copy|clone|make (a|another) copy|same again)\b/i.test(s || "");

/** Deep clone with every per-instance id dropped, so the copy is independent. */
export function freshCopy(node: Node): Node {
  const clone = JSON.parse(JSON.stringify(node));
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (n.attrs && typeof n.attrs === "object") {
      delete n.attrs.diagramId;
      delete n.attrs.instanceId;
      if (n.attrs.attrs && typeof n.attrs.attrs === "object") delete n.attrs.attrs.__instanceId;
    }
    (n.content ?? []).forEach(walk);
  };
  walk(clone);
  return clone;
}

/** Encode nodes as a `native` directive the normal AI Edit pipeline can carry. */
export function nativeDirective(nodes: Node[], keep = false): string {
  return `[[tool:native${keep ? ' keep="1"' : ""} data="${encodeURIComponent(JSON.stringify(nodes))}"]]`;
}

export function decodeNative(params: Record<string, string>): Node[] | null {
  try {
    const nodes = JSON.parse(decodeURIComponent(params.data ?? ""));
    if (!Array.isArray(nodes)) return null;
    return params.keep === "1" ? nodes : nodes.map(freshCopy);
  } catch {
    return null;
  }
}

/** Duplicate proposal: the original (untouched) followed by an independent copy. */
export function duplicateProposal(json: unknown): string | null {
  const nodes = nodesOf(json);
  if (!nodes.length || !nativeTypesIn(nodes).length) return null;
  return `${nativeDirective(nodes, true)}\n${nativeDirective(nodes)}`;
}
