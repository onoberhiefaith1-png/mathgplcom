import { describe, expect, it } from "vitest";
import { isRememberablePath, readLastPage, rememberLastPage } from "../lastPage";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
};

describe("last page", () => {
  it("returns the same account to its last page", () => {
    const s = mem();
    rememberLastPage("a", "/school/academia?s=1", s);
    expect(readLastPage("a", s)).toBe("/school/academia?s=1");
  });
  it("never gives one account another account's page", () => {
    const s = mem();
    rememberLastPage("a", "/class/1", s);
    expect(readLastPage("b", s)).toBeNull();
  });
  it("never remembers sign-in or guest pages", () => {
    expect(isRememberablePath("/login?next=/x")).toBe(false);
    expect(isRememberablePath("/guest/abc")).toBe(false);
    expect(isRememberablePath("//evil.com")).toBe(false);
  });
});
