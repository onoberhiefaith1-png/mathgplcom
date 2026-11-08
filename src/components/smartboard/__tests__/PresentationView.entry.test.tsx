import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { boardDom, inkText } from "./boardMountSupport";
import catalogue from "./fixtures/academia-quadratic-catalogue-v8.json";
const session =
  catalogue.schools[0].classes[0].subjects[0].topics[0].subtopics[0]
    .sessions[0];
const activity = session.activities[0];
const updating = vi.hoisted(() => ({
  saved: null as any,
  finish: null as null | (() => void),
  download: vi.fn(),
  run: null as any,
  saveRun: vi.fn(),
}));
vi.mock("@/lib/offline/academiaStore", () => ({
  getCatalogue: async () => updating.saved,
  getAdded: async () => ["482dd181-6ab7-4d8a-9a0f-8580640535cc"],
  allAttempts: async () => [],
  allSessionAttempts: async () => [],
  getKv: async () => "482dd181-6ab7-4d8a-9a0f-8580640535cc",
  getRun: async () => updating.run,
  saveRun: updating.saveRun,
  saveSessionAttempt: vi.fn(),
  setKv: vi.fn(),
  deviceId: async () => "test-device",
}));
vi.mock("@/lib/offline/getReady", () => ({
  getReadyAt: async () => "2026-11-07T12:00:00Z",
  getReady: (...args: any[]) => updating.download(...args),
}));
vi.mock("@/lib/offline/packSync", async (original) => ({
  ...(await original<any>()),
  fetchRemoteVersion: async () => ({ schema: 8, version: "new-guidance" }),
}));
vi.mock("@/lib/offline/prepareOffline", () => ({
  offlineMediaUrl: (s: string) => s,
  resumeMissingMedia: async () => 0,
}));
vi.mock("@/lib/offline/registerAcademiaSW", () => ({
  registerAcademiaSW: vi.fn(),
}));
vi.mock("@/pages/academiaApp/MyAccount", () => ({ default: () => null }));
vi.mock("@/pages/academiaApp/AcademiaScreens", () => ({
  HomeScreen: (p: any) => (
    <button
      onClick={() => p.onOpenSession("2fc962eb-096b-4f02-8405-7d13f3914b13")}
    >
      Open quadratic session
    </button>
  ),
  HistoryScreen: () => null,
  EvaluationScreen: () => null,
  ReviewScreen: () => null,
}));
vi.mock("@/components/academia/LearningPreferences", () => ({
  default: () => null,
}));
vi.mock("@/hooks/useDefaultTier", () => ({
  useDefaultTier: () => ({ tier: "intermediate", setTier: vi.fn() }),
}));
vi.mock("@/pages/imagine/ImaginePlayPage", () => ({ default: () => null }));
vi.mock("@/components/academia/AcademiaAdventurePlayer", () => ({
  default: () => null,
}));

