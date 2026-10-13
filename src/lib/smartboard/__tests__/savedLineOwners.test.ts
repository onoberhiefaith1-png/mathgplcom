import { describe, expect, it } from "vitest";
import { mergeSavedLineOwners, sanitizeLineOwners } from "../savedLineOwners";

describe("saved Game line ownership", () => {
  it("comes back exactly as saved for rows that still carry writing", () => {
    const saved = sanitizeLineOwners({ 2: 0, 3: 1, 4: 2 });
    expect(
      mergeSavedLineOwners(
        { 2: 0, 3: 0, 4: 0 },
        saved,
        [2, 3, 4],
        new Set([0, 1, 2]),
      ),
    ).toEqual({ 2: 0, 3: 1, 4: 2 });
  });
  it("keeps the rebuilt owner for rows the save does not know about", () => {
    expect(
      mergeSavedLineOwners(
        { 2: 0, 5: 2 },
        { 2: 1 },
        [2, 5],
        new Set([0, 1, 2]),
      ),
    ).toEqual({ 2: 1, 5: 2 });
  });
  it("ignores saved lines that no longer exist", () => {
    expect(
      mergeSavedLineOwners({ 2: 0 }, { 2: 9 }, [2], new Set([0, 1])),
    ).toEqual({ 2: 0 });
  });
  it("rejects malformed saves", () => {
    expect(sanitizeLineOwners(null)).toBeNull();
    expect(sanitizeLineOwners([1, 2])).toBeNull();
    expect(sanitizeLineOwners({ a: "x", 3: -1 })).toBeNull();
    expect(sanitizeLineOwners({ "3": "1" })).toEqual({ 3: 1 });
  });
});
