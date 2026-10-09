import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Receives finished offline attempts from an Academia device. Write-only. */
const Body = z.object({
  deviceId: z.string().uuid(),
  attempts: z.array(z.object({
    id: z.string().uuid(),
    activityId: z.string().uuid(),
    sessionId: z.string().uuid(),
    mode: z.enum(["practice", "play"]),
    score: z.number().min(0).max(1000),
    maxScore: z.number().min(0).max(1000),
    at: z.string().max(40),
  })).max(200),
});

export const Route = createFileRoute("/api/public/academia-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const rows = parsed.data.attempts.map((a) => ({
          id: a.id, device_id: parsed.data.deviceId, activity_id: a.activityId, session_id: a.sessionId,
          mode: a.mode, score: a.score, max_score: a.maxScore, attempted_at: a.at,
        }));
        if (!rows.length) return Response.json({ synced: [] });
        const { error } = await db.from("academia_device_attempts").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
        if (error) return Response.json({ synced: [] }, { status: 503 });
        return Response.json({ synced: rows.map((r) => r.id) });
      },
    },
  },
});
