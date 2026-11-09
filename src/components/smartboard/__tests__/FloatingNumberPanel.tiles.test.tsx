import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { boardDom } from "./boardMountSupport";
import { writeFloatingSize } from "@/lib/smartboard/floatingNumberSize";
import { GAME_CHIP_METRICS } from "@/lib/smartboard/floatingNumberSize";
import type { Reservoir } from "@/lib/smartboard/presentation";

const FRAGMENTS = ["−(5)", "((5)²", "x=\\frac{□}{□}", "±\\sqrt{□}", "(−1))"];
const reservoir: Reservoir = {
  beatId: "quadratic-l8",
  caption: "Question",
  fragments: FRAGMENTS,
  lines: [{
    equation: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}",
    fillers: FRAGMENTS,
    containers: [],
    fragmentStart: 0,
    fragmentEnd: FRAGMENTS.length,
  }],
};

let dom: ReturnType<typeof boardDom>;
const pause = async () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

const mount = async (phoneCompact: boolean, width: number) => {
  writeFloatingSize(1);
  dom = boardDom({ width, height: 844 });
  const { FloatingNumberPanel } = await import("../FloatingNumberPanel");
  await dom.render(
    <FloatingNumberPanel
      chromeFg="#111"
      reservoirs={[reservoir]}
      viewIdx={0}
      activeIdx={0}
      visible
      leftPx={0}
      onPing={() => undefined}
      lineNumber={8}
      lineCount={33}
      phoneCompact={phoneCompact}
      phoneControls={<span />}
    />,
  );
  await pause();
};


function precedingText(node: Element, root: Element): string {
  let text = "";
  for (let current: Element | null = node; current && current !== root; current = current.parentElement) {
    for (let sib = current.previousSibling; sib; sib = sib.previousSibling) {
      text = `${sib.textContent ?? ""}${text}`;
    }
  }
  return text.replace(/\s+/g, "");
}
const tiles = () => [...document.querySelectorAll<HTMLButtonElement>('button[title="Tap to use"]')];
const track = () => document.querySelector<HTMLElement>("[data-floating-chip-track]")
  ?? tiles()[0]?.parentElement?.parentElement as HTMLElement;

describe("floating number tray tiles", () => {
  afterEach(async () => {
    writeFloatingSize(1);
    await dom?.cleanup();
  });

  it.each([
    { name: "phone compact", phone: true, width: 390 },
    { name: "tablet / desktop frame", phone: false, width: 1440 },
  ])("$name: uniform squares, first chip stays leading, x= and ± stay inline", async ({ phone, width }) => {
    await mount(phone, width);
    const firstPass = tiles();
    expect(firstPass.map((tile) => tile.textContent?.replace(/\s+/g, "")).join(" ")).toContain("−(5)");
    expect(firstPass[0].textContent).toContain("−(5)");
    const sizes = firstPass.map((tile) => ({ w: tile.style.width, h: tile.style.height }));
    expect(new Set(sizes.map((s) => `${s.w}x${s.h}`)).size).toBe(1);
    expect(sizes[0].w).toBe(`${GAME_CHIP_METRICS.minPx}px`);
    expect(sizes[0].h).toBe(sizes[0].w);
    expect(getComputedStyle(track()).justifyContent || track().style.justifyContent).toBe("flex-start");

    const frac = firstPass.find((tile) => tile.querySelector("[data-math-kind='fraction']"))!;
    const flow = frac.querySelector<HTMLElement>("[data-chip-flow='inline']")!;
    const fraction = frac.querySelector("[data-math-kind='fraction']")!;
    expect(flow).toBeTruthy();
    expect(flow.style.whiteSpace).toBe("nowrap");
    expect(flow.style.flexWrap).toBe("nowrap");
    expect(flow.querySelector("wbr")).toBeNull();
    expect(frac.querySelector("wbr")).toBeNull();
    expect(precedingText(fraction, flow)).toMatch(/x=/);
    expect(flow.style.alignItems).toBe("center");

    const radicalChip = firstPass.find((tile) => tile.querySelector("[data-math-kind='radical']"))!;
    const radical = radicalChip.querySelector("[data-math-kind='radical']")!;
    const radicalFlow = radicalChip.querySelector<HTMLElement>("[data-chip-flow='inline']")!;
    expect(radicalFlow.style.whiteSpace).toBe("nowrap");
    expect(precedingText(radical, radicalFlow)).toMatch(/±/);

    const scroller = track();
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 900 });
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 220 });
    scroller.scrollLeft = 160;
    expect(scroller.scrollLeft).toBe(160);
    await act(async () => { writeFloatingSize(1.3); });
    await pause();
    expect(track().scrollLeft, "size increase keeps the tray anchored at the first chip").toBe(0);
    const after = tiles();
    expect(after[0].textContent).toContain("−(5)");
    const afterSizes = after.map((tile) => `${tile.style.width}x${tile.style.height}`);
    expect(new Set(afterSizes).size).toBe(1);
    expect(after[0].style.width).toBe(after[0].style.height);
    expect(after[0].style.fontSize).toBe(`${GAME_CHIP_METRICS.fontPx}px`);
  });
});
