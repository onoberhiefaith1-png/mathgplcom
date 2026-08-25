/**
 * Server-side checks for the Audit Dashboard.
 *
 * Only the database existence check needs privileged access; everything else is
 * proven in the browser from the built module graph and the router. Nothing here
 * writes to application data — the audit is read-only by design.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ tables: z.array(z.string().min(1)).max(200) });

export const checkTablesExist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some(
      (r) => r.role === "platform_owner" || r.role === "co_admin",
    );
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, { exists: boolean; detail: string }> = {};
    for (const table of data.tables) {
      const { error } = await supabaseAdmin
        // deliberately dynamic: the table name comes from the standard
        .from(table as never)
        .select("*", { head: true, count: "exact" })
        .limit(1);
      if (!error) {
        out[table] = { exists: true, detail: "table reachable" };
      } else if (error.code === "42P01" || /does not exist/i.test(error.message)) {
        out[table] = { exists: false, detail: `table missing: ${error.message}` };
      } else {
        out[table] = { exists: true, detail: `table present, read blocked: ${error.message}` };
      }
    }
    return out;
  });
