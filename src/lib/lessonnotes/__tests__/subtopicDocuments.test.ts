import { describe, it, expect } from "vitest";
import { docHasContent, type Subtopic } from "../subtopics";
import {
  applySubtopicDocument,
  cloneDoc,
  docsEqual,
  emptyDoc,
  resolveOpenSubtopic,
  storedDocumentFor,
} from "../subtopicDocuments";

const textDoc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const row = (id: string, name: string, text: string | null): Subtopic => ({
  id,
  notebook_id: "nb",
  name,
  order_index: id.charCodeAt(0),
  document_json: text == null ? emptyDoc() : textDoc(text),
});

describe("subtopic documents stay independent", () => {
  it("gives every caller a fresh empty doc, so typing in C cannot mutate A or B", () => {
    const a = emptyDoc();
    const b = emptyDoc();
    (a as { content: unknown[] }).content.push({ type: "paragraph" });
    expect(b).toEqual(emptyDoc());
    expect(a).not.toEqual(b);
  });

  it("cloneDoc copies, so later edits do not leak into a stored snapshot", () => {
    const live = textDoc("C");
    const stored = cloneDoc(live);
    (live.content[0].content[0] as { text: string }).text = "changed";
    expect(stored).toEqual(textDoc("C"));
  });

  it("applySubtopicDocument writes only the active row", () => {
    const list = [row("a", "A", "lesson A"), row("b", "B", "lesson B"), row("c", "C", "lesson C")];
    const next = applySubtopicDocument(list, "c", textDoc("lesson C revised"));
    expect(next.find((s) => s.id === "a")?.document_json).toEqual(textDoc("lesson A"));
    expect(next.find((s) => s.id === "b")?.document_json).toEqual(textDoc("lesson B"));
    expect(next.find((s) => s.id === "c")?.document_json).toEqual(textDoc("lesson C revised"));
  });

  it("creating A, then B, then C keeps each lesson on its own row", () => {
    let list: Subtopic[] = [];
    list = [...list, row("a", "A", null)];
    list = applySubtopicDocument(list, "a", textDoc("lesson A"));

    list = [...list, row("b", "B", null)];
    // Leaving A to start B stores A's pages on A only.
    expect(list.find((s) => s.id === "a")?.document_json).toEqual(textDoc("lesson A"));
    list = applySubtopicDocument(list, "b", textDoc("lesson B"));

    list = [...list, row("c", "C", null)];
    list = applySubtopicDocument(list, "c", textDoc("lesson C"));

    expect(storedDocumentFor(list.find((s) => s.id === "a"))).toEqual(textDoc("lesson A"));
    expect(storedDocumentFor(list.find((s) => s.id === "b"))).toEqual(textDoc("lesson B"));
    expect(storedDocumentFor(list.find((s) => s.id === "c"))).toEqual(textDoc("lesson C"));
  });

  it("does not label the last lesson as the first subtopic when the saved pointer is missing", () => {
    const list = [row("a", "A", "lesson A"), row("b", "B", "lesson B"), row("c", "C", null)];
    const open = resolveOpenSubtopic(list, null, textDoc("lesson C"));
    expect(open.activeId).toBe("c");
    expect(open.doc).toEqual(textDoc("lesson C"));
    expect(open.writeNotebookToActive).toBe(true);
  });

  it("uses the saved subtopic and the live notebook page when the pointer is present", () => {
    const list = [row("a", "A", "lesson A"), row("b", "B", "lesson B"), row("c", "C", "old C")];
    const open = resolveOpenSubtopic(list, "c", textDoc("lesson C"));
    expect(open.activeId).toBe("c");
    expect(open.doc).toEqual(textDoc("lesson C"));
    expect(open.writeNotebookToActive).toBe(true);
  });

  it("reopening A, B and C after a last lesson of C does not show C under A or B", () => {
    const list = [row("a", "A", "lesson A"), row("b", "B", "lesson B"), row("c", "C", "lesson C")];
    const open = resolveOpenSubtopic(list, "c", textDoc("lesson C"));
    expect(open.activeId).toBe("c");

    // Clicking A uses A's stored pages, not the live notebook page (C).
    const shownA = storedDocumentFor(list.find((s) => s.id === "a"));
    const shownB = storedDocumentFor(list.find((s) => s.id === "b"));
    const shownC = open.doc;
    expect(shownA).toEqual(textDoc("lesson A"));
    expect(shownB).toEqual(textDoc("lesson B"));
    expect(shownC).toEqual(textDoc("lesson C"));
    expect(docsEqual(shownA, shownC)).toBe(false);
    expect(docsEqual(shownB, shownC)).toBe(false);
  });

  it("a click away from a mis-labelled first subtopic must not be planned as writing C into A when C is last", () => {
    const list = [row("a", "A", "lesson A"), row("b", "B", "lesson B"), row("c", "C", null)];
    const open = resolveOpenSubtopic(list, null, textDoc("lesson C"));
    // The open page belongs to C, so a switch to A saves C onto C, not onto A.
    const afterLeave = applySubtopicDocument(list, open.activeId, open.doc);
    expect(afterLeave.find((s) => s.id === "a")?.document_json).toEqual(textDoc("lesson A"));
    expect(afterLeave.find((s) => s.id === "b")?.document_json).toEqual(textDoc("lesson B"));
    expect(afterLeave.find((s) => s.id === "c")?.document_json).toEqual(textDoc("lesson C"));
    expect(docHasContent(afterLeave.find((s) => s.id === "a")?.document_json)).toBe(true);
  });
});

