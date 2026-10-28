/**
 * Rules for a student account created by a school or a teacher.
 *
 * No email address is involved: the creator chooses the ID and the password,
 * and hands both to the student.
 */
import { z } from "zod";
import { isValidCustomId } from "./customIdRules";

export const newStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  customId: z.string().trim().min(4).max(32).refine(isValidCustomId, "That ID is not allowed."),
  password: z.string().min(8).max(128),
});

export type NewStudentInput = z.infer<typeof newStudentSchema>;

export const studentIdSchema = z.object({ studentId: z.string().uuid() });

export const resetPasswordSchema = z.object({
  studentId: z.string().uuid(),
  password: z.string().min(8).max(128),
});

export const studentStatusSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

/** A readable password a young student can actually type. */
export const suggestStudentPassword = () => {
  const words = ["maths", "angle", "prime", "digit", "graph", "cube", "ratio", "solve"];
  const word = words[Math.floor(Math.random() * words.length)];
  const number = String(Math.floor(Math.random() * 9000) + 1000);
  return `${word}${number}`;
};
