import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { boardDom } from "./boardMountSupport";
import catalogue from "./fixtures/academia-quadratic-catalogue-v8.json";
vi.mock("@/lib/accounts/useAccount", () => ({
  useAccount: () => ({ account: null }),
}));
vi.mock("@/lib/slate/gameSound", () => ({
  prepareGameSounds: async () => {},
  stopBackgroundSound: vi.fn(),
  applyBackgroundSound: vi.fn(),
  playRewardSound: vi.fn(),
  setBackgroundVolume: vi.fn(),
}));
vi.mock("@/lib/imagine/moveSounds", () => ({
  playMove: vi.fn(),
  setMoveVolume: vi.fn(),
}));
vi.mock("@/components/imagine/ImagineStage", () => ({
  default: (p: any) => (
    <div data-testid="stage">
      {p.game.slots.map((slot: any) => (
        <div key={slot.id} data-slot={slot.id}>
          <button onClick={() => p.onSelect({ kind: "slot", slotId: slot.id })}>
            {slot.id}
          </button>
          <span>{slot.structuredNote ?? ""}</span>
        </div>
      ))}
    </div>
  ),
}));

let dom: ReturnType<typeof boardDom>;
describe("installed Play's real Game renderer and board contract", () => {
  beforeEach(async () => {
    dom = boardDom();
  });
  afterEach(async () => {
    await dom.cleanup();
  });

  it("the authentic quadratic board opens Compare, not a repeated question, in Play", async () => {
    const { makeGame } = await import("@/lib/slate/defaults");
    const game = makeGame({
      name: "Synthetic Game attachment",
      topic: "",
      subtopic: "",
      surfaceId: "stone-wall",
      lines: 4,
      background: {
        src: null,
        assetId: null,
        kind: "image",
        scale: 1,
        x: 0,
        y: 0,
        opacity: 1,
      },
    });
    const activity =
      catalogue.schools[0].classes[0].subjects[0].topics[0].subtopics[0]
        .sessions[0].activities[0];
    // The downloaded question is real; attaching a Game is a mode contract test,
    // not a claim that this activity has a Game configured in production.
    const Page = (await import("@/pages/imagine/ImaginePlayPage")).default;
    await dom.render(
      <Page
        offline={{
          activityId: activity.id,
          game,
          board: activity.board as never,
          startingLives: 3,
          assetUrls: {},
          onExit: () => {},
        }}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(
      dom.host.querySelector('[data-slot="line-1"] span')?.textContent,
    ).toBe("Compare");
    expect(
      dom.host.querySelector('[data-slot="line-2"] span')?.textContent,
    ).toBe("");
  }, 20_000);
  it("a later zero-mark note is displayed on entering its actual numbered surface", async () => {
    const { makeGame } = await import("@/lib/slate/defaults");
    const { compileOfflineBoard } = await import("@/lib/offline/academiaPack");
    const game = makeGame({
      name: "Synthetic note-only navigation",
      topic: "",
      subtopic: "",
      surfaceId: "stone-wall",
      lines: 4,
      background: {
        src: null,
        assetId: null,
        kind: "image",
        scale: 1,
        x: 0,
        y: 0,
        opacity: 1,
      },
    });
    // Synthetic mode coverage: the real quadratic has no attached Game.
    const board = compileOfflineBoard({
      activityId: "game-note-contract",
      subsectionId: "synthetic",
      questionText: "Solve x + 1 = 2",
      title: "note-only test",
      lines: [
        {
          lineId: "compare",
          equation: "",
          notebook: "Compare",
          noteOnly: true,
          fillers: [],
          containers: [],
          marks: 0,
        },
        {
          lineId: "eq",
          equation: "x + 1 = 2",
          fillers: ["x", "+1", "=2"],
          containers: [],
          marks: 2,
        },
        {
          lineId: "later-note",
          equation: "",
          notebook: "with the standard form",
          noteOnly: true,
          fillers: [],
          containers: [],
          marks: 0,
        },
        {
          lineId: "answer",
          equation: "x = 1",
          fillers: ["x", "=1"],
          containers: [],
          marks: 1,
        },
      ] as never,
    })!;
    const Page = (await import("@/pages/imagine/ImaginePlayPage")).default;
    await dom.render(
      <Page
        offline={{
          activityId: "game-note-contract",
          game,
          board,
          startingLives: 3,
          assetUrls: {},
          onExit: () => {},
        }}
      />,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    expect(
      dom.host.querySelector('[data-slot="line-1"] span')?.textContent,
    ).toBe("Compare");
    expect(
      dom.host.querySelector('[data-slot="line-3"] span')?.textContent,
    ).toBe("");
    const click = async (selector: string) => {
      const button = dom.host.querySelector<HTMLButtonElement>(selector)!;
      expect(button).toBeTruthy();
      await act(async () => button.click());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    };
    await click('button[aria-label="Next line"]');
    expect(dom.host.querySelector('[title="Current line"]')?.textContent).toBe(
      "L2",
    );
    expect(
      dom.host.querySelector('[data-slot="line-3"] span')?.textContent,
    ).toBe("");
    await click('button[aria-label="Next line"]');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(
      dom.host.querySelector('[data-slot="line-3"] span')?.textContent,
    ).toBe("with the standard form");
    await click('[data-slot="line-1"] button');
    expect(
      dom.host.querySelector('[data-slot="line-3"] span')?.textContent,
    ).toBe("with the standard form");
    expect(dom.host.querySelector('[title="Marks"]')?.textContent).toBe("0/3");
    expect(
      dom.host.querySelector('[title="Completed lines"]')?.textContent,
    ).toBe("0");
    window.confirm = vi.fn(() => true);
    await click('button[aria-label="Game menu"]');
    const reset = [...dom.host.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Reset this run",
    )!;
    expect(reset).toBeTruthy();
    await act(async () => reset.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(
      dom.host.querySelector('[data-slot="line-1"] span')?.textContent,
    ).toBe("Compare");
    expect(
      dom.host.querySelector('[data-slot="line-3"] span')?.textContent,
    ).toBe("");
    expect(dom.host.querySelector('[title="Current line"]')?.textContent).toBe(
      "L1",
    );
  }, 20_000);
});
