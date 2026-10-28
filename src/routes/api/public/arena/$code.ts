import { overallChampionship } from "@/lib/arena/championship";
/* eslint-disable @typescript-eslint/no-explicit-any -- rows from the untyped service-role client */
/**
 * Timer Arena — public surface for ONE participation group.
 *
 * The student code (`TA…`) lets a device join, time and read its own position.
 * The display code (`TD…`) is read-only: champions and Top 5 only.
 * Every query is scoped to the single share the code resolves to, so two
 * teachers' groups on the same Session never mix.
 */
import { reportQuestions, resolveReportQuestion, type ReportQuestion } from "@/lib/arena/questionCatalogue";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  bestPerParticipant, cleanDisplayName, isStrictlyFaster, myPosition, normaliseEntry, rankBests, verifiedElapsed,
  ARENA_AVATARS, type ArenaBest,
} from "@/lib/arena/ranking";
import { arenaPhotoPath, MAX_PHOTO_CHARS, validatePhotoDataUrl } from "@/lib/arena/photo";
import { ACTIVE_WINDOW_MS, countPresence, latestSeen, presenceOf, sortParticipants } from "@/lib/arena/presence";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type Admin = { from: (t: string) => any; rpc: (name:string,args:Record<string,unknown>)=>any };

const loadShare = async (admin: Admin, code: string) => {
  const col = code.startsWith("TD") ? "display_code" : "code";
  const { data } = await admin
    .from("arena_shares")
    .select("id, code, display_code, source_id, guest_code, title, entry_config, status, created_at")
    .eq(col, code)
    .maybeSingle();
  return data ? { ...data, isDisplay: col === "display_code" } : null;
};

/** The Session's question cards in Session order, plus the breadcrumb. */
const loadQuestionsFresh = async (admin: Admin, sessionId: string) => {
  const { data: session } = await admin.from("academia_sessions").select("id, title, subtopic_id").eq("id", sessionId).maybeSingle();
  const { data: rows } = await admin
    .from("academia_activities")
    .select("id, title, kind, assessment_id, class_id, subsection_id, position")
    .eq("session_id", sessionId)
    .order("position");
  const ids = (rows ?? []).map((r: any) => r.id);
  const [{data: items}, {data: adventure}] = await Promise.all([
    admin.from("academia_mcq_items").select("id,activity_id,n,text,position").in("activity_id",ids).order("position"),
    admin.from("academia_adventure_questions").select("id,activity_id,title,position").in("activity_id",ids).order("position"),
  ]);
  const questions = reportQuestions(rows ?? [], items ?? [], adventure ?? []);
  const boards=(rows??[]).filter((r:any)=>r.kind==="question"&&r.class_id&&r.subsection_id);
  if(boards.length){
    const {data:play}=await admin.from("assessments").select("id,class_id,question_key").eq("kind","game").in("class_id",boards.map((r:any)=>r.class_id)).in("question_key",boards.map((r:any)=>r.subsection_id));
    for(const q of questions){const a=boards.find((r:any)=>r.id===q.activityId);if(a)q.aliases=(play??[]).filter((g:any)=>g.class_id===a.class_id&&g.question_key===a.subsection_id).map((g:any)=>g.id);}
  }
  const crumbs: Record<string, string | null> = { school: null, class: null, subject: null, topic: null, subtopic: null };
  try {
    const { data: st } = await admin.from("academia_subtopics").select("name, topic_id").eq("id", session?.subtopic_id).maybeSingle();
    crumbs["subtopic"] = st?.name ?? null;
    const { data: tp } = await admin.from("academia_topics").select("name, subject_id").eq("id", st?.topic_id).maybeSingle();
    crumbs["topic"] = tp?.name ?? null;
    const { data: sj } = await admin.from("academia_subjects").select("name, class_id").eq("id", tp?.subject_id).maybeSingle();
    crumbs["subject"] = sj?.name ?? null;
    const { data: cl } = await admin.from("academia_classes").select("name, academia_id").eq("id", sj?.class_id).maybeSingle();
    crumbs["class"] = cl?.name ?? null;
    const { data: ac } = await admin.from("academia").select("name").eq("id", cl?.academia_id).maybeSingle();
    crumbs["school"] = ac?.name ?? null;
  } catch { /* breadcrumb is decoration */ }
  return { sessionTitle: (session?.title as string) ?? "Session", questions, crumbs };
};

