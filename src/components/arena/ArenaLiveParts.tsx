// Timer Arena Live Report — the Champions Wheel, Top 5 cards and student strip.
// Built from the Mathemagine tokens (.mm-app) so it matches the app's navy + gold look.
import { Clock, Crown, TimerOff } from "lucide-react";
import ArenaAvatar from "@/components/arena/ArenaAvatar";
import type { ArenaColumn, ArenaPerson } from "@/lib/arena/arenaClient";
import { agoText } from "@/lib/arena/presence";
import { isArenaPhotoPath } from "@/lib/arena/photo";
import { sliceHue } from "@/lib/arena/liveBoard";
import { avatarEmoji, formatArenaMs, sectorAngle } from "@/lib/arena/ranking";

const GOLD = "hsl(var(--mm-accent))";
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};
const clip = (name: string, n: number) =>
  name.length > n ? `${name.slice(0, n - 1)}…` : name;

/** One slice per question; each slice shows that question's champion. */
export const ChampionsWheel = ({
  cols,
  startIndex,
  flash,
}: {
  cols: ArenaColumn[];
  startIndex: number;
  flash: Set<string>;
}) => {
  const n = cols.length;
  const angle = sectorAngle(n);
  const R = 236,
    cx = 260,
    cy = 260;
  return (
    <svg
      viewBox="0 0 520 520"
      className="mx-auto h-auto w-full max-w-[min(100%,66vh)]"
      role="img"
      aria-label="Champions Wheel"
    >
      <defs>
        <radialGradient id="mm-hub" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="hsl(222 70% 34%)" />
          <stop offset="100%" stopColor="hsl(224 60% 10%)" />
        </radialGradient>
        {cols.map((q, i) => {
          const hue = sliceHue(startIndex + i);
          return (
            <radialGradient
              key={`g${q.assessmentId}`}
              id={`mm-slice-${i}`}
              cx="50%"
              cy="50%"
              r="75%"
            >
              <stop offset="0%" stopColor={`hsl(${hue} / 0.55)`} />
              <stop offset="100%" stopColor={`hsl(${hue})`} />
            </radialGradient>
          );
        })}
        {cols.map((q, i) => {
          const a0 = i * angle;
          const [px, py] = polar(cx, cy, R * 0.64, a0 + angle / 2);
          return (
            <clipPath key={`c${q.assessmentId}`} id={`mm-photo-${i}`}>
              <circle cx={px} cy={py - 14} r={30} />
            </clipPath>
          );
        })}
        <filter id="mm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={R + 14}
        fill="none"
        stroke={GOLD}
        strokeWidth={7}
        filter="url(#mm-glow)"
        opacity={0.9}
      />
      {cols.map((q, i) => {
        const a0 = i * angle,
          a1 = a0 + angle;
        const [x0, y0] = polar(cx, cy, R, a0);
        const [x1, y1] = polar(cx, cy, R, a1);
        const large = angle > 180 ? 1 : 0;
        const d =
          n === 1
            ? `M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${R * 2} 0 a ${R} ${R} 0 1 0 ${-R * 2} 0`
            : `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
        const [tx, ty] = polar(cx, cy, R * 0.64, a0 + angle / 2);
        const champ = q.top[0];
        const photo =
          champ && isArenaPhotoPath(champ.photo) ? champ.photo : null;
        return (
          <g
            key={q.assessmentId}
            className={flash.has(q.assessmentId) ? "arena-record" : undefined}
          >
            <path
              d={d}
              fill={`url(#mm-slice-${i})`}
              stroke="hsl(var(--background))"
              strokeWidth={3}
            />
            <text
              x={tx}
              y={ty - 56}
              textAnchor="middle"
              fontSize={22}
              fontWeight={800}
              fill="#fff"
              stroke="hsl(226 62% 10% / .55)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              Q{q.number}
            </text>
            {champ ? (
              <>
                {q.photosEnabled !== false && <>
                <circle
                  cx={tx}
                  cy={ty - 14}
                  r={33}
                  fill="hsl(var(--background))"
                  stroke={GOLD}
                  strokeWidth={3}
                />
                {photo ? (
                  <image
                    href={photo}
                    x={tx - 30}
                    y={ty - 44}
                    width={60}
                    height={60}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#mm-photo-${i})`}
                  />
                ) : (
                  <text x={tx} y={ty - 3} textAnchor="middle" fontSize={34}>
                    {avatarEmoji(champ.avatar)}
                  </text>
                )}
                </>}
                <text
                  x={tx}
                  y={ty + 40}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={800}
                  fill="#fff"
                  stroke="hsl(226 62% 10% / .6)"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {formatArenaMs(champ.ms)}
                </text>
                <text
                  x={tx}
                  y={ty + 60}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  fill="#fff"
                  stroke="hsl(226 62% 10% / .6)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {clip(champ.name, 13)}
                </text>
              </>
            ) : (
              <>
                <circle
                  cx={tx}
                  cy={ty - 14}
                  r={30}
                  fill="hsl(0 0% 100% / .12)"
                  stroke="hsl(0 0% 100% / .5)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
                <text
                  x={tx}
                  y={ty - 4}
                  textAnchor="middle"
                  fontSize={26}
                  opacity={0.8}
                >
                  {q.timerEnabled === false ? "⏱️" : "🏁"}
                </text>
                <text
                  x={tx}
                  y={ty + 40}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#fff"
                  stroke="hsl(226 62% 10% / .6)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {q.timerEnabled === false ? "Timer off" : "No champion yet"}
                </text>
              </>
            )}
          </g>
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={66}
        fill="url(#mm-hub)"
        stroke={GOLD}
        strokeWidth={5}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={34}>
        🏆
      </text>
      <text
        x={cx}
        y={cy + 20}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        letterSpacing={1.5}
        fill={GOLD}
      >
        CHAMPIONS
      </text>
      <text
        x={cx}
        y={cy + 35}
        textAnchor="middle"
        fontSize={9}
        letterSpacing={1}
        fill="hsl(215 30% 80%)"
      >
        FASTEST CORRECT
      </text>
    </svg>
  );
};

const PLACE_STYLE = [
  {
    bg: "linear-gradient(135deg, hsl(44 96% 60%), hsl(32 95% 52%))",
    fg: "hsl(226 62% 10%)",
  },
  {
    bg: "linear-gradient(135deg, hsl(215 18% 86%), hsl(215 14% 68%))",
    fg: "hsl(226 62% 10%)",
  },
  {
    bg: "linear-gradient(135deg, hsl(28 70% 60%), hsl(22 65% 46%))",
    fg: "hsl(0 0% 100%)",
  },
];

/** One question's Top 5 — champion row is large and gold-framed. */
export const TopFiveCard = ({
  q,
  hue,
  flash,
}: {
  q: ArenaColumn;
  hue: string;
  flash: boolean;
}) => (
  <article
    className={`mm-arena-card min-w-0 overflow-hidden ${flash ? "arena-record" : ""}`}
    aria-label={`Top 5 for question ${q.number}`}
  >
    <header
      className="flex items-center gap-2 px-4 py-3 text-white"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue}), hsl(${hue} / 0.65))`,
      }}
    >
      <span className="text-xl font-extrabold tracking-tight">Q{q.number}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold opacity-95">
        {q.title}
      </span>
      {q.timerEnabled === false ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold">
          <TimerOff className="h-3 w-3" aria-hidden /> Timer off
        </span>
      ) : (
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">
          {q.rankedCount} ranked
        </span>
      )}
    </header>
    <ol className="max-h-[408px] overflow-y-auto space-y-1.5 p-3" aria-label="All student rankings">
      {Array.from({ length: Math.max(5, q.top.length) }, (_, k) => {
        const r = q.top[k];
        const place = PLACE_STYLE[k];
        const first = k === 0 && !!r;
        return (
          <li
            key={k}
            className={`flex h-[72px] items-center gap-3 rounded-xl px-3 ${first ? "mm-arena-champ py-2.5" : "bg-muted/60 py-1.5"}`}
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold"
              style={{
                background: place?.bg ?? "hsl(var(--border))",
                color: place?.fg ?? "hsl(var(--foreground))",
              }}
            >
              {first ? <Crown className="h-4 w-4" aria-label="1st" /> : k + 1}
            </span>
            {r ? (
              <>
                {q.photosEnabled !== false && <ArenaAvatar
                  photo={r.photo}
                  avatar={r.avatar}
                  name={r.name}
                  size={first ? 48 : 36}
                  ring={first}
                />}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-bold ${first ? "text-lg" : "text-sm"}`}
                  >
                    {r.name}
                  </span>
                </span>
                <span
                  className={`font-extrabold tabular-nums ${first ? "text-xl" : "text-sm"}`}
                  style={{ color: first ? GOLD : undefined }}
                >
                  {formatArenaMs(r.ms)}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </li>
        );
      })}
    </ol>
  </article>
);

