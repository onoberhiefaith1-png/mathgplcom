import { describe, expect, it } from "vitest";
import { arrangeLessonSessions } from "../sessionArrange";
import { aiTextToNodes } from "../aiToNodes";
import { repairDocumentMath } from "../aiToNodes";
import { enforceQuestionSolutionPairs } from "../questionPairs";
import {
  createDocWriteQueue,
  documentPlainText,
  incomingDropsLiveContent,
  shouldPublishOpenedSnapshot,
  type DocWrite,
} from "../documentPersistence";
import { composeSessionNodes } from "../subsequentSubtopic";

const PASTE = [
  "Logarithms",
  "1. Simplify log 8",
  "2. Expand log (4x)",
].join("\n");

const acceptedDoc = () => ({
  type: "doc",
  content: composeSessionNodes(PASTE, { type: "doc", content: [{ type: "paragraph" }] }),
});

describe("accepted AI lesson notes are not replaced by an older snapshot", () => {
  it("keeps the arranged questions through repair and solution pairing", () => {
    const accepted = acceptedDoc();
    expect(documentPlainText(accepted)).toContain("Simplify log 8");
    expect(documentPlainText(accepted)).toContain("Question 1");
    const repaired = repairDocumentMath(accepted);
    const paired = enforceQuestionSolutionPairs(repaired.doc);
    const text = documentPlainText(paired.doc);
    expect(text).toContain("Simplify log 8");
    expect(text).toContain("Expand log (4x)");
    expect(text).toContain("Logarithms");
    // The arranger's own output stays stable, so a second repair cannot hollow it out.
    const again = repairDocumentMath(paired.doc);
    expect(documentPlainText(again.doc)).toContain("Simplify log 8");
  });

  it("refuses an empty open snapshot once the teacher has accepted content", () => {
    const accepted = acceptedDoc();
    const opened = { type: "doc", content: [{ type: "paragraph" }] };
    expect(incomingDropsLiveContent(accepted, opened)).toBe(true);
    expect(shouldPublishOpenedSnapshot(0, 1, accepted, opened)).toBe(false);
    expect(shouldPublishOpenedSnapshot(0, 0, opened, opened)).toBe(true);
    expect(incomingDropsLiveContent(accepted, accepted)).toBe(false);
  });

  it("an older database write cannot finish on top of the accepted document", async () => {
    const sent: unknown[] = [];
    let releaseOlder: () => void = () => {};
    const olderGate = new Promise<void>((resolve) => { releaseOlder = resolve; });
    let current = 0;
    const queue = createDocWriteQueue(async (json) => {
      sent.push(json);
      if (sent.length === 1) {
        current = 1;
        await olderGate;
      }
    }, (job: DocWrite) => job.revision === current);

    const empty = { type: "doc", content: [{ type: "paragraph" }] };
    const accepted = acceptedDoc();
    const first = queue({ json: empty, revision: 0 });
    await Promise.resolve();
    const second = queue({ json: accepted, revision: 1 });
    releaseOlder();
    await first;
    await second;
    expect(sent.map((doc) => documentPlainText(doc).includes("Simplify log 8"))).toEqual([false, true]);
    expect(documentPlainText(sent[sent.length - 1])).toContain("Simplify log 8");
  });

  it("does not send a snapshot whose revision has already been superseded", async () => {
    const sent: number[] = [];
    let current = 2;
    const queue = createDocWriteQueue(async (json) => {
      sent.push((json as { n: number }).n);
    }, (job) => job.revision === current);
    await queue({ json: { n: 0 }, revision: 0 });
    await queue({ json: { n: 2 }, revision: 2 });
    expect(sent).toEqual([2]);
  });
});

describe("session arrangement still feeds the permanence guard", () => {
  it("the arranged paste is non-empty lesson text", () => {
    const arranged = arrangeLessonSessions(PASTE);
    const nodes = aiTextToNodes(arranged, { sessionHeadings: true });
    expect(documentPlainText({ type: "doc", content: nodes }).length).toBeGreaterThan(20);
  });
});
