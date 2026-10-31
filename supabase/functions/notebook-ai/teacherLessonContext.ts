// Pure request context shared by presentation guidance and relevant references.
export type TeachingSubjectFamily = "mathematics" | "engineering" | "other";

export function teachingSubjectFamily(body: Record<string, any>): TeachingSubjectFamily {
  const raw = body.subject ?? body.snapshot?.subject ?? body.context?.subject ?? "Mathematics";
  const subject = String(raw).trim().toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ");
  if (/^(?:engineering|electrical engineering|mechanical engineering|civil engineering|chemical engineering)$/.test(subject)) return "engineering";
  if (/^(?:maths?|mathematics|(?:further|additional|pure|applied|engineering|advanced|abstract) (?:maths?|mathematics)|statistics(?: and probability)?|probability(?: and statistics)?|geometry|algebra|abstract algebra|linear algebra|trigonometry|calculus|real analysis|numerical analysis|discrete mathematics)$/.test(subject)) return "mathematics";
  return "other";
}

/** Current question > current subtopic > instruction > broad notebook title. */
export function teachingContextCandidates(body: Record<string, any>): string[] {
  const strings = (values: unknown[]) => values.filter((v): v is string => typeof v === "string").join(" ");
  return [
    strings([body.question, body.problem, body.activeQuestion, body.item?.question]),
    strings([body.subtopic, body.activeSubtopic, body.snapshot?.activeSubtopic, body.snapshot?.subtopic, body.context?.activeSubtopic, body.context?.subtopic]),
    strings([body.selection, body.instruction, body.teacherPrompt, body.material?.text, body.message]),
    strings([body.topic, body.snapshot?.topic, body.context?.topic]),
  ];
}
