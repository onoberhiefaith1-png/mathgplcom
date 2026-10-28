import { JSDOM } from 'jsdom';
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const api=vi.hoisted(()=>({complete:vi.fn(),start:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/lib/assessments/bestTimes',()=>({fetchQuestionBestTimes:async()=>({overallBestMs:null,myBestMs:null})}));
vi.mock('@/lib/guests/guestApi',()=>({sendGuestHeartbeat:vi.fn(async()=>{})}));
vi.mock('@/lib/arena/arenaClient',()=>({activeArena:()=> 'TA-own-group',fetchArenaMe:async()=>({overallBestMs:null,myBestMs:null}),arenaComplete:api.complete,arenaStart:api.start}));
import { useQuestionTimerAttempt, type QuestionTimerAttempt } from './useQuestionTimerAttempt';
import { attemptProgress } from '@/lib/smartboard/completionProgress';
let root:Root,host:HTMLElement,timer:QuestionTimerAttempt,clock:number;
const lines=[{lineId:'a',marks:25},{lineId:'note',marks:0},{lineId:'final',marks:25}];
function Probe(){timer=useQuestionTimerAttempt({enabled:true,assessmentId:'assessment',studentId:'student',questionId:'q',guest:{code:'AC-own-link',token:'own-token'}});const progress=attemptProgress('q',lines,timer.confirmed);useLayoutEffect(()=>{if(timer.ready&&progress.complete)timer.complete();},[timer.ready,timer.complete,progress.complete]);return <div>{progress.score}/{progress.total} · {timer.elapsedMs}</div>;}
beforeEach(()=>{const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test'});for(const key of ['window','document','navigator','HTMLElement','Node','localStorage','CustomEvent'])vi.stubGlobal(key,(dom.window as any)[key]);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);clock=1000;vi.spyOn(Date,'now').mockImplementation(()=>clock);api.complete.mockClear();api.start.mockClear();host=document.createElement('div');root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
async function mount(){await act(async()=>root.render(<Probe/>));}
it('50/50 stops at the final scored step, submits once and cannot restart on later input',async()=>{
 await mount();await act(async()=>timer.markInput());clock=2500;await act(async()=>timer.confirmLine('q:a',25));expect(timer.running).toBe(true);expect(api.complete).not.toHaveBeenCalled();
 clock=6000;await act(async()=>timer.confirmLine('q:final',25));expect(host.textContent).toContain('50/50');expect(timer.running).toBe(false);expect(timer.completed).toBe(true);expect(timer.elapsedMs).toBe(5000);expect(api.complete).toHaveBeenCalledExactlyOnceWith('AC-own-link','own-token','assessment','q',5000);
 clock=20000;await act(async()=>{timer.markInput();timer.complete();});expect(timer.elapsedMs).toBe(5000);expect(api.complete).toHaveBeenCalledTimes(1);
});
it('reset requires a fresh attempt, retains the best, and an improvement submits to the same question',async()=>{
 await mount();await act(async()=>timer.markInput());clock=6000;await act(async()=>{timer.confirmLine('q:a',25);timer.confirmLine('q:final',25);});expect(timer.bestMs).toBe(5000);
 await act(async()=>timer.reset());expect(timer.confirmed).toEqual({});expect(timer.completed).toBe(false);expect(timer.bestMs).toBe(5000);expect(host.textContent).toContain('0/50');
 clock=8000;await act(async()=>timer.markInput());clock=9000;await act(async()=>{timer.confirmLine('q:a',25);timer.confirmLine('q:final',25);});expect(timer.bestMs).toBe(1000);expect(api.complete).toHaveBeenLastCalledWith('AC-own-link','own-token','assessment','q',1000);
});
it('a completed attempt stays stopped when restored from its device record',async()=>{
 await mount();await act(async()=>timer.markInput());clock=3000;await act(async()=>{timer.confirmLine('q:a',25);timer.confirmLine('q:final',25);});await act(async()=>root.render(null));clock=10000;await mount();expect(timer.running).toBe(false);expect(timer.completed).toBe(true);expect(timer.elapsedMs).toBe(2000);expect(api.complete).toHaveBeenCalledTimes(1);
});
