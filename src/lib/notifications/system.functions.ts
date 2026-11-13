import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A class event the platform announces to its students. The caller must be
 * own the class. Read access also belongs to students and is not authority
 * to broadcast a system announcement.
 */
export const notifyClassEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        event: z.enum(["assignment_new", "assignment_updated", "course_access", "class_updated"]),
        classId: z.string().uuid(),
        assignmentId: z.string().uuid().nullable().optional(),
        assignmentTitle: z.string().max(200).nullable().optional(),
        courseId: z.string().uuid().nullable().optional(),
        courseName: z.string().max(200).nullable().optional(),
        targetPath: z.string().max(300).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: klass } = await db
      .from("classes")
      .select("id, name, owner_id, org_id")
      .eq("id", data.classId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    const row = klass as { id: string; name: string | null; owner_id: string | null; org_id: string | null } | null;
    if (!row) return { sent: 0 };
    // Only the class's teacher (owner), its school, or platform staff may announce.
    if (row.owner_id !== context.userId) {
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", context.userId);
      const mine = new Set(((roles ?? []) as { role: string }[]).map((r) => r.role));
      let allowed = mine.has("platform_owner") || mine.has("co_admin");
      if (!allowed && mine.has("school") && row.org_id) {
        const { data: org } = await db.from("organizations").select("id").eq("id", row.org_id).eq("owner_user_id", context.userId).maybeSingle();
        allowed = !!org;
      }
      if (!allowed) throw new Error("Only the class teacher can send class notifications.");
    }

    const { notifySystemEvent } = await import("./system.server");
    const result = await notifySystemEvent({
      event: data.event,
      context: {
        classId: data.classId,
        className: row.name ?? null,
        assignmentId: data.assignmentId ?? null,
        assignmentTitle: data.assignmentTitle ?? null,
        courseId: data.courseId ?? null,
        courseName: data.courseName ?? null,
        source: "system",
      },
      targetPath: data.targetPath ?? null,
    });
    return { sent: result?.recipients ?? 0 };
  });
