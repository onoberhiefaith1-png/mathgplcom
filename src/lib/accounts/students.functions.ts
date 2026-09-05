/**
 * School / teacher management of student accounts they created.
 *
 * Every action re-derives the caller's own workspace from their session, so a
 * caller can only ever create or change students in their own workspace.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  newStudentSchema,
  resetPasswordSchema,
  studentIdSchema,
  studentStatusSchema,
} from "./studentRules";

export const fetchManagedStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const students = await import("./students.server");
    const org = await students.creatorContext(context.supabase, context.userId);
    return { org, students: await students.listManagedStudents(org.orgId, context.userId) };
  });

export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => newStudentSchema.parse(data))
  .handler(async ({ context, data }) => {
    const students = await import("./students.server");
    const org = await students.creatorContext(context.supabase, context.userId);
    return students.createManagedStudent({
      orgId: org.orgId,
      orgKind: org.kind,
      creatorId: context.userId,
      firstName: data.firstName,
      lastName: data.lastName ?? "",
      customId: data.customId,
      password: data.password,
    });
  });

export const resetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => resetPasswordSchema.parse(data))
  .handler(async ({ context, data }) => {
    const students = await import("./students.server");
    const org = await students.creatorContext(context.supabase, context.userId);
    await students.requireOwnStudent(data.studentId, org.orgId, context.userId);
    return students.resetManagedStudentPassword(data.studentId, data.password);
  });

export const setStudentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => studentStatusSchema.parse(data))
  .handler(async ({ context, data }) => {
    const students = await import("./students.server");
    const org = await students.creatorContext(context.supabase, context.userId);
    await students.requireOwnStudent(data.studentId, org.orgId, context.userId);
    return students.setManagedStudentStatus(data.studentId, org.orgId, data.status);
  });

export const removeStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => studentIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const students = await import("./students.server");
    const org = await students.creatorContext(context.supabase, context.userId);
    await students.requireOwnStudent(data.studentId, org.orgId, context.userId);
    return students.removeManagedStudent(data.studentId);
  });