// The Session's cards rarely change while a board is open, but results do — so
// only this slow part is cached (30s); every ranking is read fresh each time.
type Q = ReportQuestion;
type Meta = Awaited<ReturnType<typeof loadQuestionsFresh>> & { questions: Q[] };
const META_TTL_MS = 30_000;
const metaCache = new Map<string, { at: number; meta: Meta }>();
const loadQuestions = async (admin: Admin, sessionId: string): Promise<Meta> => {
  const hit = metaCache.get(sessionId);
  if (hit && Date.now() - hit.at < META_TTL_MS) return hit.meta;
  const meta = await loadQuestionsFresh(admin, sessionId);
  metaCache.set(sessionId, { at: Date.now(), meta });
  if (metaCache.size > 200) metaCache.delete(metaCache.keys().next().value as string);
  return meta;
};

const toBest = (r: any): ArenaBest => ({
  participantId: r.participant_id, bestMs: Number(r.best_ms), achievedAt: r.achieved_at, attemptId: r.attempt_id,
});

const LATE_START_MIN_MS = 1;
const PEOPLE_BASE = "id, device_token, display_name, anon_label, avatar_key, last_seen_at, joined_at";
const PEOPLE_CAP = 300;

// Pictures live in two columns added by drizzle/migrations/0018. Until that
// migration is applied the board must keep working without them.
let photoColumns: boolean | null = null;
let photoProbeAt = 0;
const photoColumnsMissing = (message: string | undefined) => /avatar_photo/i.test(message ?? "");
const canUsePhotoColumns = () => photoColumns !== false || Date.now() - photoProbeAt > 60_000;
const notePhotoColumns = (ok: boolean) => { photoColumns = ok; photoProbeAt = Date.now(); };

const loadPeople = async (admin: Admin, shareId: string) => {
  if (canUsePhotoColumns()) {
    const r = await admin.from("arena_participants").select(`${PEOPLE_BASE}, avatar_photo_at`).eq("share_id", shareId).limit(50000);
    if (!r.error) { notePhotoColumns(true); return (r.data ?? []) as any[]; }
    if (photoColumnsMissing(r.error.message)) notePhotoColumns(false);
  }
  const r = await admin.from("arena_participants").select(PEOPLE_BASE).eq("share_id", shareId).limit(50000);
  return (r.data ?? []) as any[];
};

