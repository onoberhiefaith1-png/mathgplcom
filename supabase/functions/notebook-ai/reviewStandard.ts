// MATHEMATICAL REFEREE — the replacement for the old presence-based Problem Check.
//
// The old checker asked "did I find mathematics inside this text block?" and
// interrupted the teacher whenever the answer was no. That produced constant
// false errors: a perfectly good question waiting for its solution, a question
// whose data lives in a Smart Table, a question whose data lives in a diagram,
// or a question the teacher edited by hand.
//
// The referee asks one question only:
//
//     "Is there a GENUINE mathematical problem with this question or its
//      solution, that a teacher must decide about before we generate?"
//
// It reasons over the WHOLE problem (text + instruction + tables + diagram +
// graphs + floating numbers + referenced items + any existing solution) and
// stays silent unless it finds something real.

export const REVIEW_ISSUE_TYPES = [
  "incomplete_question",
  "no_valid_solution",
  "method_unsuitable",
  "contradictory_information",
  "table_conflict",
  "diagram_conflict",
  "graph_conflict",
  "incorrect_information",
  "solution_incorrect",
  "solution_answers_different_question",
  "incorrect_calculation",
  "unit_inconsistency",
  "insufficient_constraints",
  "ambiguous_question",
  "missing_reference",
  "unreadable_object",
  "invalid_domain",
  "multi_step_inconsistency",
] as const;

export type ReviewIssueType = (typeof REVIEW_ISSUE_TYPES)[number];

