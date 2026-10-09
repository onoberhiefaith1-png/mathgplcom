import { createFileRoute } from "@tanstack/react-router";

/** Stable media addresses limited to activities in a public Academia. */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const containsExactString = (value: unknown, needle: string): boolean => {
  if (typeof value === "string") return value === needle;
  if (Array.isArray(value)) return value.some((entry) => containsExactString(entry, needle));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsExactString(entry, needle));
  return false;
};

export const Route = createFileRoute("/api/public/academia-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") ?? "";
        const activityId = url.searchParams.get("activity") ?? "";
        const gameAsset = url.searchParams.get("gameAsset") ?? "";
        if ((!path && (!activityId || !gameAsset)) || path.includes("..") || gameAsset.includes("..") || path.length > 400 || gameAsset.length > 400)
          return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        let bucket = "academia-media";
        let storagePath = path;

        if (gameAsset) {
          const { data: activity } = await db.from("academia_activities").select("game_id,session_id").eq("id", activityId).maybeSingle();
          if (!activity?.game_id || !activity?.session_id) return new Response("Not found", { status: 404 });
          const { data: session } = await db.from("academia_sessions").select("subtopic_id").eq("id", activity.session_id).maybeSingle();
          const { data: subtopic } = session ? await db.from("academia_subtopics").select("topic_id").eq("id", session.subtopic_id).maybeSingle() : { data: null };
          const { data: topic } = subtopic ? await db.from("academia_topics").select("subject_id").eq("id", subtopic.topic_id).maybeSingle() : { data: null };
          const { data: subject } = topic ? await db.from("academia_subjects").select("class_id").eq("id", topic.subject_id).maybeSingle() : { data: null };
          const { data: classRow } = subject ? await db.from("academia_classes").select("academia_id").eq("id", subject.class_id).maybeSingle() : { data: null };
          const { data: academia } = classRow ? await db.from("academia").select("visibility").eq("id", classRow.academia_id).maybeSingle() : { data: null };
          if (academia?.visibility !== "public") return new Response("Not found", { status: 404 });
          const { data: game } = await db.from("slate_games").select("owner_id,background,settings").eq("id", activity.game_id).maybeSingle();
          if (!game || !gameAsset.startsWith(`${game.owner_id}/`) || !containsExactString({ background: game.background, settings: game.settings }, gameAsset))
            return new Response("Not found", { status: 404 });
          bucket = "game-assets";
          storagePath = gameAsset;
        } else {
          const academiaId = path.split("/")[0];
          const { data: academia } = await db.from("academia").select("id").eq("id", academiaId).eq("visibility", "public").maybeSingle();
          if (!academia) return new Response("Not found", { status: 404 });
          const hit = async (column: string) => {
            const { data } = await db.from("academia_activities").select("id").eq(column, path).limit(1);
            return ((data as Row[] | null) ?? []).length > 0;
          };
          if (!(await hit("thumbnail_path")) && !(await hit("question_image_path")) && !(await hit("practice_video->>videoPath")) && !(await hit("play_video->>videoPath")))
            return new Response("Not found", { status: 404 });
        }
        const { data: signed } = await db.storage.from(bucket).createSignedUrl(storagePath, 300);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });
        const range = request.headers.get("range");
        const upstream = await fetch(signed.signedUrl, { headers: range ? { range } : {} });
        const headers = new Headers();
        for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set("cache-control", "public, max-age=86400");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});