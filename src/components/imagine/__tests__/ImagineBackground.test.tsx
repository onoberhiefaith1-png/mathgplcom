// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImagineBackground } from "../ImagineBackground";
import { DEFAULT_GAME_BACKGROUND_URL } from "../defaultBackground";

const background = {
  src: "/authored.jpg",
  assetId: null,
  kind: "image" as const,
  scale: 1,
  x: 0,
  y: 0,
  opacity: 1,
};

describe("ImagineBackground", () => {
  it("keeps the default visible until an authored image loads", () => {
    const { container } = render(<ImagineBackground background={background} />);
    const images = container.querySelectorAll("img");
    expect(images[0]?.getAttribute("src")).toBe(DEFAULT_GAME_BACKGROUND_URL);
    expect(images[1]?.className).toContain("opacity-0");
    if (images[1]) fireEvent.load(images[1]);
    expect(images[1]?.className).toContain("opacity-100");
  });

  it("returns to the default when authored media fails", () => {
    const { container } = render(<ImagineBackground background={background} />);
    const authored = container.querySelectorAll("img")[1];
    if (authored) fireEvent.load(authored);
    expect(authored?.className).toContain("opacity-100");
    if (authored) fireEvent.error(authored);
    expect(authored?.className).toContain("opacity-0");
  });

  it("reveals an authored video only when it can play", () => {
    const { container } = render(<ImagineBackground background={{ ...background, src: "/authored.mp4", kind: "video" }} />);
    const video = container.querySelector("video");
    expect(video?.className).toContain("opacity-0");
    if (video) fireEvent.canPlay(video);
    expect(video?.className).toContain("opacity-100");
  });
});