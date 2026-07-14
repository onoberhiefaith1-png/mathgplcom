// Dispatch table for the generic mathVisual node. Each family renders a
// simple, resizable SVG so lesson notes can carry diagrams, graphs,
// tables and manipulatives without pulling in heavy chart libraries.

import type { CSSProperties, ReactNode } from "react";

interface Ctx { onCycle?: () => void }

const SVG = ({ children, vb = "0 0 200 140", style }: { children: ReactNode; vb?: string; style?: CSSProperties }) => (
  <svg viewBox={vb} className="w-full h-auto" style={style} xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

// ── Shapes ──────────────────────────────────────────────────────────────
function Shape(variant: string) {
  const stroke = "currentColor";
  const fill = "none";
  const P = (d: string, sw = 2) => <path d={d} stroke={stroke} fill={fill} strokeWidth={sw} />;
  const L = (x1: number, y1: number, x2: number, y2: number, sw = 2, dash?: string) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
  );
  const dot = (x: number, y: number, r = 2.5) => <circle cx={x} cy={y} r={r} fill={stroke} />;

  switch (variant) {
    // Lines & Angles
    case "lineSegment":
      return <SVG>{L(30, 70, 170, 70)}{dot(30, 70)}{dot(170, 70)}</SVG>;
    case "ray":
      return (
        <SVG>
          {dot(30, 70)}
          <line x1={30} y1={70} x2={165} y2={70} stroke={stroke} strokeWidth={2} markerEnd="url(#arr)" />
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill={stroke}/>
            </marker>
          </defs>
        </SVG>
      );
    case "intersectingLines":
      return <SVG>{L(20, 30, 180, 110)}{L(20, 110, 180, 30)}<path d="M85 62 A18 18 0 0 1 115 62" stroke={stroke} fill="none" strokeWidth={1}/></SVG>;
    case "parallelTransversal":
      return (
        <SVG>
          {L(15, 45, 185, 45)}
          {L(15, 100, 185, 100)}
          {L(55, 15, 155, 130)}
          <path d="M85 45 A14 14 0 0 1 100 55" stroke={stroke} fill="none" strokeWidth={1}/>
          <path d="M105 100 A14 14 0 0 1 118 91" stroke={stroke} fill="none" strokeWidth={1}/>
        </SVG>
      );
    case "angleAcute":
      return <SVG>{L(30, 110, 180, 110)}{L(30, 110, 150, 30)}<path d="M60 110 A30 30 0 0 0 55 90" stroke={stroke} fill="none" strokeWidth={1.5}/></SVG>;
    case "angleObtuse":
      return <SVG>{L(30, 110, 180, 110)}{L(30, 110, 40, 30)}<path d="M60 110 A30 30 0 0 0 34 85" stroke={stroke} fill="none" strokeWidth={1.5}/></SVG>;
    case "angleReflex":
      return <SVG>{L(30, 110, 180, 110)}{L(30, 110, 60, 30)}<path d="M60 110 A30 30 0 1 1 40 85" stroke={stroke} fill="none" strokeWidth={1.5}/></SVG>;
    case "angleRight":
      return <SVG>{L(30, 110, 180, 110)}{L(30, 110, 30, 20)}<path d="M30 96 L44 96 L44 110" stroke={stroke} fill="none" strokeWidth={1.5}/></SVG>;

    // Triangles
    case "triangleRight":   return <SVG>{P("M20 120 L180 120 L20 20 Z")}<path d="M20 108 L32 108 L32 120" stroke={stroke} fill="none" strokeWidth={1.5}/></SVG>;
    case "triangleIso":     return <SVG>{P("M100 20 L20 120 L180 120 Z")}<line x1={55} y1={72} x2={62} y2={68} stroke={stroke}/><line x1={138} y1={68} x2={145} y2={72} stroke={stroke}/></SVG>;
    case "triangleEqui":    return <SVG>{P("M100 20 L20 120 L180 120 Z")}<line x1={55} y1={72} x2={62} y2={68} stroke={stroke}/><line x1={138} y1={68} x2={145} y2={72} stroke={stroke}/><line x1={96} y1={116} x2={104} y2={124} stroke={stroke}/></SVG>;
    case "triangleScalene": return <SVG>{P("M40 30 L20 120 L180 100 Z")}</SVG>;
    case "triangleHyp":     return <SVG>{P("M20 100 L180 100 L120 30 Z")}</SVG>;
    case "triangleAltitude":
      return <SVG>{P("M30 120 L180 120 L110 30 Z")}{L(110, 30, 110, 120, 1.5, "4 3")}<path d="M110 108 L122 108 L122 120" stroke={stroke} fill="none" strokeWidth={1}/></SVG>;

    // Quadrilaterals
    case "rectangle":       return <SVG>{P("M20 30 H180 V110 H20 Z")}</SVG>;
    case "square":          return <SVG>{P("M40 20 H160 V120 H40 Z")}</SVG>;
    case "parallelogram":   return <SVG>{P("M40 110 L70 30 L180 30 L150 110 Z")}</SVG>;
    case "trapezium":       return <SVG>{P("M20 110 L60 30 L140 30 L180 110 Z")}</SVG>;
    case "rhombus":         return <SVG>{P("M100 20 L170 70 L100 120 L30 70 Z")}</SVG>;
    case "kite":            return <SVG>{P("M100 20 L160 70 L100 120 L40 70 Z")}</SVG>;
    case "pentagon":        return <SVG>{P("M100 20 L180 75 L150 120 L50 120 L20 75 Z")}</SVG>;
    case "hexagon":         return <SVG>{P("M50 30 L150 30 L180 75 L150 120 L50 120 L20 75 Z")}</SVG>;
    case "octagon":         return <SVG>{P("M60 20 H140 L180 60 V90 L140 130 H60 L20 90 V60 Z")}</SVG>;

    // Circles
    case "circle":          return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/>{dot(100, 70, 2)}</SVG>;
    case "circleRadius":    return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/>{L(100, 70, 155, 70)}{dot(100, 70)}</SVG>;
    case "circleDiameter":  return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/>{L(45, 70, 155, 70)}</SVG>;
    case "circleSector":    return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/><path d="M100 70 L155 70 A55 55 0 0 0 130 25 Z" stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "circleSegmentChord": return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/>{L(55, 45, 155, 90)}</SVG>;
    case "circleTangent":   return <SVG><circle cx={100} cy={70} r={45} stroke={stroke} fill="none" strokeWidth={2}/>{L(20, 115, 180, 115)}</SVG>;
    case "circleInscribed": return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/>{P("M100 20 L45 100 L155 100 Z")}</SVG>;
    case "cyclicQuadrilateral":
      return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/>{P("M60 30 L155 55 L145 115 L50 105 Z")}</SVG>;

    // 3D
    case "cube":            return <SVG>{P("M40 45 H140 V125 H40 Z")}{P("M40 45 L70 20 H170 L140 45")}{P("M140 125 L170 100 V20")}</SVG>;
    case "cuboid":          return <SVG>{P("M20 45 H140 V115 H20 Z")}{P("M20 45 L50 20 H170 L140 45")}{P("M140 115 L170 90 V20")}</SVG>;
    case "cylinder":        return <SVG><ellipse cx={100} cy={30} rx={60} ry={12} stroke={stroke} fill="none" strokeWidth={2}/>{L(40, 30, 40, 110)}{L(160, 30, 160, 110)}<path d="M40 110 A60 12 0 0 0 160 110" stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "cone":            return <SVG><ellipse cx={100} cy={110} rx={60} ry={12} stroke={stroke} fill="none" strokeWidth={2} strokeDasharray="4 3"/>{L(40, 110, 100, 20)}{L(160, 110, 100, 20)}<path d="M40 110 A60 12 0 0 0 160 110" stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "sphere":          return <SVG><circle cx={100} cy={70} r={55} stroke={stroke} fill="none" strokeWidth={2}/><ellipse cx={100} cy={70} rx={55} ry={16} stroke={stroke} fill="none" strokeWidth={1} strokeDasharray="4 3"/></SVG>;
    case "hemisphere":      return <SVG><path d="M40 90 A60 60 0 0 1 160 90" stroke={stroke} fill="none" strokeWidth={2}/><ellipse cx={100} cy={90} rx={60} ry={12} stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "pyramid":         return <SVG>{P("M30 110 L100 20 L170 110 Z")}{L(30, 110, 170, 110, 1.5, "4 3")}</SVG>;
    case "squarePyramid":   return <SVG>{P("M20 100 L100 20 L180 100 L100 130 Z")}{L(20, 100, 180, 100, 1, "4 3")}{L(100, 20, 100, 130, 1, "4 3")}</SVG>;
    case "prism":
    case "triangularPrism": return <SVG>{P("M20 110 L60 30 L100 110 Z")}{L(60, 30, 160, 30)}{L(100, 110, 180, 110)}{L(180, 110, 160, 30)}{L(20, 110, 120, 110, 1, "4 3")}</SVG>;
    case "netCube":         return <SVG>{P("M60 20 H100 V60 H60 Z")}{P("M60 60 H100 V100 H60 Z")}{P("M20 60 H60 V100 H20 Z")}{P("M100 60 H140 V100 H100 Z")}{P("M140 60 H180 V100 H140 Z")}{P("M60 100 H100 V140 H60 Z")}</SVG>;
    case "netCylinder":     return <SVG><circle cx={40} cy={40} r={22} stroke={stroke} fill="none" strokeWidth={1.5}/><circle cx={40} cy={110} r={22} stroke={stroke} fill="none" strokeWidth={1.5}/>{P("M75 30 H180 V120 H75 Z", 1.5)}</SVG>;
    case "netPrism":        return <SVG>{P("M20 60 H60 V110 H20 Z")}{P("M60 60 H120 V110 H60 Z")}{P("M120 60 H180 V110 H120 Z")}{P("M60 60 L90 20 L120 60")}{P("M60 110 L90 130 L120 110", 1.5)}</SVG>;

    // Logic
    case "venn2":           return <SVG><rect x={10} y={20} width={180} height={100} stroke={stroke} fill="none" strokeWidth={1}/><circle cx={80} cy={70} r={40} stroke={stroke} fill="none" strokeWidth={2}/><circle cx={130} cy={70} r={40} stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "venn3":           return <SVG><rect x={10} y={10} width={180} height={125} stroke={stroke} fill="none" strokeWidth={1}/><circle cx={80} cy={60} r={38} stroke={stroke} fill="none" strokeWidth={2}/><circle cx={130} cy={60} r={38} stroke={stroke} fill="none" strokeWidth={2}/><circle cx={105} cy={100} r={38} stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "vennDisjoint":    return <SVG><rect x={10} y={20} width={180} height={100} stroke={stroke} fill="none" strokeWidth={1}/><circle cx={60} cy={70} r={32} stroke={stroke} fill="none" strokeWidth={2}/><circle cx={150} cy={70} r={32} stroke={stroke} fill="none" strokeWidth={2}/></SVG>;
    case "tree2":           return <SVG>{L(20, 70, 90, 30)}{L(20, 70, 90, 110)}{L(90, 30, 180, 20)}{L(90, 30, 180, 55)}{L(90, 110, 180, 90)}{L(90, 110, 180, 125)}</SVG>;
    case "tree3":           return <SVG>{L(20, 70, 120, 20)}{L(20, 70, 120, 70)}{L(20, 70, 120, 120)}</SVG>;
    case "flowchart":       return <SVG>{P("M60 15 H140 V45 H60 Z")}{P("M60 55 H140 V85 H60 Z")}{P("M60 95 H140 V125 H60 Z")}{L(100, 45, 100, 55)}{L(100, 85, 100, 95)}</SVG>;

    default: return <SVG>{P("M20 20 H180 V120 H20 Z")}<text x={100} y={75} textAnchor="middle" fontSize={12} fill={stroke}>{variant}</text></SVG>;
  }
}

