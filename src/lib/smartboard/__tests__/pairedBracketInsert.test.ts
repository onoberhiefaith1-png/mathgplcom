import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mirrorLessonNoteRow } from "../mirrorFromLessonNote";
import { insertMirroredRow } from "../insertMirroredRow";
import { insertChar, type Node, type Row } from "../mathTree";
import { rowToAscii } from "../rowAscii";

const chars = (s: string): Row => [...s].map((ch) => ({ kind: "char", ch }) as Node);

describe("one-click paired bracket Floating Number", () => {
  it("mirrors '(□)' as ONE bracket container with an editable body", () => {
    const m = mirrorLessonNoteRow("(□)");
    expect(m.ok).toBe(true);
    expect(m.row).toHaveLength(1);
    expect(m.row[0]).toMatchObject({ kind: "bracket", left: "(", right: ")", rows: [[]] });
    expect(mirrorLessonNoteRow("[□]").row[0]).toMatchObject({ kind: "bracket", left: "[", right: "]" });
  });

  it("inserts the pair with the caret inside and typing lands between the brackets", () => {
    const m = mirrorLessonNoteRow("(□)");
    let { root, cursor } = insertMirroredRow(chars("y="), { path: [], index: 2 }, m.row);
    expect(cursor).toEqual({ path: [2, 0], index: 0 });
    for (const ch of "a+b") ({ root, cursor } = insertChar(root, cursor, ch));
    expect(rowToAscii(root).replace(/\s+/g, "")).toBe("y=(a+b)");
    expect(root).toHaveLength(3); // y, =, one bracket — the closer never went inside
  });

  it("never puts a following sibling inside an empty container (old sequential descent)", () => {
    const nodes: Node[] = [
      { kind: "char", ch: "(" } as Node,
      { kind: "box", rows: [[]] } as Node,
      { kind: "char", ch: ")" } as Node,
    ];
    const { root, cursor } = insertMirroredRow([], { path: [], index: 0 }, nodes);
    expect(root.map((n) => n.kind)).toEqual(["char", "box", "char"]);
    expect((root[1] as Extract<Node, { rows: Row[] }>).rows[0]).toEqual([]);
    expect(cursor).toEqual({ path: [1, 0], index: 0 });
  });

  it("a square root inside a pair: typing fills the radicand", () => {
    const pair = insertMirroredRow([], { path: [], index: 0 }, mirrorLessonNoteRow("(□)").row);
    const root1 = insertMirroredRow(pair.root, pair.cursor, mirrorLessonNoteRow("\\sqrt{}").row);
    let { root, cursor } = root1;
    for (const ch of "b") ({ root, cursor } = insertChar(root, cursor, ch));
    expect(rowToAscii(root).replace(/\s+/g, "")).toMatch(/^\(\\?sqrt.*b.*\)$/);
    expect(root).toHaveLength(1);
  });

  it("PresentationView inserts Floating Numbers through insertMirroredRow", () => {
    const src = readFileSync(resolve(__dirname, "../../../components/smartboard/PresentationView.tsx"), "utf8");
    expect(src).toMatch(/insertMirroredRow\(row, exitCompletedScriptCursor\(row, c\), mirror\.row\)/);
  });
});
