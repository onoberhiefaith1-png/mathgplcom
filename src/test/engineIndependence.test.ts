// Architectural test: the two rendering engines MUST be independent.
//
// The user's spec: "Do not allow either engine to call or reuse the
// other's rendering code." This test enforces it as a static check on
// the source graph so a future refactor cannot silently reintroduce a
// cross-import.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const readTree = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...readTree(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
};

describe("smartboard engine independence", () => {
  it("floatingEngine never imports from presentEngine", () => {
    const files = readTree("src/lib/smartboard/engines/floatingEngine");
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} must not import presentEngine`).not.toMatch(
        /from\s+["'][^"']*engines\/presentEngine/,
      );
      expect(src, `${f} must not import previewChannel`).not.toMatch(
        /from\s+["'][^"']*boardWriter\/previewChannel/,
      );
    }
  });

  it("presentEngine never imports from floatingEngine", () => {
    const files = readTree("src/lib/smartboard/engines/presentEngine");
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} must not import floatingEngine`).not.toMatch(
        /from\s+["'][^"']*engines\/floatingEngine/,
      );
      expect(src, `${f} must not import floatingChannel`).not.toMatch(
        /from\s+["'][^"']*boardWriter\/floatingChannel/,
      );
    }
  });
});