const snapshot = async (admin: Admin, share: any, code: string) => {
  const meta = await loadQuestions(admin, share.source_id);
  const { data: link } = await admin.from("guest_links").select("id").eq("code", share.guest_code).maybeSingle();
  const [{ data: bests }, people, { data: open }, { data: seen }] = await Promise.all([
    admin.from("arena_bests").select("participant_id, assessment_id, best_ms, achieved_at, attempt_id").eq("share_id", share.id).limit(50000),
    loadPeople(admin, share.id),
    admin.from("arena_attempts").select("participant_id, assessment_id, started_at").eq("share_id", share.id).is("completed_at", null).order("started_at", { ascending: false }).limit(5000),
    // The Session's own guest heartbeat (15s) also proves a student is here.
    link ? admin.from("guest_presence").select("guest_token, last_seen_at").eq("link_id", link.id).limit(50000) : Promise.resolve({ data: [] }),
  ]);
  const nowMs = Date.now();
  const byId = new Map<string, any>(people.map((p: any) => [p.id, p]));
  const guestSeen = new Map<string, string>((seen ?? []).map((g: any) => [g.guest_token, g.last_seen_at]));
  const photoOf = (p: any) => (p?.avatar_photo_at ? arenaPhotoPath(code, p.id, Date.parse(p.avatar_photo_at)) : null);
  const numberOf = new Map<string, number>(meta.questions.map((q: Q) => [q.assessmentId, q.number]));

  const rankedBy = new Map<string, number>();
  const columns = meta.questions.map((q: Q) => {
    const sorted = rankBests(bestPerParticipant((bests ?? []).filter((b: any) => b.assessment_id === q.assessmentId).map(toBest)));
    for (const r of sorted) rankedBy.set(r.participantId, (rankedBy.get(r.participantId) ?? 0) + 1);
    return {
      ...q,
      rankedCount: sorted.length,
      photosEnabled: normaliseEntry(share.entry_config).photo !== "off",
      top: sorted.map((b, i) => {
        const p = byId.get(b.participantId);
        return { participantId: b.participantId, attemptId: b.attemptId, place: i + 1, name: p?.display_name || p?.anon_label || "Learner", avatar: p?.avatar_key ?? null, photo: photoOf(p), ms: b.bestMs, achievedAt: b.achievedAt };
      }),
    };
  });

  const overall = overallChampionship(columns);

  const workingOn = new Map<string, number>();
  for (const o of (open ?? []) as any[]) if (!workingOn.has(o.participant_id)) workingOn.set(o.participant_id, numberOf.get(o.assessment_id) ?? 0);

  const rows = people.map((p: any) => {
    const lastSeenAt = latestSeen(p.last_seen_at, guestSeen.get(p.device_token));
    const presence = presenceOf(lastSeenAt, nowMs, ACTIVE_WINDOW_MS);
    return {
      id: p.id as string,
      photosEnabled: normaliseEntry(share.entry_config).photo !== "off",
      name: (p.display_name || p.anon_label || "Learner") as string,
      avatar: (p.avatar_key ?? null) as string | null,
      photo: photoOf(p),
      presence,
      lastSeenAt,
      working: presence === "active" ? workingOn.get(p.id) || null : null,
      ranked: rankedBy.get(p.id) ?? 0,
      joinedAt: p.joined_at ? Date.parse(p.joined_at) : null,
    };
  });
  const counts = countPresence(rows);
  const ranked = new Set((bests ?? []).map((b: any) => b.participant_id)).size;
  return {
    title: share.title, status: share.status, sessionTitle: meta.sessionTitle, crumbs: meta.crumbs,
    generatedAt: new Date(nowMs).toISOString(),
    joined: counts.joined, online: counts.active, active: counts.active, inactive: counts.inactive,
    activeWindowMs: ACTIVE_WINDOW_MS,
    rankedParticipants: ranked, columns,
    overallChampions: overall.slice(0, 3), completedAll: overall.length,
    participants: sortParticipants(rows).slice(0, PEOPLE_CAP), participantsTotal: rows.length,
  };
};

/** Best-effort live nudge so open reports re-read their snapshot. */
const broadcast = async (shareId: string, kind: "best" | "join" | "start", assessmentId?: string) => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return;
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages: [{ topic: `arena:${shareId}`, event: "update", payload: { kind, assessmentId: assessmentId ?? null } }] }),
    });
  } catch { /* the report also polls every few seconds, so a missed nudge only costs seconds */ }
};

const Body = z.object({
  action: z.enum(["join", "start", "complete", "beat"]),
  token: z.string().uuid(),
  name: z.string().max(40).nullish(),
  avatar: z.string().max(20).nullish(),
  /** A pre-shrunk square picture (data URL). Validated again by validatePhotoDataUrl. */
  photo: z.string().max(MAX_PHOTO_CHARS).nullish(),
  assessmentId: z.string().uuid().optional(),
  questionId: z.string().max(64).optional(),
  working: z.record(z.string().max(10000)).optional(),
  answer: z.string().max(20).optional(),
  completedQuestions: z.array(z.string().uuid()).max(1000).optional(),
  elapsedMs: z.number().min(0).max(86_400_000).optional(),
});

