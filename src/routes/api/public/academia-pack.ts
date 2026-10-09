import { createFileRoute } from "@tanstack/react-router";
import { ACADEMIA_PACK_SCHEMA, compileOfflineBoard, gameAssetIds } from "@/lib/offline/academiaPack";
import type { QuestionVideoConfig } from "@/lib/courses/questionVideo";
import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import type { OfflinePackLine } from "@/lib/offline/academiaPack";
import { normalizeGame } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";

/** Public, full-fidelity offline packs. No people data is returned. */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const mediaUrl = (path: unknown) =>
  typeof path === "string" && path ? `/api/public/academia-media?path=${encodeURIComponent(path)}` : null;
const gameAssetUrl = (activityId: string, assetId: string) =>
  `/api/public/academia-media?activity=${encodeURIComponent(activityId)}&gameAsset=${encodeURIComponent(assetId)}`;

const parseLines = (raw: unknown, questionKey: unknown): OfflinePackLine[] => {
  const all = (Array.isArray(raw) ? raw : []).filter(
    (line): line is FloatingLine => !!line && typeof line === "object" && typeof (line as FloatingLine).equation === "string" && !!(line as FloatingLine).equation.trim(),
  );
  const own = typeof questionKey === "string" && questionKey
    ? all.filter((line) => !line.questionId || line.questionId === questionKey)
    : all;
  return (own.length ? own : all).map((line, index) => ({
    ...line,
    id: line.lineId || `line-${index + 1}`,
    marks: Math.max(0, Number(line.marks) || 0),
  }));
};

const video = (value: unknown): QuestionVideoConfig | null => {
  if (!value || typeof value !== "object") return null;
  const config = value as QuestionVideoConfig;
  if (!config.videoPath) return null;
  return { ...config, videoPath: mediaUrl(config.videoPath) ?? config.videoPath };
};

const gameFromRow = (row: Row): Game => normalizeGame({
  id: String(row.id), name: String(row.name ?? "Game"), topic: String(row.topic ?? ""), subtopic: String(row.subtopic ?? ""),
  surfaceId: String(row.surface_id ?? "plain"), surfaceColour: String(row.surface_colour ?? "#f4ead7"), roomId: String(row.room_id ?? ""),
  background: (row.background ?? {}) as Game["background"], slots: (row.slots ?? []) as Game["slots"],
  settings: (row.settings ?? {}) as Game["settings"], status: (row.status ?? {}) as Game["status"],
  patternLength: Number(row.pattern_length) || 1, updatedAt: Date.parse(String(row.updated_at ?? "")) || Date.now(),
});

