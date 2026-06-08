// HelperRail — right-side dynamic helper that shows the appropriate
// mini-tool for the student's *next* solving step. Disappears when no
// help is needed.

import { useMemo } from "react";
import { useMathBoard } from "@/hooks/useMathBoard";
import { useFractionStep, ChallengeMode } from "@/hooks/useFractionStep";
import { Node } from "@/lib/mathboard/tokens";
import HelperLCM from "./HelperLCM";
import HelperDivision from "./HelperDivision";
import HelperMultiplication from "./HelperMultiplication";
import HelperAddition from "./HelperAddition";
import HelperReciprocal from "./HelperReciprocal";
import { Lightbulb } from "lucide-react";

interface Props {
  questionNodes: Node[] | null;
  mode?: ChallengeMode;
}

export const HelperRail = ({ questionNodes, mode }: Props) => {
  const { state } = useMathBoard();
  const currentSessionId = state.cursor.container.sessionId;
  const studentNodes = useMemo(() => {
    const s = state.sessions.find((x) => x.id === currentSessionId);
    if (!s || s.status === "question") return [];
    return s.nodes;
  }, [state.sessions, currentSessionId]);

  const step = useFractionStep(questionNodes, studentNodes, mode);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">
        <Lightbulb className="h-3.5 w-3.5" />
        <span>Helper</span>
      </div>
      {step ? (
        <div key={`${step.kind}-${JSON.stringify(step)}`} className="animate-fade-in">
          {step.kind === "lcm" && <HelperLCM numbers={step.numbers} />}
          {step.kind === "division" && (
            <HelperDivision dividend={step.dividend} divisor={step.divisor} />
          )}
          {step.kind === "multiplication" && (
            <HelperMultiplication a={step.a} b={step.b} />
          )}
          {step.kind === "addition" && (
            <HelperAddition a={step.a} b={step.b} op={step.op} />
          )}
          {step.kind === "reciprocal" && (
            <HelperReciprocal a={step.a} b={step.b} c={step.c} d={step.d} />
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-200/20 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Type your next step. Helpers will appear here when needed.
        </div>
      )}
    </div>
  );
};

export default HelperRail;
