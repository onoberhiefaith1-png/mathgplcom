import type { Node as PMNode } from "@tiptap/pm/model";
import { isMcqAnswerLabel, parseInlineMcq } from "./inlineMcq";
import { nodeText } from "./lessonOutline";
import { headingRole, structuralHeadingKind, type SectionKind } from "./sectionKinds";

const questions = new Set(["example", "exercise", "classwork", "homework", "assessment", "game_questions", "custom_session"]);
const PRACTICE_HEADING = /^(?:practice|task)(?:\s*(?:no\.?|number|#)?\s*\d{1,3})?\s*$/i;

/** Headings that can own an Assign — including custom sessions and "Question 1: …". */
export function isAssignableQuestionHeading(node: PMNode): boolean {
  if (node.type.name !== "heading") return false;
  const stamped = typeof node.attrs.sessionKind === "string" ? node.attrs.sessionKind : "";
  if (stamped && questions.has(stamped)) return true;
  const level = Number(node.attrs.level ?? 2);
  const kind = structuralHeadingKind(node.textContent, level, node.attrs)?.kind;
  if (kind && questions.has(kind)) return true;
  const role = headingRole(node.textContent, level);
  if (role?.role === "custom_session") return true;
  if (role?.role === "section" && questions.has(role.kind)) return true;
  return PRACTICE_HEADING.test(node.textContent.trim());
}
const containers = new Set(["canvasFrame", "pageFrame", "canvasLayer", "solutionMath", "solutionProse"]);

export type AssignmentEndpoint = {
  kind: "mcq" | "worked" | "incomplete-mcq";
  heading: number;
  at: number;
  questionHeading: number;
  questionText: string;
  from: number;
};

export function assignmentEndpoints(doc: PMNode): AssignmentEndpoint[] {
  type Row = { node: PMNode; pos: number; kind: string | undefined };
  type Section = { heading: Row; body: Row[]; owner?: string };
  const sections: Section[] = [];
  function visit(parent: PMNode, start: number, inheritedOwner?: string) {
    let section: Section | undefined;
    parent.forEach((node, offset) => {
      const pos = start + offset;
      if (containers.has(node.type.name)) {
        visit(node, pos + 1, node.attrs.ownerQuestionId || inheritedOwner);
        return;
      }
      const kind = node.type.name === "heading"
        ? (structuralHeadingKind(node.textContent, node.attrs.level, node.attrs)?.kind
          ?? (isAssignableQuestionHeading(node) ? "custom_session" as SectionKind : undefined))
        : undefined;
      const row = { node, pos, kind };
      if (kind) {
        section = { heading: row, body: [], owner: node.attrs.ownerQuestionId || inheritedOwner };
        sections.push(section);
      } else if (node.type.name === "heading" && node.attrs.level <= 2) {
        section = undefined;
      } else {
        section?.body.push(row);
      }
    });
  }
  visit(doc, 0);

  const targets: AssignmentEndpoint[] = [];
  const owners = new Map(sections.filter(({ heading }) => questions.has(heading.kind ?? "") && heading.node.attrs.sectionId)
    .map((section) => [section.heading.node.attrs.sectionId, section]));
  const eligible = new Set<Section>();
  const incomplete = new Map<Section, AssignmentEndpoint>();
  const text = (row: Row) => nodeText(row.node.toJSON());
  const end = (row: { node: PMNode; pos: number }) => row.pos + row.node.nodeSize;

  for (const section of sections) {
    if (!questions.has(section.heading.kind ?? "")) continue;
    const lines: string[] = [];
    for (const row of section.body) {
      for (const line of text(row).split(/\r?\n/)) {
        lines.push(line);
        if (!isMcqAnswerLabel(line) || !parseInlineMcq(lines.join("\n"))) continue;
        targets.push({ kind: "mcq", at: end(row), heading: section.heading.pos,
          questionHeading: section.heading.pos, questionText: lines.join("\n"), from: section.heading.pos });
        eligible.add(section);
        break;
      }
      if (eligible.has(section)) break;
    }
    if (eligible.has(section)) continue;
    const last = section.body.filter((row) => text(row).trim()).at(-1);
    const content = lines.filter((line) =>
      !/^\s*(?:\*\*)?(?:the\s+)?(?:correct\s+)?(?:answer|option)\s*(?::|=|\bis\b)/i.test(line)).join("\n");
    // A dummy answer is only a shape check for the warning. It is never
    // written to the note or sent to students.
    if (last && parseInlineMcq(content + "\nAnswer: A")) {
      incomplete.set(section, { kind: "incomplete-mcq", at: end(last), heading: section.heading.pos,
        questionHeading: section.heading.pos, questionText: lines.join("\n"), from: section.heading.pos });
    }
  }

  // Complete MCQs typed or generated without a question heading still get Assign.
  const overlaps = (from: number, at: number) =>
    targets.some((item) => item.from < at && item.at > from) ||
    [...incomplete.values()].some((item) => item.from < at && item.at > from);
  const loose: { node: PMNode; pos: number }[] = [];
  const looseIncomplete: AssignmentEndpoint[] = [];
  const flushLoose = () => {
    if (!loose.length) return;
    const lines: string[] = [];
    let last = loose[0]!;
    for (const row of loose) {
      for (const line of nodeText(row.node.toJSON()).split(/\r?\n/)) {
        lines.push(line);
        if (!isMcqAnswerLabel(line) || !parseInlineMcq(lines.join("\n"))) continue;
        const from = loose[0]!.pos;
        const at = end(row);
        if (!overlaps(from, at)) {
          targets.push({ kind: "mcq", at, heading: from,
            questionHeading: from, questionText: lines.join("\n"), from });
        }
        loose.length = 0;
        return;
      }
      last = row;
    }
    const textLines = lines.filter((line) =>
      !/^\s*(?:\*\*)?(?:the\s+)?(?:correct\s+)?(?:answer|option)\s*(?::|=|\bis\b)/i.test(line));
    const from = loose[0]!.pos;
    const at = end(last);
    if (parseInlineMcq(textLines.join("\n") + "\nAnswer: A") && !overlaps(from, at)) {
      looseIncomplete.push({ kind: "incomplete-mcq", at, heading: from,
        questionHeading: from, questionText: lines.join("\n"), from });
    }
    loose.length = 0;
  };
  doc.forEach((node, offset) => {
    if (containers.has(node.type.name)) return;
    const isQuestionHead = node.type.name === "heading" && isAssignableQuestionHeading(node);
    if (isQuestionHead || (node.type.name === "heading" && node.attrs.level <= 2)) {
      flushLoose();
      return;
    }
    if (node.type.name === "heading" && structuralHeadingKind(node.textContent, node.attrs.level, node.attrs)) {
      flushLoose();
      return;
    }
    loose.push({ node, pos: offset });
  });
  flushLoose();

  let previousQuestion: Section | undefined;
  const worked = new Map<Section, AssignmentEndpoint>();
  for (const section of sections) {
    if (questions.has(section.heading.kind ?? "")) {
      previousQuestion = section;
      continue;
    }
    if (section.heading.kind !== "solution") {
      previousQuestion = undefined;
      continue;
    }
    const owner = section.owner ? owners.get(section.owner) : previousQuestion;
    if (!owner || eligible.has(owner)) continue;
    const content = section.body.filter((row) => text(row).trim() ||
      ["geometryDiagram", "smartGraph", "mathVisual", "mathTable", "image"].includes(row.node.type.name));
    const last = content.at(-1);
    if (!last) continue;
    worked.set(owner, { kind: "worked", at: end(last), heading: section.heading.pos,
      questionHeading: owner.heading.pos, questionText: owner.body.map(text).join("\n"), from: owner.heading.pos });
  }
  return [...targets, ...worked.values(), ...[...incomplete].filter(([section]) => !worked.has(section)).map(([, warning]) => warning), ...looseIncomplete];
}
