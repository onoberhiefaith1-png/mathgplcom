import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planTemplateMediaCopy, referencedTemplateAssets, rewriteAssetPaths } from "../templateMedia";

const owner = "f871690c-afd7-454e-ad1d-f114f6be996f";
const video = `${owner}/slate-assets/fc5735e0-1111-4222-8333-bccce8ec2354.mp4`;
const sound = `${owner}/slate-assets/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp3`;
const stranger = "11111111-2222-4333-8444-555555555555/slate-assets/private-file.png";

const template = () => ({
  id: "29a02610-08c0-4c4a-a083-bccce8ec2354",
  ownerId: owner,
  library: true,
  background: { assetId: video, kind: "video" as const },
  settings: {
    assets: { audio: [{ assetId: sound, name: "Theme" }] },
    sound: { background: { ref: { source: "user", path: sound } } },
    templateMedia: { files: [{ from: stranger, to: stranger }] },
  },
  slots: [{ note: "not a file" }],
});

describe("template game-assets", () => {
  it("collects referenced video and sound, and ignores provenance and ordinary text", () => {
    expect(referencedTemplateAssets(template()).sort()).toEqual([sound, video].sort());
  });

  it("plans an independent copy under the new owner and leaves unrelated private files alone", () => {
    let n = 0;
    const plan = planTemplateMediaCopy(
      [video, sound, stranger, "/sounds/builtin.mp3"],
      owner,
      "copier-1",
      () => `file-${n++}`,
    );
    expect(plan.copies).toEqual([
      { from: video, to: "copier-1/slate-assets/file-0.mp4" },
      { from: sound, to: "copier-1/slate-assets/file-1.mp3" },
    ]);
    expect(plan.unchanged).toEqual([stranger, "/sounds/builtin.mp3"]);
    expect(planTemplateMediaCopy([video], owner, owner).copies).toEqual([]);
  });

  it("rewrites the copy so a later source deletion does not remove its media ids", () => {
    const copied = rewriteAssetPaths(template(), [
      { from: video, to: "copier-1/slate-assets/kept.mp4" },
      { from: sound, to: "copier-1/slate-assets/kept.mp3" },
    ]);
    expect(JSON.stringify(copied)).not.toContain(video);
    expect(copied.background.assetId).toBe("copier-1/slate-assets/kept.mp4");
    expect(copied.settings.assets.audio[0]?.assetId).toBe("copier-1/slate-assets/kept.mp3");
    expect(template().background.assetId).toBe(video);
  });

  it("allows a select of an exact shared template path and does not add a write", () => {
    const sql = readFileSync("supabase/migrations/20261105211000_shared_template_game_assets.sql", "utf8");
    expect(sql).toContain("g.library IS TRUE");
    expect(sql).toContain("jsonb_has_exact_text");
    expect(sql).toContain("split_part(_name, '/', 2) = 'slate-assets'");
    expect(sql).toContain("FOR SELECT TO authenticated");
    expect(sql).not.toMatch(/FOR INSERT|FOR UPDATE|FOR DELETE/i);
    expect(sql).not.toContain("owner_id = auth.uid()");
    expect(sql).not.toContain("FOR SELECT TO anon");
    expect(sql).not.toContain("user_metadata");
    const mirror = readFileSync("drizzle/migrations/0027_shared_template_game_assets.sql", "utf8");
    expect(mirror).toContain("shared_template_references_asset");
    expect(mirror).toContain("FOR SELECT TO authenticated");
  });
});
