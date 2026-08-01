import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "@/lib/router-compat";
import { z } from "zod";
import { Eye, EyeOff, GraduationCap, Loader2, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";

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
      const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail, password });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new Error("Please verify your email address first — check your inbox for the verification link.");
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
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <GraduationCap className="h-4 w-4" /> MathGPL
        </Link>

        <h1 className="mt-5 text-2xl font-semibold text-white">
          {forgot ? "Reset your password" : "Log in"}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {forgot
            ? "Enter your email address and we'll send you a link to set a new password."
            : "One login for schools, teachers, parents and students."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
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
              className="min-h-[44px] bg-white/95"
            />
          </div>

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
                  className="min-h-[44px] bg-white/95 pr-11"
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
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" disabled={busy} className="min-h-[48px] w-full bg-amber-400 text-slate-900 hover:bg-amber-300">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {forgot ? "Send reset link" : "Log in"}
          </Button>
        </form>

        {!forgot && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-white/35">
              <span className="h-px flex-1 bg-white/15" /> or <span className="h-px flex-1 bg-white/15" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={google}
              disabled={busy}
              className="min-h-[48px] w-full border-white/25 bg-white/5 text-white hover:bg-white/15"
            >
              Continue with Google
            </Button>
          </>
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
