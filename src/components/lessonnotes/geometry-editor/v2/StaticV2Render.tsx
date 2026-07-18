// StaticV2Render — read-only SVG rendering of a v2 scene for when the
// geometry node is not selected. Phase 1 renders only points.

import type { V2Scene, V2Point } from "@/lib/geometry/v2/scene";

const PAD = 16;
const DOT_R = 4;
const LABEL_FONT = "'Times New Roman', Georgia, serif";

export function StaticV2Render({ scene, showHidden }: { scene: V2Scene; showHidden?: boolean }) {
  const W = scene.bounds.width + PAD * 2;
  const H = scene.bounds.height + PAD * 2;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 6 }}
    >
      <g transform={`translate(${PAD} ${PAD})`}>
        {scene.objects.map((o) => {
          if (o.type !== "point") return null;
          const p = o as V2Point;
          if (p.hidden && !showHidden) return null;
          return (
            <g key={p.id} opacity={p.hidden ? 0.35 : 1}>
              <circle cx={p.x} cy={p.y} r={DOT_R} fill={p.color} />
              {p.labelText ? (
                <text
                  x={p.x + p.labelOffset.dx}
                  y={p.y + p.labelOffset.dy}
                  fill={p.labelColor ?? p.color}
                  fontFamily={LABEL_FONT}
                  fontStyle="italic"
                  fontSize={14}
                >
                  {p.labelText}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