// ── Grids ───────────────────────────────────────────────────────────────
function Grid(variant: string) {
  const stroke = "currentColor";
  if (variant === "polar") {
    return (
      <SVG>
        {Array.from({ length: 5 }).map((_, i) => (
          <circle key={i} cx={100} cy={70} r={(i + 1) * 12} stroke={stroke} strokeOpacity={0.3} fill="none" strokeWidth={0.5}/>
        ))}
        <line x1={20} y1={70} x2={180} y2={70} stroke={stroke} strokeWidth={1.5}/>
        <line x1={100} y1={10} x2={100} y2={130} stroke={stroke} strokeWidth={1.5}/>
      </SVG>
    );
  }
  if (variant === "isometricDots") {
    const dots: ReactNode[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        const x = 15 + c * 16 + (r % 2 ? 8 : 0);
        const y = 12 + r * 16;
        dots.push(<circle key={`${r}-${c}`} cx={x} cy={y} r={1.2} fill={stroke}/>);
      }
    }
    return <SVG>{dots}</SVG>;
  }
  const lines: ReactNode[] = [];
  for (let i = 0; i <= 10; i++) {
    lines.push(<line key={"v" + i} x1={i * 20} y1={0} x2={i * 20} y2={140} stroke={stroke} strokeOpacity={0.25} strokeWidth={0.5}/>);
    if (i <= 7) lines.push(<line key={"h" + i} x1={0} y1={i * 20} x2={200} y2={i * 20} stroke={stroke} strokeOpacity={0.25} strokeWidth={0.5}/>);
  }
  const q1 = variant === "grid1";
  const blank = variant === "gridBlank";
  return (
    <SVG>
      {!blank && lines}
      <line x1={q1 ? 20 : 0} y1={70} x2={200} y2={70} stroke={stroke} strokeWidth={1.5}/>
      <line x1={q1 ? 20 : 100} y1={q1 ? 20 : 0} x2={q1 ? 20 : 100} y2={140} stroke={stroke} strokeWidth={1.5}/>
    </SVG>
  );
}

