import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Crown, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ArenaBoard, ArenaColumn } from '@/lib/arena/arenaClient';
import { arenaLayout, championshipPages, championshipTime, type OverallChampion } from '@/lib/arena/championship';
import ArenaAvatar from './ArenaAvatar';
import './ChampionsArena.css';

export function QuestionRankings({ question, flash = false }: { question: ArenaColumn; flash?: boolean }) {
  const entries = question.top;
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    const animations: Animation[] = [];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const top = list.getBoundingClientRect().top;
    for (const row of Array.from(list.children) as HTMLElement[]) {
      const id = row.dataset.student;
      if (!id) continue;
      const y = row.getBoundingClientRect().top - top + list.scrollTop;
      next.set(id, y);
      const previous = positions.current.get(id);
      if (!reduced && previous != null && Math.abs(previous - y) > 1 && row.animate) {
        animations.push(row.animate([{ transform: `translateY(${previous - y}px)` }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' }));
      }
    }
    positions.current = next;
    return () => animations.forEach(animation => animation.cancel());
  }, [entries]);
  return <article className={`ca-card ${flash ? 'ca-record' : ''}`} aria-label={`Question ${question.number} leaderboard`}>
    <header className="ca-card-heading">
      <strong title={question.title}>Q{question.number} <span>— Champions</span></strong>
      <span className="ca-count" title={question.timerEnabled === false ? 'Timer off: no timed ranking can qualify' : `${question.rankedCount} verified finishers`}>
        {question.timerEnabled === false ? 'Timer off' : `${question.rankedCount} ranked`}
      </span>
    </header>
    <ol ref={listRef} className="ca-rankings" tabIndex={0} aria-label={`Question ${question.number} student rankings`}>
      {Array.from({ length: Math.max(5, entries.length) }, (_, index) => {
        const entry = entries[index];
        return <li data-student={entry?.participantId} className={`ca-rank ${index < 3 ? `ca-place-${index + 1}` : ''}`} key={entry?.participantId ?? `empty-${index}`}>
          <span className="ca-rank-number">{index + 1}</span>
          {entry ? <>
            {question.photosEnabled !== false && <ArenaAvatar photo={entry.photo} avatar={entry.avatar} name={entry.name} size={16} />}
            <span className="ca-student" title={entry.name}>{entry.name}</span>
            <time title={`${entry.ms} milliseconds`}>{championshipTime(entry.ms)}</time>
          </> : <span className="ca-student ca-empty">{index === 0 ? 'Awaiting a verified finish' : '—'}</span>}
        </li>;
      })}
    </ol>
  </article>;
}

function Podium({ champions }: { champions: OverallChampion[] }) {
  const first = champions[0];
  return <section className="ca-podium" aria-label="Overall champions">
    {!first && <span className="ca-awaiting">Awaiting First Champion</span>}
    {[1, 0, 2].map(index => {
      const champion = champions[index];
      return <div className={`ca-podium-place ca-podium-${index + 1}`} key={index}>
        <span className="ca-podium-rank">{index + 1}{index === 0 && <Crown size={19} aria-label="Gold crown" />}</span>
        <span className="ca-podium-person" key={champion ? `${champion.participantId}:${champion.averageMs}` : 'waiting'}>
          {index === 0 && champion && <span className="ca-winner-label">OVERALL CHAMPION</span>}
          <strong title={champion?.name}>{champion?.name ?? (first ? 'Awaiting finisher' : `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'}`)}</strong>
          <span>{champion ? `${championshipTime(champion.averageMs)} avg / question` : 'Complete every question to qualify'}</span>
        </span>
      </div>;
    })}
  </section>;
}

/** A viewport-only display. Only .ca-rankings is allowed to scroll. */
export function ChampionsArena({ board, status, flash = new Set<string>() }: {
  board: ArenaBoard; status: string; flash?: Set<string>;
}) {
  const root = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullScreenError, setFullScreenError] = useState(false);
  const pages = useMemo(() => championshipPages(board.columns), [board.columns]);
  const safePage = Math.min(page, Math.max(0, pages.length - 1));
  const current = pages[safePage]?.items ?? [];
  const layout = arenaLayout(size.width, size.height, current.length, pages.length > 1);
  const picked = current[Math.min(selected, Math.max(0, current.length - 1))];
  const champions = board.overallChampions ?? [];
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setSize(previous => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(host);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => {
    const oldBody = document.body.style.overflow;
    const oldHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', changed);
    return () => { document.body.style.overflow = oldBody; document.documentElement.style.overflow = oldHtml; document.removeEventListener('fullscreenchange', changed); };
  }, []);
  const toggleFullscreen = async () => {
    try {
      setFullScreenError(false);
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setFullScreenError(true);
    } catch { setFullScreenError(true); }
  };
  const changePage = (next: number) => { setPage(next); setSelected(0); };
  const style = {
    '--ca-pad': `${layout.padding}px`, '--ca-gap': `${layout.gap}px`,
    '--ca-header': `${layout.header}px`, '--ca-podium': `${layout.podium}px`,
    '--ca-footer': `${layout.footer}px`, '--ca-columns': layout.columns, '--ca-rows': layout.rows,
  } as CSSProperties;
  return <main ref={root} className={`champions-arena ${layout.overview ? 'ca-overview' : ''} ${layout.rows >= 3 ? 'ca-dense' : ''}`} style={style} aria-label="Champions Arena">
    <header className="ca-header">
      <div className="ca-brand"><span>CHAMPIONS ARENA</span><h1 title={`${board.sessionTitle} · ${board.title}`}>{board.sessionTitle} <small>· {board.title}</small></h1></div>
      <div className="ca-stats" aria-label="Competition totals">
        <span><b>{board.columns.length}</b> questions</span><span><b>{board.joined}</b> students</span><span><b>{board.completedAll ?? 0}</b> finished all</span>
      </div>
      <span className={`ca-live ${status.includes('RECONNECT') ? 'ca-reconnecting' : ''}`} role="status">{board.status === 'closed' ? 'CLOSED' : status}</span>
      <button className="ca-icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullScreenError ? 'Full screen unavailable in this browser' : 'Full screen'}>
        {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </header>
    <Podium champions={champions} />
    {current.length === 0 ? <section className="ca-no-questions">This competition has no questions yet.</section> : layout.overview ?
      <section className="ca-overview-grid" aria-label="Question overview and selected leaderboard">
        <div className="ca-question-tiles" role="group" aria-label="Select question">
          {current.map((question, index) => <button key={question.assessmentId} aria-pressed={picked?.assessmentId === question.assessmentId} onClick={() => setSelected(index)} title={`Q${question.number} — ${question.title}`}>
            <b>Q{question.number}</b><span>{question.top[0] ? championshipTime(question.top[0].ms) : '—'}</span>
          </button>)}
        </div>
        {picked && <QuestionRankings key={picked.assessmentId} question={picked} flash={flash.has(picked.assessmentId)} />}
      </section> : <section className="ca-question-grid" aria-label="All question leaderboards">
        {current.map(question => <QuestionRankings key={question.assessmentId} question={question} flash={flash.has(question.assessmentId)} />)}
      </section>}
    {pages.length > 1 && <nav className="ca-pages" aria-label="Question pages">
      <button disabled={safePage === 0} onClick={() => changePage(safePage - 1)} aria-label="Previous question page"><ChevronLeft size={15} /></button>
      <span>Page {safePage + 1} / {pages.length} · Q{pages[safePage].start + 1}–{pages[safePage].start + current.length}</span>
      <button disabled={safePage === pages.length - 1} onClick={() => changePage(safePage + 1)} aria-label="Next question page"><ChevronRight size={15} /></button>
    </nav>}
  </main>;
}