export interface ReviewAction {
  /** Stable id the client sends back as the teacher's decision. */
  id: string;
  /** Teacher-facing button label. */
  label: string;
  /** Instruction the generator must follow when this action is chosen. */
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

/** Default action sets per issue type — always specific, never generic. */
export const REVIEW_ACTIONS: Record<ReviewIssueType, ReviewAction[]> = {
  incomplete_question: [
    { id: "complete_question", label: "Let Copilot complete the question", directive: "Add the missing information to the question yourself, state clearly what you added, then solve the completed question." },
    { id: "rewrite_question", label: "Rewrite the question", directive: "Write a new, fully solvable question on the same topic and at the same level, then solve it." },
    { id: "continue", label: "Continue anyway", directive: "Continue with the question exactly as written; where information is missing, state the assumption you make before using it." },
  ],
  no_valid_solution: [
    { id: "amend_question", label: "Amend the question", directive: "Correct the data so the problem has a valid solution, say what you corrected, then solve it." },
    { id: "generate_valid", label: "Generate a valid question", directive: "Replace it with a valid question of the same type and level, then solve it." },
  ],
  method_unsuitable: [
    { id: "use_other_method", label: "Use another method", directive: "Solve the problem with a valid method and name the method you used instead." },
    { id: "amend_question", label: "Amend the question", directive: "Adjust the question so the requested method genuinely applies, then solve it with that method." },
    { id: "continue", label: "Continue with the requested method", directive: "Use the requested method as far as it can go and state plainly where it breaks down." },
  ],
  contradictory_information: [
    { id: "use_question", label: "Use the question text", directive: "Treat the question text as authoritative and ignore the conflicting values elsewhere." },
    { id: "use_other", label: "Use the diagram/table data", directive: "Treat the diagram or table data as authoritative and ignore the conflicting values in the text." },
    { id: "amend_question", label: "Amend the question", directive: "Resolve the conflict, state which value you kept, then solve." },
  ],
  table_conflict: [
    { id: "use_other", label: "Use the table data", directive: "Treat the table as authoritative and solve from it." },
    { id: "use_question", label: "Use the question text", directive: "Treat the question text as authoritative and solve from it." },
    { id: "amend_question", label: "Correct the question", directive: "Correct the question so it agrees with the table, say what you corrected, then solve." },
  ],
  diagram_conflict: [
    { id: "use_question", label: "Use the question text", directive: "Treat the question text as authoritative and ignore the conflicting diagram labels." },
    { id: "use_other", label: "Use the diagram", directive: "Treat the diagram as authoritative and solve from it." },
    { id: "amend_question", label: "Amend the question", directive: "Resolve the conflict, state which values you kept, then solve." },
  ],
  graph_conflict: [
    { id: "use_question", label: "Use the question text", directive: "Treat the question text as authoritative and ignore the conflicting graph." },
    { id: "use_other", label: "Use the graph", directive: "Treat the graph as authoritative and solve from it." },
    { id: "amend_question", label: "Amend the question", directive: "Resolve the conflict, state which you kept, then solve." },
  ],
  incorrect_information: [
    { id: "amend_question", label: "Correct the information", directive: "Correct the incorrect mathematical information, say what you corrected, then solve." },
    { id: "continue", label: "Continue anyway", directive: "Solve using the information exactly as given and note the mathematical difficulty it causes." },
  ],
  solution_incorrect: [
    { id: "correct_solution", label: "Correct the solution", directive: "Keep the teacher's approach but repair the incorrect steps, showing the corrected working in full." },
    { id: "regenerate_solution", label: "Regenerate the solution", directive: "Ignore the existing solution and write a fresh, complete solution to the question." },
    { id: "keep_solution", label: "Keep the existing solution", directive: "Leave the existing solution's mathematics as it is; continue without changing it." },
  ],
  solution_answers_different_question: [
    { id: "regenerate_solution", label: "Solve the question as written", directive: "Ignore the existing solution and answer exactly what the question asks." },
    { id: "amend_question", label: "Amend the question", directive: "Adjust the question so it matches what the existing solution answers." },
  ],
  incorrect_calculation: [
    { id: "correct_solution", label: "Correct the calculation", directive: "Repair the incorrect calculation and carry the corrected value through the rest of the working." },
    { id: "regenerate_solution", label: "Regenerate the working", directive: "Write the working again from the start, correctly." },
    { id: "continue", label: "Continue anyway", directive: "Continue from the values as given without correcting them." },
  ],
  unit_inconsistency: [
    { id: "correct_units", label: "Convert to consistent units", directive: "Convert every quantity to one consistent unit, show the conversion, then solve." },
    { id: "amend_question", label: "Amend the question", directive: "Correct the units in the question, say what you corrected, then solve." },
    { id: "continue", label: "Continue anyway", directive: "Solve using the units exactly as given and state the unit of the answer." },
  ],
  insufficient_constraints: [
    { id: "complete_question", label: "Add the missing condition", directive: "Add the condition needed for a unique answer, state what you added, then solve." },
    { id: "continue", label: "Give the general solution", directive: "Give the general solution in terms of the free variable(s) instead of a single value." },
    { id: "rewrite_question", label: "Rewrite the question", directive: "Write a question of the same type that does have a unique answer, then solve it." },
  ],
  ambiguous_question: [
    { id: "choose_interpretation", label: "Use the most likely meaning", directive: "State plainly which interpretation you are using, then solve it." },
    { id: "rewrite_question", label: "Rewrite the question clearly", directive: "Rewrite the question so it has one clear meaning, then solve it." },
  ],
  missing_reference: [
    { id: "complete_question", label: "Supply the referenced values", directive: "Work out or state the referenced values yourself, say where they come from, then continue." },
    { id: "rewrite_question", label: "Rewrite as a self-contained question", directive: "Rewrite the question so it carries all its own data, then solve it." },
  ],
  unreadable_object: [
    { id: "continue", label: "Continue with what is readable", directive: "Use only the parts of the table/diagram/graph you can read reliably and say what you could not read." },
    { id: "rewrite_question", label: "Rebuild the question", directive: "Restate the question with its data written out clearly, then solve it." },
  ],
  invalid_domain: [
    { id: "amend_question", label: "Amend the question", directive: "Adjust the values so the mathematics is defined, say what you changed, then solve." },
    { id: "continue", label: "Explain the restriction", directive: "Explain the domain restriction and give the answer that is valid under it." },
  ],
  multi_step_inconsistency: [
    { id: "amend_question", label: "Resolve the inconsistency", directive: "Resolve the conflicting condition, state which you kept, then solve consistently." },
    { id: "continue", label: "Continue anyway", directive: "Continue and point out where the later condition conflicts with the earlier result." },
  ],
};

/** The referee prompt. */
export const REVIEW_STANDARD = `
You are the MathGPL MATHEMATICAL REFEREE.

Your only job is to decide whether there is a GENUINE mathematical problem that
the teacher must make a decision about before Copilot generates. You are NOT a
document checker. You never comment on formatting, layout, style or wording.

STEP 1 — Reconstruct the COMPLETE problem.
Read every part supplied to you as ONE problem: heading, question text,
instruction, equations, tables (Smart Tables / Maths Tables), matrices, graphs,
diagrams and geometry objects, Floating Numbers, referenced earlier items, and
any existing solution. Data stored in a table, diagram, graph or mathematical
object IS the question's data — exactly as if it had been typed as text.

STEP 2 — Reason through the mathematics yourself. Actually attempt it.

STEP 3 — Decide. Report an issue ONLY if one of these is genuinely true:
incomplete_question (data truly required to solve it is nowhere in the problem),
no_valid_solution, method_unsuitable (a specific method is requested and cannot
work), contradictory_information, table_conflict, diagram_conflict,
graph_conflict, incorrect_information, solution_incorrect,
solution_answers_different_question, incorrect_calculation, unit_inconsistency,
insufficient_constraints, ambiguous_question, missing_reference,
unreadable_object, invalid_domain, multi_step_inconsistency.

NEVER report an issue for any of these — they are normal, not errors:
  • no solution exists yet (generating the solution is the whole point)
  • no diagram, when the mathematics does not require one
  • no table, when the mathematics does not require one
  • the mathematics lives in a table, diagram, graph or Floating Numbers
    rather than in the question paragraph
  • the teacher edited the question, table, diagram or solution by hand
  • the solution uses a valid method different from the one you would choose
  • a table laid out differently from how you would lay it out
  • different wording, ordering or notation with the same mathematical meaning
  • a long or tedious but solvable problem
  • a non-terminating decimal, a surd, or an answer that must be rounded
  • structural labels such as "Classwork 4", "Example 3", "Solution"

Examples of questions that are COMPLETE and must pass silently:
  "Find the standard deviation of the following examination scores: 60, 65, 70, 75, 80."
  "Find the value of x." — together with a diagram or table that carries the data.
  "Solve 2x + 4 = 0" with no solution written under it.

When in doubt, PASS. A false alarm costs the teacher more than a missed check.

OUTPUT — STRICT JSON, nothing else.
Silent pass:
{"ok": true}
Genuine issue:
{"ok": false, "issue": {
  "type": "<one of the type ids above>",
  "title": "<short teacher-facing headline>",
  "detail": "<what is wrong, in plain classroom English, naming the actual numbers or objects>",
  "affected": "<which part of the problem: the question, the table, the diagram, the solution…>",
  "recommendation": "<what you recommend the teacher does>"
}}
Do not invent action buttons; the application supplies them.
`.trim();

export const buildReviewPrompt = (ctx: {
  heading?: string;
  questionText?: string;
  instruction?: string;
  tables?: string;
  diagramSummary?: string;
  graphs?: string;
  floatingLines?: string;
  existingSolution?: string;
  referenced?: string;
  requestedMethod?: string;
  sessionContext?: string;
}): string => {
  const part = (label: string, value?: string) =>
    value && value.trim() ? `${label}:\n"""${value.trim()}"""\n` : "";
  return `${REVIEW_STANDARD}

THE COMPLETE PROBLEM
${part("Heading (structure only, never mathematics)", ctx.heading)}${part("Question text", ctx.questionText)}${part("Instruction", ctx.instruction)}${part("Tables belonging to this question", ctx.tables)}${part("Diagram / geometry belonging to this question", ctx.diagramSummary)}${part("Graphs belonging to this question", ctx.graphs)}${part("Floating Numbers belonging to this question", ctx.floatingLines)}${part("Referenced earlier items", ctx.referenced)}${part("Existing solution (may be teacher-written)", ctx.existingSolution)}${part("Requested solving method", ctx.requestedMethod)}${part("Rest of this lesson session (context only)", ctx.sessionContext)}
Return the STRICT JSON verdict now.`;
};

/** Parse the referee's verdict; anything unreadable is a silent pass. */
export function parseReviewVerdict(raw: string): { ok: true } | { ok: false; issue: ReviewIssue } {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^```json\s*|\s*```$/g, "")
    .replace(/^```\s*|\s*```$/g, "");
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return { ok: true };
    try { parsed = JSON.parse(m[0]); } catch { return { ok: true }; }
  }
  if (!parsed || parsed.ok !== false || !parsed.issue) return { ok: true };
  const type = String(parsed.issue.type ?? "") as ReviewIssueType;
  if (!(REVIEW_ISSUE_TYPES as readonly string[]).includes(type)) return { ok: true };
  const detail = String(parsed.issue.detail ?? "").trim();
  if (!detail) return { ok: true };
  return {
    ok: false,
    issue: {
      type,
      title: String(parsed.issue.title ?? "").trim() || "A mathematical problem was found",
      detail,
      affected: String(parsed.issue.affected ?? "").trim(),
      recommendation: String(parsed.issue.recommendation ?? "").trim(),
      actions: [
        ...REVIEW_ACTIONS[type],
        { id: "cancel", label: "Cancel", directive: "" },
      ],
    },
  };
}
