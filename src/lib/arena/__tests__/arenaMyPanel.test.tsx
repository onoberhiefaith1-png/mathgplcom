import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ beat: vi.fn(), flush: vi.fn(async () => {}), error: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/arena/arenaClient', () => ({ activeArena: () => 'TAGROUP0001', arenaBeat: api.beat, flushArenaOutbox: api.flush }));
vi.mock('sonner', () => ({ toast: { error: api.error, success: api.success } }));
import ArenaMyPanel from '@/components/arena/ArenaMyPanel';
import { BEAT_EVERY_MS } from '@/lib/arena/presence';

let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'CustomEvent']) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  Object.values(api).forEach((f) => f.mockClear());
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('keeps re-sending queued finishes on every heartbeat, not only after a reload', async () => {
  await act(async () => root.render(<ArenaMyPanel guestCode="GUEST01" token="tok" assessmentId="as-1" />));
  const before = api.flush.mock.calls.length;
  await act(async () => { vi.advanceTimersByTime(BEAT_EVERY_MS * 3); });
  expect(api.flush.mock.calls.length - before).toBe(3);
  expect(api.beat).toHaveBeenCalledTimes(4);
});

it('tells the student when a time could not be saved, offers Retry, and confirms when it lands', async () => {
  await act(async () => root.render(<ArenaMyPanel guestCode="GUEST01" token="tok" assessmentId="as-1" />));
  const send = (detail: object) => window.dispatchEvent(new CustomEvent('arena:submit', { detail }));
  await act(async () => send({ assessmentId: 'as-1', state: 'failed', retryable: true, message: 'Your time couldn\u2019t reach the Arena.', attempt: 7 }));
  expect(api.error).toHaveBeenCalledTimes(1);
  const opts = api.error.mock.calls[0]![1] as { action: { onClick: () => void } };
  opts.action.onClick();
  expect(api.flush).toHaveBeenLastCalledWith('as-1');
  await act(async () => send({ assessmentId: 'as-1', state: 'saved', counted: true, attempt: 1 }));
  expect(api.success).toHaveBeenCalledWith('Your time is on the Live Report.', expect.anything());
  // A normal first-time save stays quiet.
  await act(async () => send({ assessmentId: 'as-2', state: 'saved', counted: true, attempt: 1 }));
  expect(api.success).toHaveBeenCalledTimes(1);
});