/** Every joined student with a live status dot. */
export const StudentStrip = ({
  people,
  total,
  nowMs,
  filter,
  questionCount=0,
}: {
  people: ArenaPerson[];
  total: number;
  nowMs: number;
  filter: "all" | "active" | "inactive";
  questionCount?:number;
}) => {
  const shown = people.filter((p) => filter === "all" || p.presence === filter);
  if (!shown.length) {
    return (
      <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
        {total === 0
          ? "No students have joined yet. Share the student link to begin."
          : `No ${filter} students right now.`}
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {shown.map((p) => {
        const active = p.presence === "active";
        return (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${active ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/40"}`}
          >
            <span className="relative">
              {p.photosEnabled !== false && <ArenaAvatar
                photo={p.photo}
                avatar={p.avatar}
                name={p.name}
                size={40}
              />}
              <span
                aria-hidden
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${active ? "mm-arena-live-dot bg-emerald-400" : "bg-slate-500"}`}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{p.name}</span>
              {questionCount>0&&<><span className="block text-xs text-muted-foreground">{p.ranked}/{questionCount} completed · {Math.round(100*p.ranked/questionCount)}%</span><progress className="h-1.5 w-full" value={p.ranked} max={questionCount} aria-label={`${p.name} completion`}/></>}
              <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                {active
                  ? p.working
                    ? `Working on Q${p.working}`
                    : "Active now"
                  : `Inactive · seen ${agoText(p.lastSeenAt, nowMs)}`}
              </span>
            </span>
            {p.ranked > 0 && (
              <span
                className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary"
                title="Questions ranked"
              >
                {p.ranked}✓
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
