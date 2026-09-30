/**
 * Guest Link — the public read surface for one shared Course or Assignment Card.
 *
 * ONE ORIGINAL RESOURCE, UNLIMITED GUESTS. Nothing here duplicates a course, a
 * question, a video or a storage object: the link resolves the ORIGINAL rows and
 * signs the ORIGINAL media. Guests never touch student tables — their marks are
 * written to `guest_attempts` by the marking engine.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const BUCKET = "course-media";
const GAME_BUCKET = "game-assets";
const ACADEMIA_BUCKET = "academia-media";

export const Route = createFileRoute("/api/public/guest/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as never as {
          from: (t: string) => any;
          storage: { from: (b: string) => any };
        };
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "payload";
        const code = String(params.slug ?? "").trim();
        if (!code) return json({ error: "not_found" }, 404);

        const { data: link } = await admin
          .from("guest_links")
          .select("id, kind, resource_id, class_id, title, enabled, ask_name")
          .eq("code", code)
          .maybeSingle();
        if (!link) return json({ error: "not_found" }, 404);
        if (!link.enabled) return json({ error: "disabled" }, 403);

        // ── A shared Game card: the saved world + this class's Levels ───────
        if (link.kind === "game" && action === "payload") {
          const [{ withDb }, { loadGame }, { loadGameBoards }, { loadGameAssignmentState }] =
            await Promise.all([
              import("@/lib/db/scope"),
              import("@/lib/slate/storage"),
              import("@/lib/slate/gameBoard"),
              import("@/lib/slate/gameAssignments"),
            ]);
          const result = await withDb(admin, async () => {
            const game = await loadGame(link.resource_id);
            if (!game || !link.class_id) return null;
            const boards = await loadGameBoards({ gameId: link.resource_id, classId: link.class_id });
            const assignment = (await loadGameAssignmentState(link.resource_id)).get(link.class_id) ?? null;
            return { game, boards, assignment };
          });
          if (!result) return json({ error: "not_found" }, 404);
          if (result.boards.length === 0) return json({ error: "not_ready" }, 404);
          const assetPaths = new Set<string>();
          const addAsset = (path: unknown) => {
            if (typeof path === "string" && path.includes("/") && !/^https?:\/\//i.test(path)) assetPaths.add(path);
          };
          addAsset(result.game.background?.assetId);
          addAsset(result.game.settings.assets?.sun?.assetId);
          result.game.settings.assets?.audio?.forEach((track) => addAsset(track.assetId));
          addAsset(result.game.settings.sound?.background?.ref?.path);
          Object.values(result.game.settings.sound?.rewards ?? {}).forEach((slot) => addAsset(slot?.ref?.path));
          const assetUrls: Record<string, string> = {};
          await Promise.all(Array.from(assetPaths).map(async (path) => {
            const { data } = await admin.storage.from(GAME_BUCKET).createSignedUrl(path, 60 * 60 * 4);
            if (data?.signedUrl) assetUrls[path] = data.signedUrl;
          }));
          return json({
            kind: "game",
            askName: link.ask_name,
            title: link.title ?? result.game.name,
            classId: link.class_id,
            assetUrls,
            ...result,
          });
        }

        // ── One isolated Academia Session: no sibling hierarchy is exposed. ─
        if (link.kind === "academia_session" && action === "payload") {
          const { data: session } = await admin.from("academia_sessions")
            .select("id,title,description,video_url")
            .eq("id", link.resource_id).maybeSingle();
          if (!session) return json({ error: "not_found" }, 404);
          const { data: rows } = await admin.from("academia_activities")
            .select("id,title,assessment_id,game_id,class_id,subsection_id,practice_video,play_video")
            .eq("session_id", session.id).eq("kind", "question").order("position");
          const activities = await Promise.all((rows ?? []).map(async (activity: any) => {
            const { data: assessment } = activity.assessment_id
              ? await admin.from("assessments").select("id,title,questions,total_marks,timer_enabled,permanent_achievement_color,current_attempt_color").eq("id", activity.assessment_id).maybeSingle()
              : { data: null };
            let gamePayload = null;
            if (activity.game_id && activity.class_id) {
              const [{ withDb }, { loadGame }, { loadGameBoards }, { loadGameAssignmentState }] = await Promise.all([
                import("@/lib/db/scope"), import("@/lib/slate/storage"), import("@/lib/slate/gameBoard"), import("@/lib/slate/gameAssignments"),
              ]);
              const result = await withDb(admin, async () => ({
                game: await loadGame(activity.game_id),
                boards: await loadGameBoards({ gameId: activity.game_id, classId: activity.class_id }),
                assignment: (await loadGameAssignmentState(activity.game_id)).get(activity.class_id) ?? null,
              }));
              const boards = result.boards.filter((board) => board.subsectionId === activity.subsection_id);
              if (result.game && boards.length) {
                const paths = new Set<string>();
                const add = (value: unknown) => { if (typeof value === "string" && value.includes("/") && !/^https?:\/\//i.test(value)) paths.add(value); };
                add(result.game.background?.assetId);
                add(result.game.settings.assets?.sun?.assetId);
                result.game.settings.assets?.audio?.forEach((track: any) => add(track.assetId));
                add(result.game.settings.sound?.background?.ref?.path);
                Object.values(result.game.settings.sound?.rewards ?? {}).forEach((slot: any) => add(slot?.ref?.path));
                const assetUrls: Record<string, string> = {};
                await Promise.all(Array.from(paths).map(async (path) => {
                  const { data } = await admin.storage.from(GAME_BUCKET).createSignedUrl(path, 60 * 60 * 4);
                  if (data?.signedUrl) assetUrls[path] = data.signedUrl;
                }));
                gamePayload = { kind: "game", askName: link.ask_name, title: activity.title, classId: activity.class_id, assetUrls, ...result, boards };
              }
            }
            return { id: activity.id, title: activity.title, assessment, practiceVideo: activity.practice_video, playVideo: activity.play_video, gamePayload };
          }));
          return json({ kind: "academia_session", askName: link.ask_name, title: link.title ?? session.title, description: session.description, videoUrl: session.video_url, activities });
        }

        // ── One exercise card's compiled questions ───────────────────────────
        if (action === "exercise") {
          const blockId = url.searchParams.get("blockId") ?? "";
          if (link.kind !== "course" || !blockId) return json({ error: "bad_request" }, 400);
          const { data: block } = await admin
            .from("course_blocks")
            .select("id, section_id, config")
            .eq("id", blockId)
            .maybeSingle();
          if (!block) return json({ error: "not_found" }, 404);
          const { data: section } = await admin
            .from("course_sections")
            .select("course_id")
            .eq("id", block.section_id)
            .maybeSingle();
          if (section?.course_id !== link.resource_id) return json({ error: "not_found" }, 404);
          const { data: rows } = await admin
            .from("assessments")
            .select("id, title, questions, total_marks, timer_enabled, permanent_achievement_color, current_attempt_color")
            .eq("kind", "course_exercise_guest")
            .eq("question_key", blockId)
            .order("created_at", { ascending: true })
            .limit(1);
          const assessment = (rows ?? [])[0];
          if (!assessment) return json({ error: "not_ready" }, 404);
          return json({ assessment });
        }

        // ── The teaching video record for ONE exercise question ─────────────
        // A reference only: the single original video path plus its line
        // ranges. Nothing is duplicated for a guest.
        if (action === "video") {
          const blockId = url.searchParams.get("blockId") ?? "";
          const questionId = url.searchParams.get("questionId") ?? "";
          if (link.kind !== "course" || !blockId || !questionId) return json({ error: "bad_request" }, 400);
          const { data: block } = await admin
            .from("course_blocks")
            .select("id, section_id, config")
            .eq("id", blockId)
            .maybeSingle();
          if (!block) return json({ error: "not_found" }, 404);
          const { data: section } = await admin
            .from("course_sections")
            .select("course_id")
            .eq("id", block.section_id)
            .maybeSingle();
          if (section?.course_id !== link.resource_id) return json({ error: "not_found" }, 404);
          const map = (block.config?.questionVideos ?? {}) as Record<string, unknown>;
          return json({ video: map[questionId] ?? null });
        }



        // ── Signed URL for an ORIGINAL course media object ───────────────────
        if (action === "media") {
          const path = url.searchParams.get("path") ?? "";
          if ((link.kind !== "course" && link.kind !== "academia_session") || !path) return json({ error: "bad_request" }, 400);
          if (link.kind === "academia_session") {
            const { data: session } = await admin.from("academia_sessions").select("subtopic_id").eq("id", link.resource_id).maybeSingle();
            const { data: subtopic } = session ? await admin.from("academia_subtopics").select("topic_id").eq("id", session.subtopic_id).maybeSingle() : { data: null };
            const { data: topic } = subtopic ? await admin.from("academia_topics").select("subject_id").eq("id", subtopic.topic_id).maybeSingle() : { data: null };
            const { data: subject } = topic ? await admin.from("academia_subjects").select("class_id").eq("id", topic.subject_id).maybeSingle() : { data: null };
            const { data: klass } = subject ? await admin.from("academia_classes").select("academia_id").eq("id", subject.class_id).maybeSingle() : { data: null };
            if (!klass?.academia_id || !path.startsWith(`${klass.academia_id}/`)) return json({ error: "forbidden" }, 403);
            const { data: signed } = await admin.storage.from(ACADEMIA_BUCKET).createSignedUrl(path, 60 * 60 * 4);
            return signed?.signedUrl ? json({ url: signed.signedUrl }) : json({ error: "unavailable" }, 404);
          }
          // The path must belong to this course (…/<owner>/<courseId>/<file>).
          if (!path.split("/").includes(String(link.resource_id))) {
            const { data: course } = await admin
              .from("courses")
              .select("background_url")
              .eq("id", link.resource_id)
              .maybeSingle();
            if (course?.background_url !== path) return json({ error: "forbidden" }, 403);
          }
          const { data: signed } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(path, 60 * 60 * 4);
          if (!signed?.signedUrl) return json({ error: "unavailable" }, 404);
          return json({ url: signed.signedUrl });
        }

        // ── This guest's own marks (seed the board) ──────────────────────────
        if (action === "progress") {
          const token = url.searchParams.get("token") ?? "";
          if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ attempts: [] });
          const { data: attempts } = await admin
            .from("guest_attempts")
            .select("assessment_id, solved_lines, score, total_marks, status")
            .eq("link_id", link.id)
            .eq("guest_token", token);
          return json({ attempts: attempts ?? [] });
        }

        // ── The link payload ────────────────────────────────────────────────
        if (link.kind === "course") {
          const { data: course } = await admin
            .from("courses")
            .select("*")
            .eq("id", link.resource_id)
            .maybeSingle();
          if (!course) return json({ error: "not_found" }, 404);
          const { data: sections } = await admin
            .from("course_sections")
            .select("*")
            .eq("course_id", course.id)
            .order("position", { ascending: true });
          const sectionIds = (sections ?? []).map((s: { id: string }) => s.id);
          const { data: blocks } = sectionIds.length
            ? await admin
                .from("course_blocks")
                .select("*")
                .in("section_id", sectionIds)
                .order("position", { ascending: true })
            : { data: [] };
          const blockIds = (blocks ?? []).map((b: { id: string }) => b.id);
          const { data: questions } = blockIds.length
            ? await admin
                .from("course_exercise_questions")
                .select("*")
                .in("block_id", blockIds)
                .order("position", { ascending: true })
            : { data: [] };
          return json({
            kind: "course",
            askName: link.ask_name,
            title: link.title ?? course.title,
            tree: { course, sections: sections ?? [], blocks: blocks ?? [], questions: questions ?? [] },
          });
        }

        // Assignment Card = every question compiled from one lesson note.
        const { data: assessments } = await admin
          .from("assessments")
          .select("id, title, total_marks, questions, timer_enabled, permanent_achievement_color, current_attempt_color")
          .eq("class_id", link.class_id)
          .eq("notebook_id", link.resource_id)
          .is("unassigned_at", null)
          .order("created_at", { ascending: true });
        const list = assessments ?? [];
        if (list.length === 0) return json({ error: "not_ready" }, 404);
        const { data: notebook } = await admin
          .from("notebooks")
          .select("title, subject, subtopic")
          .eq("id", link.resource_id)
          .maybeSingle();
        return json({
          kind: "assignment",
          askName: link.ask_name,
          title: link.title ?? notebook?.title ?? "Assignment",
          subject: notebook?.subject ?? null,
          subtopic: notebook?.subtopic ?? null,
          assessments: list,
        });
      },

      // ── Guest heartbeat: "I am here, on this question" ──────────────────
      // Written on the guest's behalf so the teacher's Live guests list can
      // show who is working right now. No account, no student record.
      POST: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as never as { from: (t: string) => any };
        const code = String(params.slug ?? "").trim();
        if (!code) return json({ error: "not_found" }, 404);

        let body: Record<string, unknown> = {};
        try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty body */ }
        const token = String(body["token"] ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "bad_request" }, 400);

        const { data: link } = await admin
          .from("guest_links")
          .select("id, enabled")
          .eq("code", code)
          .maybeSingle();
        if (!link) return json({ error: "not_found" }, 404);
        if (!link.enabled) return json({ error: "disabled" }, 403);

        const name = typeof body["name"] === "string" ? String(body["name"]).slice(0, 40) : null;
        const assessmentId = typeof body["assessmentId"] === "string" ? body["assessmentId"] : null;
        const questionId = typeof body["questionId"] === "string" ? String(body["questionId"]).slice(0, 64) : null;

        const { data: attempts } = await admin
          .from("guest_attempts")
          .select("score, total_marks")
          .eq("link_id", link.id)
          .eq("guest_token", token);
        const score = (attempts ?? []).reduce((s: number, r: { score?: number }) => s + (Number(r.score) || 0), 0);
        const totalMarks = (attempts ?? []).reduce((s: number, r: { total_marks?: number }) => s + (Number(r.total_marks) || 0), 0);

        await admin
          .from("guest_presence")
          .upsert(
            {
              link_id: link.id,
              guest_token: token,
              guest_name: name,
              assessment_id: assessmentId,
              question_id: questionId,
              score,
              total_marks: totalMarks,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "link_id,guest_token" },
          );

        // ── Guest solving time (benchmark only) ──────────────────────────
        // A guest's valid time counts towards the question's Overall Best
        // Time. It never becomes student progress and carries no identity
        // into any class, dashboard or roster.
        const elapsedMs = Math.max(0, Math.floor(Number(body["elapsedMs"]) || 0));
        const completed = body["completed"] === true;
        if (assessmentId && questionId && elapsedMs > 0) {
          const { data: existing } = await admin
            .from("guest_question_times")
            .select("id, elapsed_ms, success")
            .eq("link_id", link.id)
            .eq("guest_token", token)
            .eq("assessment_id", assessmentId)
            .eq("question_id", questionId)
            .maybeSingle();
          if (!existing) {
            await admin.from("guest_question_times").insert({
              link_id: link.id,
              guest_token: token,
              assessment_id: assessmentId,
              question_id: questionId,
              elapsed_ms: elapsedMs,
              success: completed,
            });
          } else {
            // Keep the guest's FASTEST valid time; a slower one changes nothing.
            const prev = Number(existing.elapsed_ms) || 0;
            const keepFaster = existing.success && prev > 0 && prev <= elapsedMs;
            await admin
              .from("guest_question_times")
              .update({
                elapsed_ms: keepFaster ? prev : elapsedMs,
                success: existing.success || completed,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          }
        }
        return json({ ok: true });
      },


    },
  },
});
