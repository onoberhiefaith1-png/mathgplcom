// A second question set pasted into a lesson note that already has one.
//
// The first paste with no clear heading is arranged as Introduction, then
// Question 1… The next paste of questions 1–12 must not flatten into that
// same list. Its topic name becomes a subtopic heading (level 1, the same
// heading the editor already treats as a subtopic) with the questions under it.

import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import { docHasContent } from "@/lib/lessonnotes/subtopics";
import {
  arrangeLessonSessions,
  looksLikeQuestion,
  parseSessionBlocks,
} from "@/lib/lessonnotes/sessionArrange";

type TipTapNode = any;

const GENERIC_TITLE = /^(introduction|intro|summary|conclusion|objectives?|explanation|notes?)$/i;

const nodeText = (n: TipTapNode): string => {
  if (!n) return "";
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return n.content.map(nodeText).join("");
  return "";
};

const cleanTitle = (s: string) => s.replace(/[:.\s]+$/g, "").trim();

/** A short label, not a question and not a numbered line. */
function isTitleLine(line: string): boolean {
  const t = cleanTitle(line);
  if (!t || t.length > 80) return false;
  if (GENERIC_TITLE.test(t)) return false;
  if (/^\(?\d{1,3}[.)]/.test(t)) return false;
  if (looksLikeQuestion([t])) return false;
  return true;
}

/** Question numbers the arranger found, in order. */
export function questionNumbers(text: string): number[] {
  return parseSessionBlocks(text).flatMap((block) =>
    block.marker?.kind === "question" && block.marker.n != null ? [block.marker.n] : [],
  );
}

/** A fresh 1…n question block, not a single follow-up item. */
export function looksLikeQuestionSet(text: string): boolean {
  const nums = questionNumbers(text);
  return nums.length >= 2 && nums.includes(1);
}

/**
 * Name to put on the subtopic. An explicit topic heading wins. Otherwise the
 * first short line that the arranger parked under Introduction (a plain topic
 * name above the questions) is lifted out.
 */
export function subtopicTitleFromArranged(arranged: string): string | null {
  const blocks = parseSessionBlocks(arranged);
  const first = blocks[0];
  if (!first?.marker) return null;
  const title = cleanTitle(first.marker.title);
  if ((first.marker.kind === "group" || first.marker.kind === "label") && isTitleLine(title)) {
    return title;
  }
  if (GENERIC_TITLE.test(title)) {
    const line = first.lines.map((l) => l.trim()).find(Boolean) ?? "";
    if (isTitleLine(line)) return cleanTitle(line);
  }
  return null;
}

function subtopicHeading(title: string): TipTapNode {
  return { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: title }] };
}

/** Replace a leading Introduction / topic heading with a level-1 subtopic. */
function promoteToSubtopic(nodes: TipTapNode[], title: string): TipTapNode[] {
  const out = nodes.slice();
  const first = out[0];
  if (first?.type !== "heading") return [subtopicHeading(title), ...out];
  const text = cleanTitle(nodeText(first));
  if (text.toLowerCase() === title.toLowerCase()) {
    out[0] = subtopicHeading(title);
    return out;
  }
  if (GENERIC_TITLE.test(text)) {
    out[0] = subtopicHeading(title);
    const next = out[1];
    if (next?.type === "paragraph" && cleanTitle(nodeText(next)).toLowerCase() === title.toLowerCase()) {
      out.splice(1, 1);
    }
    return out;
  }
  return [subtopicHeading(title), ...out];
}

/**
 * Compose-mode Accept. The first question set in an empty note keeps the
 * normal session arrangement. A later question set in the same note is nested
 * under its topic name as a subtopic.
 */
export function composeSessionNodes(proposed: string, existingDoc: unknown): TipTapNode[] {
  const arranged = arrangeLessonSessions(proposed);
  const nodes = aiTextToNodes(arranged, { sessionHeadings: true });
  if (!docHasContent(existingDoc) || !looksLikeQuestionSet(arranged)) return nodes;
  const title = subtopicTitleFromArranged(arranged);
  if (!title) return nodes;
  return promoteToSubtopic(nodes, title);
}
