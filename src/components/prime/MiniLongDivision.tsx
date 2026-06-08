import { cn } from "@/lib/utils";

interface Props {
  n: number;
  divisor: number;
}

interface Stage {
  colP: number;          // quotient column
  windowVal: number;
  q: number;
  product: number;       // significant product
  resultRow: number[];   // full-width result row digits (with leading zeros)
  startCol: number;      // leftmost changed column in result
}

const buildStages = (n: number, divisor: number): { stages: Stage[]; quotientDigits: (number | null)[]; nCols: number; startIdx: number } => {
  const dDigits = String(n).split("").map(Number);
  const nCols = dDigits.length;
  const quotientDigits: (number | null)[] = Array(nCols).fill(null);

  if (divisor < 1) return { stages: [], quotientDigits, nCols, startIdx: 0 };

  // find startIdx
  let startIdx = 0;
  let prefix = dDigits[0];
  while (prefix < divisor && startIdx < nCols - 1) {
    startIdx++;
    prefix = prefix * 10 + dDigits[startIdx];
  }

  const stages: Stage[] = [];
  let W = [...dDigits]; // current full-width row digits
  for (let colP = startIdx; colP < nCols; colP++) {
    // window value = digits W[0..colP] interpreted left-to-right but the number is W as full int positioned
    // Simpler: compute windowVal from W taking leading non-zero region up through colP
    let windowVal = 0;
    for (let i = 0; i <= colP; i++) windowVal = windowVal * 10 + W[i];
    const q = Math.floor(windowVal / divisor);
    const product = q * divisor;
    quotientDigits[colP] = q;

    // padded product full-width
    const pad = nCols - 1 - colP;
    const paddedProduct = product * Math.pow(10, pad);
    // current W as integer
    let Wint = 0;
    for (const d of W) Wint = Wint * 10 + d;
    const resultInt = Wint - paddedProduct;
    const resultRow = String(resultInt).padStart(nCols, "0").split("").map(Number);

    // startCol = leftmost differing col between W and resultRow
    let startCol = nCols - 1;
    for (let i = 0; i < nCols; i++) {
      if (W[i] !== resultRow[i]) { startCol = i; break; }
    }

    stages.push({ colP, windowVal, q, product, resultRow, startCol });
    W = resultRow;
  }
  return { stages, quotientDigits, nCols, startIdx };
};

const cellW = "w-5 sm:w-6";
const cellH = "h-5 sm:h-6";

const Digit = ({ d, glow, dim }: { d: number | string | null; glow?: boolean; dim?: boolean }) => (
  <div className={cn(
    "flex items-center justify-center font-black tabular-nums text-[11px] sm:text-xs",
    cellW, cellH,
    glow && "text-amber-300",
    dim && "opacity-50",
  )}>
    {d ?? ""}
  </div>
);

export const MiniLongDivision = ({ n, divisor }: Props) => {
  if (divisor < 1) return null;
  const { stages, quotientDigits, nCols } = buildStages(n, divisor);
  const dDigits = String(n).split("").map(Number);
  const cols = Array.from({ length: nCols }, (_, i) => i);
  const quotient = Math.floor(n / divisor);
  const remainder = n - quotient * divisor;
  const exact = remainder === 0;

  return (
    <div className="space-y-1.5 animate-fade-in" key={`${n}-${divisor}`}>
      <div className="rounded-md bg-background/40 border border-primary/20 p-1.5 overflow-x-auto">
        <div className="inline-flex flex-col items-stretch min-w-full">
          {/* Quotient row */}
          <div className="flex items-end justify-end gap-0">
            <div className={cn(cellW, cellH)} />
            <div className="w-2" />
            <div className="flex">
              {cols.map((c) => (
                <Digit key={`q-${c}`} d={quotientDigits[c]} glow />
              ))}
            </div>
          </div>

          {/* Divisor ) Dividend */}
          <div className="flex items-center gap-0">
            <div className={cn("flex items-center justify-center font-black tabular-nums text-[11px] sm:text-xs text-foreground", cellH, "px-1")}>
              {divisor}
            </div>
            <svg viewBox="0 0 8 24" preserveAspectRatio="none" className={cn("w-2", cellH)}>
              <path d="M 2 22 C 2 12, 3 4, 8 1" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="flex border-t-2 border-primary pt-0.5">
              {cols.map((c) => (
                <Digit key={`d-${c}`} d={dDigits[c]} />
              ))}
            </div>
          </div>

          {/* Stages */}
          {stages.map((st, si) => {
            const product = st.product;
            const productStr = String(product);
            // product is right-aligned ending at colP
            const productCells: (number | "")[] = Array(nCols).fill("");
            for (let i = 0; i < productStr.length; i++) {
              const col = st.colP - (productStr.length - 1 - i);
              if (col >= 0) productCells[col] = Number(productStr[i]);
            }
            // pad zeros to right (colP+1 .. nCols-1) — only for non-final stages
            const isFinal = si === stages.length - 1;
            for (let c = st.colP + 1; c < nCols; c++) {
              if (!isFinal) productCells[c] = 0;
            }

            const showRemainderRow = true;
            return (
              <div key={`s-${si}`} className="flex flex-col items-stretch">
                {/* Product row with minus */}
                <div className="flex items-center gap-0">
                  <div className={cn("flex items-center justify-center text-rose-400 font-bold text-[11px]", cellW, cellH)}>−</div>
                  <div className="w-2" />
                  <div className="flex">
                    {cols.map((c) => {
                      const v = productCells[c];
                      const isPad = c > st.colP && !isFinal;
                      return <Digit key={`p-${si}-${c}`} d={v === "" ? null : v} dim={isPad} />;
                    })}
                  </div>
                </div>
                {/* sub line */}
                <div className="flex items-center gap-0">
                  <div className={cn(cellW)} />
                  <div className="w-2" />
                  <div className="flex">
                    {cols.map((c) => (
                      <div key={`ln-${si}-${c}`} className={cn(cellW, "h-px",
                        c >= st.colP - String(productCells[st.colP] === "" ? 0 : 1).length ? "bg-amber-300/60" : "")} />
                    ))}
                  </div>
                </div>
                {/* remainder row */}
                {showRemainderRow && (
                  <div className="flex items-center gap-0">
                    <div className={cn(cellW)} />
                    <div className="w-2" />
                    <div className="flex">
                      {cols.map((c) => {
                        const v = st.resultRow[c];
                        // hide leading zeros to the left of startCol
                        const hide = c < st.startCol && v === 0;
                        return <Digit key={`r-${si}-${c}`} d={hide ? null : v} dim={c < st.colP} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-center text-[10px] leading-snug font-bold">
        {exact ? (
          <span className="text-emerald-300">{n} ÷ {divisor} = {quotient} · divisible</span>
        ) : (
          <span className="text-rose-300">{n} ÷ {divisor} = {quotient} r {remainder} · not divisible</span>
        )}
      </p>
    </div>
  );
};
