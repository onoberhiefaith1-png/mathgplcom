import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FloatingDisplayFrame } from "@/components/smartboard/floatingDisplays";
import { FLOATING_DISPLAY_STYLES } from "@/lib/smartboard/floatingDisplayStyles";

const nav = (label: string) => ({ enabled: true, label, onTap: () => {} });

describe("floating display variants", () => {
  it("every design keeps all five controls", () => {
    for (const d of FLOATING_DISPLAY_STYLES) {
      const html = renderToStaticMarkup(
        <FloatingDisplayFrame
          style={d.id}
          chromeFg="#111"
          frozen={false}
          frozenTitle=""
          chips={<span>1</span>}
          left={nav("Backward")}
          right={nav("Forward")}
          up={nav("Previous line")}
          down={nav("Next line")}
          lineText="L3"
        />,
      );
      for (const label of ["Backward", "Forward", "Previous line", "Next line"]) {
        expect(html, `${d.id} missing ${label}`).toContain(`aria-label="${label}"`);
      }
      expect(html, `${d.id} missing line indicator`).toContain("L3");
      // Original keeps its historic compact line column; every new design
      // must give all four controls a full Smartboard touch target.
      const min = d.id === "original" ? 2 : 4;
      expect((html.match(/min-height:56px/g) ?? []).length, `${d.id} touch targets`).toBeGreaterThanOrEqual(min);
    }
  });
});
