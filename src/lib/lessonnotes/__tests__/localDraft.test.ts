/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  clearLocalDraft,
  draftStorageKey,
  readLocalDraft,
  readPendingLocalDraft,
  writeLocalDraft,
} from "../localDraft";

describe("per-subtopic local drafts", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores Expert Practice and Beginner Practice under different keys", () => {
    writeLocalDraft("nb", { text: "EXPERT PRACTICE" }, true, "notation");
    writeLocalDraft("nb", { text: "BEGINNER PRACTICE" }, true, "ide");
    expect(draftStorageKey("nb", "notation")).toBe("mathgpl.draft.nb.notation");
    expect(draftStorageKey("nb", "ide")).toBe("mathgpl.draft.nb.ide");
    expect(readLocalDraft("nb", "notation")?.doc).toEqual({ text: "EXPERT PRACTICE" });
    expect(readLocalDraft("nb", "ide")?.doc).toEqual({ text: "BEGINNER PRACTICE" });
    expect(readPendingLocalDraft("nb", "ide")?.doc).toEqual({ text: "BEGINNER PRACTICE" });
    expect(readPendingLocalDraft("nb", "notation")?.doc).toEqual({ text: "EXPERT PRACTICE" });
  });

  it("does not apply a leftover notebook-wide draft that belongs to another subtopic", () => {
    writeLocalDraft("nb", { text: "EXPERT PRACTICE" }, true, "notation");
    // A draft stamped for notation must not be offered while ide is open.
    expect(readPendingLocalDraft("nb", "ide")?.doc).toBeUndefined();
  });
});
