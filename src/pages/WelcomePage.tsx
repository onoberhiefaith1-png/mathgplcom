import { Link } from "@/lib/router-compat";
import SiteSection from "@/components/site/SiteSections";
import type { SiteContent } from "@/lib/site/types";

/**
 * The signed-out front door: a cinematic, visual-first journey through the
 * MathGPL product. Every section is content-managed, so the owner can replace
 * artwork and copy without touching code, and empty sections simply don't
 * render.
 */
const WelcomePage = ({ content }: { content: SiteContent }) => (
  <main className="min-h-screen w-full bg-[hsl(224_70%_6%)] text-white">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[hsl(224_70%_6%)]/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-semibold tracking-[0.35em] text-white/85">MATHGPL</span>
        <div className="flex items-center gap-2">
          <Link
            to="/plans"
            className="hidden min-h-[40px] items-center rounded-full px-4 text-sm font-medium text-white/70 transition hover:text-white sm:inline-flex"
          >
            Pricing
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-[40px] items-center rounded-full border border-white/20 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            Log In
          </Link>
          <Link
            to="/signup"
            className="inline-flex min-h-[40px] items-center rounded-full bg-amber-400 px-4 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>

    {content.sections.map((section) => (
      <SiteSection key={section.key} section={section} content={content} />
    ))}
  </main>
);

export default WelcomePage;
