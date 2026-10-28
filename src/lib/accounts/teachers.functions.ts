import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as team from "./teamAdmin.server";

export const fetchTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await team.requireOwnedOrg(context.supabase, context.userId);
    return { org, teachers: await team.listTeachers(org.id) };
  });

export const inviteTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        firstName: z.string().trim().max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        origin: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const org = await team.requireOwnedOrg(context.supabase, context.userId);
    return team.inviteTeacher({ ...data, orgId: org.id, invitedBy: context.userId });
  });

export const createTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
        firstName: z.string().trim().max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const org = await team.requireOwnedOrg(context.supabase, context.userId);
    return team.createTeacherWithPassword({ ...data, orgId: org.id });
  });

export const setTeacherStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ teacherId: z.string().uuid(), status: z.enum(["active", "suspended"]) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const org = await team.requireOwnedOrg(context.supabase, context.userId);
    await team.setTeacherStatus({ ...data, orgId: org.id });
    return { ok: true };
  });

export const removeTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ teacherId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const org = await team.requireOwnedOrg(context.supabase, context.userId);
    await team.removeTeacher({ orgId: org.id, teacherId: data.teacherId });
    return { ok: true };
  });

export const fetchParentTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    teachers: await team.listParentTeachers(context.userId),
  }));

export const connectParentTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        childUserId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    team.linkParentTeacher({ parentId: context.userId, ...data }),
  );

export const disconnectParentTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ linkId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await team.unlinkParentTeacher({ parentId: context.userId, linkId: data.linkId });
    return { ok: true };
  });
