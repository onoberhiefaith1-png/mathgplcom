import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Crown, Maximize2, Minimize2, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import type { ArenaBoard, ArenaColumn, ArenaPerson } from '@/lib/arena/arenaClient';
import { arenaLayout, championshipPages, championshipTime, type OverallChampion } from '@/lib/arena/championship';
import { freshness, personFor, sliceHue, type PersonLook, type ReportPalette, type ReportTheme } from '@/lib/arena/liveBoard';
import ArenaAvatar from './ArenaAvatar';
import { GraphActivity } from '@/components/graphActivity';
import { extractGraphTable, DEFAULT_GRAPH_TABLE } from '@/lib/graphActivity/table';
import './ChampionsArena.css';

export function QuestionRankings({ question, flash = false, avatarSize = 22 }: { question: ArenaColumn; flash?: boolean; avatarSize?: number }) {
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
  return <article className={`ca-card ${flash ? 'ca-record' : ''}`} style={{ '--ca-hue': sliceHue(question.number - 1) } as CSSProperties} aria-label={`Question ${question.number} leaderboard`}>
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
            {question.photosEnabled !== false && <ArenaAvatar photo={entry.photo} avatar={entry.avatar} name={entry.name} size={avatarSize} ring={index === 0} />}
            <span className="ca-student" title={entry.name}>{entry.name}</span>
            <time title={`${entry.ms} milliseconds`}>{championshipTime(entry.ms)}</time>
          </> : <span className="ca-student ca-empty">{index === 0 ? 'Awaiting a verified finish' : '—'}</span>}
        </li>;
      })}
    </ol>
  </article>;
}

function Podium({ champions, look, size }: { champions: OverallChampion[]; look: (id: string) => PersonLook | null; size: number }) {
  const first = champions[0];
  return <section className="ca-podium" aria-label="Overall champions">
    {!first && <span className="ca-awaiting">Awaiting First Champion</span>}
    {[1, 0, 2].map(index => {
      const champion = champions[index];
      return <div className={`ca-podium-place ca-podium-${index + 1}`} key={index}>
        <span className="ca-podium-rank">{index + 1}{index === 0 && <Crown size={19} aria-label="Gold crown" />}</span>
        {champion && (() => { const who = look(champion.participantId); return <ArenaAvatar photo={who?.photo} avatar={who?.avatar} name={champion.name} size={index === 0 ? Math.round(size * 1.2) : size} ring={index === 0} className="ca-podium-avatar" />; })()}
        <span className="ca-podium-person" key={champion ? `${champion.participantId}:${champion.averageMs}` : 'waiting'}>
          {index === 0 && champion && <span className="ca-winner-label">OVERALL CHAMPION</span>}
          <strong title={champion?.name}>{champion?.name ?? (first ? 'Awaiting finisher' : `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'}`)}</strong>
          <span>{champion ? `${championshipTime(champion.averageMs)} avg / question` : 'Complete every question to qualify'}</span>
        </span>
      </div>;
    })}
  </section>;
}

/** Everyone who joined: picture, live dot, the question they are on, and how many they have finished. */
function Roster({ people, total, questions, size }: { people: ArenaPerson[]; total: number; questions: number; size: number }) {
  const active = people.filter(p => p.presence === 'active').length;
  return <section className="ca-roster" aria-label="Students in the room">
    <div className="ca-roster-head"><b>{active}</b><span>active now</span><small>{total} joined</small></div>
    <ol className="ca-roster-list">
      {people.map(p => <li key={p.id} className={`ca-person ${p.presence === 'active' ? 'ca-person-active' : 'ca-person-away'}`} title={`${p.name} · ${p.presence === 'active' ? (p.working ? `working on Q${p.working}` : 'active') : 'away'} · ${p.ranked}/${questions} finished`}>
        <span className="ca-person-pic">
          <ArenaAvatar photo={p.photosEnabled === false ? null : p.photo} avatar={p.avatar} name={p.name} size={size} />
          <i aria-label={p.presence === 'active' ? 'active' : 'away'} />
        </span>
        <span className="ca-person-text"><strong>{p.name}</strong><small>{p.presence === 'active' ? (p.working ? `On Q${p.working}` : 'Here') : 'Away'} · {p.ranked}/{questions}</small></span>
      </li>)}
    </ol>
  </section>;
}

