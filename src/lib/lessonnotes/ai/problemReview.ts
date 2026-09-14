// MATHEMATICAL REFEREE — client side.
//
// The old Problem Check asked "does this text block contain mathematics, a
// diagram or a solution?" and interrupted the teacher whenever it did not.
// That is gone. This module instead assembles the COMPLETE problem and asks the
// Math Engine whether there is a GENUINE mathematical problem worth a decision.
//
// No genuine problem (or the referee is unavailable) → generation continues
// silently. A genuine problem → the review panel explains it and offers actions
// that belong to that specific problem; the chosen action is fed straight back
// into the same generation call.

import { supabase } from "@/integrations/supabase/client";

export type ReviewIssueType =
  | "incomplete_question"
  | "no_valid_solution"
  | "method_unsuitable"
  | "contradictory_information"
  | "table_conflict"
  | "diagram_conflict"
  | "graph_conflict"
  | "incorrect_information"
  | "solution_incorrect"
  | "solution_answers_different_question"
  | "incorrect_calculation"
  | "unit_inconsistency"
  | "insufficient_constraints"
  | "ambiguous_question"
  | "missing_reference"
  | "unreadable_object"
  | "invalid_domain"
  | "multi_step_inconsistency";

export interface ReviewAction {
  id: string;
  label: string;
  /** Instruction appended to the generation prompt when this action is chosen. */
  directive: string;
}

export interface ReviewIssue {
  type: ReviewIssueType;
  title: string;
  detail: string;
  affected: string;
  recommendation: string;
  actions: ReviewAction[];
}

/** Everything that belongs to ONE mathematical problem. */
export interface ProblemContext {
  heading?: string;
  questionText?: string;
  instruction?: string;
  /** Tables belonging to the question, serialised row by row. */
  tables?: string;
  /** Text inventory of the diagram / geometry objects. */
  diagramSummary?: string;
  graphs?: string;
  floatingLines?: string;
  existingSolution?: string;
  referenced?: string;
  requestedMethod?: string;
  sessionContext?: string;
}

export type ReviewVerdict = { ok: true } | { ok: false; issue: ReviewIssue };

/** A verbal task ("Solve ... using substitution") the referee must validate. */
const METHOD_PHRASE =
  /\b(?:using|by|with|via)\s+(?:the\s+)?([a-z][a-z' -]{2,40}?)\s*(?:method|rule|formula|theorem|law|approach)?\b/i;

export function detectRequestedMethod(text: string): string {
  const m = METHOD_PHRASE.exec(String(text ?? ""));
  return m ? m[0].trim() : "";
}

/** Is there anything at all to reason about? */
export function hasProblemContent(ctx: ProblemContext): boolean {
  return Boolean(
    (ctx.questionText ?? "").trim() ||
      (ctx.tables ?? "").trim() ||
      (ctx.diagramSummary ?? "").trim() ||
      (ctx.graphs ?? "").trim() ||
      (ctx.floatingLines ?? "").trim() ||
      (ctx.existingSolution ?? "").trim(),
  );
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);

/**
 * Ask the referee. NEVER throws and NEVER blocks: any failure, timeout or
 * unreadable answer resolves as a silent pass.
 */
export async function reviewProblem(ctx: ProblemContext): Promise<ReviewVerdict> {
  // Nothing written anywhere yet: there is no problem to referee. The teacher
  // is asking Copilot to create the question, which is normal.
  if (!hasProblemContent(ctx)) return { ok: true };
  try {
    const res = await withTimeout(
      supabase.functions.invoke("notebook-ai", {
        body: { mode: "review", ...ctx },
      }),
      60_000,
    );
    if (!res || (res as any).error) return { ok: true };
    const data = (res as any).data;
    if (!data || data.ok !== false || !data.issue) return { ok: true };
    const issue = data.issue as ReviewIssue;
    const actions = Array.isArray(issue.actions) ? issue.actions.filter((a) => a?.id && a?.label) : [];
    if (!actions.length) return { ok: true };
    return { ok: false, issue: { ...issue, actions } };
  } catch {
    return { ok: true };
  }
}

/** The teacher's decision, expressed as a directive for the generator. */
export function decisionDirective(issue: ReviewIssue, actionId: string): string {
  const action = issue.actions.find((a) => a.id === actionId);
  if (!action || !action.directive) return "";
  return [
    "TEACHER'S DECISION ON A REVIEWED PROBLEM — follow it exactly.",
    `Problem found: ${issue.title} — ${issue.detail}`,
    `Decision: ${action.label}.`,
    `What you must do: ${action.directive}`,
  ].join("\n");
}
