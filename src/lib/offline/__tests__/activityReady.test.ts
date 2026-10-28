import { describe, expect, it } from "vitest";
import { ACADEMIA_PACK_SCHEMA } from "../academiaPack";
import { activityNotReadyReason, isActivityReady, NOT_DOWNLOADED } from "../activityReady";
import type { PackActivity } from "../academiaStore";

const base = { id: "a", title: "A", lines: [], videoUrl: null } as unknown as PackActivity;
const act = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as PackActivity;
const mcqQ = { n: 1, text: "q", options: [], answer: "A", solution: null };
const adventure = (over: Record<string, unknown> = {}) => ({ id: "v", canvas: {}, questions: [{ id: "q" }], pass: {}, game: { id: "g" }, audio: {}, assetUrls: {}, ...over });

describe("why an activity cannot be opened", () => {
  it("MCQ without questions", () => {
    const a = act({ kind: "mcq", mcq: { id: "a", subject_id: "s", title: "T", questions: [] } });
    expect(isActivityReady(a)).toBe(false);
    expect(activityNotReadyReason(a, ACADEMIA_PACK_SCHEMA)).toBe("No questions assigned to this session yet");
  });
  it("Adventure without copied questions", () => {
    expect(activityNotReadyReason(act({ kind: "adventure", adventure: adventure({ questions: [] }) }), ACADEMIA_PACK_SCHEMA)).toBe("No questions assigned to this adventure yet");
  });
  it("Adventure with questions but no Game", () => {
    const a = act({ kind: "adventure", adventure: adventure({ game: null }) });
    expect(isActivityReady(a)).toBe(false);
    expect(activityNotReadyReason(a, ACADEMIA_PACK_SCHEMA)).toBe("No Game attached to this adventure yet");
  });
  it("a pack from before MCQ / Adventure support", () => {
    expect(activityNotReadyReason(act({ kind: "mcq" }), ACADEMIA_PACK_SCHEMA)).toBe(NOT_DOWNLOADED);
    expect(activityNotReadyReason(act({ kind: "adventure" }), ACADEMIA_PACK_SCHEMA)).toBe(NOT_DOWNLOADED);
    expect(activityNotReadyReason(act({}), ACADEMIA_PACK_SCHEMA - 1)).toBe(NOT_DOWNLOADED);
    expect(NOT_DOWNLOADED).toBe("Not downloaded yet. Update to get this content");
  });
  it("Adventure whose video is missing from the pack", () => {
    expect(activityNotReadyReason(act({ kind: "adventure", adventure: null }), ACADEMIA_PACK_SCHEMA)).toBe("This adventure isn't set up yet");
  });
  it("is silent for activities that are ready, and keeps the old wording for an empty practice question", () => {
    expect(activityNotReadyReason(act({ kind: "mcq", mcq: { id: "a", subject_id: "s", title: "T", questions: [mcqQ] } }), ACADEMIA_PACK_SCHEMA)).toBeNull();
    expect(activityNotReadyReason(act({ kind: "adventure", adventure: adventure() }), ACADEMIA_PACK_SCHEMA)).toBeNull();
    expect(activityNotReadyReason(act({ kind: "question", lines: [{}, {}] }), ACADEMIA_PACK_SCHEMA)).toBeNull();
    expect(activityNotReadyReason(act({ kind: "question", lines: [{}] }), ACADEMIA_PACK_SCHEMA)).toBe("No question yet");
  });
});
