/**
 * The standalone, offline Academia app. No login: every visitor is a student
 * with a device identity. Content comes from the on-device store; marking runs
 * on the device; attempts sync when a connection returns.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Download, Plus, Search, Wifi, WifiOff, Youtube, Coins, Timer } from "lucide-react";
import {
  allAttempts, deviceId, getAdded, getCatalogue, saveAttempt, saveCatalogue, setAdded,
  type Catalogue, type PackActivity, type PackSchool, type PackSession, type LocalAttempt,
} from "@/lib/offline/academiaStore";
import { markLine } from "@/lib/offline/marking";
import { registerAcademiaSW } from "@/lib/offline/registerAcademiaSW";
import { installTargetFor, isInstalledApp, type InstallTarget } from "@/lib/offline/installTarget";
import { offlineMediaUrl, prepareOffline, type OfflineReadiness } from "@/lib/offline/prepareOffline";
import IosInstallGuide from "@/components/site/IosInstallGuide";

type View =
  | { k: "home" }
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
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [device, setDevice] = useState<{ target: InstallTarget; standalone: boolean }>({ target: "desktop", standalone: true });
  const [guideOpen, setGuideOpen] = useState(false);
  const [readiness, setReadiness] = useState<OfflineReadiness | null>(null);
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
    void registerAcademiaSW();
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void refresh().then((c) => c && setCat(c)); void syncAttempts(); };
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
      setLoaded(true);
      if (navigator.onLine) {
        const fresh = await refresh();
        if (fresh) setCat(fresh);
        void syncAttempts();
      }
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", bip);
    };
  }, []);

  const toggleAdd = async (id: string) => {
    const next = added.includes(id) ? added.filter((x) => x !== id) : [...added, id];
    setAddedState(next);
    await setAdded(next);
  };

  const onFinish = useCallback(async (a: LocalAttempt) => {
    await saveAttempt(a);
    setAttempts(await allAttempts());
    if (navigator.onLine) void syncAttempts();
  }, []);

  const schools = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (cat?.schools ?? []).filter((s) => !t || `${s.name} ${s.schoolName}`.toLowerCase().includes(t));
  }, [cat, q]);
  const mine = useMemo(() => (cat?.schools ?? []).filter((s) => added.includes(s.id)), [cat, added]);

  // Whenever there is a connection, save the app and the added schools'
  // videos onto the device so the next open needs no data.
  useEffect(() => {
    if (!loaded || !online) return;
    let live = true;
    void prepareOffline(mine, (r) => { if (live) setReadiness(r); });
    return () => { live = false; };
  }, [loaded, online, mine]);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      {guideOpen && <IosInstallGuide inSafari={target === "ios-safari"} onClose={() => setGuideOpen(false)} />}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        {view.k !== "home" && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setView(view.k === "activity" ? { k: "session", school: view.school, session: view.session, trail: view.trail } : view.k === "session" ? { k: "school", school: view.school } : { k: "home" })}
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

      <div className="mx-auto max-w-4xl px-4 py-5">
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
        {view.k === "home" && <OfflineStatus readiness={readiness} hasSchools={mine.length > 0} />}
        {view.k === "home" && (
          <>

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
                      {mine.map((s) => <SchoolCard key={s.id} s={s} added onOpen={() => setView({ k: "school", school: s })} onToggle={() => toggleAdd(s.id)} />)}
                    </div>
                  </section>
                )}
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Explore public schools</h2>
                <label className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools" className="w-full bg-transparent outline-none" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {schools.map((s) => <SchoolCard key={s.id} s={s} added={added.includes(s.id)} onOpen={() => setView({ k: "school", school: s })} onToggle={() => toggleAdd(s.id)} />)}
                  {!schools.length && <p className="text-sm text-muted-foreground">No schools match.</p>}
                </div>
              </>
            )}
          </>
        )}

        {view.k === "school" && (
          <SchoolBrowser school={view.school} attempts={attempts}
            onOpen={(session, trail) => setView({ k: "session", school: view.school, session, trail })} />
        )}

        {view.k === "session" && (
          <>
            <p className="text-xs text-muted-foreground">{view.trail}</p>
            <h1 className="mb-3 text-2xl font-bold">{view.session.title}</h1>
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
                  const best = Math.max(0, ...attempts.filter((x) => x.activityId === a.id).map((x) => x.score));
                  const max = a.lines.slice(1).reduce((n, l) => n + l.marks, 0);
                  return (
                    <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Activity {i + 1} · best {best}/{max}</p>
                      <p className="mb-3 font-mono text-lg">{a.lines[0]?.equation}</p>
                      <div className="flex gap-2">
                        {(["practice", "play"] as const).map((mode) => (
                          <button key={mode} type="button"
                            onClick={() => setView({ k: "activity", school: view.school, session: view.session, trail: view.trail, activity: a, mode })}
                            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold capitalize text-primary-foreground">
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!view.session.activities.length && <p className="text-sm text-muted-foreground">No activities in this session yet.</p>}
              </div>
            </div>
          </>
        )}

        {view.k === "activity" && (
          <ActivityPlayer key={`${view.activity.id}-${view.mode}`} activity={view.activity} sessionId={view.session.id} mode={view.mode} onFinish={onFinish} />
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

const PLAY_SECONDS = 120;

function ActivityPlayer({ activity, sessionId, mode, onFinish }: {
  activity: PackActivity; sessionId: string; mode: "practice" | "play"; onFinish: (a: LocalAttempt) => void;
}) {
  const steps = activity.lines.slice(1);
  const max = steps.reduce((n, l) => n + l.marks, 0);
  const [idx, setIdx] = useState(0);
  const [written, setWritten] = useState<string[]>(() => steps.map(() => ""));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(PLAY_SECONDS);
  const [saved, setSaved] = useState(false);
  const finished = idx >= steps.length || (mode === "play" && left <= 0);

  useEffect(() => {
    if (mode !== "play" || finished) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  useEffect(() => {
    if (!finished || saved) return;
    setSaved(true);
    onFinish({ id: crypto.randomUUID(), activityId: activity.id, sessionId, mode, score, maxScore: max, at: new Date().toISOString(), synced: false });
  }, [finished, saved, onFinish, activity.id, sessionId, mode, score, max]);

  const write = (value: string) => {
    const next = [...written];
    next[idx] = value;
    setWritten(next);
    if (markLine(steps[idx].equation, value)) {
      setScore((s) => s + steps[idx].marks);
      setIdx((i) => i + 1);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1 font-semibold"><Coins className="h-4 w-4 text-primary" /> {score}/{max}</span>
        {mode === "play" && <span className="inline-flex items-center gap-1"><Timer className="h-4 w-4" /> {Math.max(0, left)}s</span>}
        <span className="ml-auto capitalize text-muted-foreground">{mode}</span>
      </div>
      <ol className="space-y-2 rounded-xl border border-border bg-card p-4 font-mono text-lg">
        <li className="flex gap-3"><span className="w-6 text-muted-foreground">0</span><span>{activity.lines[0].equation}</span></li>
        {steps.map((l, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="w-6 text-muted-foreground">{i + 1}</span>
            {i < idx ? (
              <span className="text-[hsl(25_60%_35%)]">{written[i]} <Check className="inline h-4 w-4" /></span>
            ) : i === idx && !finished ? (
              <input autoFocus value={written[i]} onChange={(e) => write(e.target.value)} aria-label={`Line ${i + 1}`}
                className="w-full rounded-md border-2 border-primary bg-background px-2 py-1 outline-none" />
            ) : <span className="text-muted-foreground">…</span>}
          </li>
        ))}
      </ol>
      {!finished && steps[idx]?.fillers.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Floating Numbers">
          {steps[idx].fillers.map((f, i) => (
            <button key={i} type="button" onClick={() => write(`${written[idx]}${written[idx] && !/^[+\-=)]/.test(f) ? " " : ""}${f}`)}
              className="min-w-[44px] rounded-lg bg-primary px-3 py-2 font-mono font-semibold text-primary-foreground">
              {f}
            </button>
          ))}
          <button type="button" onClick={() => write("")} className="rounded-lg border border-border px-3 py-2 text-sm">Clear</button>
        </div>
      )}
      {finished && (
        <p className="mt-4 rounded-xl border border-border bg-card p-4 text-center font-semibold">
          {idx >= steps.length ? "Well done!" : "Time's up."} Score {score}/{max}
        </p>
      )}
    </div>
  );
}

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** Same order as the signed-in student view: Class → Subject → Topic → Subtopic → Session. */
function SchoolBrowser({ school, attempts, onOpen }: {
  school: PackSchool; attempts: LocalAttempt[]; onOpen: (s: PackSession, trail: string) => void;
}) {
  const [ci, setCi] = useState(0);
  const [si, setSi] = useState(0);
  const [ti, setTi] = useState(0);
  const [ui, setUi] = useState(0);
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
