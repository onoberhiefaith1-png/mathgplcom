import { adventureAssetUrl, adventureMediaPaths, copiedAdventureQuestion, offlineAdventureCanvas, sessionPaper } from "@/lib/offline/extendedActivities";
import { normalizeAudio } from "@/lib/academia/adventureMix";
import { blockQuestionObjects } from "@/lib/assessments/questionObjects";
import type { SolutionObject } from "@/lib/floating/solutionItems";
import { createFileRoute } from "@tanstack/react-router";
import { ACADEMIA_PACK_SCHEMA, compileOfflineBoard, gameAssetIds } from "@/lib/offline/academiaPack";
import type { QuestionVideoConfig } from "@/lib/courses/questionVideo";
import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import type { OfflinePackLine } from "@/lib/offline/academiaPack";
import { selectAll } from "@/lib/offline/packQuery";
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
      GET: async (ctx?: { request?: Request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const select = (table: string, columns: string, column: string, ids: string[], order: string | null = "position", tiebreak: string | null = "id") =>
          selectAll(db, table, columns, column, ids, order, tiebreak);
        const { data: rawAcademias, error: academiaError } = await db.from("academia").select("id,org_id,name,description,updated_at").eq("visibility", "public").limit(200);
        if (academiaError) throw new Error(academiaError.message);
        const academias: Row[] = rawAcademias ?? [];
        const orgs = await select("organizations", "id,name", "id", academias.map((a) => a.org_id), null);
        const classes = await select("academia_classes", "id,academia_id,name", "academia_id", academias.map((a) => a.id));
        const subjects = await select("academia_subjects", "id,class_id,name", "class_id", classes.map((row) => row.id));
        const topics = await select("academia_topics", "id,subject_id,name", "subject_id", subjects.map((row) => row.id));
        const subtopics = await select("academia_subtopics", "id,topic_id,name", "topic_id", topics.map((row) => row.id));
        const sessions = await select("academia_sessions", "id,subtopic_id,title,description,video_url", "subtopic_id", subtopics.map((row) => row.id));
        const activities = await select(
          "academia_activities",
          "id,session_id,title,kind,ref_id,audio,subsection_id,question_key,question_design,practice_video,play_video,thumbnail_path,question_image_path,game_id,updated_at",
          "session_id", sessions.map((row) => row.id),
        );
        const mcqIds = activities.filter((r) => r.kind === "mcq").map((r) => r.id);
        const adventureActivities = activities.filter((r) => r.kind === "adventure");
        // Load independent content together to keep the full pack within the download deadline.
        const [paperRows, items, adventureRows, adventureQuestions, passMarks, subsections, gameRows] = await Promise.all([
          select("academia_mcq_papers", "id,subject_id,title,questions", "subject_id", subjects.map((r) => r.id)),
          select("academia_mcq_items", "activity_id,n,text,options,answer", "activity_id", mcqIds),
          select("games", "id,canvas,updated_at", "id", adventureActivities.map((r) => r.ref_id).filter(Boolean), null),
          select("academia_adventure_questions", "id,activity_id,scene_id,bar_id,position,title,question_text,lines,objects,total_marks,subsection_id,notebook_id", "activity_id", adventureActivities.map((r) => r.id)),
          select("academia_adventure_points", "activity_id,scene_id,pass_pct", "activity_id", adventureActivities.map((r) => r.id), null, "scene_id"),
          select("notebook_subsections", "id,section_id,floating_lines", "id", activities.map((row) => row.subsection_id).filter(Boolean), null),
          select("slate_games", "*", "id", activities.map((row) => row.game_id).filter(Boolean), null),
        ]);
        const papers = paperRows.map((p) => ({ id: String(p.id), subject_id: String(p.subject_id), title: String(p.title ?? "Questions"), questions: Array.isArray(p.questions) ? p.questions : [] }));
        const [sections, problemBlocks] = await Promise.all([
          select("notebook_sections", "id,notebook_id", "id", subsections.map((row) => row.section_id).filter(Boolean), null),
          select("notebook_blocks", "subsection_id,kind,content_ascii,content_json,order_index", "subsection_id", subsections.map((row) => row.id), null),
        ]);
        const problemBySub: Record<string, string> = {};
        for (const block of problemBlocks) if (block.kind === "problem" && block.subsection_id) problemBySub[block.subsection_id] = String(block.content_ascii ?? "");
        // Question diagrams travel with the question; diagrams drawn inside a
        // Solution travel as notes on the line they follow.
        const objectsBySub: Record<string, SolutionObject[]> = {};
        for (const block of [...problemBlocks].sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))) {
          if (!block.subsection_id || (block.kind !== "problem" && block.kind !== "solution")) continue;
          const found = blockQuestionObjects(block.content_json).map((o) => block.kind === "solution" ? { ...o, inSolution: true } : o);
          if (found.length) objectsBySub[block.subsection_id] = [...(objectsBySub[block.subsection_id] ?? []), ...found];
        }
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
              objects: objectsBySub[activity.subsection_id] ?? null,
            });
            const game = activity.game_id && gameMap[activity.game_id] && board ? gameFromRow(gameMap[activity.game_id]) : null;
            const adventureRow = adventureRows.find((r) => r.id === activity.ref_id);
            const adventureGame = activity.kind === "adventure" && gameMap[activity.game_id] ? gameFromRow(gameMap[activity.game_id]) : null;
            const audio = normalizeAudio(activity.audio);
            const adventure = activity.kind === "adventure" && adventureRow ? {
              id: adventureRow.id, canvas: offlineAdventureCanvas(activity.id, adventureRow.canvas),
              questions: adventureQuestions.filter((q) => q.activity_id === activity.id).map(copiedAdventureQuestion),
              pass: Object.fromEntries(passMarks.filter((p) => p.activity_id === activity.id).map((p) => [p.scene_id, p.pass_pct])),
              game: adventureGame,
              audio: { ...audio, music: audio.music ? { ...audio.music, path: adventureAssetUrl(activity.id, audio.music.path) } : null },
              assetUrls: Object.fromEntries([
                ...(adventureGame ? gameAssetIds(adventureGame).map((id) => [id, gameAssetUrl(activity.id, id)]) : []),
                ...adventureMediaPaths(adventureRow.canvas, activity.audio).map((id) => [id, adventureAssetUrl(activity.id, id)]),
              ]),
            } : null;
            const practiceVideo = video(activity.practice_video);
            const playVideo = video(activity.play_video);
            return {
              id: activity.id, title: activity.title, kind: activity.kind, lines, adventure,
              mcq: activity.kind === "mcq" ? sessionPaper(activity, items, papers) : null,
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
              id: subject.id, name: subject.name, papers: papers.filter((p) => p.subject_id === subject.id),
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
        // Include edits to copied questions and paper answers even when the activity timestamp is unchanged.
        const bytes = new TextEncoder().encode(JSON.stringify(schools));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const version = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
        // `?versionOnly=1` lets the installed app ask "has anything changed?" without downloading the pack.
        if (ctx?.request && new URL(ctx.request.url).searchParams.get("versionOnly") === "1")
          return Response.json({ schema: ACADEMIA_PACK_SCHEMA, version }, { headers: { "cache-control": "no-store" } });
        return Response.json({ schema: ACADEMIA_PACK_SCHEMA, version, schools }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});