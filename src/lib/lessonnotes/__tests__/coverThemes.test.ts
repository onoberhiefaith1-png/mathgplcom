// LN-011 — the cover designer offers a fixed set of ten themes, and a chosen
// cover is a stored config (read back verbatim), never regenerated per view.
import { describe, expect, it } from "vitest";
import {
  COVER_THEMES,
  defaultCoverConfig,
  readCoverConfig,
  suggestCoverThemes,
  themeById,
} from "@/lib/lessonnotes/coverThemes";

const nb = { title: "Quadratics", subject: "Mathematics", subtopic: "Factorising", class_name: "JSS2", session: "2026" };

describe("notebook cover designer (LN-011)", () => {
  it("offers exactly ten themes with unique ids", () => {
    expect(COVER_THEMES).toHaveLength(10);
    expect(new Set(COVER_THEMES.map((t) => t.id)).size).toBe(10);
  });

  it("suggests one ready-made cover per theme", () => {
    const suggestions = suggestCoverThemes(nb);
    expect(suggestions.map((s) => s.themeId)).toEqual(COVER_THEMES.map((t) => t.id));
  });

  it("reads a stored cover back verbatim instead of regenerating it", () => {
    const stored = { ...defaultCoverConfig(nb), themeId: "academic-gold", title: "My own title", artOpacity: 0.2 };
    const read = readCoverConfig(stored, nb);
    expect(read.themeId).toBe("academic-gold");
    expect(read.title).toBe("My own title");
    expect(read.artOpacity).toBe(0.2);
  });

  it("falls back to a valid theme when nothing is stored yet", () => {
    const read = readCoverConfig(null, nb);
    expect(COVER_THEMES.some((t) => t.id === read.themeId)).toBe(true);
    expect(themeById(read.themeId).id).toBe(read.themeId);
    expect(themeById("does-not-exist").id).toBe(COVER_THEMES[0].id);
  });
});
