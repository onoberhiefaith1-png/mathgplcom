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
it('shows who is in the room with pictures, the champion\u2019s picture, and the Mathemagine light/dark switch', async () => {
 const value = board(2);
 const photo = (id: string) => `/api/public/arena/TDABCDEFGH?action=photo&p=00000000-0000-4000-8000-${id.padStart(12, '0')}`;
 value.columns[0]!.photosEnabled = true; value.columns[0]!.top[0]!.photo = photo('1');
 value.overallChampions = [{ participantId: 'p0', name: 'Student 1', averageMs: 9000, totalMs: 18000, completedAt: '', place: 1 }];
 value.participants = [
  { id: 'p0', name: 'Student 1', avatar: null, photo: photo('1'), presence: 'active', lastSeenAt: 1, working: 2, ranked: 2, joinedAt: 1 },
  { id: 'p1', name: 'Student 2', avatar: 'owl', photo: null, presence: 'inactive', lastSeenAt: 1, working: null, ranked: 0, joinedAt: 1 },
 ];
 value.participantsTotal = 2;
 const toggle = vi.fn();
 await act(async () => root.render(<ChampionsArena board={value} status="LIVE" theme="dark" onToggleTheme={toggle} updatedAt={Date.now()} />));
 const main = host.querySelector('main')!;
 expect(main.className).toContain('mm-app'); expect(main.className).toContain('mm-dark');
 expect(host.querySelectorAll('.ca-person')).toHaveLength(2);
 expect(host.querySelector('.ca-person-active')?.textContent).toContain('On Q2');
 expect(host.querySelector('.ca-roster-head')?.textContent).toContain('1active now');
 expect(host.querySelector('.ca-podium-1 img')?.getAttribute('src')).toBe(photo('1'));
 expect(host.querySelector('.ca-live')?.textContent).toContain('just now');
 await act(async () => (host.querySelector('[aria-label="Switch to light mode"]') as HTMLButtonElement).click());
 expect(toggle).toHaveBeenCalledTimes(1);
});
