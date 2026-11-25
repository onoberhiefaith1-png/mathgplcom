import { JSDOM } from "jsdom";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AddGameChoice } from "../AddQuestionGameControl";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://mathgpl.com",
  pretendToBeVisual: true,
});
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "Element",
  "Node",
  "DocumentFragment",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "CustomEvent",
]) {
  const value = (dom.window as unknown as Record<string, unknown>)[name];
  if (value)
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  configurable: true,
  writable: true,
});
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.requestAnimationFrame ??= (cb: FrameRequestCallback) =>
  setTimeout(() => cb(0), 0) as unknown as number;
globalThis.cancelAnimationFrame ??= (id: number) => clearTimeout(id);

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AddQuestionGameControl } = await import("../AddQuestionGameControl");
type Root = ReturnType<typeof createRoot>;

afterAll(() => dom.window.close());

const games: AddGameChoice[] = [
  {
    id: "game-a",
    name: "Game A",
    surface: "Stone Wall",
    preview: "/stone.jpg",
  },
  {
    id: "game-b",
    name: "Game B",
    surface: "Parchment",
    preview: "/parchment.jpg",
  },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function show(
  props: Partial<Parameters<typeof AddQuestionGameControl>[0]> = {},
) {
  const onSave = props.onSave ?? vi.fn(async () => undefined);
  const onReloadGames = props.onReloadGames ?? vi.fn();
  await act(async () => {
    root.render(
      <AddQuestionGameControl
        eligible
        canEdit
        currentGameId={null}
        games={games}
        gamesStatus="ready"
        onReloadGames={onReloadGames}
        onSave={onSave}
        {...props}
      />,
    );
  });
  return { onSave, onReloadGames };
}

function button(name: string) {
  return (
    [...document.querySelectorAll("button")].find(
      (el) =>
        el.textContent?.includes(name) ||
        el.getAttribute("aria-label") === name,
    ) ?? null
  );
}

async function click(el: Element | null) {
  if (!el) throw new Error("missing button");
  await act(async () => {
    (el as HTMLButtonElement).click();
  });
}

describe("Add Game on a Floating Numbers question", () => {
  it("adds a game to a question that has none", async () => {
    const { onSave } = await show();
    await click(button("Add Game"));
    expect(document.body.textContent).toContain(
      "Choose a game from your dashboard",
    );
    await click(document.querySelector("[data-testid='game-game-b']"));
    await click(document.querySelector("[data-testid='save-game']"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("game-b");
    expect(document.querySelector("[data-testid='save-game']")).toBeNull();
  });

  it("keeps Add Game when a game is already linked and replaces it", async () => {
    const { onSave } = await show({ currentGameId: "game-a" });
    const opener = button("Add Game");
    expect(opener?.textContent).toContain("Add Game");
    await click(opener);
    const current = document.querySelector("[data-testid='current-game']");
    expect(current?.textContent).toContain("Current");
    expect(
      document
        .querySelector("[data-testid='game-game-a']")
        ?.contains(current as Node),
    ).toBe(true);
    expect(
      (document.querySelector("[data-testid='save-game']") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await click(document.querySelector("[data-testid='game-game-b']"));
    await click(document.querySelector("[data-testid='save-game']"));
    expect(onSave).toHaveBeenCalledWith("game-b");
  });

  it("does not offer Add Game on an ordinary multiple-choice question", async () => {
    await show({ eligible: false, canEdit: true });
    expect(button("Add Game")).toBeNull();
  });

  it("does not offer Add Game to a student", async () => {
    await show({ eligible: true, canEdit: false });
    expect(button("Add Game")).toBeNull();
  });

  it("explains when the dashboard has no games", async () => {
    await show({ games: [] });
    await click(button("Add Game"));
    expect(
      document.querySelector("[data-testid='add-game-empty']")?.textContent,
    ).toContain("no available games in your dashboard");
  });

  it("keeps the current game when saving fails", async () => {
    const onSave = vi.fn(async () => {
      throw new Error(
        "The game could not be saved. This question is unchanged.",
      );
    });
    await show({ currentGameId: "game-a", onSave });
    await click(button("Add Game"));
    await click(document.querySelector("[data-testid='game-game-b']"));
    await click(document.querySelector("[data-testid='save-game']"));
    expect(
      document.querySelector("[data-testid='add-game-error']")?.textContent,
    ).toContain("unchanged");
    const current = document.querySelector("[data-testid='current-game']");
    expect(current?.textContent).toContain("Current");
    expect(
      document
        .querySelector("[data-testid='game-game-a']")
        ?.contains(current as Node),
    ).toBe(true);
  });

  it("ignores a second save while the first is still running", async () => {
    let release: () => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await show({ onSave });
    await click(button("Add Game"));
    await click(document.querySelector("[data-testid='game-game-b']"));
    const save = document.querySelector(
      "[data-testid='save-game']",
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
      save.click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
    expect(document.querySelector("[data-testid='save-game']")).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
