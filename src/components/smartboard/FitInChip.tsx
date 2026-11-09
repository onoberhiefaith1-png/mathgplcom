import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CHIP_FIT_INSET, chipFlowStyle, fitContentScale } from "@/lib/smartboard/floatingNumberTiles";

/** Measures chip ink and scales it down so it stays inside a uniform tile. */
export const FitInChip = ({ children }: { children: ReactNode }) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const ink = inkRef.current;
    if (!box || !ink) return;
    const measure = () => {
      const next = fitContentScale(
        Math.max(0, box.clientWidth - CHIP_FIT_INSET),
        Math.max(0, box.clientHeight - CHIP_FIT_INSET),
        ink.scrollWidth,
        ink.scrollHeight,
      );
      setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(ink);
    return () => ro.disconnect();
  }, [children]);

  return (
    <span
      ref={boxRef}
      data-chip-fit
      data-fit-scale={scale}
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <span
        ref={inkRef}
        data-chip-flow="inline"
        style={{
          ...chipFlowStyle,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </span>
    </span>
  );
};
