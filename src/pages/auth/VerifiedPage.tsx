import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@/lib/router-compat";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useMathgplId } from "@/lib/accounts/useMathgplId";
import { sendAccountCreatedNotice } from "@/lib/accounts/accountId.functions";
import { usePlanGate } from "@/lib/plans/usePlanGate";


/**
 * Where the verification link lands. If the link established a session the
 * account is already active and the visitor can walk straight in; otherwise
 * they finish by logging in.
 *
 * With a session we also show the permanent MathGPL ID they will log in with,
 * and send the "account created" record to the address on file. That send is
 * idempotent, so revisiting this page never emails twice.
 */
const VerifiedPage = () => {
  const { user, ready } = useAuth();
  const { mathgplId, typeLabel } = useMathgplId();
  const notify = useServerFn(sendAccountCreatedNotice);


  const sent = useRef(false);

  useEffect(() => {
    if (!ready || !user || sent.current) return;
    sent.current = true;
    void notify({}).catch(() => {
      /* the confirmation email already carried the ID; this is a courtesy record */
    });
  }, [ready, user, notify]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] px-5 py-14">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-[0_30px_80px_rgba(4,8,25,0.55)] backdrop-blur-xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <GraduationCap className="h-4 w-4" /> MathGPL
        </Link>
        <span className="mt-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-2xl font-semibold text-white">Email verified</h1>
        <p className="mt-3 text-sm text-white/70">
          Your MathGPL account is active. Welcome aboard.
        </p>

        {mathgplId && (
          <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
              {typeLabel} · Your User ID
            </p>
            <p className="mt-1.5 font-mono text-xl font-semibold text-amber-200">{mathgplId}</p>
            <p className="mt-2 text-xs text-white/60">
              Log in with this ID and your password. It is permanent and never changes — we've also
              emailed it to you.
            </p>
          </div>
        )}

        <Link
          to={ready && user ? "/" : "/login"}
          className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-400 px-6 text-base font-semibold text-slate-900 transition hover:bg-amber-300"
        >
          {ready && user ? "Enter MathGPL" : "Log in"}
        </Link>


      </section>
    </main>
  );
};

export default VerifiedPage;
