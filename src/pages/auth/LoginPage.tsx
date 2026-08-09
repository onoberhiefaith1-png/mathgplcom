import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "@/lib/router-compat";
import { z } from "zod";
import { Eye, EyeOff, GraduationCap, Loader2, LogIn, Wrench } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_FIELD } from "@/lib/accounts/authField";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useResendCooldown } from "@/lib/auth/useResendCooldown";
import { isDevWorkspaceHost } from "@/lib/env/devWorkspace";


const RETURN_KEY = "mathgpl:returnTo";

/**
 * One login for everybody.
 *
 * There is deliberately no account-type picker here: the role is stored on the
 * account, so the platform detects it after authentication and sends the user
 * to the right place.
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [unverified, setUnverified] = useState(false);
  // Development-only shortcut. Resolved after mount so the server-rendered
  // markup and the first client render always match.
  const [devHost, setDevHost] = useState(false);
  useEffect(() => setDevHost(isDevWorkspaceHost()), []);

  const cooldown = useResendCooldown(email);


  const rawNext = searchParams.get("next") ?? searchParams.get("redirect") ?? "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const target = useMemo(() => {
    if (safeNext) return safeNext;
    try {
      const stored = sessionStorage.getItem(RETURN_KEY) ?? "";
      return stored.startsWith("/") && !stored.startsWith("//") ? stored : "/";
    } catch {
      return "/";
    }
  }, [safeNext]);

  useEffect(() => {
    if (safeNext) {
      try { sessionStorage.setItem(RETURN_KEY, safeNext); } catch { /* ignore */ }
    }
  }, [safeNext]);

  // A signed-in visitor never sees a login form.
  useEffect(() => {
    if (!ready || !user) return;
    try { sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
    navigate(target, { replace: true });
  }, [ready, user, target, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsedEmail = z.string().trim().email("Enter a valid email address").max(255).parse(email);

      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We sent you a link to create a new password.",
        });
        setForgot(false);
        return;
      }

      try { localStorage.setItem("mathgpl:remember", remember ? "1" : "0"); } catch { /* ignore */ }
      setUnverified(false);
      const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail, password });
      if (error) {
        if (/email not confirmed|not confirmed/i.test(error.message)) {
          setUnverified(true);
          throw new Error("Please confirm your email address before signing in.");
        }
        if (/invalid login credentials/i.test(error.message)) {
          throw new Error("Incorrect email or password.");
        }
        throw error;
      }
      // The session listener redirects; nothing else to do here.
    } catch (error) {
      toast({
        title: forgot ? "Could not send reset link" : "Could not sign in",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
    } catch (error) {
      toast({ title: "Google sign-in failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] px-5 py-14">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_30px_80px_rgba(4,8,25,0.55)] backdrop-blur-xl sm:p-9">
        {devHost && (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin")}
            className="mb-5 min-h-[44px] w-full border-amber-300/40 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
          >
            <Wrench className="mr-2 h-4 w-4" /> Go to My Workspace (development only)
          </Button>
        )}

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <GraduationCap className="h-4 w-4" /> MathGPL
        </Link>


        <h1 className="mt-5 text-2xl font-semibold text-white">
          {forgot ? "Recover your account" : "Log in"}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {forgot
            ? "Enter your email address and we'll send you your MathGPL ID with a link to set a new password."
            : "Sign in with your MathGPL ID — schools, teachers, parents and students."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {forgot ? (
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/80">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                className={`${AUTH_FIELD}`}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="mathgpl-id" className="text-white/80">MathGPL ID</Label>
              <Input
                id="mathgpl-id"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="username"
                placeholder="TCH/000001"
                value={mathgplId}
                onChange={(e) => setMathgplId(e.target.value.toUpperCase())}
                required
                maxLength={40}
                className={`${AUTH_FIELD} font-mono tracking-wide`}
              />
            </div>
          )}


          {!forgot && (
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/80">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={128}
                  className={`${AUTH_FIELD} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {!forgot && (
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-white/70">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setForgot(true)}
                className="text-sm font-medium text-amber-300 hover:text-amber-200"
              >
                Forgot ID or password?
              </button>

            </div>
          )}

          {!forgot && unverified && (
            <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-left">
              <p className="text-sm text-amber-100">
                Please confirm your email address before signing in.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={cooldown.sending || !cooldown.ready}
                onClick={async () => {
                  const result = await cooldown.resend();
                  toast(
                    result.ok
                      ? {
                          title: "Confirmation email sent",
                          description: `We've sent a new confirmation link to ${email.trim()}.`,
                        }
                      : { title: "Not sent", description: result.message, variant: "destructive" },
                  );
                }}
                className="mt-3 min-h-[44px] w-full border-amber-300/40 bg-white/5 text-amber-100 hover:bg-amber-300/20"
              >
                {cooldown.sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {cooldown.ready
                  ? "Resend confirmation email"
                  : `Resend available in ${cooldown.seconds} second${cooldown.seconds === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}

          <Button type="submit" disabled={busy} className="min-h-[48px] w-full bg-amber-400 text-slate-900 hover:bg-amber-300">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {forgot ? "Send reset link" : "Log in"}
          </Button>
        </form>

        {!forgot && (
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center text-xs text-white/55">
            Your MathGPL ID was sent to you when your account was created. Lost it? Use
            “Forgot ID or password?” and we'll email it with a reset link.
          </p>
        )}


        <p className="mt-6 text-center text-sm text-white/60">
          {forgot ? (
            <button type="button" onClick={() => setForgot(false)} className="font-medium text-amber-300 hover:text-amber-200">
              Back to login
            </button>
          ) : (
            <>
              Don't have an account?{" "}
              <Link to="/signup" className="font-medium text-amber-300 hover:text-amber-200">Create Account</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
};

export default LoginPage;
