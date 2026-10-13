import { z } from "zod";
import { QUESTION_KINDS, TEACHING_KINDS, type StructuredSection } from "./lessonValidator";

const expression = z.string().trim().min(1).max(2000);
const answerLine = z.number().int().min(2).max(80).describe("1-based index of the final solution line containing this answer.");
export const answerCheckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("equation_solution"), equation: expression, variable: z.string().regex(/^[a-z]$/i), value: expression, answerLine }).strict(),
  z.object({ kind: z.literal("arithmetic"), expression, value: expression, answerLine }).strict(),
]);
const line = z.string().max(2000);
export const questionSchema = z.object({
  question: z.string().trim().min(1).max(4000),
  solution: z.array(line).min(3).max(80).describe("Question verbatim, method, micro-steps and final answer; one complete step per item."),
  title: z.string().max(200).optional(),
  checks: z.array(answerCheckSchema).max(10).optional().describe("Checks tied to the actual question and displayed final answer. Omit for unsupported mathematics, which requires explicit teacher review."),
}).strict();
const teachingSection = <K extends typeof TEACHING_KINDS[number]>(kind: K) =>
  z.object({ kind: z.literal(kind), title: z.string().max(200).optional(), lines: z.array(line).min(1).max(200) }).strict();
const questionSection = <K extends typeof QUESTION_KINDS[number]>(kind: K) =>
  z.object({ kind: z.literal(kind), title: z.string().max(200).optional(), questions: z.array(questionSchema).min(1).max(30) }).strict();
export const sectionSchema = z.discriminatedUnion("kind", [
  teachingSection("introduction"), teachingSection("explanation"), teachingSection("summary"),
  questionSection("example"), questionSection("exercise"), questionSection("classwork"), questionSection("homework"),
]);
export const draftInputSchema = {
  notebookId: z.string().uuid().optional().describe("Existing owner-scoped notebook to append this approved draft to."),
  title: z.string().trim().min(1).max(200).optional().describe("Title required for a new lesson notebook."),
  subject: z.string().trim().max(100).default("Mathematics").describe("Lesson subject; load this subject's standards before authoring."),
  subtopic: z.string().trim().max(200).default("").describe("Topic or subtopic for a new note."),
  className: z.string().max(100).optional().describe("Agreed class or year shown on a new note's cover."),
  teacher: z.string().max(100).optional().describe("Teacher name for a new note's cover, if supplied."),
  expectedCounts: z.object(Object.fromEntries([...TEACHING_KINDS, ...QUESTION_KINDS].map(k => [k, z.number().int().min(0).max(150).optional()]))).strict().optional().describe("Exact agreed counts; examples/exercises/classwork/homework count individual questions; zero omits the kind."),
  sections: z.array(sectionSchema).min(1).max(50).describe("Complete draft in teaching order: teaching lines or questions with their own worked solutions and optional answer checks."),
};

// Preserve all typed mathematical checks in the reviewed/saved payload.
export function toStructured(sections: z.infer<typeof sectionSchema>[]): StructuredSection[] {
  return sections;
}