/** A viewport-only display. Only .ca-rankings (and the roster strip, sideways) scroll. */
export function ChampionsArena({ board, status, flash = new Set<string>(), theme = 'light', palette = 'ocean', onToggleTheme, updatedAt = null }: {
  board: ArenaBoard; status: string; flash?: Set<string>;
  /** The Mathemagine app's own light/dark choice and colour palette. */
  theme?: ReportTheme; palette?: ReportPalette; onToggleTheme?: () => void;
  /** When the last snapshot reached this screen (ms). */
  updatedAt?: number | null;
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
  const people = board.participants ?? [];
  const layout = arenaLayout(size.width, size.height, current.length, pages.length > 1, people.length > 0);
  const rowHeight = ((layout.overview ? layout.gridHeight - 40 : layout.cardHeight) - 40) / 5;
  const avatarSize = Math.round(Math.max(18, Math.min(40, rowHeight * 0.62)));
  const look = (id: string) => personFor(board, id);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
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
    '--ca-footer': `${layout.footer}px`, '--ca-roster': `${layout.roster}px`, '--ca-columns': layout.columns, '--ca-rows': layout.rows,
  } as CSSProperties;
  const graphTable = extractGraphTable(board) ?? DEFAULT_GRAPH_TABLE;
  return <main ref={root} className={`champions-arena mm-app ${theme === 'dark' ? 'mm-dark ca-dark' : 'mm-light ca-light'} mm-palette-${palette} ${layout.roster ? 'ca-has-roster' : ''} ${layout.overview ? 'ca-overview' : ''} ${layout.rows >= 3 ? 'ca-dense' : ''}`} style={style} aria-label="Champions Arena" data-theme={theme}>
    <div className="ca-stage">
    <header className="ca-header">
      <div className="ca-brand"><span>CHAMPIONS ARENA</span><h1 title={`${board.sessionTitle} · ${board.title}`}>{board.sessionTitle} <small>· {board.title}</small></h1></div>
      <div className="ca-stats" aria-label="Competition totals">
        <span><b>{board.columns.length}</b> questions</span><span><b>{board.joined}</b> students</span><span><b>{board.completedAll ?? 0}</b> finished all</span>
      </div>
      <span className={`ca-live ${status.includes('RECONNECT') ? 'ca-reconnecting' : ''}`} role="status" title={`Updated ${freshness(now, updatedAt)}`}>{board.status === 'closed' ? 'CLOSED' : status}<small>{freshness(now, updatedAt)}</small></span>
      {onToggleTheme && <button className="ca-icon-button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>}
      <button className="ca-icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullScreenError ? 'Full screen unavailable in this browser' : 'Full screen'}>
        {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </header>
    <Podium champions={champions} look={look} size={size.width < 700 ? 22 : layout.podium >= 80 ? 40 : 28} />
    {layout.roster > 0 && <Roster people={people} total={board.participantsTotal ?? board.joined} questions={board.columns.length} size={layout.roster >= 70 ? 40 : 32} />}
    {current.length === 0 ? <section className="ca-no-questions">This competition has no questions yet.</section> : layout.overview ?
      <section className="ca-overview-grid" aria-label="Question overview and selected leaderboard">
        <div className="ca-question-tiles" role="group" aria-label="Select question">
          {current.map((question, index) => <button key={question.assessmentId} style={{ '--ca-hue': sliceHue(question.number - 1) } as CSSProperties} aria-pressed={picked?.assessmentId === question.assessmentId} onClick={() => setSelected(index)} title={`Q${question.number} — ${question.title}`}>
            <b>Q{question.number}</b><span>{question.top[0] ? championshipTime(question.top[0].ms) : '—'}</span>
          </button>)}
        </div>
        {picked && <QuestionRankings key={picked.assessmentId} question={picked} flash={flash.has(picked.assessmentId)} avatarSize={avatarSize} />}
      </section> : <section className="ca-question-grid" aria-label="All question leaderboards">
        {current.map(question => <QuestionRankings key={question.assessmentId} question={question} flash={flash.has(question.assessmentId)} avatarSize={avatarSize} />)}
      </section>}
    {pages.length > 1 && <nav className="ca-pages" aria-label="Question pages">
      <button disabled={safePage === 0} onClick={() => changePage(safePage - 1)} aria-label="Previous question page"><ChevronLeft size={15} /></button>
      <span>Page {safePage + 1} / {pages.length} · Q{pages[safePage].start + 1}–{pages[safePage].start + current.length}</span>
      <button disabled={safePage === pages.length - 1} onClick={() => changePage(safePage + 1)} aria-label="Next question page"><ChevronRight size={15} /></button>
    </nav>}
    </div>
    <section className="ca-graph-section" aria-label="Graph">
      <GraphActivity source={board} table={graphTable} theme={theme} />
    </section>
  </main>;
}
