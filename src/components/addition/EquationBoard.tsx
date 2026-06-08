import { cn } from "@/lib/utils";
import { AddProblem } from "@/lib/addition";
import { AddRewardKind } from "@/lib/additionRewards";
import { BoardCell } from "./BoardCell";

export interface BoardState {
  problem: AddProblem;
  /** answers[col] = entered digit or null. Length = answerCols. */
  answers: (number | null)[];
  /** carries[col] = entered carry digit or null. carries[0] always null (no carry into units). */
  carries: (number | null)[];
  /** Reward hidden behind each answer/carry cell, indexed by col. */
  answerRewards: AddRewardKind[];
  carryRewards: AddRewardKind[];
  /** Cells currently in burst (final reward animation) state. */
  burstAnswer: boolean[];
  burstCarry: boolean[];
  /** Cells flashing wrong. */
  wrongAnswer: boolean[];
  wrongCarry: boolean[];
}

interface Props {
  state: BoardState;
  /** active = { type, col } */
  active: { type: "answer" | "carry"; col: number } | null;
  onPlace: (type: "answer" | "carry", col: number, digit: number) => void;
  onActivate: (type: "answer" | "carry", col: number) => void;
}

export const EquationBoard = ({ state, active, onPlace, onActivate }: Props) => {
  const { problem, answers, carries, answerRewards, carryRewards } = state;
  const { aDigits, bDigits, operandCols, answerCols } = problem;

  // We render columns right-to-left visually but build them in display (left→right) order.
  // Total visible columns = answerCols (extra leading column when sum has more digits than operands).
  const cols = answerCols;
  // Display indices (left → right) map to "place" indices (right→left = units first):
  // displayCol d corresponds to place index = cols - 1 - d.
  const displayPlaces: number[] = [];
  for (let d = 0; d < cols; d++) displayPlaces.push(cols - 1 - d);

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card/80 to-card/50 p-3 sm:p-4 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      {/* Carry row */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {displayPlaces.map((p) => {
          // Carry into column p (carry box sits ABOVE column p).
          // Only show a real carry box when this column actually receives a carry from column p-1.
          // For UX clarity we show a carry slot for every column except units when it's possible.
          const isUnits = p === 0;
          if (isUnits) return <div key={`c-${p}`} />;
          const needsCarry = problem.carryInto[p] > 0;
          return (
            <div key={`c-${p}`} className="flex justify-center" data-add-cell={`carry-${p}`}>
              <BoardCell
                kind={needsCarry ? "carry" : "empty"}
                small
                value={carries[p]}
                reward={carryRewards[p]}
                active={active?.type === "carry" && active.col === p}
                correct={needsCarry && carries[p] === problem.carryInto[p]}
                wrong={state.wrongCarry[p]}
                burst={state.burstCarry[p]}
                onClick={() => needsCarry && onActivate("carry", p)}
                onDrop={(d) => needsCarry && onPlace("carry", p, d)}
              />
            </div>
          );
        })}
      </div>

      {/* Operand A */}
      <div className="mt-1 grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {displayPlaces.map((p) => (
          <div key={`a-${p}`} className="flex justify-center">
            <BoardCell kind={p < operandCols ? "operand" : "empty"} value={p < operandCols ? aDigits[p] : null} />
          </div>
        ))}
      </div>

      {/* Operand B with + */}
      <div className="mt-1 grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div className="flex items-center justify-center text-2xl sm:text-3xl font-black text-primary">+</div>
        {displayPlaces.map((p) => (
          <div key={`b-${p}`} className="flex justify-center">
            <BoardCell kind={p < operandCols ? "operand" : "empty"} value={p < operandCols ? bDigits[p] : null} />
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="my-2 h-[3px] w-full rounded bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* Answer row */}
      <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {displayPlaces.map((p) => (
          <div key={`ans-${p}`} className="flex justify-center" data-add-cell={`answer-${p}`}>
            <BoardCell
              kind="answer"
              value={answers[p]}
              reward={answerRewards[p]}
              active={active?.type === "answer" && active.col === p}
              correct={answers[p] === problem.answerDigits[p]}
              wrong={state.wrongAnswer[p]}
              burst={state.burstAnswer[p]}
              onClick={() => onActivate("answer", p)}
              onDrop={(d) => onPlace("answer", p, d)}
            />
          </div>
        ))}
      </div>

      {/* Place labels */}
      <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {displayPlaces.map((p) => (
          <div key={`lbl-${p}`} className={cn("text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground")}>
            {placeLabel(p)}
          </div>
        ))}
      </div>
    </div>
  );
};

const placeLabel = (p: number) => {
  switch (p) {
    case 0: return "Units";
    case 1: return "Tens";
    case 2: return "Hund.";
    case 3: return "Thou.";
    case 4: return "10K";
    default: return "";
  }
};
