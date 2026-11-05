import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canAssignQuestions,
  canShareGameToLibrary,
  copyGameTemplate,
  forkLibrarySample,
  libraryReaderView,
  templateShareAction,
  type LibrarySample,
} from "../library";

const sample = (): LibrarySample => ({
  id: "sample-1",
  name: "Linear equations",
  library: true,
  ownerId: "faith",
  slots: ["line 1"],
});

const shell = () => ({
  id: "template-1",
  name: "Linear equations",
  library: true,
  ownerId: "faith",
  topic: "Algebra",
  subtopic: "Brackets",
  surfaceId: "parchment",
  surfaceColour: "#f4ead7",
  roomId: "none",
  background: { src: "/bg.jpg", kind: "image" as const, scale: 1, x: 0, y: 0, opacity: 0.8 },
  slots: [{
    id: "line-1",
    text: "",
    surfaceId: "parchment",
    rewards: [{ id: "r1", type: "hourglass", x: 10, y: 20 }],
  }],
  settings: {
    text: { colour: "#112233", size: 36, style: "raised" },
    imagine: { finish: "framed", textTreatment: "engraved", desktopTextSize: 40 },
    sound: { background: { enabled: true, assetId: "track-1" } },
    rewards: { visible: true, opacity: 0.6 },
    completionFlow: { enabled: true, clips: [{ id: "clip" }] },
    labels: [{ id: "label-1", text: "Title", x: 50, y: 16, size: 42, colour: "#aa3311" }],
  },
  status: { vaultsOpened: 2, lives: 1, timerEndsAt: 99 },
  patternLength: 4,
  questions: [
    { id: "q1", notebookId: "note-1", subsectionId: "sub-1" },
    { id: "q2", subsectionId: "sub-2" },
  ],
});

describe("game library source", () => {
  it("gives every reader the template row, including a later edit", () => {
    const original = sample();
    expect(libraryReaderView(original)).toBe(original);
    const edited = { ...original, name: "Solving linear equations", slots: ["line 1", "line 2"] };
    const seen = libraryReaderView(edited);
    expect(seen.id).toBe("sample-1");
    expect(seen.slots).toEqual(["line 1", "line 2"]);
    expect(seen.name).toBe("Solving linear equations");
  });

  it("keeps a private copy where it was when it was made", () => {
    const original = sample();
    const mine = forkLibrarySample(original, { id: "mine-1", ownerId: "teacher" });
    const edited = { ...original, slots: ["line 1", "line 2"] };
    expect(mine).toMatchObject({
      id: "mine-1",
      ownerId: "teacher",
      library: false,
      name: "Linear equations copy",
      slots: ["line 1"],
    });
    expect(libraryReaderView(edited).slots).toEqual(["line 1", "line 2"]);
    expect(mine.slots).toEqual(["line 1"]);
  });
});

describe("who may share a game template", () => {
  it("allows an administrator", () => {
    expect(canShareGameToLibrary({ isAdmin: true, holdsAccessCode: false })).toBe(true);
  });

  it("allows someone who holds an access code", () => {
    expect(canShareGameToLibrary({ isAdmin: false, holdsAccessCode: true })).toBe(true);
  });

  it("refuses everyone else", () => {
    expect(canShareGameToLibrary({ isAdmin: false, holdsAccessCode: false })).toBe(false);
  });

  it("names the menu action", () => {
    expect(templateShareAction(false)).toBe("Share to templates");
    expect(templateShareAction(true)).toBe("Remove from templates");
  });

  it("enforces the same rule in the database", () => {
    const sql = readFileSync("supabase/migrations/20261105190000_game_template_share_access.sql", "utf8");
    expect(sql).toContain("can_share_game_library");
    expect(sql).toContain("is_flow_admin");
    expect(sql).toContain("staff_codes");
    expect(sql).toContain("purpose = 'access'");
    expect(sql).toContain("NEW.library IS DISTINCT FROM OLD.library");
    expect(sql).not.toContain("Only an administrator can publish");
  });
});

describe("copying a template", () => {
  it("preserves the shell, is owned by the copier, and carries no questions", () => {
    const template = shell();
    const copy = copyGameTemplate(template, { id: "mine-1", ownerId: "teacher" });

    expect(copy.id).toBe("mine-1");
    expect(copy.ownerId).toBe("teacher");
    expect(copy.library).toBe(false);
    expect(copy.name).toBe("Linear equations copy");
    expect(copy.questions).toEqual([]);
    expect(copy.surfaceId).toBe(template.surfaceId);
    expect(copy.slots).toEqual(template.slots);
    expect(copy.settings).toEqual(template.settings);
    expect(copy.background).toEqual(template.background);
    expect(copy.patternLength).toBe(template.patternLength);
    expect(copy.status).toEqual({ vaultsOpened: 0, lives: 3, timerEndsAt: null });
    expect(copy.settings).not.toBe(template.settings);
    expect(copy.slots).not.toBe(template.slots);

    template.settings.labels[0]!.text = "Changed on the template";
    template.slots[0]!.rewards.push({ id: "r2", type: "vault", x: 1, y: 2 });
    expect(copy.settings.labels[0]!.text).toBe("Title");
    expect(copy.slots[0]!.rewards).toHaveLength(1);
    expect(libraryReaderView(template).settings.labels[0]!.text).toBe("Changed on the template");
  });

  it("lets the copier assign questions to their game only", () => {
    const template = shell();
    const copy = copyGameTemplate(template, { id: "mine-1", ownerId: "teacher" });
    expect(canAssignQuestions(template, "teacher")).toBe(false);
    expect(canAssignQuestions(copy, "teacher")).toBe(true);
    expect(canAssignQuestions(template, "faith")).toBe(true);
  });
});
