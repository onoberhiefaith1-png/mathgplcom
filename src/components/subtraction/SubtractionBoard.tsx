import { cn } from "@/lib/utils";
import { SubProblem } from "@/lib/subtraction";
import { SubRewardKind, SUB_REWARD_META } from "@/lib/subtractionRewards";

export interface MinuendCol {
  /** Base digit currently shown (after any Replace). */
  base: number;
  /** Whether base differs from original (visually marked). */
  replaced: boolean;
  /** Borrow digit added to the LEFT (e.g. 1 → renders as [1][3]=13). null if not added. */
  borrow: number | null;
  /** Currently armed for replacement. */
  armingReplace: boolean;
  /** Currently expanded by Add Digit (slot visible, may be empty). */
  expanded: boolean;
  /** Visual error flash. */
  wrong: boolean;
}

export interface SubBoardState {
  problem: SubProblem;
  minuend: MinuendCol[];
  /** Answer per column (0 = units). null until placed. */
  answers: (number | null)[];
  answerRewards: SubRewardKind[];
  burstAnswer: boolean[];
  wrongAnswer: boolean[];
}

export type ToolMode = "idle" | "replace" | "add";

interface Props {
  state: SubBoardState;
  toolMode: ToolMode;
  hintCol: number | null;
  selectedMinCol: number | null;
  onMinuendClick: (col: number) => void;
  onMinuendDrop: (col: number, digit: number, target: "base" | "borrow") => void;
  onAnswerDrop: (col: number, digit: number) => void;
  onAnswerClick: (col: number) => void;
  activeAnswerCol: number | null;
}

