import { describe, expect, it } from "vitest";
import { pageKeyLabel, toPageKey } from "../pageKey";

describe("toPageKey", () => {
  it("keeps a static page as-is", () => {
    expect(toPageKey("/teaching-hub")).toBe("/teaching-hub");
    expect(toPageKey("/")).toBe("/");
  });

  it("collapses every instance of a page onto one key", () => {
    const a = toPageKey("/class/8f2c1d64-1f2e-4b3a-9c1d-2f3a4b5c6d7e/notes");
    const b = toPageKey("/class/91ab1d64-1f2e-4b3a-9c1d-2f3a4b5c6d7e/notes");
    expect(a).toBe("/class/:id/notes");
    expect(b).toBe(a);
  });

  it("treats route-id params and numeric ids as dynamic", () => {
    expect(toPageKey("/class/$classId/assignments")).toBe("/class/:id/assignments");
    expect(toPageKey("/levels/12")).toBe("/levels/:id");
  });

  it("ignores query strings and hashes", () => {
    expect(toPageKey("/reports?tab=class#top")).toBe("/reports");
  });
});

describe("pageKeyLabel", () => {
  it("reads as a page name", () => {
    expect(pageKeyLabel("/teaching-hub/classes")).toBe("Teaching hub › Classes");
    expect(pageKeyLabel("/class/:id/notes")).toBe("Class › (item) › Notes");
    expect(pageKeyLabel("/")).toBe("Home");
  });
});
