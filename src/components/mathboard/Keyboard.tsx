// Math keyboard panels — exported for use inside BottomDock.

import { useMathBoard } from "@/hooks/useMathBoard";
import {
  mkOp, mkEq, mkSym, mkFrac, mkBracket, mkPower, mkRoot,
  mkAbs, mkIntegral, mkSum, mkProd, mkLim, mkDeriv, mkPartial, mkFunc, mkMixed,
} from "@/lib/mathboard/tokens";

export const SUPER: Record<string, string> = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","n":"ⁿ" };

export type TabKey = "basic" | "fractions" | "algebra" | "advanced" | "geometry" | "letters";

export const TAB_LABELS: Record<TabKey, string> = {
  basic: "Numbers",
  fractions: "Fractions",
  algebra: "Algebra",
  advanced: "Advanced",
  geometry: "Geometry",
  letters: "Letters",
};

// ---------- Reusable Chip ----------

const Chip = ({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) => (
  <button
    onClick={onClick}
    className={[
      "h-14 min-w-[56px] rounded-xl border border-amber-200/20 bg-background/40 text-amber-100 hover:border-amber-200/60 hover:bg-amber-300/5 transition flex items-center justify-center text-xl font-medium px-3",
      className || "",
    ].join(" ")}
  >
    {children}
  </button>
);

const MiniFrac = ({ t, b }: { t: string; b: string }) => (
  <span className="inline-flex flex-col items-center text-sm leading-tight italic">
    <span>{t}</span>
    <span className="block w-full h-[1px] bg-current" />
    <span>{b}</span>
  </span>
);

// ---------- BASIC ----------

export const BasicPanel = ({ exponent, typeMaybeExp }: { exponent: boolean; typeMaybeExp: (n: string) => void }) => {
  const { insert } = useMathBoard();
  const num = (n: string) => () => typeMaybeExp(n);
  const cls = exponent ? "h-12 min-w-[44px] text-base text-violet-200 border-violet-300/40" : "";
  return (
    <div className="grid grid-cols-4 gap-2 max-w-md">
      {["7","8","9"].map(n => <Chip key={n} onClick={num(n)} className={cls}>{exponent ? SUPER[n] : n}</Chip>)}
      <Chip onClick={() => insert(mkOp("+"))}>+</Chip>
      {["4","5","6"].map(n => <Chip key={n} onClick={num(n)} className={cls}>{exponent ? SUPER[n] : n}</Chip>)}
      <Chip onClick={() => insert(mkOp("-"))}>−</Chip>
      {["1","2","3"].map(n => <Chip key={n} onClick={num(n)} className={cls}>{exponent ? SUPER[n] : n}</Chip>)}
      <Chip onClick={() => insert(mkOp("*"))}>×</Chip>
      <Chip onClick={num("0")} className={cls}>{exponent ? SUPER["0"] : "0"}</Chip>
      <Chip onClick={() => insert(mkSym("."))}>.</Chip>
      <Chip onClick={() => insert(mkEq())}>=</Chip>
      <Chip onClick={() => insert(mkOp("/"))}>÷</Chip>
    </div>
  );
};

// ---------- FRACTIONS ----------

export const FractionsPanel = () => {
  const { insert } = useMathBoard();
  return (
    <div className="grid grid-cols-4 gap-2 max-w-xl">
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="a" b="b" /></Chip>
      <Chip onClick={() => { insert(mkFrac()); }}><MiniFrac t="a" b="b" /> + <MiniFrac t="c" b="d" /></Chip>
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="a" b="n" /></Chip>
      <Chip onClick={() => insert(mkMixed())}><span className="mr-1">a</span><MiniFrac t="b" b="c" /></Chip>
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="a" b="b" /></Chip>
      <Chip onClick={() => insert(mkPartial())}><MiniFrac t="∂" b="∂" /></Chip>
      <Chip onClick={() => insert(mkSym("LCM"))} className="text-xs">LCM</Chip>
      <Chip onClick={() => insert(mkBracket("inline", "("))}>( )</Chip>
      <Chip onClick={() => insert(mkBracket("inline", "["))}>[ ]</Chip>
      <Chip onClick={() => insert(mkBracket("inline", "{"))}>{"{ }"}</Chip>
      <Chip onClick={() => insert(mkBracket("expanded", "("))} className="text-amber-300"><span className="scale-y-150 inline-block">(&nbsp;)</span></Chip>
      <Chip onClick={() => insert(mkBracket("expanded", "["))} className="text-amber-300"><span className="scale-y-150 inline-block">[&nbsp;]</span></Chip>
      <Chip onClick={() => insert(mkBracket("expanded", "{"))} className="text-amber-300"><span className="scale-y-150 inline-block">{"{ }"}</span></Chip>
    </div>
  );
};

// ---------- ALGEBRA ----------

export const AlgebraPanel = () => {
  const { insert } = useMathBoard();
  return (
    <div className="grid grid-cols-4 gap-2 max-w-xl">
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="x" b="x" /></Chip>
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="z" b="z" /></Chip>
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="a" b="a" /></Chip>
      <Chip onClick={() => insert(mkFrac())}><MiniFrac t="b" b="b" /></Chip>
      <Chip onClick={() => insert(mkPower())}>x²</Chip>
      <Chip onClick={() => insert(mkPower())}>x<sup>y</sup></Chip>
      <Chip onClick={() => insert(mkRoot())}>√x</Chip>
      <Chip onClick={() => insert(mkRoot(true))}><sup className="text-xs">n</sup>√x</Chip>
      <Chip onClick={() => insert(mkAbs())}>|x|</Chip>
      <Chip onClick={() => insert(mkBracket("inline", "("))}>(</Chip>
      <Chip onClick={() => insert(mkBracket("inline", "("))}>)</Chip>
      <Chip onClick={() => insert(mkPower())}><span>x</span><sub className="text-xs">n</sub></Chip>
      <Chip onClick={() => insert(mkPower())}>x<sup>n</sup></Chip>
      <Chip onClick={() => insert(mkOp("!"))}>!</Chip>
    </div>
  );
};

// ---------- ADVANCED ----------

export const AdvancedPanel = () => {
  const { insert } = useMathBoard();
  return (
    <div className="grid grid-cols-4 gap-2 max-w-xl">
      <Chip onClick={() => insert(mkIntegral(false))}>∫</Chip>
      <Chip onClick={() => insert(mkIntegral(true))}>∫<sup>b</sup><sub>a</sub></Chip>
      <Chip onClick={() => insert(mkSum())}>Σ</Chip>
      <Chip onClick={() => insert(mkProd())}>Π</Chip>
      <Chip onClick={() => insert(mkLim())}>lim</Chip>
      <Chip onClick={() => insert(mkDeriv(1))}><MiniFrac t="d" b="dx" /></Chip>
      <Chip onClick={() => insert(mkPartial())}><MiniFrac t="∂" b="∂x" /></Chip>
      <Chip onClick={() => insert(mkDeriv(2))}><MiniFrac t="d²" b="dx²" /></Chip>
      <Chip onClick={() => insert(mkFunc("f"))}>f(x)</Chip>
      <Chip onClick={() => insert(mkFunc("f'"))}>f'(x)</Chip>
      <Chip onClick={() => insert(mkSym("dx"))}>dx</Chip>
    </div>
  );
};

// ---------- GEOMETRY ----------

export const GeometryPanel = () => {
  const { insert } = useMathBoard();
  const sym = (s: string) => () => insert(mkSym(s));
  const eqop = (s: any) => () => insert(mkEq(s));
  return (
    <div className="grid grid-cols-4 gap-2 max-w-xl">
      <Chip onClick={sym("∠")}>∠</Chip>
      <Chip onClick={sym("°")}>°</Chip>
      <Chip onClick={sym("∥")}>∥</Chip>
      <Chip onClick={sym("⊥")}>⊥</Chip>
      <Chip onClick={sym("△")}>△</Chip>
      <Chip onClick={sym("□")}>□</Chip>
      <Chip onClick={sym("○")}>○</Chip>
      <Chip onClick={sym("⌒")}>⌒</Chip>
      <Chip onClick={eqop("=")}>=</Chip>
      <Chip onClick={eqop("≠")}>≠</Chip>
      <Chip onClick={eqop("≤")}>≤</Chip>
      <Chip onClick={eqop("≥")}>≥</Chip>
      <Chip onClick={sym("∈")}>∈</Chip>
      <Chip onClick={sym("∉")}>∉</Chip>
      <Chip onClick={sym("⊂")}>⊂</Chip>
      <Chip onClick={sym("⊃")}>⊃</Chip>
      <Chip onClick={sym("∪")}>∪</Chip>
      <Chip onClick={sym("∩")}>∩</Chip>
      <Chip onClick={sym("∅")}>∅</Chip>
    </div>
  );
};

// ---------- LETTERS ----------

export const LettersPanel = () => {
  const { type } = useMathBoard();
  const lower = "abcdefghijklmnopqrstuvwxyz".split("");
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const shortcuts = ["x", "y", "z", "n", "a", "b", "c", "k", "θ", "π"];
  return (
    <div className="space-y-2 max-w-3xl">
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map((s) => (
          <Chip key={`s${s}`} onClick={() => type(s)} className="h-10 min-w-[44px] text-base text-emerald-200 border-emerald-300/30">{s}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lower.map((s) => (
          <Chip key={`l${s}`} onClick={() => type(s)} className="h-10 min-w-[40px] text-base italic">{s}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {upper.map((s) => (
          <Chip key={`u${s}`} onClick={() => type(s)} className="h-10 min-w-[40px] text-base">{s}</Chip>
        ))}
      </div>
    </div>
  );
};

export { BottomDock as default } from "./BottomDock";
