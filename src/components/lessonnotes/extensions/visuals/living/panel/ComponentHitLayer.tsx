// Invisible click targets rendered over the diagram, one per component.
// Clicking sets the current selectedComponentId; clicking empty space
// (handled by the SVG background) clears it back to the whole diagram.

import type { PointerEvent as ReactPointerEvent } from "react";
import type { Nodes } from "../geometry";
import type { Component } from "./componentModel";

interface Props {
  components: Component[];
  nodes: Nodes | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ComponentHitLayer({ components, nodes, selectedId, onSelect }: Props) {
  if (!nodes) return null;
  const stop = (e: ReactPointerEvent) => { e.stopPropagation(); };

  return (
    <g>
      {components.map(c => {
        if (c.behaviour?.visible === false || c.behaviour?.locked) return null;
        const sel = c.id === selectedId;
        const commonProps = {
          onPointerDown: (e: ReactPointerEvent) => { stop(e); onSelect(c.id); },
          style: { cursor: "pointer" as const },
        };

        if (c.kind === "line" && c.nodes?.length === 2) {
          const a = nodes[c.nodes[0]]; const b = nodes[c.nodes[1]];
          if (!a || !b) return null;
          return (
            <g key={c.id}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={10} {...commonProps}
              />
              {sel && (
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="hsl(var(--primary))" strokeWidth={3} strokeOpacity={0.35}
                  style={{ pointerEvents: "none" }} />
              )}
            </g>
          );
        }
        if (c.kind === "vertex" && c.nodes?.[0]) {
          const p = nodes[c.nodes[0]]; if (!p) return null;
          return (
            <g key={c.id}>
              <circle cx={p.x} cy={p.y} r={7} fill="transparent" {...commonProps} />
              {sel && (
                <circle cx={p.x} cy={p.y} r={6} fill="none"
                  stroke="hsl(var(--primary))" strokeWidth={1.5}
                  style={{ pointerEvents: "none" }} />
              )}
            </g>
          );
        }
        if (c.kind === "angle" && c.nodes?.length === 3) {
          const v = nodes[c.nodes[1]]; if (!v) return null;
          return (
            <g key={c.id}>
              <circle cx={v.x} cy={v.y} r={16} fill="transparent" {...commonProps} />
              {sel && (
                <circle cx={v.x} cy={v.y} r={16} fill="none"
                  stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="2 2"
                  style={{ pointerEvents: "none" }} />
              )}
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}
