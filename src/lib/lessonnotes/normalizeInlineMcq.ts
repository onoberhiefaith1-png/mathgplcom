import { nodeText } from "./lessonOutline";
import { isMcqAnswerLabel, parseInlineMcq } from "./inlineMcq";

type Node = { type: string; attrs?: Record<string, unknown> | null; content?: Node[]; text?: string };
const question = (n: Node) => n.type === "heading" && /^(?:question|example|exercise|classwork|homework|assessment|quiz|problem|practice|task)\b/i.test(nodeText(n).trim());
const solution = (n: Node) => n.type === "heading" && /^solution\b/i.test(nodeText(n).trim());
const blankParagraph = (n: Node) => n.type === "paragraph" && !nodeText(n).trim() &&
  !(n.content ?? []).some(child => child.type !== "text" && child.type !== "hardBreak");
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
      // Older AI output put the declared answer in an otherwise empty Solution.
      // Heal only that exact shape; never delete a teacher's actual working.
      if (end < out.length && solution(out[end])) {
        let after = end + 1;
        while (after < out.length && !boundary(out[after])) after++;
        const rows = out.slice(end + 1, after).filter(n => !blankParagraph(n));
        const owner = out[end].attrs?.ownerQuestionId;
        const questionId = out[i].attrs?.sectionId;
        const ownAnswer = !owner || (!!questionId && owner === questionId);
        if (ownAnswer && rows.length === 1 && isMcqAnswerLabel(nodeText(rows[0])) &&
          parseInlineMcq([...out.slice(i + 1, end), rows[0]].map(nodeText).join("\n"))) {
          out.splice(end, after - end, rows[0]);
          end += 1;
          changed = true;
        }
      }
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
        while (after < out.length && blankParagraph(out[after])) after++;
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
