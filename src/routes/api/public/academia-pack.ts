import { createFileRoute } from "@tanstack/react-router";

/**
 * Public offline pack for the Academia app: only Academias marked public, and
 * only learning content (names, questions, expected lines). No people data.
 */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const Route = createFileRoute("/api/public/academia-pack")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const sel = async (table: string, cols: string, col: string, ids: string[]): Promise<Row[]> => {
          if (!ids.length) return [];
          const { data } = await db.from(table).select(cols).in(col, ids).order("position");
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
        const subtopics = await sel("academia_subtopics", "id, topic_id, name", "topic_id", topics.map((t) => t.id));
        const sessions = await sel("academia_sessions", "id, subtopic_id, title, description, video_url", "subtopic_id", subtopics.map((s) => s.id));
        const acts = (await sel("academia_activities", "id, session_id, title, subsection_id, practice_video", "session_id", sessions.map((s) => s.id)))
          .filter((a) => a.subsection_id);
        const subs = await sel("notebook_subsections", "id, floating_lines, position", "id", acts.map((a) => a.subsection_id));
        const linesOf = (id: string) => {
          const raw = subs.find((s) => s.id === id)?.floating_lines;
          return (Array.isArray(raw) ? raw : [])
            .filter((l: Row) => typeof l?.equation === "string" && l.equation.trim())
            .map((l: Row) => ({ equation: String(l.equation), marks: Number(l.marks ?? 1) || 1, fillers: Array.isArray(l.fillers) ? l.fillers.map(String) : [] }));
        };
        const youtube = (v: unknown) => (typeof v === "string" && /youtu\.?be/.test(v) ? v : null);
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
                    id: se.id, title: se.title, description: se.description ?? null, videoUrl: youtube(se.video_url),
                    activities: acts.filter((x) => x.session_id === se.id).map((x) => ({
                      id: x.id, title: x.title, lines: linesOf(x.subsection_id), videoUrl: null,
                    })).filter((x) => x.lines.length > 1),
                  })),
                })),
              })),
            })),
          })),
        }));
        const version = academias.map((a) => a.updated_at).sort().pop() ?? "0";
        return Response.json({ version, schools }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