export const SubtractionBoard = ({
  state, toolMode, hintCol, selectedMinCol, onMinuendClick, onMinuendDrop, onAnswerDrop, onAnswerClick, activeAnswerCol,
}: Props) => {
  const { problem, minuend, answers, answerRewards } = state;
  const cols = problem.cols;
  // Display left→right corresponds to place index (cols-1-d)
  const placeOrder: number[] = [];
  for (let d = 0; d < cols; d++) placeOrder.push(cols - 1 - d);

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card/85 to-card/50 p-3 sm:p-5 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      {/* Minuend row */}
      <div className="grid gap-2 items-end" style={{ gridTemplateColumns: `36px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {placeOrder.map((p) => (
          <div key={`m-${p}`} className="flex justify-center" data-sub-cell={`min-${p}`}>
            <MinuendCell
              col={p}
              data={minuend[p]}
              hint={hintCol === p && toolMode !== "idle"}
              selected={selectedMinCol === p}
              toolMode={toolMode}
              onClick={() => onMinuendClick(p)}
              onDropBase={(d) => onMinuendDrop(p, d, "base")}
              onDropBorrow={(d) => onMinuendDrop(p, d, "borrow")}
            />
          </div>
        ))}
      </div>

      {/* Subtrahend row */}
      <div className="mt-2 grid gap-2 items-center" style={{ gridTemplateColumns: `36px repeat(${cols}, minmax(0,1fr))` }}>
        <div className="flex items-center justify-center text-3xl sm:text-4xl font-black text-primary">−</div>
        {placeOrder.map((p) => {
          const show = problem.bDigits[p] !== 0 || p < String(problem.b).length;
          return (
            <div key={`b-${p}`} className="flex justify-center">
              {show ? (
                <div className="flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center text-3xl sm:text-4xl font-black text-foreground tabular-nums">
                  {problem.bDigits[p]}
                </div>
              ) : <div className="h-12 w-10 sm:h-14 sm:w-12" />}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-3 h-[3px] w-full rounded bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* Answer row */}
      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: `36px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {placeOrder.map((p) => (
          <div key={`a-${p}`} className="flex justify-center" data-sub-cell={`ans-${p}`}>
            <AnswerCell
              value={answers[p]}
              reward={answerRewards[p]}
              active={activeAnswerCol === p}
              correct={answers[p] === problem.answerDigits[p]}
              wrong={state.wrongAnswer[p]}
              burst={state.burstAnswer[p]}
              onClick={() => onAnswerClick(p)}
              onDrop={(d) => onAnswerDrop(p, d)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `36px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {placeOrder.map((p) => (
          <div key={`l-${p}`} className="text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {placeLabel(p)}
          </div>
        ))}
      </div>
    </div>
  );
};

const placeLabel = (p: number) => {
  switch (p) {
    case 0: return "Units"; case 1: return "Tens"; case 2: return "Hund.";
    case 3: return "Thou."; case 4: return "10K"; default: return "";
  }
};

/* ========== Minuend Cell ========== */

interface MinuendProps {
  col: number;
  data: MinuendCol;
  hint: boolean;
  selected: boolean;
  toolMode: ToolMode;
  onClick: () => void;
  onDropBase: (d: number) => void;
  onDropBorrow: (d: number) => void;
}

const MinuendCell = ({ data, hint, selected, toolMode, onClick, onDropBase, onDropBorrow }: MinuendProps) => {
  const handleOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const handleDropBase = (e: React.DragEvent) => {
    e.preventDefault();
    const n = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(n)) onDropBase(n);
  };
  const handleDropBorrow = (e: React.DragEvent) => {
    e.preventDefault();
    const n = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(n)) onDropBorrow(n);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Borrow slot — collapses when not expanded */}
      <div
        onDragOver={data.expanded ? handleOver : undefined}
        onDrop={data.expanded ? handleDropBorrow : undefined}
        className={cn(
          "flex items-center justify-center overflow-hidden transition-[width,opacity,margin] duration-300 ease-out",
          "rounded-lg border-2 font-black tabular-nums text-2xl sm:text-3xl",
          data.expanded
            ? "h-12 w-10 sm:h-14 sm:w-12 opacity-100 border-violet-400/70 bg-violet-500/15 text-violet-200 shadow-[0_0_18px_hsl(270_80%_60%/0.55)]"
            : "h-12 w-0 sm:h-14 opacity-0 border-transparent",
          data.borrow === null && data.expanded && "animate-pulse",
        )}
      >
        {data.borrow !== null && <span className="animate-[scale-in_0.3s_ease-out]">{data.borrow}</span>}
      </div>

      {/* Base digit */}
      <button
        type="button"
        onClick={onClick}
        onDragOver={data.armingReplace ? handleOver : undefined}
        onDrop={data.armingReplace ? handleDropBase : undefined}
        className={cn(
          "relative flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center rounded-lg transition-all",
          "font-black text-3xl sm:text-4xl tabular-nums select-none",
          data.replaced ? "text-emerald-300" : "text-foreground",
          data.armingReplace
            ? "border-2 border-dashed border-sky-400 bg-sky-500/10 opacity-70 ring-2 ring-sky-400/60 animate-pulse"
            : "border-2 border-transparent hover:border-primary/30",
          selected && !data.armingReplace && "ring-2 ring-amber-300/80 bg-amber-400/10 scale-105 shadow-[0_0_18px_hsl(45_95%_60%/0.55)]",
          hint && toolMode === "replace" && !data.armingReplace && !selected && "ring-2 ring-sky-400/40",
          hint && toolMode === "add" && !data.expanded && !selected && "ring-2 ring-violet-400/40",
          data.wrong && "animate-[shake_0.4s_ease-in-out] text-rose-400",
        )}
      >
        {data.base}
      </button>
    </div>
  );
};

/* ========== Answer Cell ========== */

interface AnsProps {
  value: number | null;
  reward: SubRewardKind;
  active: boolean;
  correct: boolean;
  wrong: boolean;
  burst: boolean;
  onClick: () => void;
  onDrop: (d: number) => void;
}

const AnswerCell = ({ value, reward, active, correct, wrong, burst, onClick, onDrop }: AnsProps) => {
  const meta = SUB_REWARD_META[reward];
  const handleOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const n = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(n)) onDrop(n);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={handleOver}
      onDrop={handleDrop}
      className={cn(
        "relative flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center rounded-lg border-2 select-none transition-all",
        "bg-gradient-to-b from-card/90 to-card/60 backdrop-blur-sm border-primary/40",
        active && value === null && "border-primary ring-2 ring-primary/50 animate-pulse",
        correct && "border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/60",
        wrong && "border-rose-500 bg-rose-500/10 animate-[shake_0.4s_ease-in-out]",
        burst && "animate-[scale-in_0.4s_ease-out]",
      )}
    >
      {!value && (
        <img
          src={meta.src}
          alt=""
          className={cn(
            "pointer-events-none absolute inset-1 m-auto object-contain transition-opacity",
            "opacity-25",
            burst && "opacity-100 drop-shadow-[0_0_6px_currentColor]",
          )}
          draggable={false}
        />
      )}
      {burst && (
        <span className="absolute -inset-1 rounded-lg ring-2 ring-amber-300/70 shadow-[0_0_18px_hsl(45_95%_60%/0.8)] animate-[scale-in_0.3s_ease-out]" />
      )}
      {value !== null && (
        <span className="relative z-10 text-2xl sm:text-3xl font-black tabular-nums text-foreground drop-shadow">
          {value}
        </span>
      )}
    </button>
  );
};
