import { describe, expect, it } from "vitest";

import {
  answerQuestion,
  applyLedgerPatch,
  askQuestion,
  emptyLedger,
  openQuestions,
  renderLedger,
} from "../missionLedger";

describe("the exploration record", () => {
  it("keeps what she learned and drops what she settled", () => {
    let ledger = applyLedgerPatch(emptyLedger(), {
      known: ["A session holds one question"],
      unknown: ["Where lesson editing happens"],
      tested: ["Opened lesson notes"],
      area: "Lesson Notes",
      state: "uncertain",
    });
    expect(ledger.known).toHaveLength(1);
    expect(ledger.map["Lesson Notes"]).toBe("uncertain");

    ledger = applyLedgerPatch(ledger, {
      resolved: ["Where lesson editing happens"],
      area: "Lesson Notes",
      state: "confirmed",
    });
    expect(ledger.unknown).toHaveLength(0);
    expect(ledger.map["Lesson Notes"]).toBe("confirmed");
  });

  it("does not repeat the same line twice", () => {
    const once = applyLedgerPatch(emptyLedger(), { known: ["Chips come from highlights"] });
    const twice = applyLedgerPatch(once, { known: ["chips come from highlights"] });
    expect(twice.known).toHaveLength(1);
  });

  it("logs a question without waiting, and closes it when answered", () => {
    const asked = askQuestion(emptyLedger(), "Are lesson notes read-only once assigned?");
    expect(openQuestions(asked.ledger)).toHaveLength(1);

    const answered = answerQuestion(asked.ledger, asked.id, "Yes, read-only once assigned.");
    expect(openQuestions(answered)).toHaveLength(0);
    expect(answered.corrections).toContain("Yes, read-only once assigned.");
  });

  it("reads back to her with every heading she needs", () => {
    const text = renderLedger(emptyLedger());
    for (const heading of ["KNOWN", "UNKNOWN", "TESTED", "FAILED", "QUESTIONS I ASKED", "AREAS"]) {
      expect(text).toContain(heading);
    }
  });
});
