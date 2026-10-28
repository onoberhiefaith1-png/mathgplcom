import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  geometryClassroomFallback,
  geometryClassroomSource,
  renderStatement,
} from "../renderStatement";

const visible = (value: string): string =>
  renderToStaticMarkup(createElement("span", null, renderStatement(value)))
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&");

describe("Geometry Map classroom notation", () => {
  it("shows Pythagoras with real superscripts and no storage syntax", () => {
    const formula = "BC^{2}=AB^{2}+CA^{2}";
    const output = visible(formula);

    expect(output).toContain("BC");
    expect(output).toContain("AB");
    expect(output).toContain("CA");
    expect(output).not.toMatch(/[\\^{}]/);
  });

  it("hides geometry-reference macros while preserving every side label", () => {
    const formula =
      "\\georef{side-bc}{BC}^{2}=\\georef{side-ab}{AB}^{2}+\\georef{side-ca}{CA}^{2}";
    const source = geometryClassroomSource(formula);
    const output = visible(formula);

    expect(source).not.toContain("georef");
    expect(output).toContain("BC");
    expect(output).toContain("AB");
    expect(output).toContain("CA");
    expect(output).not.toMatch(/georef|side-bc|side-ab|side-ca|[\\^{}]/);
  });

  it("cleans malformed legacy commands instead of exposing raw syntax", () => {
    const output = geometryClassroomFallback("\\georef{id}{AB}^{2}=\\unknown{CA}");
    expect(output).toContain("AB²");
    expect(output).not.toMatch(/[\\^{}]/);
  });
});