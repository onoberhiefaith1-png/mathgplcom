import { nodeText } from "./lessonOutline";
import { explanationTail, isMcqAnswerLabel, parseInlineMcq } from "./inlineMcq";

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
    // AI sometimes emits numbered stems as paragraphs rather than headings.
    // Use the declared answer and parsed options to distinguish a question
    // from a mere prose reference to another numbered question.
    const numberedStem = (node: Node) => node.type === "paragraph"
      ? nodeText(node).trim().match(/^(?:Question|Example|Exercise)\s+(\d+)\s*[:.)–—-]\s*\S/i) : null;
    for (let i = 0; i < out.length; i++) {
      const stem = numberedStem(out[i]);
      if (!stem || (i > 0 && question(out[i - 1]))) continue;
      let end = i + 1;
      while (end < out.length && !numberedStem(out[end]) && !boundary(out[end])) end++;
      const lines = out.slice(i, end).flatMap((row) => nodeText(row).split(/\r?\n/));
      const answer = lines.findIndex((line, index) => isMcqAnswerLabel(line) &&
        !!parseInlineMcq(lines.slice(0, index + 1).join("\n")));
      if (answer < 0) continue;
      out.splice(i, 0, { type: "heading", attrs: { level: 2 },
        content: [{ type: "text", text: `Question ${stem[1]}` }] });
      i++;
      changed = true;
    }
    // A complete generated or pasted MCQ can arrive without a structural
    // question heading. Give that complete block an owner without touching
    // its stem, options, marks, or declared answer.
    const firstHeading = out.findIndex((node) => node.type === "heading");
    const looseEnd = firstHeading < 0 ? out.length : firstHeading;
    if (looseEnd && parseInlineMcq(out.slice(0, looseEnd).map(nodeText).join("\n"))) {
      out.unshift({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Question" }] });
      changed = true;
    }
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
      if (!parseInlineMcq(body)) {
        if (!out[end] || !solution(out[end])) {
          const working = out.findIndex((row, index) => index > i + 1 && index < end &&
            row.type === "paragraph" && /^(?:worked\s+)?(?:solution|working)\s*:/i.test(nodeText(row).trim()));
          if (working >= 0 && (/:\s*\S/.test(nodeText(out[working])) ||
            out.slice(working + 1, end).some((row) => nodeText(row).trim()))) {
            out.splice(working, 0, { type: "heading", attrs: { level: 4 },
              content: [{ type: "text", text: "Solution" }] });
            changed = true;
          }
        }
        continue;
      }
      const answerAt = out.findIndex((n, j) => j > i && j < end && isMcqAnswerLabel(nodeText(n)));
      if (answerAt < 0) continue;
      const tail = out.slice(answerAt + 1, end);
      const plainTail = tail.every(n => n.type === "paragraph" || blankParagraph(n));
      if (plainTail && tail.some(n => nodeText(n).trim())) {
        const peeled = explanationTail(tail.map(nodeText));
        if (peeled) {
          const replacement = peeled.body.length
            ? [
                { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Explanation" }] },
                ...peeled.body.map(text => ({ type: "paragraph", content: [{ type: "text", text }] })),
              ]
            : [];
          out.splice(answerAt + 1, end - (answerAt + 1), ...replacement);
          end = answerAt + 1 + replacement.length;
          changed = true;
        }
      }
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