// ── Number lines ────────────────────────────────────────────────────────
function parseDataList(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite);
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split(/[,\s]+/).map(Number).filter(Number.isFinite);
}

function NumberLine(variant: string, attrs: Record<string, unknown> = {}) {
  const stroke = "currentColor";
  const min = Number.isFinite(Number(attrs.min)) ? Number(attrs.min) : 0;
  const max = Number.isFinite(Number(attrs.max)) ? Number(attrs.max) : 10;
  const step = Number.isFinite(Number(attrs.step)) && Number(attrs.step) > 0 ? Number(attrs.step) : 1;
  const mode = String(attrs.mode ?? (variant === "inequalityOpen" ? "open" : variant === "inequalityClosed" ? "closed" : "none"));
  const marker = Number.isFinite(Number(attrs.marker)) ? Number(attrs.marker) : (min + max) / 2;

  const x0 = 30, x1 = 200, y = 20;
  const toX = (v: number) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  const ticks: number[] = [];
  const nTicks = Math.min(40, Math.floor((max - min) / step) + 1);
  for (let i = 0; i < nTicks; i++) ticks.push(min + i * step);

  return (
    <SVG vb="0 0 220 40">
      <line x1={10} y1={y} x2={210} y2={y} stroke={stroke} strokeWidth={2}/>
      <polygon points={`10,${y} 20,${y-5} 20,${y+5}`} fill={stroke}/>
      <polygon points={`210,${y} 200,${y-5} 200,${y+5}`} fill={stroke}/>
      {ticks.map((t, i) => (
        <line key={i} x1={toX(t)} y1={y-5} x2={toX(t)} y2={y+5} stroke={stroke} strokeWidth={1.2}/>
      ))}
      {mode === "open" && (<>
        <line x1={toX(marker)} y1={y} x2={x1} y2={y} stroke={stroke} strokeWidth={3}/>
        <circle cx={toX(marker)} cy={y} r={5} fill="white" stroke={stroke} strokeWidth={2}/>
      </>)}
      {mode === "closed" && (<>
        <line x1={toX(marker)} y1={y} x2={x1} y2={y} stroke={stroke} strokeWidth={3}/>
        <circle cx={toX(marker)} cy={y} r={5} fill={stroke}/>
      </>)}
    </SVG>
  );
}

// ── Charts ──────────────────────────────────────────────────────────────
function Chart(variant: string, attrs: Record<string, unknown> = {}) {
  const s = "currentColor";
  const axes = (
    <>
      <line x1={20} y1={120} x2={190} y2={120} stroke={s} strokeWidth={1.5}/>
      <line x1={20} y1={10} x2={20} y2={120} stroke={s} strokeWidth={1.5}/>
    </>
  );
  const custom = parseDataList(attrs.data);
  switch (variant) {
    case "barchart": {
      const data = custom.length > 0 ? custom : [70, 40, 90, 55, 100];
      const maxV = Math.max(...data, 1);
      const bw = Math.min(28, 160 / Math.max(1, data.length));
      return <SVG>{axes}{data.map((v, i) => {
        const h = (Math.max(0, v) / maxV) * 100;
        return <rect key={i} x={30 + i * (bw + 6)} y={120 - h} width={bw} height={h} fill="none" stroke={s} strokeWidth={1.5}/>;
      })}</SVG>;
    }
    case "piechart": {
      const data = custom.length > 0 ? custom : [30, 25, 25, 20];
      const total = data.reduce((a, b) => a + b, 0) || 1;
      let acc = -Math.PI / 2;
      const cx = 100, cy = 70, r = 55;
      return <SVG>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={s} strokeWidth={1.5}/>
        {data.map((v, i) => {
          const x = cx + Math.cos(acc) * r;
          const y = cy + Math.sin(acc) * r;
          acc += (v / total) * Math.PI * 2;
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={s} strokeWidth={1.5}/>;
        })}
      </SVG>;
    }
    case "histogram": {
      const data = custom.length > 0 ? custom : [60, 90, 70, 40, 30];
      const maxV = Math.max(...data, 1);
      const bw = Math.min(40, 160 / Math.max(1, data.length));
      return <SVG>{axes}{data.map((v, i) => {
        const h = (Math.max(0, v) / maxV) * 100;
        return <rect key={i} x={20 + i * bw} y={120 - h} width={bw} height={h} fill="none" stroke={s} strokeWidth={1.5}/>;
      })}</SVG>;
    }
    case "scatter": {
      const pairs = custom.length >= 2
        ? Array.from({ length: Math.floor(custom.length / 2) }, (_, i) => [custom[i*2], custom[i*2+1]])
        : [[40,90],[60,70],[80,80],[100,50],[120,55],[140,35],[160,25]];
      return <SVG>{axes}{pairs.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={s}/>
      ))}</SVG>;
    }
    case "boxplot":
      return <SVG vb="0 0 220 60">
        <line x1={20} y1={30} x2={200} y2={30} stroke={s} strokeWidth={1.5}/>
        <rect x={80} y={15} width={70} height={30} fill="none" stroke={s} strokeWidth={1.5}/>
        <line x1={115} y1={15} x2={115} y2={45} stroke={s} strokeWidth={1.5}/>
        <line x1={30} y1={20} x2={30} y2={40} stroke={s} strokeWidth={1.5}/>
        <line x1={190} y1={20} x2={190} y2={40} stroke={s} strokeWidth={1.5}/>
      </SVG>;
    case "linegraph": {
      const data = custom.length > 0 ? custom : [100, 70, 85, 45, 60, 25];
      const dx = 160 / Math.max(1, data.length - 1);
      const maxV = Math.max(...data, 1);
      const pts = data.map((v, i) => [30 + i * dx, 120 - (v / maxV) * 100] as const);
      return <SVG>{axes}<polyline points={pts.map(([x,y]) => `${x},${y}`).join(" ")} stroke={s} strokeWidth={2} fill="none"/>{pts.map(([x,y],i) => <circle key={i} cx={x} cy={y} r={2.5} fill={s}/>)}</SVG>;
    }
    case "dotplot": {
      const heights = custom.length > 0 ? custom : [1, 3, 5, 4, 2, 1];
      const dots: ReactNode[] = [];
      heights.forEach((h, col) => {
        for (let r = 0; r < h; r++) {
          dots.push(<circle key={`${col}-${r}`} cx={40 + col * 26} cy={115 - r * 12} r={4} fill={s}/>);
        }
      });
      return <SVG><line x1={20} y1={125} x2={190} y2={125} stroke={s} strokeWidth={1.5}/>{dots}</SVG>;
    }
    case "ogive":
      return <SVG>{axes}<path d="M20 120 Q60 118 90 90 T160 20" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    default:
      return Shape("rectangle");
  }
}

