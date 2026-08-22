import { Link } from "@/lib/router-compat";
import { ArrowRight, LogIn } from "lucide-react";
import Reveal from "./Reveal";
import SiteMedia from "./SiteMedia";
import { MERCHANT_OF_RECORD_STATEMENT, SELLER_LEGAL_NAME } from "@/lib/legal/seller";
import type { SiteContent, SiteItemResolved, SiteSectionResolved } from "@/lib/site/types";

/* ------------------------------------------------------------------ shared */

const Primary = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-amber-400 px-8 text-base font-semibold text-slate-900 transition hover:bg-amber-300"
  >
    {children} <ArrowRight className="h-4 w-4" />
  </Link>
);

const Secondary = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-8 text-base font-semibold text-white transition hover:bg-white/15"
  >
    {children}
  </Link>
);

const Cta = ({ section }: { section: SiteSectionResolved }) =>
  section.ctaLabel && section.ctaHref ? (
    <div className="mt-10">
      <Primary to={section.ctaHref}>{section.ctaLabel}</Primary>
    </div>
  ) : null;

/** Placeholder used wherever the owner has not uploaded artwork yet. */
const MediaFrame = ({
  section,
  priority = false,
  className = "aspect-video",
}: {
  section: SiteSectionResolved;
  priority?: boolean;
  className?: string;
}) => (
  <div className={`relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ${className}`}>
    {section.media ? (
      <SiteMedia
        media={section.media}
        priority={priority}
        alt={section.headline ?? ""}
        className="absolute inset-0 h-full w-full"
      />
    ) : (
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,hsl(258_70%_35%/0.5),transparent_60%),radial-gradient(circle_at_75%_70%,hsl(210_80%_40%/0.35),transparent_55%)]" />
    )}
  </div>
);

/* ------------------------------------------------------------------- kinds */

const Hero = ({ section }: { section: SiteSectionResolved }) => (
  <section className="relative flex min-h-[92vh] items-center overflow-hidden">
    <div className="absolute inset-0">
      {section.media ? (
        <SiteMedia media={section.media} priority alt="" className="h-full w-full" />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_25%_20%,hsl(258_70%_30%),hsl(224_70%_8%)_65%)]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(224_70%_6%)]/85 via-[hsl(224_70%_6%)]/45 to-[hsl(224_70%_6%)]" />
    </div>

    <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-32">
      <Reveal>
        {section.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-amber-300/90">
            {section.eyebrow}
          </p>
        )}
        <h1 className="mt-6 max-w-3xl text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-tight text-white">
          {section.headline}
        </h1>
        {section.subline && (
          <p className="mt-6 max-w-xl text-lg text-white/70">{section.subline}</p>
        )}
        <div className="mt-10 flex flex-wrap gap-3">
          <Primary to={section.ctaHref ?? "/signup"}>{section.ctaLabel ?? "Get Started"}</Primary>
          <Secondary to="/login">
            <LogIn className="h-4 w-4" /> Log In
          </Secondary>
        </div>
      </Reveal>
    </div>
  </section>
);

const Statement = ({ section }: { section: SiteSectionResolved }) =>
  section.media ? (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <SiteMedia media={section.media} alt="" className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(224_70%_6%)]/85 via-[hsl(224_70%_6%)]/60 to-[hsl(224_70%_6%)]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-6 py-28 text-center sm:py-40">
        <Reveal>
          <h2 className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-semibold leading-tight tracking-tight text-white">
            {section.headline}
          </h2>
          {section.subline && <p className="mt-5 text-lg text-white/70">{section.subline}</p>}
        </Reveal>
      </div>
    </section>
  ) : (
    <section className="mx-auto max-w-5xl px-6 py-28 text-center sm:py-36">
      <Reveal>
        <h2 className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-semibold leading-tight tracking-tight text-white">
          {section.headline}
        </h2>
        {section.subline && <p className="mt-5 text-lg text-white/60">{section.subline}</p>}
      </Reveal>
    </section>
  );


