import { Link } from "@/lib/router-compat";
import { GraduationCap, LogIn, Tag, UserPlus } from "lucide-react";
import { MERCHANT_OF_RECORD_STATEMENT, SELLER_LEGAL_NAME } from "@/lib/legal/seller";

/**
 * The signed-out front door.
 *
 * Nothing about the platform — no rotating building, no dashboard, no
 * navigation — is shown until somebody signs in. Only two ways forward:
 * create an account, or log in.
 */
const WelcomePage = () => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] px-5 py-16">
    <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
    <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />

    <section className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-[0_30px_80px_rgba(4,8,25,0.55)] backdrop-blur-xl sm:p-10">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30">
        <GraduationCap className="h-8 w-8" />
      </span>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">MathGPL</h1>
      <p className="mt-3 text-base leading-relaxed text-white/70">
        Welcome to MathGPL — the mathematics teaching and learning platform for schools, teachers,
        parents and students.
      </p>

      <div className="mt-8 grid gap-3">
        <Link
          to="/signup"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 text-base font-semibold text-slate-900 transition hover:bg-amber-300"
        >
          <UserPlus className="h-5 w-5" /> Create Account
        </Link>
        <Link
          to="/login"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 text-base font-semibold text-white transition hover:bg-white/15"
        >
          <LogIn className="h-5 w-5" /> Login
        </Link>
      </div>

      <p className="mt-8 text-xs text-white/45">
        By continuing you agree to our{" "}
        <Link to="/terms" className="underline hover:text-white/70">Terms of Service</Link> and{" "}
        <Link to="/privacy" className="underline hover:text-white/70">Privacy Policy</Link>.
      </p>
    </section>
  </main>
);

export default WelcomePage;
