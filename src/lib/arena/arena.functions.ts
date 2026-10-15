import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (len: number) => {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
};

/**
 * Create a NEW Timer Arena participation group for one Academia Session.
 * Any teacher who can open the Session (their school's, or a public one) may
 * share it; sharing never grants editing rights. Each call makes a separate
 * group with its own unguessable student link and display link.
 */
export const createArenaShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        sessionId: z.string().uuid(),
        title: z.string().trim().min(1).max(80),
        entry: z.object({
          name: z.enum(["off", "optional", "required"]),
          photo: z.enum(["off", "optional", "required"]),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Access check AS THE TEACHER: RLS decides whether they may open it.
    const { data: session } = await supabase
      .from("academia_sessions")
      .select("id, title")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("You can't open this session.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as never as { from: (t: string) => any };

    // The Session's content gateway (one per Session) — reused, never copied.
    const { data: links } = await admin
      .from("guest_links")
      .select("code, enabled, owner_id")
      .eq("kind", "academia_session")
      .eq("resource_id", data.sessionId)
      .is("class_id", null)
      .order("created_at")
      .limit(20);
    const all = (links ?? []) as { code: string; enabled: boolean; owner_id: string }[];
    let link: { code: string; enabled: boolean } | null =
      all.find((l) => l.owner_id === userId && l.enabled) ?? all.find((l) => l.enabled) ?? all[0] ?? null;
    if (!link) {
      for (let i = 0; i < 3 && !link; i++) {
        const { data: created } = await admin
          .from("guest_links")
          .insert({
            owner_id: userId,
            kind: "academia_session",
            resource_id: data.sessionId,
            class_id: null,
            code: `AC${randomCode(8)}`,
            title: session.title,
            enabled: true,
            ask_name: false,
          })
          .select("code, enabled")
          .maybeSingle();
        link = created;
      }
    }
    if (!link) throw new Error("Could not prepare the session link.");
    if (!link.enabled) throw new Error("This session's sharing has been switched off by its school.");

    for (let i = 0; i < 3; i++) {
      const { data: share, error } = await supabase
        .from("arena_shares")
        .insert({
          owner_id: userId,
          source_kind: "academia_session",
          source_id: data.sessionId,
          guest_code: link.code,
          code: `TA${randomCode(10)}`,
          display_code: `TD${randomCode(12)}`,
          title: data.title,
          entry_config: data.entry,
        })
        .select("id, code, display_code")
        .single();
      if (!error && share) return share;
      if (!/duplicate/i.test(error?.message ?? "")) throw new Error(error?.message ?? "Could not create the group.");
    }
    throw new Error("Could not create the group. Please try again.");
  });
