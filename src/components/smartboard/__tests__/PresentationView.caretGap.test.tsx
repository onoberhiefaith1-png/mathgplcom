import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { boardDom, getBoardSession } from "./boardMountSupport";
import { getGrid } from "@/lib/smartboard/grid";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import catalogue from "./fixtures/academia-quadratic-catalogue-v8.json";

const activity = catalogue.schools[0].classes[0].subjects[0].topics[0].subtopics[0].sessions[0].activities[0];
const boardSession = getBoardSession();
const guidance = "State the quadratic formula:";
let dom: ReturnType<typeof boardDom>;
const pause = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 90)); });
const rows = () => [...dom.host.querySelectorAll<HTMLElement>("[data-erase-line]")];
const caret = () => rows().find(row => row.querySelector(".sb-sensor"))!;
const line = (row: HTMLElement) => Number(row.dataset.eraseLine);
const top = (row: HTMLElement) => parseFloat(row.style.top);
const lastSnapshot = () => boardSession.push.mock.calls.at(-1)![0];
async function click(label: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  expect(button, label).toBeTruthy();
  await act(async () => button.click()); await pause();
}
async function chip(text: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button[title="Tap to use"]')]
    .find(b => b.textContent?.startsWith(text))!;
  expect(button, `missing chip ${text}`).toBeTruthy();
  await act(async () => button.click()); await pause();
}
async function pad(direction: "up" | "down") {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="Sensor ${direction}"]`)!;
  expect(button.disabled, `${direction} should be reachable`).toBe(false);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    button.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
  }); await pause();
}
async function key(key: string) {
  await act(async () => dom.host.querySelector("textarea")!.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key }),
  )); await pause();
}
async function tapSurface(y: number) {
  const main = dom.host.querySelector("main")!;
  // Actual production pointer conversion subtracts the host origin + 24px padding.
  await act(async () => main.dispatchEvent(new MouseEvent("pointerdown", {
    bubbles: true, button: 0, clientX: 45,
    clientY: y + main.getBoundingClientRect().top + 24 - main.scrollTop,
  }))); await pause();
}

describe("production caret below measured quadratic guidance", () => {
  afterEach(async () => { await dom.cleanup(); vi.restoreAllMocks(); });
  it.each([
    { name: "phone, three wrapped lines", width: 390, textScale: 1, zoom: 1, wraps: 3, local: true },
    { name: "tablet, two wrapped lines and enlarged text", width: 768, textScale: 1.3, zoom: 1, wraps: 2, local: true },
    { name: "desktop website, enlarged single line and zoom", width: 1440, textScale: 1.8, zoom: 1.2, wraps: 1, local: false },
  ])("$name: D-pad/touch reach the first clear row; keyboard and math protect prose", async config => {
    dom = boardDom({ width: config.width, height: 844 });
    boardSession.sessionActive = true;
    const b = activity.board;
    localStorage.setItem(`smartboard:textScale:${b.notebookId}`, String(config.textScale));
    localStorage.setItem(`smartboard:zoom:${b.notebookId}`, String(config.zoom));
    const grid = getGrid(config.zoom, 1, config.textScale, config.width < 1024 ? .25 : 1);
    const noteHeight = config.wraps * grid.FONT_PX + (config.wraps - 1) * Math.round(grid.FONT_PX * .35);
    // jsdom has no typesetter. Supply only browser measurement inputs, using
    // the renderer's inline font/rowGap and explicit wrap counts. All layout,
    // row ownership, reflow, hit testing, writing and controls remain real.
    // These are deterministic geometry scenarios, not device screenshot pixels.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
      const y = parseFloat(this.style.top) || 0;
      const font = parseFloat(this.style.fontSize) || grid.FONT_PX;
      const isInk = this.hasAttribute("data-erase-line");
      const height = !isInk ? 0 : this.textContent === guidance ? noteHeight
        : this.querySelector('[style*="flex-direction: column"]') ? 4 * font : font;
      return { x: 0, y, top: y, bottom: y + height, left: 0, right: config.width,
        width: config.width, height, toJSON() {} } as DOMRect;
    });
    const PresentationView = (await import("../PresentationView")).default;
    await dom.render(<PresentationView role="student" source={b.boardSource as never}
      notebookId={b.notebookId} assessmentId={b.assessmentId}
      boardStudentId={`offline:${activity.id}`} boardQuestionId={b.boardQuestionId}
      workspace="assignment" testMode={config.local} localMarking={config.local} />);
    await pause();
    expect(rows()[0].textContent).toBe("Compare");
    if (config.width >= 640) await click(config.width >= 1024 ? "Toggle floating numbers" : "Floating numbers");
    // Walk the authentic public activity, including the standard-form note.
    for (const chips of [["2x²", "+5x", "−1", "=0"], ["ax²", "+bx", "+c", "=0"],
      ["a", "=", "2"], ["b", "=", "5"], ["c", "=", "−1"]]) {
      await click("Next line");
      for (const value of chips) await chip(value);
    }
    await click("Teaching note — tap to place on board");
    await click("Next line");
    await pad("down");
    const note = rows().find(row => row.textContent === guidance)!;
    const noteLine = line(note);
    const expected = noteLine + 1;
    expect(line(caret()), "Measured height already pushes this baseline below all prose; do not reserve it twice").toBe(expected);
    expect(top(caret()) - top(note)).toBeCloseTo(grid.LINE_HEIGHT + Math.max(0, noteHeight - grid.CURSOR_HEIGHT));
    expect(top(caret())).toBeGreaterThanOrEqual(top(note) + noteHeight - .01);
    const firstClearTop = top(caret());
    await pad("down"); await pad("up");
    expect(line(caret())).toBe(expected);
    await key("ArrowUp"); expect(line(caret())).toBe(expected);
    await key("ArrowRight"); await key("ArrowLeft");
    expect(line(caret())).toBe(expected);
    await pad("down"); await tapSurface(firstClearTop + 2);
    expect(line(caret()), "Touch agrees with D-pad after measured reflow").toBe(expected);
    expect(lastSnapshot().sensor.line, "Classroom mirror publishes the same logical row, not its shifted pixel index").toBe(expected);
    await act(async () => note.querySelector<HTMLElement>("[data-erase-path]")!.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
    )); await pause();
    expect(line(caret()), "Authored prose remains protected").toBe(expected);
    expect(note.textContent).toBe(guidance);
    await tapSurface(top(note) + noteHeight * .7);
    expect(line(caret()), "Blank portions inside wrapped guidance do not become writing slots").toBe(expected);
    expect(lastSnapshot().notebookRows).toContain(noteLine);
    const cRow = rows().find(row => /c =/.test(row.textContent ?? ""))!;
    const cBefore = cRow.textContent;
    // Select the next authored line after manually moving the writing sensor.
    await click("Next line");
    // Start its actual formula on the newly accessible row.
    await chip("x=");
    expect(lastSnapshot().sensor.line).toBe(expected);
    expect(rowToAscii(lastSnapshot().freeLines[expected])).toContain("x");
    expect(lastSnapshot().activeLineIdx).toBe(6);
    expect(lastSnapshot().freeLines[expected]).toEqual(expect.arrayContaining([expect.objectContaining({ sbOwner: 6 })]));
    expect(cRow.textContent).toBe(cBefore);
    expect(note.textContent).toBe(guidance);
    if (config.local && config.width === 390) {
      // Nested fraction + root keyboard controls stay inside their actual math
      // slots rather than taking ownership of the preceding c/note rows.
      await chip("±");
      expect(lastSnapshot().sensor.line).toBe(expected);
      await key("ArrowDown");
      expect(lastSnapshot().sensor.line).toBe(expected);
      const formula=rows().find(row=>line(row)===expected)!;
      await act(async()=>formula.firstElementChild!.lastElementChild!.dispatchEvent(
        new MouseEvent("pointerdown", {bubbles:true,button:0}),
      )); await pause();
      await pad("down");
      expect(line(caret()), "Tall math retains exactly its one structural reservation, not measured extra skips").toBe(expected+2);
      expect(top(caret())).toBeGreaterThanOrEqual(top(formula)+formula.getBoundingClientRect().height-.01);
      expect(lastSnapshot().activeLineIdx).toBe(6);
      expect(note.textContent).toBe(guidance);
    }
  }, 45000);
});
