import { describe, expect, it } from "vitest";
import { adventureAssetUrl, adventureMediaPaths, copiedAdventureQuestion, offlineAdventureCanvas, sessionPaper } from "../extendedActivities";
import { mediaToSave, offlineMediaUrl, splitMedia } from "../prepareOffline";
import { compileOfflineBoard } from "../academiaPack";

const canvas = { mode: "video", video: { path: "teacher/movie.mp4", source: "storage" },
  narrations: [{ id: "voice", path: "teacher/explain.mp3", source: "storage", at: 5, mode: "repeat" }],
  scenes: [{ id: "point", title: "Learn", loopStart: 5, loopEnd: 9, elements: [] }], activeSceneId: "point" };

describe("Mathemagine content parity", () => {
  it("uses the Session's copied answer and options, with its linked Smartboard solution", () => {
    const solution = { lines: [] };
    const paper = sessionPaper({ id: "activity", ref_id: "paper", title: "Quiz" }, [
      { activity_id: "other", n: 9, answer: "D" },
      { activity_id: "activity", n: 1, text: "Copied question", options: [{ label: "B", text: "8" }], answer: "B" },
    ], [{ id: "paper", subject_id: "subject", title: "Full paper", questions: [{ n: 1, text: "Changed source", options: [], answer: "A", solution }] }]);
    expect(paper.questions).toEqual([{ n: 1, text: "Copied question", options: [{ label: "B", text: "8" }], answer: "B", solution }]);
  });
  it("keeps copied Adventure questions playable after the source notebook is deleted", () => {
    const q = copiedAdventureQuestion({ id: "q", activity_id: "a", scene_id: "point", bar_id: "bar", question_text: "x+7=15", lines: [
      { lineId: "step", equation: "x=8", fillers: ["x", "=", "8"], marks: 2 },
    ] });
    const board = compileOfflineBoard({ activityId: q.id, subsectionId: q.id, title: q.title, questionText: q.questionText, lines: q.lines as never });
    expect(q.sceneId).toBe("point");
    expect(board?.lineIds).toEqual(["step"]);
    expect(board?.totalMarks).toBe(2);
  });
  it("keeps narrator timing, repeats and learning-point boundaries when replacing storage links", () => {
    const converted = offlineAdventureCanvas("a", canvas);
    expect(converted.video).toMatchObject({ source: "url", path: adventureAssetUrl("a", "teacher/movie.mp4") });
    expect(converted.narrations?.[0]).toMatchObject({ at: 5, mode: "repeat", source: "url" });
    expect(converted.scenes[0]).toMatchObject({ id: "point", loopStart: 5, loopEnd: 9 });
    expect(canvas.video.source).toBe("storage");
  });
  it("authorizes only exact rendered Adventure media, including teacher music", () => {
    expect(adventureMediaPaths(canvas, { music: { path: "teacher/music.mp3" } })).toEqual(["teacher/movie.mp4", "teacher/explain.mp3", "teacher/music.mp3"]);
    expect(adventureMediaPaths({ ...canvas, narrations: [...canvas.narrations, { ...canvas.narrations[0], path: "../secret.mp3" }] }, null)).not.toContain("../secret.mp3");
    expect(adventureMediaPaths(canvas, null)).not.toContain("teacher/unlinked.mp3");
  });
  it("downloads Adventure video in the background and voice/music as essentials", () => {
    const converted = offlineAdventureCanvas("a", canvas);
    const urls = mediaToSave([{ classes: [{ subjects: [{ topics: [{ subtopics: [{ sessions: [{ activities: [{ lines: [], adventure: {
      canvas: converted, audio: { music: { path: "/teacher/music.mp3" } }, assetUrls: {},
    } }] }] }] }] }] }] }] as never);
    const split = splitMedia(urls);
    expect(split.videos).toContain(offlineMediaUrl(converted.video!.path));
    expect(split.essential).toContain(offlineMediaUrl(converted.narrations![0].path));
    expect(split.essential).toContain(offlineMediaUrl("/teacher/music.mp3"));
  });
});
