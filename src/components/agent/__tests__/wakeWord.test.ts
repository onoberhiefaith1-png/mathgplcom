import { describe, expect, it } from "vitest";

import { extractWakeCommand } from "../useListening";

describe("the Aura wake word", () => {
  it("wakes on the name alone with no instruction", () => {
    expect(extractWakeCommand("Aura")).toEqual({ woke: true, command: "" });
  });

  it("takes everything after the name as the instruction", () => {
    expect(
      extractWakeCommand("Aura, create a lesson note on quadratic equations"),
    ).toEqual({ woke: true, command: "create a lesson note on quadratic equations" });
  });

  it("wakes mid-sentence and keeps the words that follow", () => {
    const { woke, command } = extractWakeCommand("okay aura open Grade 9 Algebra");
    expect(woke).toBe(true);
    expect(command).toBe("open Grade 9 Algebra");
  });

  it("ignores ordinary speech that never says the name", () => {
    expect(extractWakeCommand("let us solve this quadratic together")).toEqual({
      woke: false,
      command: "",
    });
  });

  it("does not wake on a word that merely contains the name", () => {
    expect(extractWakeCommand("the aurora borealis")).toEqual({ woke: false, command: "" });
  });
});