// ── Plots ───────────────────────────────────────────────────────────────
function Plot(variant: string, attrs: Record<string, unknown> = {}) {
  const s = "currentColor";
  const axis = (
    <>
      <line x1={10} y1={70} x2={190} y2={70} stroke={s} strokeWidth={1} strokeOpacity={0.6}/>
      <line x1={100} y1={10} x2={100} y2={130} stroke={s} strokeWidth={1} strokeOpacity={0.6}/>
    </>
  );
  if (variant === "distanceTime") {
    return <SVG>{axis}<polyline points="20,110 60,80 100,80 140,30 180,30" stroke={s} strokeWidth={2} fill="none"/></SVG>;
  }
  if (variant === "velocityTime") {
    return <SVG>{axis}<polyline points="20,110 60,40 130,40 180,110" stroke={s} strokeWidth={2} fill="none"/></SVG>;
  }
  const coeff = Number.isFinite(Number(attrs.coeff)) ? Number(attrs.coeff) : 1;
  const dMin  = Number.isFinite(Number(attrs.domainMin)) ? Number(attrs.domainMin) : -4;
  const dMax  = Number.isFinite(Number(attrs.domainMax)) ? Number(attrs.domainMax) : 4;
  const span  = Math.max(0.1, dMax - dMin);
  const pts = (fn: (x: number) => number, clampY = 60) => {
    const arr: string[] = [];
    let broke = true;
    for (let px = 10; px <= 190; px += 2) {
      const x = dMin + ((px - 10) / 180) * span;
      const y = 70 - fn(x) * 25;
      if (Number.isFinite(y) && Math.abs(y - 70) < clampY + 10 && y >= 0 && y <= 140) {
        arr.push(`${broke ? "M" : "L"}${px},${y.toFixed(1)}`);
        broke = false;
      } else {
        broke = true;
      }
    }
    return arr.join(" ");
  };
  const base = ({
    sinegraph: (x: number) => Math.sin(x),
    cosinegraph: (x: number) => Math.cos(x),
    tangentgraph: (x: number) => Math.tan(x),
    parabola: (x: number) => 0.4 * x * x - 1,
    cubic: (x: number) => 0.1 * x * x * x,
    exponential: (x: number) => Math.exp(x * 0.6) - 1,
    bellcurve: (x: number) => 2 * Math.exp(-x * x * 0.4),
  } as Record<string, (x: number) => number>)[variant] ?? ((x: number) => x);
  const fn = (x: number) => coeff * base(x);
  return <SVG>{axis}<path d={pts(fn)} stroke={s} strokeWidth={2} fill="none"/></SVG>;
}

