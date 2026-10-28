/** Read-only championship projection over server-verified personal bests. */
export type ChampionshipEntry = {
  participantId: string; name: string; ms: number; achievedAt?: string; attemptId?: string;
};
export type OverallChampion = {
  participantId: string; name: string; averageMs: number; totalMs: number; completedAt: string; place: number;
};
export function overallChampionship(columns: readonly { assessmentId: string; top: readonly ChampionshipEntry[] }[]) {
  const required = new Map(columns.map(q => [q.assessmentId, q]));
  if (!required.size) return [] as OverallChampion[];
  const students = new Map<string, Map<string, ChampionshipEntry>>();
  for (const [questionId, question] of required) {
    for (const entry of question.top) {
      if (!entry.participantId || !Number.isFinite(entry.ms) || entry.ms <= 0) continue;
      let bests = students.get(entry.participantId);
      if (!bests) students.set(entry.participantId, bests = new Map());
      const old = bests.get(questionId);
      if (!old || entry.ms < old.ms || (entry.ms === old.ms && (entry.achievedAt ?? '') < (old.achievedAt ?? ''))) bests.set(questionId, entry);
    }
  }
  const eligible: Omit<OverallChampion, 'place'>[] = [];
  for (const [participantId, bests] of students) {
    if (bests.size !== required.size) continue;
    const entries = [...bests.values()];
    const totalMs = entries.reduce((sum, entry) => sum + entry.ms, 0);
    eligible.push({ participantId, name: entries[0].name, totalMs, averageMs: totalMs / required.size,
      completedAt: entries.map(e => e.achievedAt ?? '').sort().at(-1) ?? '' });
  }
  return eligible.sort((a, b) => a.totalMs - b.totalMs || a.completedAt.localeCompare(b.completedAt) || a.participantId.localeCompare(b.participantId))
    .map((entry, index) => ({ ...entry, place: index + 1 }));
}

export const QUESTION_PAGE_SIZE = 20;
export function championshipPages<T>(questions: readonly T[]) {
  return Array.from({ length: Math.ceil(questions.length / QUESTION_PAGE_SIZE) }, (_, page) => ({
    start: page * QUESTION_PAGE_SIZE, items: questions.slice(page * QUESTION_PAGE_SIZE, (page + 1) * QUESTION_PAGE_SIZE),
  }));
}

/** All geometry derives from the measured root; no page zoom or content-based heights. */
export function arenaLayout(width: number, height: number, count: number, paginated = false) {
  const n = Math.max(1, Math.min(20, count));
  const columns = Math.min(5, n);
  const rows = Math.ceil(n / columns);
  const padding = width < 700 ? 8 : 12;
  const gap = height < 700 ? 6 : 8;
  const dense = rows >= 3 || height < 700;
  const header = width < 700 ? 56 : dense ? 40 : 58;
  const podium = dense ? 50 : 80;
  const footer = paginated ? 28 : 0;
  const gridHeight = Math.max(0, height - padding * 2 - header - podium - footer - gap * (paginated ? 3 : 2));
  const cardWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const cardHeight = (gridHeight - gap * (rows - 1)) / rows;
  const overview = width < 900 || cardWidth < 180 || cardHeight < 132;
  return { columns, rows, padding, gap, header, podium, footer, gridHeight, cardWidth, cardHeight, overview };
}

export function championshipTime(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
