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
            .select("id, title, questions, total_marks")
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
          if (link.kind !== "course" || !path) return json({ error: "bad_request" }, 400);
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
          .select("id, title, total_marks, questions")
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
    },
  },
});
