/**
 * The standalone, offline Academia app. No login: every visitor is a student
 * with a device identity. Content comes from the on-device store; marking runs
 * on the device; attempts sync when a connection returns.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Plus, Search, Wifi, WifiOff, Youtube, BarChart3, Home, BookOpen, History, School } from "lucide-react";
import { HomeScreen, HistoryScreen, EvaluationScreen, ReviewScreen } from "@/pages/academiaApp/AcademiaScreens";
import { ensureAttempt, recordMarks, removeAttempt, recoverAttempt, currentAttempt, type SessionAttempt, type SessionContext } from "@/lib/offline/evaluation";
import {
  allAttempts, allSessionAttempts, saveSessionAttempt, getKv, setKv, deviceId, getAdded, getCatalogue, saveAttempt, saveCatalogue, setAdded,
  type Catalogue, type PackActivity, type PackSchool, type PackSession, type LocalAttempt,
} from "@/lib/offline/academiaStore";
import { markLine } from "@/lib/offline/marking";
import { registerAcademiaSW } from "@/lib/offline/registerAcademiaSW";
import { installTargetFor, isInstalledApp, type InstallTarget } from "@/lib/offline/installTarget";
import { offlineMediaUrl, prepareOffline, type OfflineReadiness } from "@/lib/offline/prepareOffline";
import IosInstallGuide from "@/components/site/IosInstallGuide";
import OfflineActivity from "@/pages/academiaApp/OfflineActivity";
import { summariseAttempts } from "@/lib/offline/results";
import { sessionPlaySequence } from "@/lib/academia/playSequence";
import { getReady, getReadyAt } from "@/lib/offline/getReady";
import { GameLoadingScreen } from "@/components/gameslate/GameLoadingScreen";
import { RefreshCw } from "lucide-react";

type View =
  | { k: "home" }
  | { k: "results" }
  | { k: "history" }
  | { k: "evaluation" }
  | { k: "schools" }
  | { k: "learn" }
  | { k: "review"; attempt: SessionAttempt }
  | { k: "school"; school: PackSchool }
  | { k: "session"; school: PackSchool; session: PackSession; trail: string }
  | { k: "activity"; school: PackSchool; session: PackSession; trail: string; activity: PackActivity; mode: "practice" | "play" };

type InstallEvent = Event & { prompt: () => Promise<void> };

async function refresh(): Promise<Catalogue | null> {
  try {
    const r = await fetch("/api/public/academia-pack", { cache: "no-store" });
    if (!r.ok) return null;
    const c = (await r.json()) as Catalogue;
    await saveCatalogue(c);
    return c;
  } catch {
    return null;
  }
}

async function syncAttempts() {
  const pending = (await allAttempts()).filter((a) => !a.synced);
  if (!pending.length) return;
  try {
    const r = await fetch("/api/public/academia-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: await deviceId(), attempts: pending }),
    });
    if (!r.ok) return;
    const { synced } = (await r.json()) as { synced: string[] };
    for (const a of pending) if (synced.includes(a.id)) await saveAttempt({ ...a, synced: true });
  } catch { /* stay queued */ }
}

type SessionHit = { school: PackSchool; session: PackSession; trail: string; ctx: SessionContext; path: [number, number, number, number] };
function sessionIndex(cat: Catalogue | null) {
  const m = new Map<string, SessionHit>();
  for (const school of cat?.schools ?? []) school.classes.forEach((c, ci) => c.subjects.forEach((sub, si) => sub.topics.forEach((t, ti) => t.subtopics.forEach((st, ui) => st.sessions.forEach((session) => {
    const activityMax: Record<string, number> = {};
    for (const a of session.activities) {
      const board = a.board ?? a.game?.board ?? null;
      activityMax[a.id] = board ? board.totalMarks : a.lines.slice(1).reduce((n, l) => n + l.marks, 0);
    }
    const trail = `${c.name} · ${sub.name} · ${t.name} · ${st.name}`;
    m.set(session.id, { school, session, trail, path: [ci, si, ti, ui], ctx: {
      sessionId: session.id, sessionTitle: session.title, trail, schoolId: school.id, classId: c.id,
      subjectId: sub.id, subjectName: sub.name, topicId: t.id, topicName: t.name, subtopicId: st.id, subtopicName: st.name, activityMax,
    } });
  }))))); 
  return m;
}