const FullVideo = ({ section }: { section: SiteSectionResolved }) => (
  <section className="relative w-full">
    <Reveal>
      <div className="relative h-[70vh] w-full overflow-hidden bg-black">
        {section.media ? (
          <SiteMedia media={section.media} alt="" className="h-full w-full" />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(120deg,hsl(258_70%_18%),hsl(224_70%_8%))]" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[hsl(224_70%_6%)] to-transparent p-8 pt-24 sm:p-14">
          <h2 className="max-w-2xl text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold tracking-tight text-white">
            {section.headline}
          </h2>
        </div>
      </div>
    </Reveal>
  </section>
);

const Panels = ({ section }: { section: SiteSectionResolved }) => (
  <section className="mx-auto max-w-7xl px-6 py-24">
    <Reveal>
      <h2 className="max-w-3xl text-[clamp(1.7rem,3.6vw,2.8rem)] font-semibold leading-tight tracking-tight text-white">
        {section.headline}
      </h2>
    </Reveal>
    <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {(section.items.length ? section.items : DEFAULT_PANELS).map((item, i) => (
        <Reveal key={item.id} delay={i * 80}>
          <article className="group relative h-[26rem] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            {item.media ? (
              <SiteMedia media={item.media} alt={item.label ?? ""} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-[1.04]" />
            ) : (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_40%_30%,hsl(258_70%_35%/0.45),transparent_60%)]" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(224_70%_6%)] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">
                {item.label}
              </p>
              {item.headline && (
                <p className="mt-2 text-xl font-semibold text-white">{item.headline}</p>
              )}
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  </section>
);

const DEFAULT_PANELS: SiteItemResolved[] = [
  { id: "learn", label: "Learn", headline: "Lesson notes" },
  { id: "interact", label: "Interact", headline: "Smartboard" },
  { id: "play", label: "Play", headline: "Adventure" },
  { id: "measure", label: "Measure", headline: "Assessment" },
];

const DEFAULT_SHOWCASE: SiteItemResolved[] = [
  { id: "smartboard", label: "Smartboard", headline: "Mathematics you can interact with." },
  { id: "notes", label: "Lesson notes", headline: "Every step, in the right order." },
  { id: "assignments", label: "Assignments", headline: "Set the challenge. Let students solve." },
  { id: "adventure", label: "Adventure", headline: "Problem-solving becomes exploration." },
  { id: "assessment", label: "Assessment", headline: "Progress you can see." },
];

const Showcase = ({ section }: { section: SiteSectionResolved }) => (
  <section className="mx-auto max-w-7xl px-6 py-24">
    <Reveal>
      <h2 className="text-[clamp(1.9rem,4.5vw,3.2rem)] font-semibold tracking-tight text-white">
        {section.headline}
      </h2>
    </Reveal>
    <div className="mt-16 space-y-24">
      {(section.items.length ? section.items : DEFAULT_SHOWCASE).map((item, i) => (
        <Reveal key={item.id}>
          <div
            className={`grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] ${
              i % 2 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300/90">
                {item.label}
              </p>
              <p className="mt-4 text-[clamp(1.5rem,3vw,2.3rem)] font-semibold leading-tight text-white">
                {item.headline}
              </p>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
              {item.media ? (
                <SiteMedia media={item.media} alt={item.label ?? ""} className="absolute inset-0 h-full w-full" />
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,hsl(210_80%_40%/0.35),transparent_60%)]" />
              )}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
    <Cta section={section} />
  </section>
);

const Cinematic = ({ section }: { section: SiteSectionResolved }) => {
  const frame = section.items[0];
  return (
    <section className="relative w-full">
      <div className="relative h-[100vh] w-full overflow-hidden">
        <div className="absolute inset-0">
          {section.media ? (
            <SiteMedia media={section.media} alt="" className="h-full w-full scale-105" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_50%_60%,hsl(258_75%_28%),hsl(224_70%_6%)_70%)]" />
          )}
          <div className="absolute inset-0 bg-[hsl(224_70%_6%)]/45" />
        </div>
        <div className="relative flex h-full items-center justify-center px-6 text-center">
          <Reveal>
            {section.eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.5em] text-amber-300/90">
                {section.eyebrow}
              </p>
            )}
            <h2 className="mt-6 max-w-4xl text-[clamp(2rem,5.5vw,4rem)] font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              {section.headline}
            </h2>
            {section.subline && <p className="mt-6 text-lg text-white/70">{section.subline}</p>}
          </Reveal>
        </div>
      </div>
      {/* Optional wide screenshot beneath the band, so a signature technology
          can show itself without losing the cinematic opening. */}
      {section.items.length > 0 && (
        <div className="mx-auto -mt-20 max-w-6xl px-6 pb-24">
          <Reveal>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_hsl(258_70%_30%/0.45)]">
              {frame?.media ? (
                <SiteMedia media={frame.media} alt={frame.label ?? ""} className="absolute inset-0 h-full w-full" />
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,hsl(258_70%_38%/0.45),transparent_65%)]" />
              )}
            </div>
            {frame?.label && <p className="mt-4 text-center text-sm text-white/50">{frame.label}</p>}
          </Reveal>
        </div>
      )}
      <Cta section={section} />
    </section>
  );
};

/* ---------------------------------------------------- spotlight / workflow / journey */

/** Screenshot on one side, words on the other. Alternates by position. */
const Spotlight = ({ section }: { section: SiteSectionResolved }) => {
  const flipped = section.position % 2 === 0;
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className={`min-w-0 ${flipped ? "lg:order-2" : ""}`}>
            {section.eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300/90">
                {section.eyebrow}
              </p>
            )}
            <h2 className="mt-5 text-[clamp(1.7rem,3.6vw,2.8rem)] font-semibold leading-tight tracking-tight text-white">
              {section.headline}
            </h2>
            {section.subline && (
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/65">{section.subline}</p>
            )}
            {section.items.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/75"
                  >
                    {item.label || item.headline}
                  </li>
                ))}
              </ul>
            )}
            {section.ctaLabel && section.ctaHref && (
              <div className="mt-9">
                <Primary to={section.ctaHref}>{section.ctaLabel}</Primary>
              </div>
            )}
          </div>
          <div className={`min-w-0 ${flipped ? "lg:order-1" : ""}`}>
            <MediaFrame section={section} className="aspect-[16/10]" />
          </div>
        </div>
      </Reveal>
    </section>
  );
};

/** Numbered steps down the page, each with its own screenshot slot. */
const Workflow = ({ section }: { section: SiteSectionResolved }) => (
  <section className="mx-auto max-w-7xl px-6 py-24">
    <Reveal>
      {section.eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300/90">
          {section.eyebrow}
        </p>
      )}
      <h2 className="mt-5 max-w-3xl text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-white">
        {section.headline}
      </h2>
      {section.subline && <p className="mt-5 max-w-2xl text-lg text-white/60">{section.subline}</p>}
    </Reveal>

    <ol className="relative mt-16 space-y-14 before:absolute before:bottom-6 before:left-[1.4rem] before:top-6 before:w-px before:bg-gradient-to-b before:from-amber-300/40 before:via-white/15 before:to-transparent">
      {section.items.map((item, i) => (
        <li key={item.id} className="relative pl-16">
          <Reveal delay={(i % 3) * 80}>
            <span className="absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full border border-amber-300/40 bg-[hsl(224_70%_8%)] text-sm font-semibold text-amber-300">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="min-w-0">
                <p className="text-xl font-semibold text-white">{item.label}</p>
                {item.headline && (
                  <p className="mt-2 text-base leading-relaxed text-white/60">{item.headline}</p>
                )}
              </div>
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {item.media ? (
                  <SiteMedia media={item.media} alt={item.label ?? ""} className="absolute inset-0 h-full w-full" />
                ) : (
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_55%_35%,hsl(210_80%_40%/0.3),transparent_60%)]" />
                )}
              </div>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
    <Cta section={section} />
  </section>
);

/** The closing connected diagram: chips joined by arrows. */
const Journey = ({ section }: { section: SiteSectionResolved }) => (
  <section className="mx-auto max-w-6xl px-6 py-28">
    <Reveal>
      {section.eyebrow && (
        <p className="text-center text-xs font-semibold uppercase tracking-[0.4em] text-amber-300/90">
          {section.eyebrow}
        </p>
      )}
      <h2 className="mt-5 text-center text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-white">
        {section.headline}
      </h2>
      {section.subline && (
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-white/60">{section.subline}</p>
      )}
    </Reveal>
    <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
      {section.items.map((item, i) => (
        <Reveal key={item.id} delay={i * 60}>
          <span className="flex items-center gap-3">
            <span className="rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/85">
              {item.label || item.headline}
            </span>
            {i < section.items.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-amber-300/70" />}
          </span>
        </Reveal>
      ))}
    </div>
    <Cta section={section} />
  </section>
);


const Compare = ({ section }: { section: SiteSectionResolved }) => {
  const [before, after] = section.items;
  return (
    <section className="mx-auto max-w-7xl px-6 py-28">
      <div className="grid gap-8 lg:grid-cols-2">
        <Reveal>
          <p className="text-[clamp(1.4rem,3vw,2.2rem)] font-semibold leading-tight text-white/55">
            {section.headline}
          </p>
          <div className="mt-6 aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
            {before?.media ? (
              <SiteMedia media={before.media} alt="" className="h-full w-full" />
            ) : (
              <div className="h-full w-full bg-[repeating-linear-gradient(0deg,hsl(0_0%_100%/0.06)_0_1px,transparent_1px_28px)]" />
            )}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-[clamp(1.4rem,3vw,2.2rem)] font-semibold leading-tight text-white">
            {section.subline}
          </p>
          <div className="mt-6 aspect-[4/3] overflow-hidden rounded-3xl border border-amber-300/25 bg-white/[0.03] shadow-[0_0_80px_hsl(258_70%_45%/0.25)]">
            {after?.media ? (
              <SiteMedia media={after.media} alt="" className="h-full w-full" />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_50%_40%,hsl(258_75%_40%/0.5),transparent_65%)]" />
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const Stats = ({
  section,
  content,
}: {
  section: SiteSectionResolved;
  content: SiteContent;
}) => {
  const { stats, statsSettings } = content;
  const metrics = [
    { on: statsSettings.show_learners, label: "Learners", value: stats.learners },
    { on: statsSettings.show_teachers, label: "Teachers", value: stats.teachers },
    { on: statsSettings.show_schools, label: "Schools", value: stats.schools },
    { on: statsSettings.show_questions, label: "Questions solved", value: stats.questions },
    { on: statsSettings.show_adventures, label: "Adventures completed", value: stats.adventures },
  ].filter((m) => m.on);

  if (metrics.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal>
        <h2 className="text-center text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-white">
          {section.headline}
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[hsl(224_70%_8%)] px-6 py-10 text-center">
              <p className="text-4xl font-semibold text-amber-300">{m.value}+</p>
              <p className="mt-2 text-sm text-white/60">{m.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
};

const DEFAULT_AUDIENCE: SiteItemResolved[] = [
  { id: "students", label: "Students", headline: "Learn. Solve. Explore." },
  { id: "teachers", label: "Teachers", headline: "Teach. Assign. Track." },
  { id: "schools", label: "Schools", headline: "Connect learning at scale." },
];

const Audience = ({ section }: { section: SiteSectionResolved }) => (
  <section className="mx-auto max-w-7xl px-6 py-24">
    <Reveal>
      <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold tracking-tight text-white">
        {section.headline}
      </h2>
    </Reveal>
    <div className="mt-12 grid gap-5 lg:grid-cols-3">
      {(section.items.length ? section.items : DEFAULT_AUDIENCE).map((item, i) => (
        <Reveal key={item.id} delay={i * 90}>
          <article className="relative h-[32rem] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            {item.media ? (
              <SiteMedia media={item.media} alt={item.label ?? ""} className="absolute inset-0 h-full w-full" />
            ) : (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,hsl(258_70%_38%/0.45),transparent_60%)]" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(224_70%_6%)] via-[hsl(224_70%_6%)]/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300/90">
                {item.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">{item.headline}</p>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
    <Cta section={section} />
  </section>
);

const Testimonials = ({
  section,
  content,
}: {
  section: SiteSectionResolved;
  content: SiteContent;
}) => {
  if (content.testimonials.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal>
        <h2 className="max-w-3xl text-[clamp(1.7rem,3.6vw,2.8rem)] font-semibold leading-tight tracking-tight text-white">
          {section.headline}
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {content.testimonials.map((t, i) => (
          <Reveal key={t.id} delay={i * 80}>
            <figure className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <blockquote className="text-lg leading-relaxed text-white/85">“{t.quote}”</blockquote>
              <figcaption className="mt-6 text-sm text-white/55">
                <span className="font-semibold text-white">{t.author_name}</span>
                {t.author_role ? ` · ${t.author_role}` : ""}
                {t.organisation ? ` · ${t.organisation}` : ""}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

const Demo = ({ section }: { section: SiteSectionResolved }) => (
  <section className="mx-auto max-w-7xl px-6 py-24">
    <Reveal>
      <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold tracking-tight text-white">
        {section.headline}
      </h2>
      <div className="mt-10">
        <MediaFrame section={section} className="aspect-[16/9]" />
      </div>
      <Cta section={section} />
    </Reveal>
  </section>
);

const FinalCta = ({ section }: { section: SiteSectionResolved }) => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0">
      {section.media ? (
        <SiteMedia media={section.media} alt="" className="h-full w-full" />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_50%_120%,hsl(258_75%_32%),hsl(224_70%_6%)_65%)]" />
      )}
      <div className="absolute inset-0 bg-[hsl(224_70%_6%)]/60" />
    </div>
    <div className="relative mx-auto max-w-4xl px-6 py-36 text-center">
      <Reveal>
        <h2 className="text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-tight tracking-tight text-white">
          {section.headline}
        </h2>
        {section.subline && <p className="mt-5 text-lg text-white/70">{section.subline}</p>}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Primary to={section.ctaHref ?? "/signup"}>{section.ctaLabel ?? "Get Started"}</Primary>
          <Secondary to="/login">
            <LogIn className="h-4 w-4" /> Log In
          </Secondary>
        </div>
      </Reveal>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/10 px-6 py-14">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold tracking-[0.3em] text-white/80">MATHGPL</p>
      <nav className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/plans" className="hover:text-white">Pricing</Link>
        <Link to="/terms" className="hover:text-white">Terms of Service</Link>
        <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
        <Link to="/refund-policy" className="hover:text-white">Refund Policy</Link>
        <Link to="/support" className="hover:text-white">Support</Link>
      </nav>
    </div>
    <p className="mx-auto mt-8 max-w-7xl text-xs leading-relaxed text-white/35">
      MathGPL is operated by {SELLER_LEGAL_NAME}. {MERCHANT_OF_RECORD_STATEMENT}
    </p>
  </footer>
);

/* ------------------------------------------------------------------ router */

export const SiteSection = ({
  section,
  content,
}: {
  section: SiteSectionResolved;
  content: SiteContent;
}) => {
  switch (section.kind) {
    case "hero":
      return <Hero section={section} />;
    case "statement":
      return <Statement section={section} />;
    case "video":
      return <FullVideo section={section} />;
    case "panels":
      return <Panels section={section} />;
    case "showcase":
      return <Showcase section={section} />;
    case "spotlight":
      return <Spotlight section={section} />;
    case "workflow":
      return <Workflow section={section} />;
    case "journey":
      return <Journey section={section} />;

    case "cinematic":
      return <Cinematic section={section} />;
    case "compare":
      return <Compare section={section} />;
    case "stats":
      return <Stats section={section} content={content} />;
    case "audience":
      return <Audience section={section} />;
    case "testimonials":
      return <Testimonials section={section} content={content} />;
    case "demo":
      return <Demo section={section} />;
    case "cta":
      return <FinalCta section={section} />;
    case "footer":
      return <Footer />;
    default:
      return null;
  }
};

export default SiteSection;
