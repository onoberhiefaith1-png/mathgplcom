import { describe, expect, it } from 'vitest';
import { arenaLayout, championshipPages, championshipTime, overallChampionship } from '../championship';
const entry = (participantId: string, ms: number, at = '2026-10-27T10:00:00Z') => ({ participantId, name: participantId, ms, achievedAt: at });
describe('Champions Arena eligibility and personal best projection', () => {
  it('never declares a champion for an empty competition', () => expect(overallChampionship([])).toEqual([]));
  it('excludes a faster student who has not completed every question', () => {
    const result = overallChampionship([{ assessmentId: 'q1', top: [entry('partial', 1000), entry('complete', 30000)] }, { assessmentId: 'q2', top: [entry('complete', 50000)] }]);
    expect(result.map(x => x.participantId)).toEqual(['complete']); expect(result[0].averageMs).toBe(40000);
  });
  it('averages best times once per question, rather than marks or fastest single time', () => {
    const result = overallChampionship([{ assessmentId: 'q1', top: [entry('A', 20000), entry('A', 25000), entry('B', 1000)] }, { assessmentId: 'q2', top: [entry('A', 30000), entry('B', 70000)] }]);
    expect(result.map(x => [x.participantId, x.averageMs])).toEqual([['A', 25000], ['B', 35500]]);
  });
  it('moves an overall champion after a faster verified best arrives', () => {
    const columns = [{ assessmentId: 'q1', top: [entry('A', 20000), entry('B', 30000)] }, { assessmentId: 'q2', top: [entry('A', 30000), entry('B', 30000)] }];
    expect(overallChampionship(columns)[0].participantId).toBe('A');
    columns[1].top[1] = entry('B', 10000);
    expect(overallChampionship(columns)[0].participantId).toBe('B');
  });
  it('uses earliest final best timestamp, then stable participant id on exact ties', () => {
    const result = overallChampionship([{ assessmentId: 'q1', top: [entry('B', 1000, '2026-10-27T10:00:01Z'), entry('C', 1000), entry('A', 1000)] }]);
    expect(result.map(x => x.participantId)).toEqual(['A', 'C', 'B']);
  });
  it('requires all 21 questions even when only 20 are visible', () => {
    const columns = Array.from({ length: 21 }, (_, i) => ({ assessmentId: `q${i}`, top: i === 20 ? [] : [entry('A', 1000)] }));
    expect(overallChampionship(columns)).toEqual([]);
    columns[20].top.push(entry('A', 2000)); expect(overallChampionship(columns)[0].averageMs).toBeCloseTo(22000 / 21);
  });
  it('ignores missing identity, invalid times and duplicate question columns', () => {
    expect(overallChampionship([{ assessmentId: 'q1', top: [entry('', 10), entry('bad', NaN), entry('negative', -1), entry('zero', 0), entry('valid', 15)] }]).map(x => x.participantId)).toEqual(['valid']);
    expect(overallChampionship([{ assessmentId: 'q', top: [entry('A', 10)] }, { assessmentId: 'q', top: [entry('A', 20)] }])[0].averageMs).toBe(20);
  });
  it('does not combine two competition snapshots', () => {
    expect(overallChampionship([{ assessmentId: 'q1', top: [entry('A', 1000)] }, { assessmentId: 'q2', top: [] }])).toEqual([]);
    expect(overallChampionship([{ assessmentId: 'q1', top: [] }, { assessmentId: 'q2', top: [entry('A', 1000)] }])).toEqual([]);
  });
});

describe('Viewport-fitting layout and pagination', () => {
  for (const count of [1, 2, 5, 8, 10, 15, 20, 21, 40]) {
    it(`fits ${count} questions in 20-question pages on desktop and laptop screens`, () => {
      const pages = championshipPages(Array.from({ length: count }, (_, i) => i + 1));
      expect(pages.flatMap(p => p.items)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
      expect(pages.length).toBe(Math.ceil(count / 20));
      for (const [width, height] of [[1920,1080], [1440,900], [1366,768], [1280,720], [1024,768]]) for (const page of pages) {
        const layout = arenaLayout(width, height, page.items.length, pages.length > 1);
        expect(layout.overview).toBe(false); expect(layout.cardWidth).toBeGreaterThanOrEqual(180); expect(layout.cardHeight).toBeGreaterThanOrEqual(132);
        const usedHeight = 2 * layout.padding + layout.header + layout.podium + layout.footer + layout.gap * (pages.length > 1 ? 3 : 2) + layout.rows * layout.cardHeight + (layout.rows - 1) * layout.gap;
        expect(usedHeight).toBeCloseTo(height);
        expect(layout.columns).toBe(Math.min(5, page.items.length));
      }
    });
  }
  it('uses generous two-card space with no empty rows', () => {
    const two = arenaLayout(1366, 768, 2), twenty = arenaLayout(1366, 768, 20);
    expect(two.rows).toBe(1); expect(two.columns).toBe(2); expect(two.cardHeight).toBeGreaterThan(twenty.cardHeight * 3);
  });
  it('uses readable overview on phones, tablets and short desktop windows', () => {
    for (const [w,h] of [[390,844], [768,1024], [1280,600]]) expect(arenaLayout(w,h,20).overview).toBe(true);
  });
  it('formats short and long times consistently', () => {
    expect(championshipTime(18400)).toBe('18.4s'); expect(championshipTime(84000)).toBe('01:24'); expect(championshipTime(156000)).toBe('02:36');
  });
});