import {
  planInstantSwitch,
  shouldRestoreDraft,
  shouldWriteLiveNotebook,
} from "../subtopicDocuments";

describe("instant subtopic switch and owner-scoped saves", () => {
  it("shows the clicked subtopic immediately and holds the previous lesson to save later", () => {
    const planned = planInstantSwitch({
      fromId: "notation",
      fromDoc: textDoc("EXPERT PRACTICE"),
      targetId: "ide",
      targetDoc: textDoc("BEGINNER PRACTICE"),
    });
    expect(planned.displayId).toBe("ide");
    expect(planned.displayDoc).toEqual(textDoc("BEGINNER PRACTICE"));
    expect(planned.persistFrom).toEqual({ id: "notation", doc: textDoc("EXPERT PRACTICE") });
  });

  it("rapid clicks leave each lesson on its own row and open the last click", () => {
    let list = [row("notation", "index notation", "EXPERT PRACTICE"), row("ide", "ide", "BEGINNER PRACTICE"), row("laws", "laws", "LAWS")];
    let openId = "notation";
    let openDoc = textDoc("EXPERT PRACTICE revised");
    const click = (targetId: string) => {
      const target = list.find((s) => s.id === targetId)!;
      const planned = planInstantSwitch({ fromId: openId, fromDoc: openDoc, targetId, targetDoc: target.document_json });
      if (planned.persistFrom) list = applySubtopicDocument(list, planned.persistFrom.id, planned.persistFrom.doc);
      openId = planned.displayId;
      openDoc = planned.displayDoc as typeof openDoc;
    };
    click("ide");
    click("laws");
    click("ide");
    expect(openId).toBe("ide");
    expect(openDoc).toEqual(textDoc("BEGINNER PRACTICE"));
    expect(list.find((s) => s.id === "notation")?.document_json).toEqual(textDoc("EXPERT PRACTICE revised"));
    expect(list.find((s) => s.id === "ide")?.document_json).toEqual(textDoc("BEGINNER PRACTICE"));
    expect(list.find((s) => s.id === "laws")?.document_json).toEqual(textDoc("LAWS"));
  });

  it("creating Expert Practice on A and Beginner Practice on B keeps both after a reload", () => {
    let list: Subtopic[] = [];
    list = [...list, row("notation", "index notation", null)];
    list = applySubtopicDocument(list, "notation", textDoc("EXPERT PRACTICE 3.1.1 Index Notation"));
    list = [...list, row("ide", "ide", null)];
    list = applySubtopicDocument(list, "notation", textDoc("EXPERT PRACTICE 3.1.1 Index Notation"));
    list = applySubtopicDocument(list, "ide", textDoc("BEGINNER PRACTICE"));
    const live = textDoc("BEGINNER PRACTICE");
    const open = resolveOpenSubtopic(list, "ide", live);
    expect(open.activeId).toBe("ide");
    expect(open.doc).toEqual(textDoc("BEGINNER PRACTICE"));
    expect(storedDocumentFor(list.find((s) => s.id === "notation"))).toEqual(textDoc("EXPERT PRACTICE 3.1.1 Index Notation"));
    expect(docsEqual(storedDocumentFor(list.find((s) => s.id === "notation")), open.doc)).toBe(false);
  });

  it("a late save from the previous subtopic must not write the live notebook", () => {
    expect(shouldWriteLiveNotebook("notation", "ide")).toBe(false);
    expect(shouldWriteLiveNotebook("ide", "ide")).toBe(true);
    expect(shouldWriteLiveNotebook(null, "ide")).toBe(false);
    expect(shouldWriteLiveNotebook(null, null)).toBe(true);
  });

  it("does not restore one subtopic's draft into another", () => {
    expect(shouldRestoreDraft({ subtopicId: "notation" }, "ide")).toBe(false);
    expect(shouldRestoreDraft({ subtopicId: "ide" }, "ide")).toBe(true);
    expect(shouldRestoreDraft(null, "ide")).toBe(false);
  });
});
