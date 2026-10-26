import type { ReactNode } from "react";

/** The body owns the baseline; an accent occupies only the space above it. */
export function MathAccent({ symbol, children }: { symbol: string; children: ReactNode }) {
  return (
    <span data-math-kind="accent" style={{ display: "inline-block", position: "relative", verticalAlign: "baseline", paddingTop: "0.35em", lineHeight: 1 }}>
      <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: "0.75em", height: "0.5em", lineHeight: 0.6 }}>{symbol}</span>
      {children}
    </span>
  );
}