export const Route = createFileRoute("/api/public/arena/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as never as Admin;
        const code = String(params.code ?? "").trim().toUpperCase();
        if (!/^T[AD][A-Z0-9]{8,16}$/.test(code)) return json({ error: "not_found" }, 404);
        const share = await loadShare(admin, code);
        if (!share) return json({ error: "not_found" }, 404);
        const action = new URL(request.url).searchParams.get("action") ?? "info";

        if (action === "info" && !share.isDisplay) {
          return json({
            shareId: share.id, title: share.title, status: share.status, guestCode: share.guest_code,
            entry: normaliseEntry(share.entry_config), avatars: ARENA_AVATARS.map((a) => a.key),
          });
        }
        if(action === "progress" && !share.isDisplay) {
          const token=new URL(request.url).searchParams.get("token")??"";
          if(!z.string().uuid().safeParse(token).success)return json({error:"bad_request"},400);
          const {data: me}=await admin.from("arena_participants").select("id").eq("share_id",share.id).eq("device_token",token).maybeSingle();
          if(!me)return json({bests:[]});
          const {data:bests}=await admin.from("arena_bests").select("assessment_id,best_ms").eq("share_id",share.id).eq("participant_id",me.id);
          return json({bests:bests??[]});
        }
        if (action === "board") return json({ shareId: share.id, ...(await snapshot(admin, share, code)) });

        // A stored picture: only ever our own validated bytes, never a URL.
        if (action === "photo") {
          const pid = new URL(request.url).searchParams.get("p") ?? "";
          if (!z.string().uuid().safeParse(pid).success) return json({ error: "bad_request" }, 400);
          const { data: row, error } = await admin.from("arena_participants").select("avatar_photo").eq("id", pid).eq("share_id", share.id).maybeSingle();
          if (error && photoColumnsMissing(error.message)) notePhotoColumns(false);
          const check = validatePhotoDataUrl(row?.avatar_photo);
          if (!row || !check.ok) return json({ error: "not_found" }, 404);
          const bin = atob(String(row.avatar_photo).split(",")[1]!);
          const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
          return new Response(bytes as unknown as BodyInit, {
            headers: {
              "Content-Type": check.mime,
              "Cache-Control": "public, max-age=3600",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; sandbox",
              "Cross-Origin-Resource-Policy": "same-origin",
            },
          });
        }

        if (action === "me" && !share.isDisplay) {
          const token = new URL(request.url).searchParams.get("token") ?? "";
          const requestedId = new URL(request.url).searchParams.get("assessmentId") ?? "";
          const assessmentId = resolveReportQuestion((await loadQuestions(admin,share.source_id)).questions,requestedId)?.assessmentId ?? requestedId;
          if (!z.string().uuid().safeParse(token).success || !z.string().uuid().safeParse(assessmentId).success) return json({ error: "bad_request" }, 400);
          const { data: me } = await admin.from("arena_participants").select("id, display_name, anon_label, avatar_key").eq("share_id", share.id).eq("device_token", token).maybeSingle();
          let mePhoto: string | null = null;
          if (me && canUsePhotoColumns()) {
            const pr = await admin.from("arena_participants").select("avatar_photo_at").eq("id", me.id).maybeSingle();
            if (pr.error && photoColumnsMissing(pr.error.message)) notePhotoColumns(false);
            else if (pr.data?.avatar_photo_at) mePhoto = arenaPhotoPath(code, me.id, Date.parse(pr.data.avatar_photo_at));
          }
          const [{ data: rows }, { count: joined }] = await Promise.all([
            admin.from("arena_bests").select("participant_id, best_ms, achieved_at, attempt_id").eq("share_id", share.id).eq("assessment_id", assessmentId).limit(50000),
            admin.from("arena_participants").select("id", { count: "exact", head: true }).eq("share_id", share.id),
          ]);
          const sorted = rankBests(bestPerParticipant((rows ?? []).map(toBest)));
          const mine = me ? sorted.find((b) => b.participantId === me.id) : undefined;
          return json({
            joined: joined ?? 0,
            name: me ? me.display_name || me.anon_label : null,
            avatar: me?.avatar_key ?? null,
            photo: mePhoto,
            myBestMs: mine?.bestMs ?? null,
            overallBestMs: sorted[0]?.bestMs ?? null,
            position: me ? myPosition(sorted, me.id) : { ranked: false, rankedCount: sorted.length },
          });
        }
        return json({ error: "bad_request" }, 400);
      },

      POST: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as never as Admin;
        const code = String(params.code ?? "").trim().toUpperCase();
        if (!/^TA[A-Z0-9]{8,16}$/.test(code)) return json({ error: "not_found" }, 404);
        const share = await loadShare(admin, code);
        if (!share) return json({ error: "not_found" }, 404);
        if (share.status !== "open") return json({ error: "closed" }, 403);
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "bad_request" }, 400);
        const body = parsed.data;
        const entry = normaliseEntry(share.entry_config);

        const { data: existing } = await admin
          .from("arena_participants")
          .select("id, anon_label, display_name, avatar_key, joined_at")
          .eq("share_id", share.id)
          .eq("device_token", body.token)
          .maybeSingle();

        if (body.action === "join") {
          let displayName: string | null = null;
          if (entry.name !== "off" && body.name) {
            displayName = cleanDisplayName(body.name);
            if (!displayName) return json({ error: "name_rejected" }, 422);
          }
          if (entry.name === "required" && !displayName) return json({ error: "name_required" }, 422);
          const avatar = entry.photo !== "off" && ARENA_AVATARS.some((a) => a.key === body.avatar) ? body.avatar! : null;
          // A real picture: re-validated here (type, size, file signature) — the device's word is never enough.
          let photo: string | null = null;
          if (entry.photo !== "off" && body.photo) {
            const check = validatePhotoDataUrl(body.photo);
            if (!check.ok) return json({ error: check.reason === "too_large" ? "photo_too_large" : "photo_invalid" }, 422);
            photo = body.photo;
          }
          if (entry.photo === "required" && !avatar && !photo) return json({ error: "avatar_required" }, 422);
          const nowIso = new Date().toISOString();
          if (existing) {
            // Changing name or picture never touches earlier times.
            const patch: Record<string, unknown> = {
              display_name: displayName ?? existing.display_name, avatar_key: avatar ?? existing.avatar_key, last_seen_at: nowIso,
            };
            if (photo) { patch["avatar_photo"] = photo; patch["avatar_photo_at"] = nowIso; if (!avatar) patch["avatar_key"] = null; }
            let { error } = await admin.from("arena_participants").update(patch).eq("id", existing.id);
            let photoSaved = !!photo && !error;
            if (error && photo && photoColumnsMissing(error.message)) {
              notePhotoColumns(false);
              delete patch["avatar_photo"]; delete patch["avatar_photo_at"];
              ({ error } = await admin.from("arena_participants").update(patch).eq("id", existing.id));
              photoSaved = false;
            } else if (photo && !error) notePhotoColumns(true);
            await broadcast(share.id, "join");
            return json({ participantId: existing.id, anonLabel: existing.anon_label, photoSaved });
          }
          for (let i = 0; i < 6; i++) {
            const label = `Learner-${1000 + Math.floor(Math.random() * 9000)}`;
            const row0: Record<string, unknown> = {
              share_id: share.id, device_token: body.token, display_name: displayName, anon_label: label, avatar_key: avatar,
            };
            if (photo) { row0["avatar_photo"] = photo; row0["avatar_photo_at"] = nowIso; }
            let ins = await admin.from("arena_participants").insert(row0).select("id, anon_label").maybeSingle();
            let photoSaved = !!photo && !ins.error;
            if (ins.error && photo && photoColumnsMissing(ins.error.message)) {
              notePhotoColumns(false);
              delete row0["avatar_photo"]; delete row0["avatar_photo_at"];
              ins = await admin.from("arena_participants").insert(row0).select("id, anon_label").maybeSingle();
              photoSaved = false;
            } else if (photo && !ins.error) notePhotoColumns(true);
            if (ins.data) {
              await broadcast(share.id, "join");
              return json({ participantId: ins.data.id, anonLabel: ins.data.anon_label, photoSaved });
            }
            if (!/duplicate/i.test(ins.error?.message ?? "")) break;
          }
          return json({ error: "join_failed" }, 500);
        }

        if (!existing) return json({ error: "not_joined" }, 403);
        await admin.from("arena_participants").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
        if (body.action === "beat") return json({ ok: true });
        if (!body.assessmentId) return json({ error: "bad_request" }, 400);

        // Resolve server-owned metadata; IDs from another Session are never accepted.
        const meta = await loadQuestions(admin, share.source_id);
        const question = resolveReportQuestion(meta.questions,body.assessmentId);
        if (!question) return json({ error: "not_in_session" }, 403);
        const questionId = question.questionId;
        const assessmentId = question.assessmentId;

        const { data: open } = await admin.from("arena_attempts").select("id, started_at")
          .eq("share_id",share.id).eq("participant_id", existing.id).eq("assessment_id", assessmentId).is("completed_at", null)
          .order("started_at", { ascending: false }).limit(1).maybeSingle();

        if (body.action === "start") {
          if (!open) {
            await admin.from("arena_attempts").insert({
              share_id: share.id, participant_id: existing.id, assessment_id: assessmentId, question_id: questionId,
            });
          }
          await broadcast(share.id, "start", assessmentId);
          return json({ ok: true });
        }

        // complete — only a fully correct, server-marked sitting counts.
        // The student's `start` can be lost (dropped connection, refresh,
        // device asleep). Rather than silently discarding a correct finish, the
        // server back-dates a start from the reported time, but never further
        // back than the moment the student joined this group, and never for a
        // a zero-length claim.
        let attempt: { id: string; started_at: string } | null = open;
        if (!attempt) {
          const claimed = Math.floor(Number(body.elapsedMs) || 0);
          const sinceJoin = Date.now() - Date.parse(existing.joined_at);
          if (claimed < LATE_START_MIN_MS || !Number.isFinite(sinceJoin)) return json({ error: "no_open_attempt" }, 409);
          const startedAt = new Date(Date.now() - Math.min(claimed, Math.max(sinceJoin, LATE_START_MIN_MS))).toISOString();
          const { data: made } = await admin.from("arena_attempts").insert({
            share_id: share.id, participant_id: existing.id, assessment_id: assessmentId, question_id: questionId, started_at: startedAt,
          }).select("id, started_at").maybeSingle();
          if (!made) return json({ error: "attempt_save_failed" }, 500);
          attempt = made;
        }
        const sitting = attempt as { id: string; started_at: string };
        const { data: link } = await admin.from("guest_links").select("id").eq("code", share.guest_code).maybeSingle();
        const { data: marked } = link
          ? await admin.from("guest_attempts").select("score, total_marks").eq("link_id", link.id)
              .eq("guest_token", body.token).eq("assessment_id", body.assessmentId).maybeSingle()
          : { data: null };
        const total = Number(marked?.total_marks) || 0;
        let fullyCorrect = total > 0 && Number(marked?.score) >= total;
        if (question.kind === "mcq") {
          const {data: item} = await admin.from("academia_mcq_items").select("answer").eq("id",question.assessmentId).eq("activity_id",question.activityId).maybeSingle();
          fullyCorrect = !!item?.answer && body.answer === item.answer;
          if (!fullyCorrect) return json({ok:true,counted:false});
        } else if (question.kind === "adventure-question") {
          const {data: row}=await admin.from("academia_adventure_questions").select("*").eq("id",question.assessmentId).eq("activity_id",question.activityId).maybeSingle();
          const [{boardFor},{copiedAdventureQuestion},{markLine}]=await Promise.all([import("@/lib/academia/adventureSlots"),import("@/lib/offline/extendedActivities"),import("@/lib/offline/marking")]);
          const board=row?boardFor(copiedAdventureQuestion(row)):null;
          const lines=board?.boardSource.reservoirs.flatMap(r=>r.lines??[]).filter(l=>(l.marks??0)>0)??[];
          fullyCorrect=lines.length>0 && lines.every(l=>markLine(l.equation??"",body.working?.[l.lineId??""]??""));
        } else if (question.kind === "adventure") {
          const required = meta.questions.filter(q => q.activityId === question.activityId && q.kind === "adventure-question");
          const {data: completed} = await admin.from("arena_bests").select("assessment_id").eq("share_id",share.id).eq("participant_id",existing.id).in("assessment_id",required.map(q=>q.assessmentId));
          fullyCorrect = required.length > 0 && required.every(q => (completed ?? []).some((r:any)=>r.assessment_id === q.assessmentId));
        }
        // Marking may land a moment after the board's own tick: keep the
        // attempt open so the device can retry; nothing is counted yet.
        if (!fullyCorrect) return json({ ok: true, counted: false, pending: true });
        const nowIso = new Date().toISOString();
        const serverMs = Date.now() - Date.parse(sitting.started_at);
        const elapsed = verifiedElapsed(body.elapsedMs ?? 0, serverMs);
        await admin.from("arena_attempts").update({
          completed_at: nowIso, elapsed_ms: elapsed, success: elapsed != null,
        }).eq("id", sitting.id);
        if (elapsed == null) return json({ ok: true, counted: false });

        const {data: promoted,error: promoteError}=await admin.rpc("arena_promote_best",{
          _share:share.id,_participant:existing.id,_assessment:assessmentId,_question:questionId,
          _ms:elapsed,_at:nowIso,_attempt:sitting.id,
        });
        if(promoteError) return json({error:"result_save_failed"},503);
        await broadcast(share.id,"best",assessmentId);
        return json({ok:true,counted:true,newBest:!!promoted,ms:elapsed});

      },
    },
  },
});
