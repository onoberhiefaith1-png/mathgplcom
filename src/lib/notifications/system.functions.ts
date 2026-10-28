import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A class event the platform announces to its students. The caller must be
 * able to see the class through RLS, so a teacher can never announce into a
 * class that is not theirs.
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
      .select("id, name")
      .eq("id", data.classId)
      .maybeSingle();
    const row = klass as { id: string; name: string | null } | null;
    if (!row) return { sent: 0 };

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