const sessionsOf = (s: PackSchool) =>
  s.classes.flatMap((c) => c.subjects.flatMap((sub) => sub.topics.flatMap((t) => t.subtopics.flatMap((st) =>
    st.sessions.map((se) => ({ session: se, trail: `${c.name} · ${sub.name} · ${t.name} · ${st.name}` }))))));

export default function AcademiaApp() {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [added, setAddedState] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<LocalAttempt[]>([]);
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ k: "home" });
  const [sAttempts, setSAttempts] = useState<SessionAttempt[]>([]);
  const sRef = useRef<SessionAttempt[]>([]);
  const [histTab, setHistTab] = useState<"started" | "completed">("started");
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [browseStart, setBrowseStart] = useState<{ school: string; path: number[] } | null>(null);
  const restartRef = useRef(new Set<string>());
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [device, setDevice] = useState<{ target: InstallTarget; standalone: boolean }>({ target: "desktop", standalone: true });
  const [guideOpen, setGuideOpen] = useState(false);
  const [readiness] = useState<OfflineReadiness | null>(null);
  const [readyAt, setReadyAt] = useState<string | null>(null);
  const [dl, setDl] = useState<{ percent: number; error: string | null } | null>(null);
  useEffect(() => {
    const target = installTargetFor(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    const standalone = isInstalledApp();
    setDevice({ target, standalone });
    // Arriving from the front page's Download button opens the guide straight away.
    if (!standalone && target.startsWith("ios") && new URLSearchParams(window.location.search).get("install") === "1") setGuideOpen(true);
  }, []);
  const { target, standalone } = device;
  const isAndroid = target === "android";
  const isIOS = target === "ios-safari" || target === "ios-other-browser";

  useEffect(() => {
    // Tells the boot watchdog (academia-app route head) the app really started.
    (window as unknown as { __academiaReady?: boolean }).__academiaReady = true;
    try { sessionStorage.removeItem("aca-repair"); } catch { /* ignore */ }
    void registerAcademiaSW();
    setOnline(navigator.onLine);
    // Content never updates by itself: only the first download or the Update button.
    const on = () => { setOnline(true); void syncAttempts(); };
    const off = () => setOnline(false);
    const bip = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallEvent); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", bip);
    (async () => {
      const local = await getCatalogue().catch(() => undefined);
      if (local) setCat(local);
      setAddedState(await getAdded().catch(() => []));
      setAttempts(await allAttempts().catch(() => []));
      const sa = await allSessionAttempts().catch(() => [] as SessionAttempt[]);
      sRef.current = sa; setSAttempts(sa);
      setCurrentSchoolId((await getKv<string>("currentSchool").catch(() => undefined)) ?? null);
      setReadyAt((await getReadyAt().catch(() => undefined)) ?? null);
      setLoaded(true);
      if (navigator.onLine) void syncAttempts();
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", bip);
    };
  }, []);

  const [videos, setVideos] = useState<{ done: number; total: number } | null>(null);
  const runDownload = useCallback(async (ids: string[]) => {
    if (!navigator.onLine) { setDl({ percent: 0, error: "Connect to the internet to update." }); return; }
    setDl({ percent: 5, error: null });
    const r = await getReady(ids, (p) => setDl({ percent: p, error: null }), (d, t) => setVideos(t ? { done: d, total: t } : null));
    if (r.ok) { setCat(r.catalogue); setReadyAt(r.at); setDl(null); }
    else setDl({ percent: 0, error: r.reason === "offline" ? "Connect to the internet to update." : "The download did not finish. Your saved copy is unchanged — try again." });
  }, []);

  // First open: download everything once, with data, before the app is used.
  useEffect(() => {
    if (loaded && !readyAt && !dl) void runDownload(added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, readyAt]);

  const toggleAdd = async (id: string) => {
    const adding = !added.includes(id);
    const next = adding ? [...added, id] : added.filter((x) => x !== id);
    setAddedState(next);
    await setAdded(next);
    if (adding && navigator.onLine) void runDownload(next);
  };

  const onFinish = useCallback(async (a: LocalAttempt) => {
    await saveAttempt(a);
    setAttempts(await allAttempts());
    if (navigator.onLine) void syncAttempts();
  }, []);

  const sessions = useMemo(() => sessionIndex(cat), [cat]);
  const putAttempts = useCallback((next: SessionAttempt[], changed: SessionAttempt[]) => {
    sRef.current = next; setSAttempts(next);
    for (const a of changed) void saveSessionAttempt(a);
  }, []);
  /** First mathematical input in Practice or Play: resume, or start one new attempt. */
  const onMathInput = useCallback((sessionId: string) => {
    const hit = sessions.get(sessionId);
    if (!hit) return;
    const restart = restartRef.current.has(sessionId);
    const r = ensureAttempt(sRef.current, hit.ctx, { now: new Date().toISOString(), id: crypto.randomUUID(), restart });
    restartRef.current.delete(sessionId);
    if (r.created) putAttempts(r.attempts, r.attempts.filter((a) => a.id === r.attempt.id || a.sessionId === sessionId));
  }, [putAttempts, sessions]);
  const onMarks = useCallback((sessionId: string, activityId: string, mode: "practice" | "play", lineId: string, marks: number) => {
    onMathInput(sessionId);
    const cur = currentAttempt(sRef.current, sessionId);
    if (!cur) return;
    const next = recordMarks(cur, { eventId: `${activityId}:${mode}:${lineId}`, activityId, mode, marks, now: new Date().toISOString() });
    if (next !== cur) putAttempts(sRef.current.map((a) => (a.id === cur.id ? next : a)), [next]);
  }, [onMathInput, putAttempts]);
  const updateOne = (a: SessionAttempt) => putAttempts(sRef.current.map((x) => (x.id === a.id ? a : x)), [a]);
  const openSessionId = (id: string) => { const h = sessions.get(id); if (h) setView({ k: "session", school: h.school, session: h.session, trail: h.trail }); };
  const restartSession = (a: SessionAttempt) => { restartRef.current.add(a.sessionId); openSessionId(a.sessionId); };
  const chooseSchool = (id: string) => { setCurrentSchoolId(id); void setKv("currentSchool", id); };

  const schools = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (cat?.schools ?? []).filter((s) => !t || `${s.name} ${s.schoolName}`.toLowerCase().includes(t));
  }, [cat, q]);
  const summaries = useMemo(() => summariseAttempts(attempts), [attempts]);
  const lookup = useMemo(() => {
    const m = new Map<string, { school: PackSchool; session: PackSession; trail: string; activity: PackActivity }>();
    for (const school of cat?.schools ?? []) for (const { session, trail } of sessionsOf(school))
      for (const activity of session.activities) m.set(activity.id, { school, session, trail, activity });
    return m;
  }, [cat]);
  const mine = useMemo(() => (cat?.schools ?? []).filter((s) => added.includes(s.id)), [cat, added]);
  const currentSchool = useMemo(() => (cat?.schools ?? []).find((s) => s.id === currentSchoolId) ?? mine[0] ?? null, [cat, currentSchoolId, mine]);
  const recent = useMemo(() => {
    const seen = new Map<string, { sessionId: string; title: string; trail: string; status: string; at: string }>();
    for (const a of [...sAttempts].filter((x) => x.status !== "removed").sort((x, y) => y.lastAt.localeCompare(x.lastAt)))
      if (!seen.has(a.sessionId)) seen.set(a.sessionId, { sessionId: a.sessionId, title: a.sessionTitle, trail: a.trail, status: a.status === "completed" ? "Completed" : "In progress", at: a.lastAt });
    return [...seen.values()].slice(0, 5);
  }, [sAttempts]);
  const tab = view.k === "history" || view.k === "review" ? "history" : view.k === "evaluation" ? "evaluation" : view.k === "schools" ? "schools" : view.k === "home" ? "home" : "learn";
  const goTab = (t: string) => {
    if (t === "learn") setView(currentSchool ? { k: "school", school: currentSchool } : { k: "schools" });
    else setView({ k: t as "home" });
  };
  const activityTitles = useMemo(() => Object.fromEntries([...lookup.entries()].map(([id, h]) => [id, h.activity.title])), [lookup]);


  const downloading = dl && !dl.error;
  if (loaded && (downloading || (!readyAt && dl))) {
    return (
      <main className="relative min-h-[100dvh] bg-background">
        <GameLoadingScreen progress={dl?.percent ?? 5} restoring={Boolean(readyAt)} />
        {dl?.error && (
          <div className="absolute inset-x-0 bottom-10 z-50 flex flex-col items-center gap-3 px-6 text-center">
            <p className="text-sm text-foreground">{readyAt ? dl.error : "Academia needs the internet once to download everything. Turn on data, then try again."}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void runDownload(added)} className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">Try again</button>
              {readyAt && <button type="button" onClick={() => setDl(null)} className="rounded-full border border-border px-5 py-2">Keep my saved copy</button>}
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      {guideOpen && <IosInstallGuide inSafari={target === "ios-safari"} onClose={() => setGuideOpen(false)} />}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        {view.k !== "home" && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setView(view.k === "activity" ? { k: "session", school: view.school, session: view.session, trail: view.trail } : view.k === "session" ? { k: "school", school: view.school } : view.k === "review" ? { k: "history" } : { k: "home" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:border-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <img src="/academia-icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
        <span className="font-semibold tracking-wide">Academia</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {online ? "Online" : "Offline"}
        </span>
        {installEvt && (
          <button type="button" onClick={() => installEvt.prompt().then(() => setInstallEvt(null))}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
            <Download className="h-4 w-4" /> Install
          </button>
        )}
      </header>

      <nav aria-label="Academia" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:top-[57px] md:w-52 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-3">
        {([["home", "Home", Home], ["learn", "Learn", BookOpen], ["history", "History", History], ["evaluation", "Evaluation", BarChart3], ["schools", "Schools", School]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => goTab(k)} aria-current={tab === k ? "page" : undefined}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold md:min-h-[44px] md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm ${tab === k ? "text-primary md:bg-primary/10" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </nav>
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:pb-8 md:pl-56">
        {view.k === "home" && !standalone && (
          <section aria-label="Install Academia" className="mb-5 rounded-2xl border border-primary/40 bg-card p-4">
            <p className="font-semibold">Install Academia on this device</p>
            <p className="mt-1 text-sm text-muted-foreground">Opens from its own icon and works with no data. No account needed.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {isAndroid && (
                <a href="/mathgpl-academia.apk" download className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground">
                  <Download className="h-5 w-5" /> Download Android app
                </a>
              )}
              {isIOS && (
                <button type="button" onClick={() => setGuideOpen(true)}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground">
                  <Download className="h-5 w-5" /> Install Academia
                </button>
              )}
              {installEvt && (
                <button type="button" onClick={() => installEvt.prompt().then(() => setInstallEvt(null))}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border border-primary px-5 font-semibold text-primary">
                  <Download className="h-5 w-5" /> Install now
                </button>
              )}
            </div>
            {isAndroid && <p className="mt-2 text-xs text-muted-foreground">Open the downloaded file and tap Install. If your phone asks, allow installs from your browser.</p>}
            {isIOS && <p className="mt-2 text-xs text-muted-foreground">Takes three taps in Safari. The button shows you exactly where.</p>}
            {!isAndroid && !isIOS && !installEvt && <p className="mt-2 text-sm text-muted-foreground">In Chrome or Edge, click the Install icon at the right of the address bar.</p>}
          </section>
        )}
        {view.k === "home" && loaded && (
          <div className="mb-5">
            <HomeScreen school={currentSchool} attempts={sAttempts} recent={recent}
              onContinue={(a) => openSessionId(a.sessionId)} onOpenSession={openSessionId}
              onTab={(t, sub) => { if (sub) setHistTab(sub); goTab(t); }}
              onSubject={(ci, si) => { if (currentSchool) { setBrowseStart({ school: currentSchool.id, path: [ci, si, 0, 0] }); setView({ k: "school", school: currentSchool }); } }} />
          </div>
        )}
        {view.k === "history" && (
          <HistoryScreen attempts={sAttempts} tab={histTab} setTab={setHistTab}
            onContinue={(a) => openSessionId(a.sessionId)} onRestart={restartSession}
            onRemove={(a) => updateOne(removeAttempt(a, new Date().toISOString()))} onRecover={(a) => updateOne(recoverAttempt(a))}
            onReview={(a) => setView({ k: "review", attempt: a })} />
        )}
        {view.k === "review" && <ReviewScreen attempt={view.attempt} titles={activityTitles} />}
        {view.k === "evaluation" && <EvaluationScreen attempts={sAttempts} />}
        {view.k === "results" && (
          <section aria-label="My results">
            <h1 className="mb-3 text-2xl font-bold">My results</h1>
            {!attempts.length && <p className="text-sm text-muted-foreground">No attempts yet.</p>}
            <ul className="space-y-2">
              {[...attempts].sort((x, y) => y.at.localeCompare(x.at)).map((at) => {
                const hit = lookup.get(at.activityId);
                return (
                  <li key={at.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-muted-foreground">{hit ? `${hit.school.name} · ${hit.session.title}` : "Activity"}</p>
                        <p className="truncate font-semibold">{hit?.activity.title ?? "Activity"} <span className="text-xs font-normal capitalize text-muted-foreground">· {at.mode}</span></p>
                      </div>
                      <span className="text-lg font-bold">{at.score}/{at.maxScore}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(at.at).toLocaleString()}
                      {at.lines ? ` · ${at.lines.filter((l) => l.correct).length}/${at.lines.length} lines right` : ""}
                      {at.seconds != null ? ` · ${at.seconds}s` : ""}
                      {at.synced ? " · sent to school" : " · saved on this device"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {view.k === "home" && (
          <section aria-label="Update" className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{readyAt ? "Saved on this phone — works with no data" : "Not downloaded yet"}</p>
              {readyAt && <p className="text-xs text-muted-foreground">Last updated {new Date(readyAt).toLocaleString()}</p>}
              {videos && videos.done < videos.total && <p className="text-xs text-muted-foreground">Videos: {videos.done} of {videos.total} saved</p>}
              {dl?.error && <p className="text-xs text-destructive">{dl.error}</p>}
            </div>
            <button type="button" onClick={() => void runDownload(added)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground">
              <RefreshCw className="h-4 w-4" /> Update
            </button>
          </section>
        )}
        {view.k === "home" && readiness && <OfflineStatus readiness={readiness} hasSchools={mine.length > 0} />}
        {view.k === "schools" && (
          <>
            <h1 className="mb-3 text-2xl font-bold">Schools</h1>
            {currentSchool && (
              <section className="mb-5 rounded-2xl border border-primary/40 bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current school</p>
                <p className="text-lg font-bold">{currentSchool.name}</p>
                <p className="text-sm text-muted-foreground">{currentSchool.schoolName}</p>
              </section>
            )}
            {!loaded ? <p className="text-muted-foreground">Opening…</p> : !cat ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Connect to the internet once to download the public schools. After that, everything works offline.
              </p>
            ) : (
              <>
                {mine.length > 0 && (
                  <section className="mb-6">
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">My schools</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {mine.map((s) => <SchoolCard key={s.id} s={s} added onOpen={() => { chooseSchool(s.id); setView({ k: "school", school: s }); }} onToggle={() => toggleAdd(s.id)} />)}
                    </div>
                  </section>
                )}
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Explore public schools</h2>
                <label className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools" className="w-full bg-transparent outline-none" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {schools.map((s) => <SchoolCard key={s.id} s={s} added={added.includes(s.id)} onOpen={() => { chooseSchool(s.id); setView({ k: "school", school: s }); }} onToggle={() => { if (!added.includes(s.id)) chooseSchool(s.id); void toggleAdd(s.id); }} />)}
                  {!schools.length && <p className="text-sm text-muted-foreground">No schools match.</p>}
                </div>
              </>
            )}
          </>
        )}

        {view.k === "school" && (
          <SchoolBrowser key={view.school.id + (browseStart?.path.join() ?? "")} school={view.school} attempts={attempts} start={browseStart?.school === view.school.id ? browseStart.path : undefined}
            onOpen={(session, trail) => setView({ k: "session", school: view.school, session, trail })} />
        )}

        {view.k === "session" && (
          <>
            <p className="text-xs text-muted-foreground">{view.trail}</p>
            <h1 className="mb-3 text-2xl font-bold">{view.session.title}</h1>
            {(() => {
              const cur = currentAttempt(sAttempts, view.session.id);
              const pending = restartRef.current.has(view.session.id);
              const done = sAttempts.filter((x) => x.sessionId === view.session.id && x.status === "completed").length;
              return (
                <p className="mb-3 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                  {pending ? "Restart ready: a new attempt starts when you write your first step." : cur ? `Attempt ${cur.attemptNo} in progress · ${Object.keys(cur.modeEarned).length ? "marks are being saved on this device" : "no marks yet"}` : "Watching or reading does not start an attempt. It starts when you write your first step in Practice or Play."}
                  {done ? ` · Completed ${done} time${done === 1 ? "" : "s"}` : ""}
                </p>
              );
            })()}
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="md:sticky md:top-20 md:self-start">
                {view.session.videoUrl ? (
                  !youtubeEmbed(view.session.videoUrl) ? (
                    // Saved videos play from the device, with or without data.
                    <video src={offlineMediaUrl(view.session.videoUrl)} controls playsInline className="aspect-video w-full rounded-xl border border-border bg-muted" />
                  ) : online ? (
                    <iframe title="Session video" src={youtubeEmbed(view.session.videoUrl)!} allowFullScreen
                      className="aspect-video w-full rounded-xl border border-border bg-muted" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-muted p-4 text-center text-sm text-muted-foreground">
                      <span><Youtube className="mx-auto mb-2 h-6 w-6" />Internet needed to watch this YouTube video. The activities work offline.</span>
                    </div>
                  )
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">No video for this session</div>
                )}
                {view.session.description && <p className="mt-3 text-sm text-muted-foreground">{view.session.description}</p>}
              </div>
              <div className="space-y-3">
                {view.session.activities.map((a, i) => {
                  const sum = summaries.get(a.id);
                  const offlineBoard = a.board ?? a.game?.board ?? null;
                  const max = offlineBoard ? offlineBoard.totalMarks : a.lines.slice(1).reduce((n, l) => n + l.marks, 0);
                  const ready = offlineBoard ? true : a.lines.length > 1;
                  return (
                    <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                      {a.imageUrl && <img src={offlineMediaUrl(a.imageUrl)} alt="" loading="lazy" className="mb-3 max-h-40 w-full rounded-lg object-contain" />}
                      <p className="text-xs text-muted-foreground">Activity {i + 1}{sum ? ` · best ${sum.best}/${max} · last ${sum.latest}/${max}` : ""}</p>
                      <p className="font-semibold">{a.title}</p>
                      {ready ? <p className="mb-3 font-mono text-lg">{offlineBoard?.questionText ?? a.lines[0]?.equation}</p> : <p className="mb-1 text-sm text-muted-foreground">No question yet</p>}
                      {ready && (
                        <div className="flex gap-2">
                          {(a.game ? (["practice", "play"] as const) : (["practice"] as const)).map((mode) => (
                            <button key={mode} type="button"
                              onClick={() => setView({ k: "activity", school: view.school, session: view.session, trail: view.trail, activity: a, mode })}
                              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold capitalize text-primary-foreground">
                              {mode}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!view.session.activities.length && <p className="text-sm text-muted-foreground">No activities in this session yet.</p>}
                {(() => {
                  const hit = sessions.get(view.session.id);
                  const list = hit ? hit.school.classes[hit.path[0]]?.subjects[hit.path[1]]?.topics[hit.path[2]]?.subtopics[hit.path[3]]?.sessions ?? [] : [];
                  const i = list.findIndex((x) => x.id === view.session.id);
                  const prev = list[i - 1], next = list[i + 1];
                  return (prev || next) ? (
                    <div className="flex gap-2 pt-2">
                      {prev && <button type="button" onClick={() => openSessionId(prev.id)} className="flex-1 truncate rounded-full border border-border px-4 py-2 text-sm">← {prev.title}</button>}
                      {next && <button type="button" onClick={() => openSessionId(next.id)} className="flex-1 truncate rounded-full border border-border px-4 py-2 text-sm">{next.title} →</button>}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </>
        )}

        {view.k === "activity" && (
          <>
            <p className="text-xs text-muted-foreground">{view.session.title}</p>
            <h1 className="mb-3 text-xl font-bold">{view.activity.title}</h1>
            <OfflineActivity key={`${view.activity.id}-${view.mode}`} activity={view.activity} sessionId={view.session.id} mode={view.mode} onFinish={onFinish}
              onMathInput={() => onMathInput(view.session.id)}
              onMarks={(e) => onMarks(view.session.id, view.activity.id, view.mode, e.lineId, e.marks)}
              onBack={() => setView({ k: "session", school: view.school, session: view.session, trail: view.trail })}
              playPosition={view.mode === "play" ? sessionPlaySequence(view.session.activities, view.activity.id, activity => !!activity.game) : undefined}
              onContinue={(() => {
                if (view.mode === "play") {
                  const { next } = sessionPlaySequence(view.session.activities, view.activity.id, activity => !!activity.game);
                  return next ? () => setView({ ...view, activity: next, mode: "play" }) : undefined;
                }
                const index = view.session.activities.findIndex((activity) => activity.id === view.activity.id);
                const next = view.session.activities[index + 1];
                return next ? () => setView({ ...view, activity: next }) : undefined;
              })()} />
          </>
        )}
      </div>
    </main>
  );
}

function OfflineStatus({ readiness, hasSchools }: { readiness: OfflineReadiness | null; hasSchools: boolean }) {
  if (!readiness) return null;
  if (readiness.state === "unsupported") {
    return <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">Offline saving starts once Academia is opened from mathgpl.com.</p>;
  }
  if (readiness.state === "working") {
    if (readiness.total === 0) return null;
    const pct = Math.round((readiness.done / readiness.total) * 100);
    return (
      <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3" aria-live="polite">
        <p className="text-sm font-semibold">Saving for offline… {readiness.done}/{readiness.total} videos</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/40 bg-card px-4 py-3" aria-live="polite">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="text-sm">
        <p className="font-semibold">Ready offline</p>
        <p className="text-xs text-muted-foreground">
          {hasSchools ? "Your schools and activities work with no data." : "Add a school below to keep it on this device."}
          {readiness.skipped > 0 ? ` ${readiness.skipped} very large video${readiness.skipped === 1 ? "" : "s"} still need data.` : ""}
          {" "}To test, switch on airplane mode and open Academia.
        </p>
      </div>
    </div>
  );
}

function SchoolCard({ s, added, onOpen, onToggle }: { s: PackSchool; added: boolean; onOpen: () => void; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate font-semibold">{s.name}</p>
        <p className="truncate text-xs text-muted-foreground">{s.schoolName}</p>
      </button>
      <button type="button" onClick={onToggle} aria-label={added ? "Remove from my schools" : "Add to my schools"}
        className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ${added ? "bg-primary text-primary-foreground" : "border border-border"}`}>
        {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {added ? "Added" : "Add"}
      </button>
    </div>
  );
}

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** Same order as the signed-in student view: Class → Subject → Topic → Subtopic → Session. */
function SchoolBrowser({ school, attempts, onOpen, start }: {
  school: PackSchool; attempts: LocalAttempt[]; onOpen: (s: PackSession, trail: string) => void; start?: number[];
}) {
  const [ci, setCi] = useState(start?.[0] ?? 0);
  const [si, setSi] = useState(start?.[1] ?? 0);
  const [ti, setTi] = useState(start?.[2] ?? 0);
  const [ui, setUi] = useState(start?.[3] ?? 0);
  // Remember the last class/subject/topic/subtopic for each school.
  const [restored, setRestored] = useState(!!start);
  useEffect(() => {
    if (start) return;
    void getKv<number[]>(`browse:${school.id}`).then((p) => { if (p) { setCi(p[0] ?? 0); setSi(p[1] ?? 0); setTi(p[2] ?? 0); setUi(p[3] ?? 0); } }).finally(() => setRestored(true));
  }, [school.id, start]);
  useEffect(() => { if (restored) void setKv(`browse:${school.id}`, [ci, si, ti, ui]); }, [ci, si, ti, ui, restored, school.id]);
  const cls = school.classes[ci];
  const subj = cls?.subjects[si];
  const topic = subj?.topics[ti];
  const sub = topic?.subtopics[ui];
  const col = (title: string, items: { id: string; name: string }[], sel: number, pick: (i: number) => void) => (
    <div className="min-w-0 rounded-xl border border-border bg-card p-2">
      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.map((it, i) => (
        <button key={it.id} type="button" onClick={() => pick(i)}
          className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${i === sel ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          {it.name}
        </button>
      ))}
      {!items.length && <p className="px-2 py-2 text-xs text-muted-foreground">None yet</p>}
    </div>
  );
  return (
    <>
      <h1 className="text-2xl font-bold">{school.name}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{school.schoolName}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {col("Class", school.classes, ci, (i) => { setCi(i); setSi(0); setTi(0); setUi(0); })}
        {col("Subject", cls?.subjects ?? [], si, (i) => { setSi(i); setTi(0); setUi(0); })}
        {col("Topic", subj?.topics ?? [], ti, (i) => { setTi(i); setUi(0); })}
        {col("Subtopic", topic?.subtopics ?? [], ui, setUi)}
      </div>
      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sessions</h2>
      <div className="space-y-2">
        {(sub?.sessions ?? []).map((session, n) => {
          const done = attempts.some((a) => a.sessionId === session.id);
          const trail = [cls?.name, subj?.name, topic?.name, sub?.name].join(" › ");
          return (
            <button key={session.id} type="button" onClick={() => onOpen(session, trail)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{n + 1}</span>
              <span className="min-w-0 flex-1 font-semibold">{session.title}</span>
              {done && <Check className="h-5 w-5 text-primary" />}
            </button>
          );
        })}
        {!sub?.sessions.length && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
      </div>
    </>
  );
}
