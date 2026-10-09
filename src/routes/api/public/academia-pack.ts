import { createFileRoute } from "@tanstack/react-router";

/**
 * Public offline pack for the Academia app: only Academias marked public, and
 * only learning content (names, questions, expected lines). No people data,
 * no Vault codes.
 */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const mediaUrl = (path: unknown) =>
  typeof path === "string" && path ? `/api/public/academia-media?path=${encodeURIComponent(path)}` : null;

export const Route = createFileRoute("/api/public/academia-pack")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const sel = async (table: string, cols: string, col: string, ids: string[], order: string | null = "position"): Promise<Row[]> => {
          if (!ids.length) return [];
          let qy = db.from(table).select(cols).in(col, ids);
          if (order) qy = qy.order(order);
          const { data, error } = await qy;
          if (error) console.error(`academia-pack ${table}:`, error.message);
          return data ?? [];
        };
        const { data: acs } = await db.from("academia").select("id, org_id, name, description, updated_at").eq("visibility", "public").limit(200);
        const academias: Row[] = acs ?? [];
        const { data: orgs } = academias.length
          ? await db.from("organizations").select("id, name").in("id", academias.map((a) => a.org_id))
          : { data: [] };
        const classes = await sel("academia_classes", "id, academia_id, name", "academia_id", academias.map((a) => a.id));
        const subjects = await sel("academia_subjects", "id, class_id, name", "class_id", classes.map((c) => c.id));
        const topics = await sel("academia_topics", "id, subject_id, name", "subject_id", subjects.map((s) => s.id));
        const subtopics = await sel("academia_subtopics", "id, topic_id, name", "topic_id", subtopics_ids(topics));
        const sessions = await sel("academia_sessions", "id, subtopic_id, title, description, video_url", "subtopic_id", subtopics.map((s) => s.id));
        const acts = await sel(
          "academia_activities",
          "id, session_id, title, kind, subsection_id, question_key, practice_video, thumbnail_path, question_image_path, updated_at",
          "session_id", sessions.map((s) => s.id),
        );
        const subs = await sel("notebook_subsections", "id, floating_lines", "id", acts.map((a) => a.subsection_id).filter(Boolean), null);
        const linesOf = (a: Row) => {
          const raw = subs.find((s) => s.id === a.subsection_id)?.floating_lines;
          const all = (Array.isArray(raw) ? raw : []).filter((l: Row) => typeof l?.equation === "string" && l.equation.trim());
          // A subsection can hold several questions; keep only this activity's.
          const own = a.question_key ? all.filter((l: Row) => !l.questionId || l.questionId === a.question_key) : all;
          const use = own.length ? own : all;
          return use.map((l: Row) => ({
            id: String(l.lineId ?? ""),
            equation: String(l.equation),
            marks: Number(l.marks ?? 1) || 1,
            fillers: Array.isArray(l.fillers) ? l.fillers.map(String) : [],
            timerSeconds: Number(l.timerSeconds) > 0 ? Number(l.timerSeconds) : null,
          }));
        };
        const video = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
        const schools = academias.map((a) => ({
          id: a.id,
          name: a.name,
          schoolName: orgs?.find((o: Row) => o.id === a.org_id)?.name ?? "",
          description: a.description ?? null,
          classes: classes.filter((c) => c.academia_id === a.id).map((c) => ({
            id: c.id, name: c.name,
            subjects: subjects.filter((s) => s.class_id === c.id).map((s) => ({
              id: s.id, name: s.name,
              topics: topics.filter((t) => t.subject_id === s.id).map((t) => ({
                id: t.id, name: t.name,
                subtopics: subtopics.filter((st) => st.topic_id === t.id).map((st) => ({
                  id: st.id, name: st.name,
                  sessions: sessions.filter((se) => se.subtopic_id === st.id).map((se) => ({
                    id: se.id, title: se.title, description: se.description ?? null, videoUrl: video(se.video_url),
                    activities: acts
                      .filter((x) => x.session_id === se.id && x.kind !== "game")
                      .map((x) => ({
                        id: x.id,
                        title: x.title,
                        lines: linesOf(x),
                        imageUrl: mediaUrl(x.question_image_path ?? x.thumbnail_path),
                        videoUrl: mediaUrl(x.practice_video?.videoPath),
                        videoSegments: Array.isArray(x.practice_video?.segments)
                          ? x.practice_video.segments
                              .filter((g: Row) => typeof g?.key === "string" && g.key.startsWith("line:"))
                              .map((g: Row) => ({ lineId: g.key.slice(5), start: Number(g.start) || 0, end: Number(g.end) || 0 }))
                          : [],
                      })),
                  })),
                })),
              })),
            })),
          })),
        }));
        const version = [...academias.map((a) => a.updated_at), ...acts.map((a) => a.updated_at)].sort().pop() ?? "0";
        return Response.json({ version, schools }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});

function subtopics_ids(topics: Row[]) {
  return topics.map((t) => t.id);
}
