import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ChampionsArena } from '@/components/arena/ChampionsArena';
import type { ArenaBoard } from '@/lib/arena/arenaClient';
let root: Root, host: HTMLElement, width: number, height: number;
const board = (count: number): ArenaBoard => ({ shareId: 'one-competition', title: 'Spring Challenge', sessionTitle: 'Algebra', status: 'open', crumbs: {}, joined: 100, online: 20, rankedParticipants: 100, completedAll: 1,
 overallChampions: [{ participantId: 'A', name: 'Alice', averageMs: 20000, totalMs: count * 20000, completedAt: '', place: 1 }],
 columns: Array.from({ length: count }, (_, index) => ({ number: index + 1, activityId: `a${index}`, assessmentId: `q${index}`, title: 'Question', rankedCount: 100, photosEnabled: false,
 top: Array.from({ length: 100 }, (_, i) => ({ place: i + 1, participantId: `p${i}`, name: `Student ${i + 1}`, avatar: null, ms: 10000 + i * 1000 })) })) });
beforeEach(() => {
 width = 1366; height = 768;
 const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test' });
 for (const key of ['window','document','navigator','HTMLElement','Node','Event']) vi.stubGlobal(key, (dom.window as any)[key]);
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width, height, top:0,left:0,right:width,bottom:height,x:0,y:0,toJSON:()=>({}) }));
 host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(count: number) { await act(async () => root.render(<ChampionsArena board={board(count)} status="LIVE" />)); }
it('keeps 20 complete cards with every ranking available inside each card', async () => {
 await render(20); expect(host.querySelectorAll('.ca-card')).toHaveLength(20); expect(host.querySelectorAll('.ca-rankings')).toHaveLength(20);
 expect(host.querySelector('.ca-rankings')?.children).toHaveLength(100); expect(host.querySelector('.ca-rankings')?.getAttribute('tabindex')).toBe('0');
 expect(document.body.style.overflow).toBe('hidden'); expect(host.querySelector('.ca-question-grid')).not.toBeNull();
 expect(host.querySelector('.ca-podium-1')?.textContent).toContain('Alice'); expect(host.querySelectorAll('img')).toHaveLength(0);
});
it('paginates 21 questions without changing the overall podium', async () => {
 await render(21); await act(async () => (host.querySelector('[aria-label="Next question page"]') as HTMLButtonElement).click());
 expect(host.querySelectorAll('.ca-card')).toHaveLength(1); expect(host.querySelector('.ca-card')?.getAttribute('aria-label')).toBe('Question 21 leaderboard');
 expect(host.querySelector('.ca-podium-1')?.textContent).toContain('Alice'); expect(host.textContent).toContain('Page 2 / 2');
});
it('switches to the overview when resized and opens the selected question', async () => {
 await render(20); width = 390; height = 844; await act(async () => window.dispatchEvent(new Event('resize')));
 expect(host.querySelectorAll('.ca-card')).toHaveLength(1); expect(host.querySelectorAll('.ca-question-tiles button')).toHaveLength(20);
 await act(async () => (host.querySelectorAll('.ca-question-tiles button')[19] as HTMLButtonElement).click());
 expect(host.querySelector('.ca-card')?.getAttribute('aria-label')).toBe('Question 20 leaderboard');
});
it('enters and exits full screen without losing the selected page', async () => {
 await render(21); await act(async () => (host.querySelector('[aria-label="Next question page"]') as HTMLButtonElement).click());
 const arena = host.querySelector('main')!;
 Object.defineProperty(arena, 'requestFullscreen', { value: vi.fn(async () => { Object.defineProperty(document,'fullscreenElement',{ configurable:true,value:arena }); document.dispatchEvent(new Event('fullscreenchange')); }) });
 Object.defineProperty(document,'exitFullscreen',{ configurable:true,value:vi.fn(async()=>{Object.defineProperty(document,'fullscreenElement',{configurable:true,value:null});document.dispatchEvent(new Event('fullscreenchange'));}) });
 await act(async () => (host.querySelector('[aria-label="Full screen"]') as HTMLButtonElement).click());
 expect(host.querySelector('[aria-label="Exit full screen"]')).not.toBeNull(); expect(host.textContent).toContain('Page 2 / 2');
 await act(async () => (host.querySelector('[aria-label="Exit full screen"]') as HTMLButtonElement).click()); expect(host.querySelector('[aria-label="Full screen"]')).not.toBeNull();
});
it('restores document scrolling on unmount and shows no unverified overall champion', async () => {
 document.body.style.overflow = 'auto'; const value = board(2); value.overallChampions = []; value.completedAll = 0;
 await act(async () => root.render(<ChampionsArena board={value} status="LIVE" />)); expect(host.textContent).toContain('Awaiting First Champion');
 await act(async () => root.render(null)); expect(document.body.style.overflow).toBe('auto');
});
