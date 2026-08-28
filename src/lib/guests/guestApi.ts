/**
 * Guest Link — public client access.
 *
 * Everything a guest reads comes from `/api/public/guest/<code>`: the ORIGINAL
 * course or assignment card, the ORIGINAL media, and their own marks. Nothing
 * is duplicated per guest.
 */
import type { CourseTree } from "@/lib/courses/types";
import type { AssessmentLike } from "@/lib/assessments/assessmentBoardSource";

export interface GuestCoursePayload {
  kind: "course";
  askName: boolean;
  title: string;
  tree: CourseTree;
}

export interface GuestAssignmentPayload {
  kind: "assignment";
  askName: boolean;
  title: string;
  subject: string | null;
  subtopic: string | null;
  assessments: (AssessmentLike & { total_marks: number })[];
}

export type GuestPayload = GuestCoursePayload | GuestAssignmentPayload;

export interface GuestAttemptRow {
  assessment_id: string;
  solved_lines: Record<string, number>;
  score: number;
  total_marks: number;
  status: string;
}

const base = (code: string) => `/api/public/guest/${encodeURIComponent(code)}`;

const get = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

export const fetchGuestPayload = (code: string) => get<GuestPayload>(base(code));

export const fetchGuestExercise = (code: string, blockId: string) =>
  get<{ assessment: AssessmentLike & { total_marks: number } }>(
    `${base(code)}?action=exercise&blockId=${encodeURIComponent(blockId)}`,
  );

export const fetchGuestMediaUrl = async (code: string, path: string): Promise<string | null> =>
  (await get<{ url: string }>(`${base(code)}?action=media&path=${encodeURIComponent(path)}`))?.url ?? null;

export const fetchGuestAttempts = async (code: string, token: string): Promise<GuestAttemptRow[]> =>
  (await get<{ attempts: GuestAttemptRow[] }>(`${base(code)}?action=progress&token=${encodeURIComponent(token)}`))
    ?.attempts ?? [];
