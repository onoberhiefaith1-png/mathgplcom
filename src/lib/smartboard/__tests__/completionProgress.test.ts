import { describe, expect, it } from 'vitest';
import { attemptProgress, createGradeQueue, mergeVerifiedMarks, needsAwardPersistence, verifiedScore } from '../completionProgress';
describe('Verified completion handoff', () => {
 it('stale snapshots cannot remove already earned marks or count a slot twice', () => {
  const first = mergeVerifiedMarks({}, {'q:a':7});
  const both = mergeVerifiedMarks(first, {'q:b':8});
  const late = mergeVerifiedMarks(both, {'q:a':7});
  expect(late).toEqual({'q:a':7,'q:b':8}); expect(verifiedScore(late)).toBe(15);
  expect(verifiedScore(mergeVerifiedMarks(late, {'q:a':7}))).toBe(15);
 });
 it('counts all scored steps and excludes note/zero-mark lines', () => {
  const lines = [{lineId:'a',marks:25},{lineId:'note',marks:0},{lineId:'b',marks:25},{lineId:'prose',marks:10,notebookOnly:true}];
  expect(attemptProgress('q',lines,{'q:a':25})).toMatchObject({score:25,total:50,complete:false});
  expect(attemptProgress('q',lines,{'q:a':25,'q:b':25})).toMatchObject({score:50,total:50,complete:true});
 });
 it('requires the final scored step and the current question identity', () => {
  const lines = [{lineId:'a',marks:50},{lineId:'final',marks:50}];
  expect(attemptProgress('q',lines,{'old:a':50,'old:final':50}).complete).toBe(false);
  expect(attemptProgress('q',lines,{'q:a':50,'q:final':0}).complete).toBe(false);
  expect(attemptProgress('q',[],{}).complete).toBe(false);
 });
 it('does not silently skip a scored step whose mapping is missing', () => {
  expect(attemptProgress('q',[{lineId:'a',marks:25},{marks:25}],{'q:a':25})).toEqual({total:50,score:25,complete:false});
 });
 it('a local predicted mark is still pending server persistence', () => {
  expect(needsAwardPersistence('q:a', {'q:a':true})).toBe(true);
  expect(needsAwardPersistence('q:a', {})).toBe(false);
 });
 it('serializes writes to the same progress row without blocking other participants', async () => {
  const run = createGradeQueue(); const order: string[] = []; let release!:()=>void;
  const waiting = new Promise<void>(resolve=>release=resolve);
  const a = run('student-A', async()=>{order.push('a-start');await waiting;order.push('a-save');});
  const b = run('student-A', async()=>{order.push('b-start');});
  await run('student-B', async()=>{order.push('other');});
  expect(order).toEqual(['a-start','other']);release();await Promise.all([a,b]);expect(order).toEqual(['a-start','other','a-save','b-start']);
 });
 it('a failed request does not poison subsequent marking writes', async () => {
  const run = createGradeQueue();await expect(run('q',async()=>{throw Error('offline');})).rejects.toThrow('offline');
  expect(await run('q',async()=>42)).toBe(42);
 });
});
