import type { Node as PMNode } from "@tiptap/pm/model";
import { isMcqAnswerLabel, parseInlineMcq } from "./inlineMcq";
import { nodeText } from "./lessonOutline";
import { structuralHeadingKind } from "./sectionKinds";

const questions = new Set(["example", "exercise", "classwork", "homework", "assessment", "game_questions", "custom_session"]);
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
        ? structuralHeadingKind(node.textContent, node.attrs.level, node.attrs)?.kind : undefined;
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
  const end = (row: Row) => row.pos + row.node.nodeSize;

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
  return [...targets, ...worked.values(), ...[...incomplete].filter(([section]) => !worked.has(section)).map(([, warning]) => warning)];
}
