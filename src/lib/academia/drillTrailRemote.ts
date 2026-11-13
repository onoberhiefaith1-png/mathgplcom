/**
 * Per-user Academia drill trail on the server.
 * The device copy is written first so the screen can paint, then upserted.
 * Until migration `academia_drill_trails` is applied, reads and writes fail
 * soft and the device copy keeps working.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeDrillTrail,
  readDrillEnvelope,
  writeDrillEnvelope,
  type DrillTrail,
  type DrillTrailRecord,
} from "@/lib/academia/drillTrail";

export type DrillTrailSnapshot =
  { status: "ok"; record: DrillTrailRecord | null } | { status: "unavailable" };

type DrillRow = {
  academia_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  session_id: string | null;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

let saveToken = 0;
let remoteUnavailable = false;

export function drillTrailQueryKey(userId: string) {
  return ["academia-drill-trail", userId] as const;
}

function missingRelation(
  error: { code?: string; message?: string } | null,
): boolean {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (/academia_drill_trails/i.test(message) &&
      /schema cache|does not exist|could not find/i.test(message))
  );
}

function rowToRecord(row: DrillRow): DrillTrailRecord {
  return {
    trail: normalizeDrillTrail({
      academiaId: row.academia_id,
      classId: row.class_id,
      subjectId: row.subject_id,
      topicId: row.topic_id,
      subtopicId: row.subtopic_id,
      sessionId: row.session_id,
    }),
    updatedAt: String(row.updated_at),
  };
}

/** Adopt a trail locally without marking a new save in flight. */
export function adoptDrillTrail(
  userId: string,
  trail: DrillTrail,
  updatedAt: string | null,
) {
  writeDrillEnvelope(userId, {
    trail: normalizeDrillTrail(trail),
    updatedAt,
    pending: false,
    pendingAt: null,
  });
}

export async function fetchDrillTrail(): Promise<DrillTrailSnapshot> {
  if (remoteUnavailable) return { status: "unavailable" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "ok", record: null };
  const { data, error } = await db
    .from("academia_drill_trails")
    .select(
      "academia_id, class_id, subject_id, topic_id, subtopic_id, session_id, updated_at",
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) {
      remoteUnavailable = true;
      return { status: "unavailable" };
    }
    throw error;
  }
  if (!data) return { status: "ok", record: null };
  return { status: "ok", record: rowToRecord(data as DrillRow) };
}

export async function saveDrillTrail(
  trail: DrillTrail,
): Promise<string | null> {
  if (remoteUnavailable) return null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const clean = normalizeDrillTrail(trail);
  const { data, error } = await db
    .from("academia_drill_trails")
    .upsert(
      {
        user_id: userId,
        academia_id: clean.academiaId,
        class_id: clean.classId,
        subject_id: clean.subjectId,
        topic_id: clean.topicId,
        subtopic_id: clean.subtopicId,
        session_id: clean.sessionId,
      },
      { onConflict: "user_id" },
    )
    .select("updated_at")
    .single();
  if (error) {
    if (missingRelation(error)) {
      remoteUnavailable = true;
      return null;
    }
    throw error;
  }
  return data?.updated_at ? String(data.updated_at) : null;
}

/** Write the device copy immediately, then upsert. Last call wins. */
export async function rememberDrillTrail(
  userId: string,
  trail: DrillTrail,
  queryClient?: QueryClient,
) {
  const clean = normalizeDrillTrail(trail);
  const token = ++saveToken;
  const previous = readDrillEnvelope(userId);
  writeDrillEnvelope(userId, {
    trail: clean,
    updatedAt: previous?.updatedAt ?? null,
    pending: true,
    pendingAt: Date.now(),
  });
  try {
    const updatedAt = await saveDrillTrail(clean);
    if (token !== saveToken) return;
    if (!updatedAt) return;
    writeDrillEnvelope(userId, {
      trail: clean,
      updatedAt,
      pending: false,
      pendingAt: null,
    });
    queryClient?.setQueryData(drillTrailQueryKey(userId), {
      status: "ok",
      record: { trail: clean, updatedAt },
    } satisfies DrillTrailSnapshot);
  } catch {
    /* The pending device copy is retried on the next visit. */
  }
}