let dom: ReturnType<typeof boardDom>;
let PresentationView: typeof import("../PresentationView").default;
describe("real offline question on mounted PresentationView", () => {
  beforeEach(async () => {
    dom = boardDom();
    updating.run = null;
    PresentationView = (await import("../PresentationView")).default;
  }, 20_000);
  afterEach(async () => {
    await dom.cleanup();
  });
  it.each([false, true])(
    "a completed pack update replaces stale browsing snapshots, not active work (active=%s)",
    async (active) => {
      // Recreate schema 7's actual contract: the equation is first; standalone notes were omitted.
      const old = structuredClone(catalogue);
      old.schema = 7;
      old.version = "old-without-standalone-notes";
      const b =
        old.schools[0].classes[0].subjects[0].topics[0].subtopics[0].sessions[0]
          .activities[0].board;
      b.boardSource.reservoirs[0].lines.shift();
      for (const key of [
        "lineIds",
        "lineMarks",
        "lineNotes",
        "lineNoteOnly",
        "lineHasFloatingNumbers",
        "lineTimers",
        "lineVaults",
      ] as const)
        b[key].shift();
      updating.saved = old;
      updating.run = {
        awards: [
          {
            lineId: b.lineIds[0],
            studentAscii: b.boardSource.reservoirs[0].lines[0].equation,
            marks: 2,
            at: "2026-11-07T12:00:00Z",
          },
        ],
        startedAt: "2026-11-07T12:00:00Z",
      };
      updating.saveRun.mockClear();
      localStorage.setItem("progress-sentinel", "keep my progress");
      updating.download.mockImplementation(
        () =>
          new Promise((resolve) => {
            updating.finish = () => {
              updating.saved = catalogue;
              resolve({ ok: true, catalogue, at: "2026-11-08T12:00:00Z" });
            };
          }),
      );
      const AcademiaApp = (await import("@/pages/academiaApp/AcademiaApp"))
        .default;
      await dom.render(<AcademiaApp />);
      const clickText = async (text: string) => {
        const button = [...dom.host.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === text,
        )!;
        expect(button).toBeTruthy();
        await act(async () => button.click());
      };
      expect(updating.finish).toBeTypeOf("function");
      await clickText("Open quadratic session");
      if (active) {
        await clickText("practice");
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
        expect(dom.host.textContent).toContain("+5x");
      }
      await act(async () => updating.finish!());
      if (active) {
        // A download that was already running must not replace a live attempt.
        expect(dom.host.textContent).toContain("+5x");
        await act(async () =>
          dom.host
            .querySelector<HTMLButtonElement>(
              'button[aria-label="Back to Session"]',
            )!
            .click(),
        );
      }
      await clickText("practice");
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });
      expect(inkText(dom.host)).toBe("Compare");
      expect(dom.host.textContent).not.toContain("+5x");
      expect(localStorage.getItem("progress-sentinel")).toBe(
        "keep my progress",
      );
      expect(updating.saveRun).toHaveBeenLastCalledWith(
        activity.id,
        "practice",
        updating.run,
      );
    },
    20_000,
  );
  it.each([true, false])(
    "Compare → true L2 → note → Reset on the board (offline=%s)",
    async (offline) => {
      const b = activity.board;
      expect(b.lineIds[0]).toBe("hl_leading_note");
      expect(b.lineNoteOnly[0]).toBe(true);
      expect(b.lineMarks[0]).toBe(0);
      expect(b.boardSource.reservoirs[0].lines[0].fillers).toEqual([]);
      expect(b.totalMarks).toBe(33);
      await dom.render(
        <PresentationView
          role="student"
          source={b.boardSource as never}
          notebookId={b.notebookId}
          assessmentId={b.assessmentId}
          boardStudentId={`offline:${activity.id}`}
          boardQuestionId={b.boardQuestionId}
          workspace="assignment"
          testMode={offline}
          localMarking={offline}
          timerEnabled
          touchSession={{
            questionIndex: 0,
            questionCount: 1,
            score: 0,
            totalScore: b.totalMarks,
            onQuestionChange: () => {},
            onBack: () => {},
            backLabel: "Back to Session",
            fullscreen: true,
            onFullscreenChange: () => {},
          }}
        />,
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });
      expect(dom.host.textContent).toContain("Compare");
      expect(dom.host.textContent).not.toContain("with the standard form");
      const click = async (label: string) => {
        const button = dom.host.querySelector<HTMLButtonElement>(
          `button[aria-label="${label}"]`,
        )!;
        expect(button).toBeTruthy();
        await act(async () => button.click());
        await act(async () => {
          await new Promise((r) => setTimeout(r, 100));
        });
      };
      await click("Next line");
      expect(
        [...dom.host.querySelectorAll('button[title="Tap to use"]')].map(
          (button) => button.textContent,
        ),
      ).toEqual(["+5xL2", "=0L2", "2x²L2", "−1L2"]);
      expect(dom.host.textContent).not.toContain("with the standard form");
      expect(
        dom.host.querySelector('button[title="Line 2"]')?.textContent,
      ).toBe("2");
      await click("Next line");
      expect(inkText(dom.host)).toBe("Comparewith the standard form");
      await click("Previous line");
      await click("Previous line");
      await click("Next line");
      await click("Next line");
      expect(inkText(dom.host)).toBe("Comparewith the standard form");
      await click("Reset attempt");
      expect(inkText(dom.host)).toBe("Compare");
      expect(dom.host.textContent).not.toContain("+5x");
    },
    20_000,
  );
});
