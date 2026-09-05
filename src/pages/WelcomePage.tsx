import { Link } from "@/lib/router-compat";
import HomepageAdBlock from "@/components/ads/HomepageAdBlock";
import SiteSection from "@/components/site/SiteSections";
import LanguageSelector from "@/components/i18n/LanguageSelector";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { SiteContent } from "@/lib/site/types";

/**
 * The signed-out front door: a cinematic, visual-first journey through the
 * MathGPL product. Every section is content-managed, so the owner can replace
 * artwork and copy without touching code, and empty sections simply don't
 * render.
 */
const WelcomePage = ({ content }: { content: SiteContent }) => {
  const t = useT();
  return (
  <main className="min-h-screen w-full bg-[hsl(224_70%_6%)] text-white">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[hsl(224_70%_6%)]/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-semibold tracking-[0.35em] text-white/85">MATHGPL</span>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <Link
            to="/plans"
            className="hidden min-h-[40px] items-center rounded-full px-4 text-sm font-medium text-white/70 transition hover:text-white sm:inline-flex"
          >
            {t("nav_pricing")}
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-[40px] items-center rounded-full border border-white/20 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            {t("auth_sign_in")}
          </Link>
          <Link
            to="/signup"
            className="inline-flex min-h-[40px] items-center rounded-full bg-amber-400 px-4 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
          >
            {t("auth_create_account")}
          </Link>
        </div>
      </div>
    </header>


    {content.sections.length > 0 ? (
      content.sections.map((section, index) => (
        <div key={section.key}>
          <SiteSection section={section} content={content} />
          {/* One natural break in the cinematic flow carries the homepage ad. */}
          {index === Math.min(2, content.sections.length - 1) && <HomepageAdBlock />}
        </div>
      ))
    ) : (
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6">
        <p className="text-xs font-semibold tracking-[0.4em] text-amber-300/80">MATHGPL</p>
        <h1 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Mathematics, Reimagined.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-white/70">
          Learn. Explore. Solve. Experience mathematics differently.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="inline-flex min-h-[48px] items-center rounded-full bg-amber-400 px-7 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-[48px] items-center rounded-full border border-white/20 px-7 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            Log In
          </Link>
        </div>
      </section>
    )}

    {/* Secret entrance for authorised access. */}
    <div className="flex justify-center pb-8 pt-4">
      <Link
        to="/access"
        aria-label="Authorised entrance"
        className="px-3 py-2 text-lg leading-none tracking-[0.4em] text-white/20 transition hover:text-white/60"
      >
        &bull;&bull;&bull;
      </Link>
    </div>
  </main>
  );
};


export default WelcomePage;
