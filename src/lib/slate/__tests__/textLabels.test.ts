import { describe, expect, it } from "vitest";
import { makeGame } from "../defaults";
import { normalizeGame } from "../storage";
import {
  createTextLabel,
  moveTextLabel,
  normalizeTextLabels,
  removeTextLabel,
  textLabelStyle,
  updateTextLabel,
} from "../textLabels";

const game = () => makeGame({
  name: "Labels",
  topic: "Algebra",
  subtopic: "",
  surfaceId: "plain",
  lines: 1,
  background: { src: null, kind: "image", scale: 1, x: 0, y: 0, opacity: 1 },
});

describe("text labels", () => {
  it("keeps a label through save and reload", () => {
    const label = createTextLabel("label-1", { text: "Check the signs", size: 44, colour: "#aa3311", x: 30, y: 18 });
    const saved = { ...game(), settings: { ...game().settings, labels: [label] } };
    const reloaded = normalizeGame(JSON.parse(JSON.stringify(saved)));
    expect(reloaded.settings.labels).toEqual([label]);
    expect(textLabelStyle(reloaded.settings.labels![0]!)).toEqual({ fontSize: "44px", color: "#aa3311" });
  });

  it("edits, moves and deletes one label without touching another", () => {
    const labels = [
      createTextLabel("a", { text: "One", x: 10, y: 10 }),
      createTextLabel("b", { text: "Two", x: 70, y: 40 }),
    ];
    const edited = updateTextLabel(labels, "a", { text: "One more", size: 50, colour: "#00aa44" });
    const moved = moveTextLabel(edited, "a", 22, 33);
    expect(moved[0]).toMatchObject({ text: "One more", size: 50, colour: "#00aa44", x: 22, y: 33 });
    expect(moved[1]?.text).toBe("Two");
    expect(removeTextLabel(moved, "a").map((label) => label.id)).toEqual(["b"]);
  });

  it("drops a label whose colour is not a colour", () => {
    const [label] = normalizeTextLabels([{ id: "bad", text: "Hi", x: 10, y: 10, size: 20, colour: "red; background:url(x)" }]);
    expect(label?.colour).toBe("#173f91");
  });
});
