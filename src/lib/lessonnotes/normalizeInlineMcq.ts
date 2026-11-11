import { nodeText } from "./lessonOutline";
import { isMcqAnswerLabel, parseInlineMcq } from "./inlineMcq";

type Node = { type: string; attrs?: Record<string, unknown> | null; content?: Node[]; text?: string };
const question = (n: Node) => n.type === "heading" && /^(?:question|example|exercise|classwork|homework|assessment|quiz|problem|practice|task)\b/i.test(nodeText(n).trim());
const solution = (n: Node) => n.type === "heading" && /^solution\b/i.test(nodeText(n).trim());
const boundary = (n: Node) => n.type === "heading" && (Number(n.attrs?.level ?? 6) <= 3 || solution(n));

/** An answer row owns Assign; an MCQ never receives an empty worked area.
 * Existing nonempty working is preserved, even when a pasted MCQ has it. */
export function normalizeInlineMcqDocument<T extends Node>(doc: T): { doc: T; changed: boolean } {
  if (!doc?.content) return { doc, changed: false };
  let changed = false;
  const visit = (nodes: Node[]): Node[] => {
    const out = nodes.map(n => {
      if (!["canvasFrame", "pageFrame", "canvasLayer"].includes(n.type) || !n.content) return n;
      return { ...n, content: visit(n.content) };
    });
    for (let i = 0; i < out.length; i++) {
      if (!question(out[i])) continue;
      let end = i + 1;
      while (end < out.length && !boundary(out[end])) end++;
      const body = out.slice(i + 1, end).map(nodeText).join("\n");
      if (!parseInlineMcq(body)) continue;
      const answerAt = out.findIndex((n, j) => j > i && j < end && isMcqAnswerLabel(nodeText(n)));
      if (answerAt < 0) continue;
      const answerNode = out[answerAt];
      if (answerNode.type !== "heading" || answerNode.attrs?.level !== 4) {
        out[answerAt] = { ...answerNode, type: "heading", attrs: { ...answerNode.attrs, level: 4 } };
        changed = true;
      }
      if (end < out.length && solution(out[end])) {
        let after = end + 1;
        while (after < out.length && out[after].type === "paragraph" && !nodeText(out[after]).trim()) after++;
        if (after === out.length || boundary(out[after])) {
          out.splice(end, after - end);
          changed = true;
        }
      }
    }
    return out;
  };
  const content = visit(doc.content);
  return { doc: changed ? { ...doc, content } : doc, changed };
}