export const Route = createFileRoute("/api/public/academia-pack")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const select = async (table: string, columns: string, column: string, ids: string[], order: string | null = "position"): Promise<Row[]> => {
          if (!ids.length) return [];
          let query = db.from(table).select(columns).in(column, ids);
          if (order) query = query.order(order);
          const { data, error } = await query;
          if (error) console.error(`academia-pack ${table}:`, error.message);
          return data ?? [];
        };
        const { data: rawAcademias } = await db.from("academia").select("id,org_id,name,description,updated_at").eq("visibility", "public").limit(200);
        const academias: Row[] = rawAcademias ?? [];
        const orgs = await select("organizations", "id,name", "id", academias.map((a) => a.org_id), null);
        const classes = await select("academia_classes", "id,academia_id,name", "academia_id", academias.map((a) => a.id));
        const subjects = await select("academia_subjects", "id,class_id,name", "class_id", classes.map((row) => row.id));
        const topics = await select("academia_topics", "id,subject_id,name", "subject_id", subjects.map((row) => row.id));
        const subtopics = await select("academia_subtopics", "id,topic_id,name", "topic_id", topics.map((row) => row.id));
        const sessions = await select("academia_sessions", "id,subtopic_id,title,description,video_url", "subtopic_id", subtopics.map((row) => row.id));
        const activities = await select(
          "academia_activities",
          "id,session_id,title,kind,subsection_id,question_key,question_design,practice_video,play_video,thumbnail_path,question_image_path,game_id,updated_at",
          "session_id", sessions.map((row) => row.id),
        );
        const subsections = await select("notebook_subsections", "id,section_id,floating_lines", "id", activities.map((row) => row.subsection_id).filter(Boolean), null);
        const sections = await select("notebook_sections", "id,notebook_id", "id", subsections.map((row) => row.section_id).filter(Boolean), null);
        const problemBlocks = await select("notebook_blocks", "subsection_id,kind,content_ascii", "subsection_id", subsections.map((row) => row.id), null);
        const problemBySub: Record<string, string> = {};
        for (const block of problemBlocks) if (block.kind === "problem" && block.subsection_id) problemBySub[block.subsection_id] = String(block.content_ascii ?? "");
        const gameRows = await select("slate_games", "*", "id", activities.map((row) => row.game_id).filter(Boolean), null);
        const subsectionMap = Object.fromEntries(subsections.map((row) => [row.id, row]));
        const sectionMap = Object.fromEntries(sections.map((row) => [row.id, row]));
        const gameMap = Object.fromEntries(gameRows.map((row) => [row.id, row]));

        const activitiesFor = (sessionId: string) => activities
          .filter((row) => row.session_id === sessionId && row.kind !== "game")
          .map((activity) => {
            const subsection = subsectionMap[activity.subsection_id] as Row | undefined;
            const lines = parseLines(subsection?.floating_lines, activity.question_key);
            const notebookId = subsection ? (sectionMap[subsection.section_id] as Row | undefined)?.notebook_id : null;
            const board = compileOfflineBoard({
              activityId: String(activity.id), subsectionId: String(activity.subsection_id), notebookId: notebookId ? String(notebookId) : null,
              title: String(activity.title ?? "Activity"), lines,
              questionText: problemBySub[activity.subsection_id] ?? null,
            });
            const game = activity.game_id && gameMap[activity.game_id] && board ? gameFromRow(gameMap[activity.game_id]) : null;
            const practiceVideo = video(activity.practice_video);
            const playVideo = video(activity.play_video);
            return {
              id: activity.id, title: activity.title, lines,
              board, questionText: board?.questionText ?? null,
              questionDesign: activity.question_design ?? null,
              imageUrl: mediaUrl(activity.question_image_path ?? activity.thumbnail_path),
              practiceVideo, playVideo,
              practiceVideoUrl: practiceVideo?.videoPath ?? null,
              playVideoUrl: playVideo?.videoPath ?? null,
              videoUrl: practiceVideo?.videoPath ?? playVideo?.videoPath ?? null,
              videoSegments: practiceVideo?.segments ?? playVideo?.segments ?? [],
              game: game && board ? {
                game, board, startingLives: Math.max(1, Number(game.status?.lives) || 3),
                assetUrls: Object.fromEntries(gameAssetIds(game).map((id) => [id, gameAssetUrl(String(activity.id), id)])),
              } : null,
            };
          });

        const schools = academias.map((academia) => ({
          id: academia.id, name: academia.name,
          schoolName: orgs.find((org) => org.id === academia.org_id)?.name ?? "", description: academia.description ?? null,
          classes: classes.filter((row) => row.academia_id === academia.id).map((classRow) => ({
            id: classRow.id, name: classRow.name,
            subjects: subjects.filter((row) => row.class_id === classRow.id).map((subject) => ({
              id: subject.id, name: subject.name,
              topics: topics.filter((row) => row.subject_id === subject.id).map((topic) => ({
                id: topic.id, name: topic.name,
                subtopics: subtopics.filter((row) => row.topic_id === topic.id).map((subtopic) => ({
                  id: subtopic.id, name: subtopic.name,
                  sessions: sessions.filter((row) => row.subtopic_id === subtopic.id).map((session) => ({
                    id: session.id, title: session.title, description: session.description ?? null, videoUrl: session.video_url ?? null,
                    activities: activitiesFor(session.id),
                  })),
                })),
              })),
            })),
          })),
        }));
        const version = [...academias.map((row) => row.updated_at), ...activities.map((row) => row.updated_at)].sort().pop() ?? "0";
        return Response.json({ schema: ACADEMIA_PACK_SCHEMA, version, schools }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});