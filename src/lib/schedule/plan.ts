/**
 * The teaching plan: what will be taught, and on which date.
 *
 * This is the "what" layer. It sits beside the recurring day/time schedule
 * ("when and where") and is shared, unchanged, by a Class and a Live room —
 * one table, one shape, two scopes.
 */

import { supabase } from "@/integrations/supabase/client";

export type PlanScope = "class" | "session";

export type SchedulePlanEntry = {
  id: string;
  scope: PlanScope;
  scopeId: string;
  /** ISO date ("2026-09-02"). Null while the teacher has not dated it yet. */
  entryDate: string | null;
  /** Free label such as "Week 1". Optional. */
  weekLabel: string | null;
  topic: string;
  description: string | null;
  position: number;
};

type Row = {
  id: string;
  scope: string;
  scope_id: string;
  entry_date: string | null;
  week_label: string | null;
  topic: string | null;
  description: string | null;
  position: number | null;
};

const hydrate = (row: Row): SchedulePlanEntry => ({
  id: row.id,
  scope: row.scope === "session" ? "session" : "class",
  scopeId: row.scope_id,
  entryDate: row.entry_date,
  weekLabel: row.week_label,
  topic: row.topic ?? "",
  description: row.description,
  position: row.position ?? 0,
});

/** Dated entries first (chronological), undated ones after, by position. */
export const sortPlanEntries = (entries: SchedulePlanEntry[]): SchedulePlanEntry[] =>
  [...entries].sort((a, b) => {
    if (a.entryDate && b.entryDate) return a.entryDate.localeCompare(b.entryDate);
    if (a.entryDate) return -1;
    if (b.entryDate) return 1;
    return a.position - b.position;
  });

/**
 * The table lands with this feature, so the generated types do not know it yet;
 * the reads and writes below are the only place that shape is used.
 */
type LooseTable = {
  select: (cols: string) => {
    eq: (col: string, value: string) => {
      eq: (col: string, value: string) => PromiseLike<{ data: unknown }>;
    };
  };
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  update: (row: Record<string, unknown>) => {
    eq: (col: string, value: string) => PromiseLike<{ error: unknown }>;
  };
  delete: () => { eq: (col: string, value: string) => PromiseLike<{ error: unknown }> };
};

const planTable = (): LooseTable =>
  (supabase as unknown as { from: (t: string) => LooseTable }).from("teaching_schedule_entries");

export const listPlanEntries = async (
  scope: PlanScope,
  scopeId: string,
): Promise<SchedulePlanEntry[]> => {
  const { data } = await planTable()
    .select("id, scope, scope_id, entry_date, week_label, topic, description, position")
    .eq("scope", scope)
    .eq("scope_id", scopeId);
  return sortPlanEntries(((data ?? []) as Row[]).map(hydrate));
};

export type PlanEntryInput = {
  entryDate: string | null;
  weekLabel: string | null;
  topic: string;
  description: string | null;
  position?: number;
};

export const createPlanEntry = async (
  scope: PlanScope,
  scopeId: string,
  ownerId: string,
  input: PlanEntryInput,
) =>
  planTable().insert({
    scope,
    scope_id: scopeId,
    owner_id: ownerId,
    entry_date: input.entryDate,
    week_label: input.weekLabel,
    topic: input.topic.trim(),
    description: input.description,
    position: input.position ?? 0,
  });

export const updatePlanEntry = async (id: string, input: PlanEntryInput) =>
  planTable()
    .update({
      entry_date: input.entryDate,
      week_label: input.weekLabel,
      topic: input.topic.trim(),
      description: input.description,
      ...(input.position === undefined ? {} : { position: input.position }),
    })
    .eq("id", id);

export const deletePlanEntry = async (id: string) => planTable().delete().eq("id", id);


const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const dateOf = (iso: string): Date | null => {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** The entry for today or the soonest future date — what's coming next. */
export const nextPlanEntry = (
  entries: SchedulePlanEntry[],
  now: Date = new Date(),
): SchedulePlanEntry | null => {
  const today = startOfDay(now).getTime();
  for (const entry of sortPlanEntries(entries)) {
    if (!entry.entryDate) continue;
    const at = dateOf(entry.entryDate);
    if (at && at.getTime() >= today) return entry;
  }
  return null;
};

/** Everything after the next entry — the "Upcoming Topics" list. */
export const upcomingPlanEntries = (
  entries: SchedulePlanEntry[],
  now: Date = new Date(),
): SchedulePlanEntry[] => {
  const next = nextPlanEntry(entries, now);
  const sorted = sortPlanEntries(entries);
  if (!next) return sorted;
  return sorted.slice(sorted.findIndex((e) => e.id === next.id) + 1);
};

/** "2 September 2026" — how a date reads on a card. */
export const formatPlanDate = (iso: string | null): string => {
  if (!iso) return "Date not set";
  const at = dateOf(iso);
  if (!at) return iso;
  return at.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

/** "Tuesday, 2 September" — used in the Coming Soon headline. */
export const formatPlanDayDate = (iso: string | null): string => {
  if (!iso) return "";
  const at = dateOf(iso);
  if (!at) return iso;
  return at.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
};