// ── Table (generic editable data grid, rendered read-only here) ────────
function Table(attrs: Record<string, unknown>) {
  const rows = Math.max(1, Number(attrs.rows) || 3);
  const cols = Math.max(1, Number(attrs.cols) || 3);
  const headers = (attrs.headers as string[]) || [];
  const kind = attrs.kind as string | undefined;

  const cellValue = (r: number, c: number): string => {
    if (kind === "mul") return String((r + 1) * (c + 1));
    if (kind === "add") return String((r + 1) + (c + 1));
    if (kind === "tally" && c === 1) return "||||".slice(0, (r % 4) + 1);
    if (kind === "stemleaf" && c === 0) return String(r);
    if (kind === "stemleaf" && c === 1) return "";
    return "";
  };

  return (
    <table className="w-full text-[11px] border border-current/40" style={{ borderCollapse: "collapse" }}>
      <tbody>
        {headers.length > 0 && (
          <tr>{headers.slice(0, cols).map((h, i) => (
            <th key={i} className="border border-current/40 px-1 py-0.5 text-center font-semibold">{h}</th>
          ))}</tr>
        )}
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td
                key={c}
                className="border border-current/40 px-1 py-0.5 text-center h-5"
                style={kind === "stemleaf" && c === 0 ? { borderRightWidth: 2 } : undefined}
              >
                {cellValue(r, c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Manipulatives (Section 5 · Probability + Counting) ─────────────────
function Manip(variant: string) {
  const s = "currentColor";
  switch (variant) {
    case "dice": return <SVG vb="0 0 120 120"><rect x={20} y={20} width={80} height={80} rx={12} stroke={s} fill="none" strokeWidth={2}/>{[[45,45],[75,45],[45,75],[75,75],[60,60]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r={4} fill={s}/>)}</SVG>;
    case "dice4": return <SVG vb="0 0 120 120">{[["M60 20 L100 90 L20 90 Z"],["M60 20 L60 90"]].map((d,i)=><path key={i} d={d[0]} stroke={s} fill="none" strokeWidth={2}/>)}<text x={60} y={78} textAnchor="middle" fontSize={16} fill={s}>4</text></SVG>;
    case "dice8": return <SVG vb="0 0 120 120"><path d="M60 15 L105 60 L60 105 L15 60 Z" stroke={s} fill="none" strokeWidth={2}/><path d="M15 60 L105 60 M60 15 L60 105" stroke={s} strokeWidth={1}/><text x={60} y={65} textAnchor="middle" fontSize={16} fill={s}>8</text></SVG>;
    case "dice10": return <SVG vb="0 0 120 120"><path d="M60 15 L100 45 L90 100 L30 100 L20 45 Z" stroke={s} fill="none" strokeWidth={2}/><text x={60} y={70} textAnchor="middle" fontSize={16} fill={s}>10</text></SVG>;
    case "dice12": return <SVG vb="0 0 120 120"><polygon points="60,15 95,35 100,75 75,105 45,105 20,75 25,35" stroke={s} fill="none" strokeWidth={2}/><text x={60} y={70} textAnchor="middle" fontSize={16} fill={s}>12</text></SVG>;
    case "dice20": return <SVG vb="0 0 120 120"><polygon points="60,15 100,40 100,80 60,105 20,80 20,40" stroke={s} fill="none" strokeWidth={2}/><path d="M60 15 L60 105 M20 40 L100 80 M100 40 L20 80" stroke={s} strokeWidth={0.8}/><text x={60} y={65} textAnchor="middle" fontSize={14} fill={s}>20</text></SVG>;
    case "coin": return <SVG vb="0 0 120 120"><circle cx={60} cy={60} r={45} stroke={s} fill="none" strokeWidth={2}/><text x={60} y={68} textAnchor="middle" fontSize={22} fill={s}>H</text></SVG>;
    case "spinner": return <SVG vb="0 0 120 120"><circle cx={60} cy={60} r={45} stroke={s} fill="none" strokeWidth={2}/><line x1={60} y1={60} x2={95} y2={30} stroke={s} strokeWidth={1}/><line x1={60} y1={60} x2={95} y2={90} stroke={s} strokeWidth={1}/><line x1={60} y1={60} x2={15} y2={60} stroke={s} strokeWidth={1}/><line x1={60} y1={60} x2={90} y2={95} stroke={s} strokeWidth={2.5}/><polygon points="88,93 96,96 90,102" fill={s}/></SVG>;
    case "playingcards": return <SVG><rect x={30} y={20} width={60} height={90} rx={6} stroke={s} fill="none" strokeWidth={1.5} transform="rotate(-8 60 65)"/><rect x={70} y={30} width={60} height={90} rx={6} stroke={s} fill="none" strokeWidth={1.5}/><text x={100} y={80} textAnchor="middle" fontSize={22} fill={s}>A♠</text></SVG>;
    case "urn": return <SVG><path d="M60 30 Q100 30 100 60 L110 120 H40 L50 60 Q50 30 60 30 Z" stroke={s} fill="none" strokeWidth={2}/>{[[70,85],[90,80],[80,100],[62,105],[95,105]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={5} fill={s} opacity={0.5+i*0.1}/>)}</SVG>;
    case "abacus": return <SVG>{[30,60,90].map(y=><line key={y} x1={20} y1={y} x2={180} y2={y} stroke={s} strokeWidth={1.5}/>)}{[0,1,2,3].map(r => [0,1,2,3,4].map(i => <circle key={`${r}-${i}`} cx={30+i*15+(r%2?5:0)} cy={30+r*22} r={5} stroke={s} fill="none" strokeWidth={1.2}/>))}</SVG>;
    case "algebratiles": return <SVG><rect x={20} y={20} width={60} height={60} stroke={s} fill="none" strokeWidth={2}/><text x={50} y={55} textAnchor="middle" fontSize={16} fill={s}>x²</text><rect x={90} y={20} width={60} height={20} stroke={s} fill="none" strokeWidth={2}/><text x={120} y={35} textAnchor="middle" fontSize={12} fill={s}>x</text><rect x={90} y={50} width={20} height={20} stroke={s} fill="none" strokeWidth={2}/><text x={100} y={64} textAnchor="middle" fontSize={11} fill={s}>1</text></SVG>;
    case "fractionstrips": return <SVG><rect x={10} y={20} width={180} height={16} stroke={s} fill="none" strokeWidth={1.5}/>{[0,1].map(i=><rect key={`h${i}`} x={10+i*90} y={40} width={90} height={16} stroke={s} fill="none" strokeWidth={1.5}/>)}{[0,1,2,3].map(i=><rect key={`q${i}`} x={10+i*45} y={60} width={45} height={16} stroke={s} fill="none" strokeWidth={1.5}/>)}{Array.from({length:8}).map((_,i)=><rect key={`e${i}`} x={10+i*22.5} y={80} width={22.5} height={16} stroke={s} fill="none" strokeWidth={1.5}/>)}</SVG>;
    case "fractioncircles": return <SVG><circle cx={100} cy={70} r={55} stroke={s} fill="none" strokeWidth={2}/><line x1={100} y1={15} x2={100} y2={125} stroke={s} strokeWidth={1.5}/><line x1={45} y1={70} x2={155} y2={70} stroke={s} strokeWidth={1.5}/><line x1={61} y1={31} x2={139} y2={109} stroke={s} strokeWidth={1.5}/><line x1={139} y1={31} x2={61} y2={109} stroke={s} strokeWidth={1.5}/></SVG>;
    case "basetenblocks": return <SVG><rect x={10} y={20} width={70} height={70} stroke={s} fill="none" strokeWidth={1.5}/>{Array.from({length:6}).map((_,i)=><line key={`v${i}`} x1={10+i*10} y1={20} x2={10+i*10} y2={90} stroke={s} strokeWidth={0.5}/>)}{Array.from({length:6}).map((_,i)=><line key={`h${i}`} x1={10} y1={20+i*10} x2={80} y2={20+i*10} stroke={s} strokeWidth={0.5}/>)}<rect x={95} y={20} width={12} height={70} stroke={s} fill="none" strokeWidth={1.5}/>{[0,1,2,3,4,5].map(i=><line key={i} x1={95} y1={20+i*10} x2={107} y2={20+i*10} stroke={s} strokeWidth={0.5}/>)}<rect x={125} y={78} width={12} height={12} stroke={s} fill="none" strokeWidth={1.5}/></SVG>;
    case "counters": case "twocolorcounters": {
      const cs = variant === "twocolorcounters" ? [s, "white"] : [s, s];
      return <SVG>{[0,1,2,3,4].map(i => <circle key={i} cx={30+i*32} cy={70} r={12} fill={cs[i%2]} stroke={s} strokeWidth={2}/>)}</SVG>;
    }
    case "tenframe": return <SVG>{[0,1].map(r => Array.from({length:5}).map((_,c) => <rect key={`${r}-${c}`} x={10+c*36} y={20+r*45} width={36} height={45} stroke={s} fill="none" strokeWidth={1.5}/>))}{[[28,42],[64,42],[100,42],[136,42],[172,42],[28,87]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={12} fill={s}/>)}</SVG>;
    default: return placeholder(variant);
  }
}

// ── Tools (Section 5 · Measurement + Time) ─────────────────────────────
function Tool(variant: string) {
  const s = "currentColor";
  switch (variant) {
    case "ruler": return <SVG vb="0 0 220 40"><rect x={5} y={10} width={210} height={20} stroke={s} fill="none" strokeWidth={1.5}/>{Array.from({length:21}).map((_,i)=><line key={i} x1={5+i*10} y1={10} x2={5+i*10} y2={i%5===0?22:18} stroke={s} strokeWidth={1}/>)}</SVG>;
    case "protractor": return <SVG><path d="M20 120 A80 80 0 0 1 180 120 Z" stroke={s} fill="none" strokeWidth={2}/>{Array.from({length:19}).map((_,i)=>{const a=Math.PI*(1-i/18);const x1=100+Math.cos(a)*72;const y1=120-Math.sin(a)*72;const x2=100+Math.cos(a)*80;const y2=120-Math.sin(a)*80;return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth={i%3===0?1.5:0.8}/>;})}</SVG>;
    case "compass": return <SVG>{[[100,20,50,120],[100,20,150,120]].map(([x1,y1,x2,y2],i)=><line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth={2.5}/>)}<circle cx={100} cy={20} r={5} fill={s}/><path d="M75 90 A30 30 0 0 0 125 90" stroke={s} fill="none" strokeWidth={1.5}/></SVG>;
    case "setsquare45": return <SVG><path d="M30 120 L170 120 L30 20 Z" stroke={s} fill="none" strokeWidth={2}/><path d="M30 105 L45 105 L45 120" stroke={s} fill="none" strokeWidth={1}/><text x={50} y={112} fontSize={9} fill={s}>45°</text></SVG>;
    case "setsquare3060": return <SVG><path d="M30 120 L170 120 L30 40 Z" stroke={s} fill="none" strokeWidth={2}/><path d="M30 108 L42 108 L42 120" stroke={s} fill="none" strokeWidth={1}/><text x={50} y={115} fontSize={9} fill={s}>60°</text><text x={140} y={115} fontSize={9} fill={s}>30°</text></SVG>;
    case "thermometer": return <SVG vb="0 0 60 140"><rect x={22} y={10} width={16} height={100} rx={8} stroke={s} fill="none" strokeWidth={1.5}/><circle cx={30} cy={118} r={14} stroke={s} fill={s} strokeWidth={1.5}/><rect x={26} y={55} width={8} height={55} fill={s}/></SVG>;
    case "measuringcylinder": return <SVG vb="0 0 100 140"><path d="M25 15 H75 V125 Q50 130 25 125 Z" stroke={s} fill="none" strokeWidth={2}/>{[35,55,75,95].map(y=><line key={y} x1={25} y1={y} x2={40} y2={y} stroke={s} strokeWidth={1}/>)}<rect x={25} y={85} width={50} height={40} fill={s} opacity={0.25}/></SVG>;
    case "weighingscale": case "dialscale": return <SVG><path d="M40 120 H160" stroke={s} strokeWidth={2}/><path d="M50 120 L100 40 L150 120 Z" stroke={s} fill="none" strokeWidth={2}/><path d="M60 80 A40 40 0 0 1 140 80" stroke={s} fill="none" strokeWidth={1.5}/><line x1={100} y1={80} x2={125} y2={55} stroke={s} strokeWidth={2}/><circle cx={100} cy={80} r={3} fill={s}/></SVG>;
    case "balancescale": return <SVG><line x1={100} y1={30} x2={100} y2={100} stroke={s} strokeWidth={2}/><line x1={30} y1={40} x2={170} y2={40} stroke={s} strokeWidth={2}/>{[30,170].map(cx=><path key={cx} d={`M${cx-20} 55 Q${cx} 75 ${cx+20} 55`} stroke={s} fill="none" strokeWidth={2}/>)}<line x1={30} y1={40} x2={30} y2={55} stroke={s} strokeWidth={1}/><line x1={170} y1={40} x2={170} y2={55} stroke={s} strokeWidth={1}/><path d="M70 120 H130 L120 100 H80 Z" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "tapemeasure": return <SVG><circle cx={50} cy={70} r={35} stroke={s} fill="none" strokeWidth={2}/><rect x={80} y={62} width={110} height={16} stroke={s} fill="none" strokeWidth={1.5}/>{Array.from({length:10}).map((_,i)=><line key={i} x1={85+i*10} y1={62} x2={85+i*10} y2={i%2?70:74} stroke={s} strokeWidth={0.8}/>)}</SVG>;
    case "clock": return <SVG vb="0 0 140 140"><circle cx={70} cy={70} r={55} stroke={s} fill="none" strokeWidth={2}/>{Array.from({length:12}).map((_,i)=>{const a=Math.PI*2*i/12-Math.PI/2;return <line key={i} x1={70+Math.cos(a)*45} y1={70+Math.sin(a)*45} x2={70+Math.cos(a)*52} y2={70+Math.sin(a)*52} stroke={s} strokeWidth={1.5}/>;})}<line x1={70} y1={70} x2={70} y2={35} stroke={s} strokeWidth={2.5}/><line x1={70} y1={70} x2={100} y2={70} stroke={s} strokeWidth={2}/><circle cx={70} cy={70} r={3} fill={s}/></SVG>;
    case "clockDigital": return <SVG><rect x={20} y={40} width={160} height={60} rx={6} stroke={s} fill="none" strokeWidth={2}/><text x={100} y={85} textAnchor="middle" fontSize={36} fontFamily="monospace" fill={s}>10:24</text></SVG>;
    case "calendar": return <SVG><rect x={15} y={20} width={170} height={110} stroke={s} fill="none" strokeWidth={1.5}/><line x1={15} y1={40} x2={185} y2={40} stroke={s} strokeWidth={1.5}/>{Array.from({length:7}).map((_,c)=><line key={`v${c}`} x1={15+c*24.28} y1={40} x2={15+c*24.28} y2={130} stroke={s} strokeWidth={0.6}/>)}{Array.from({length:4}).map((_,r)=><line key={`h${r}`} x1={15} y1={40+(r+1)*22.5} x2={185} y2={40+(r+1)*22.5} stroke={s} strokeWidth={0.6}/>)}</SVG>;
    case "stopwatch": return <SVG vb="0 0 140 140"><circle cx={70} cy={78} r={50} stroke={s} fill="none" strokeWidth={2}/><rect x={62} y={10} width={16} height={12} stroke={s} fill="none" strokeWidth={1.5}/><line x1={70} y1={78} x2={70} y2={38} stroke={s} strokeWidth={2}/><circle cx={70} cy={78} r={3} fill={s}/></SVG>;
    default: return placeholder(variant);
  }
}

// ── Illustrations (Section 5 · Real-world) ─────────────────────────────
function Illus(variant: string) {
  const s = "currentColor";
  switch (variant) {
    case "money": return <SVG vb="0 0 120 120"><circle cx={60} cy={60} r={40} stroke={s} fill="none" strokeWidth={2}/><text x={60} y={70} textAnchor="middle" fontSize={30} fill={s}>£</text></SVG>;
    case "banknote": return <SVG><rect x={20} y={40} width={160} height={80} rx={4} stroke={s} fill="none" strokeWidth={2}/><circle cx={100} cy={80} r={20} stroke={s} fill="none" strokeWidth={1.5}/><text x={100} y={87} textAnchor="middle" fontSize={20} fill={s}>£</text><text x={35} y={58} fontSize={10} fill={s}>10</text><text x={165} y={115} fontSize={10} fill={s}>10</text></SVG>;
    case "car": return <SVG><path d="M20 100 H180 V85 L155 55 H55 L30 85 Z" stroke={s} fill="none" strokeWidth={2}/><line x1={95} y1={55} x2={95} y2={85} stroke={s} strokeWidth={1}/><circle cx={55} cy={110} r={12} stroke={s} fill="none" strokeWidth={2}/><circle cx={155} cy={110} r={12} stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "bus": return <SVG><rect x={20} y={30} width={160} height={80} rx={6} stroke={s} fill="none" strokeWidth={2}/>{[40,75,110,145].map(x=><rect key={x} x={x} y={45} width={22} height={22} stroke={s} fill="none" strokeWidth={1.5}/>)}<circle cx={55} cy={118} r={10} stroke={s} fill="none" strokeWidth={2}/><circle cx={145} cy={118} r={10} stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "train": return <SVG><rect x={15} y={40} width={130} height={65} rx={8} stroke={s} fill="none" strokeWidth={2}/><rect x={145} y={55} width={35} height={50} stroke={s} fill="none" strokeWidth={2}/>{[30,65,100].map(x=><rect key={x} x={x} y={55} width={22} height={22} stroke={s} fill="none" strokeWidth={1.5}/>)}<circle cx={40} cy={115} r={8} stroke={s} fill="none" strokeWidth={2}/><circle cx={100} cy={115} r={8} stroke={s} fill="none" strokeWidth={2}/><circle cx={160} cy={115} r={8} stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "bicycle": return <SVG><circle cx={50} cy={90} r={28} stroke={s} fill="none" strokeWidth={2}/><circle cx={150} cy={90} r={28} stroke={s} fill="none" strokeWidth={2}/><line x1={50} y1={90} x2={100} y2={40} stroke={s} strokeWidth={2}/><line x1={100} y1={40} x2={150} y2={90} stroke={s} strokeWidth={2}/><line x1={50} y1={90} x2={150} y2={90} stroke={s} strokeWidth={1}/><line x1={100} y1={40} x2={100} y2={90} stroke={s} strokeWidth={2}/></SVG>;
    case "airplane": return <SVG><path d="M20 70 L140 60 L180 30 L155 75 L180 90 L140 82 L110 110 L100 82 L60 90 Z" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "ball": case "apple": return <SVG><circle cx={100} cy={75} r={45} stroke={s} fill="none" strokeWidth={2}/>{variant==="apple" && <path d="M100 30 Q108 15 118 20" stroke={s} fill="none" strokeWidth={2}/>}</SVG>;
    case "pizza": return <SVG><circle cx={100} cy={70} r={55} stroke={s} fill="none" strokeWidth={2}/><line x1={100} y1={70} x2={100} y2={15} stroke={s} strokeWidth={1.5}/><line x1={100} y1={70} x2={155} y2={70} stroke={s} strokeWidth={1.5}/><line x1={100} y1={70} x2={45} y2={70} stroke={s} strokeWidth={1.5}/><line x1={100} y1={70} x2={100} y2={125} stroke={s} strokeWidth={1.5}/><line x1={100} y1={70} x2={139} y2={31} stroke={s} strokeWidth={1.5}/><line x1={100} y1={70} x2={139} y2={109} stroke={s} strokeWidth={1.5}/></SVG>;
    case "cake": return <SVG><rect x={40} y={60} width={120} height={60} stroke={s} fill="none" strokeWidth={2}/><path d="M40 60 Q100 40 160 60" stroke={s} fill="none" strokeWidth={1.5}/><line x1={100} y1={30} x2={100} y2={55} stroke={s} strokeWidth={2}/><path d="M97 25 Q100 20 103 25" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "bottle": return <SVG vb="0 0 80 140"><path d="M32 15 H48 V35 Q60 45 60 60 V125 H20 V60 Q20 45 32 35 Z" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "tree": return <SVG><path d="M100 20 L60 70 H80 L50 110 H150 L120 70 H140 Z" stroke={s} fill="none" strokeWidth={2}/><rect x={90} y={110} width={20} height={20} stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "sun": return <SVG><circle cx={100} cy={70} r={30} stroke={s} fill="none" strokeWidth={2}/>{Array.from({length:8}).map((_,i)=>{const a=Math.PI*2*i/8;return <line key={i} x1={100+Math.cos(a)*38} y1={70+Math.sin(a)*38} x2={100+Math.cos(a)*52} y2={70+Math.sin(a)*52} stroke={s} strokeWidth={2}/>;})}</SVG>;
    case "animal": case "dog": return <SVG><ellipse cx={110} cy={90} rx={50} ry={25} stroke={s} fill="none" strokeWidth={2}/><circle cx={55} cy={70} r={20} stroke={s} fill="none" strokeWidth={2}/><path d="M45 55 L50 40 M65 55 L70 40" stroke={s} strokeWidth={2}/><line x1={80} y1={115} x2={80} y2={130} stroke={s} strokeWidth={2}/><line x1={140} y1={115} x2={140} y2={130} stroke={s} strokeWidth={2}/></SVG>;
    case "cat": return <SVG><circle cx={100} cy={75} r={35} stroke={s} fill="none" strokeWidth={2}/><path d="M75 55 L70 30 L88 50 M125 55 L130 30 L112 50" stroke={s} fill="none" strokeWidth={2}/><circle cx={90} cy={70} r={2} fill={s}/><circle cx={110} cy={70} r={2} fill={s}/></SVG>;
    case "bird": return <SVG><path d="M50 90 Q100 60 150 90 Q130 100 100 95 Q80 95 50 90 Z" stroke={s} fill="none" strokeWidth={2}/><circle cx={140} cy={85} r={2} fill={s}/><path d="M148 90 L160 85 L150 95 Z" stroke={s} fill="none" strokeWidth={1.5}/></SVG>;
    case "house": return <SVG><path d="M30 120 V60 L100 20 L170 60 V120 Z" stroke={s} fill="none" strokeWidth={2}/><rect x={85} y={80} width={30} height={40} stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "building": return <SVG><rect x={40} y={20} width={120} height={110} stroke={s} fill="none" strokeWidth={2}/>{[0,1,2,3].map(r=>[0,1,2,3].map(c=><rect key={`${r}-${c}`} x={50+c*26} y={30+r*24} width={16} height={16} stroke={s} fill="none" strokeWidth={1}/>))}</SVG>;
    case "box": return <SVG>{Shape("cuboid")}</SVG>;
    case "book": return <SVG><path d="M20 30 Q100 20 100 30 V120 Q100 110 20 120 Z" stroke={s} fill="none" strokeWidth={2}/><path d="M180 30 Q100 20 100 30 V120 Q100 110 180 120 Z" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "person": return <SVG><circle cx={100} cy={35} r={15} stroke={s} fill="none" strokeWidth={2}/><path d="M100 50 V95 M100 60 L70 80 M100 60 L130 80 M100 95 L80 130 M100 95 L120 130" stroke={s} fill="none" strokeWidth={2}/></SVG>;
    case "shoppingitem": return <SVG><path d="M30 30 H50 L70 100 H150 L165 45 H60" stroke={s} fill="none" strokeWidth={2}/><circle cx={80} cy={120} r={8} stroke={s} fill="none" strokeWidth={2}/><circle cx={140} cy={120} r={8} stroke={s} fill="none" strokeWidth={2}/></SVG>;
    default: return placeholder(variant);
  }
}

function placeholder(label: string) {
  return (
    <SVG>
      <rect x={10} y={10} width={180} height={120} rx={8} stroke="currentColor" fill="none" strokeWidth={1.5} strokeDasharray="5 3"/>
      <text x={100} y={75} textAnchor="middle" fontSize={14} fill="currentColor">{label}</text>
    </SVG>
  );
}

export function renderVisual(family: string, attrs: Record<string, unknown>, ctx: Ctx): ReactNode {
  const variant = String(attrs.variant ?? "");
  const wrap = (n: ReactNode) => (
    <span className="block leading-none" onClick={ctx.onCycle} title="Click to cycle state">
      {n}
    </span>
  );
  switch (family) {
    case "shape":      return wrap(Shape(variant));
    case "lineEngine": return wrap(Shape(String(attrs.preset ?? variant))); // classic pictogram in asset picker
    case "circleEngine": {
      const preset = String(attrs.preset ?? variant);
      // Map presets to existing pictograms so the asset picker tile is intuitive.
      const map: Record<string, string> = {
        circle: "circle", radius: "circleRadius", diameter: "circleDiameter",
        sector: "circleSector", segment: "circleSegmentChord", tangent: "circleTangent",
        arc: "circleSector", semicircle: "circleSector", quadrant: "circleSector",
        concentric: "circle",
      };
      return wrap(Shape(map[preset] ?? "circle"));
    }
    case "solidEngine": {
      const preset = String(attrs.preset ?? variant);
      // Reuse existing 3D pictograms for the asset picker tile.
      const map: Record<string, string> = {
        cube: "cube", cuboid: "cuboid",
        cylinder: "cylinder", cone: "cone",
        sphere: "sphere", hemisphere: "hemisphere",
        pyramid: "pyramid", squarePyramid: "squarePyramid",
        prism: "triangularPrism", triangularPrism: "triangularPrism",
        triangularPyramid: "pyramid", frustum: "cuboid",
      };
      return wrap(Shape(map[preset] ?? "cube"));
    }
    case "vennEngine": {
      const preset = String(attrs.preset ?? variant);
      const map: Record<string, string> = {
        venn2: "venn2", venn3: "venn3", venndisjoint: "vennDisjoint",
      };
      return wrap(Shape(map[preset.toLowerCase()] ?? "venn2"));
    }
    case "grid":       return wrap(Grid(variant));
    case "numberline": return wrap(NumberLine(variant, attrs));
    case "chart":      return wrap(Chart(variant, attrs));
    case "plot":       return wrap(Plot(variant, attrs));
    case "table":      return <span className="block">{Table(attrs)}</span>;
    case "manip":      return wrap(Manip(variant));
    case "tool":       return wrap(Tool(variant));
    case "illus":      return wrap(Illus(variant));
    default:           return wrap(placeholder(variant || family));
  }
}
