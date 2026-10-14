import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fixture(change?: "modified" | "added" | "deleted") {
  const root = mkdtempSync(resolve(tmpdir(), "game-lock-"));
  const content = "approved game behavior";
  mkdirSync(resolve(root, "docs"));
  mkdirSync(resolve(root, "game"));
  writeFileSync(resolve(root, "game/player.ts"), content);
  writeFileSync(resolve(root, "docs/game-lock-baseline.json"), JSON.stringify({
    scope: ["game"], sha256: { "game/player.ts": createHash("sha256").update(content).digest("hex") },
  }));
  if (change === "modified") writeFileSync(resolve(root, "game/player.ts"), "changed behavior");
  if (change === "added") writeFileSync(resolve(root, "game/new.ts"), "new behavior");
  if (change === "deleted") rmSync(resolve(root, "game/player.ts"));
  try {
    return spawnSync("python3", [resolve("scripts/check-game-lock.py"), root], { encoding: "utf8" });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("owner-locked Game", () => {
  it("accepts unchanged approved code", () => { expect(fixture().status).toBe(0); });
  it.each(["modified", "added", "deleted"] as const)("requires review for %s protected code", change => {
    const result = fixture(change);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(change === "added" ? "game/new.ts" : "game/player.ts");
  });
});
