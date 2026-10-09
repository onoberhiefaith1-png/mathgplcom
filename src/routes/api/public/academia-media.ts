import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves an image or video of a PUBLIC Academia activity under one stable
 * address, so the offline app can keep it on the device. Any other path is 404.
 */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const Route = createFileRoute("/api/public/academia-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path") ?? "";
        if (!path || path.length > 400 || path.includes("..")) return new Response("Not found", { status: 404 });
        const academiaId = path.split("/")[0];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const { data: ac } = await db.from("academia").select("id").eq("id", academiaId).eq("visibility", "public").maybeSingle();
        if (!ac) return new Response("Not found", { status: 404 });
        const { data: used } = await db.from("academia_activities")
          .select("id, thumbnail_path, question_image_path, practice_video")
          .or(`thumbnail_path.eq.${path},question_image_path.eq.${path},practice_video->>videoPath.eq.${path}`)
          .limit(1);
        if (!(used as Row[] | null)?.length) return new Response("Not found", { status: 404 });
        const { data: signed } = await db.storage.from("academia-media").createSignedUrl(path, 300);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });
        const range = request.headers.get("range");
        const upstream = await fetch(signed.signedUrl, { headers: range ? { range } : {} });
        const headers = new Headers();
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const v = upstream.headers.get(h);
          if (v) headers.set(h, v);
        }
        headers.set("cache-control", "public, max-age=86400");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
