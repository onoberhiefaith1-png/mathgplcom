// Hint: when dividing fractions, flip the second one and multiply.

interface Props {
  a: number; b: number; // first fraction a/b
  c: number; d: number; // second fraction c/d
}

const Frac = ({ t, b }: { t: number | string; b: number | string }) => (
  <span className="inline-flex flex-col items-center text-base leading-tight tabular-nums">
    <span>{t}</span>
    <span className="block w-full h-[1px] bg-current" />
    <span>{b}</span>
  </span>
);

export const HelperReciprocal = ({ a, b, c, d }: Props) => (
  <div className="space-y-2">
    <div className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-300/80 font-bold">
      Flip & Multiply
    </div>
    <div className="rounded-2xl border-2 border-fuchsia-400/40 bg-card/50 p-3 text-center backdrop-blur space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Dividing by a fraction = multiplying by its reciprocal. Flip the second fraction.
      </p>
      <div className="flex items-center justify-center gap-2 text-fuchsia-100 font-black">
        <Frac t={a} b={b} />
        <span className="text-fuchsia-300/70">÷</span>
        <Frac t={c} b={d} />
        <span className="text-fuchsia-300/70 mx-2">→</span>
        <Frac t={a} b={b} />
        <span className="text-emerald-300">×</span>
        <Frac t={d} b={c} />
      </div>
      <p className="text-[10px] text-emerald-300">
        Now multiply numerators and denominators.
      </p>
    </div>
  </div>
);

export default HelperReciprocal;
