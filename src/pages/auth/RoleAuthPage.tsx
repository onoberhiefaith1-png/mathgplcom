import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "@/lib/router-compat";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_FIELD } from "@/lib/accounts/authField";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AUTH_ROLES, COUNTRIES, detectTimeZone, type AuthRoleKey } from "@/lib/accounts/authForms";
import { resendConfirmationEmail } from "@/lib/auth/resendConfirmation";

type Mode = "signin" | "signup" | "forgot";

const RETURN_KEY = "mathgpl:returnTo";

const baseSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  confirm: z.string(),
  country: z.string().trim().min(1, "Select your country"),
  time_zone: z.string().trim().min(1, "Time zone is required"),
});

/** One authentication page, configured per role. */
const RoleAuthPage = ({ roleKey }: { roleKey: AuthRoleKey }) => {
  const config = AUTH_ROLES[roleKey];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
    country: "",
    time_zone: detectTimeZone(),
  }));
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [remember, setRemember] = useState(true);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const rawNext = searchParams.get("next") ?? searchParams.get("redirect") ?? "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const stored = (() => {
    try {
      const v = sessionStorage.getItem(RETURN_KEY) ?? "";
      return v.startsWith("/") && !v.startsWith("//") ? v : "";
    } catch {
      return "";
    }
  })();
  const target = useMemo(() => safeNext || stored || "/home", [safeNext, stored]);

  useEffect(() => {
    if (safeNext) {
      try { sessionStorage.setItem(RETURN_KEY, safeNext); } catch { /* ignore */ }
    }
  }, [safeNext]);

  // Already signed in — never show a login form to an authenticated user.
  useEffect(() => {
    if (!ready || !user) return;
    try { sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
    navigate(target, { replace: true });
  }, [ready, user, target, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const email = z.string().trim().email().parse(values.email);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent a link to reset your password." });
        setMode("signin");
        return;
      }

      if (mode === "signin") {
        const email = z.string().trim().email("Enter a valid email address").parse(values.email);
        try { localStorage.setItem("mathgpl:remember", remember ? "1" : "0"); } catch { /* ignore */ }
        setUnverified(false);
        const { error } = await supabase.auth.signInWithPassword({ email, password: values.password });
        if (error) {
          if (/email not confirmed|not confirmed/i.test(error.message)) {
            setUnverified(true);
            throw new Error("Please confirm your email address before signing in.");
          }
          throw error;
        }
        return;
      }

      // Sign up
      const parsed = baseSchema.safeParse(values);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (values.password !== values.confirm) throw new Error("Passwords do not match");
      for (const f of config.extraFields) {
        if (f.required && !values[f.name]?.trim()) throw new Error(`${f.label} is required`);
      }
      if (values.date_of_birth) {
        const dob = new Date(values.date_of_birth);
        const now = new Date();
        if (Number.isNaN(dob.getTime()) || dob > now || dob.getFullYear() < 1900) {
          throw new Error("Enter a valid date of birth");
        }
      }
      if (!terms) throw new Error("Please accept the Terms of Service and Privacy Policy");

      const metadata: Record<string, string | boolean> = {
        account_role: config.signupRole ?? "teacher",
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        country: values.country.trim(),
        time_zone: values.time_zone.trim(),
        display_name:
          values.display_name?.trim() || `${values.first_name.trim()} ${values.last_name.trim()}`.trim(),
        terms_accepted: true,
        marketing_opt_in: marketing,
      };
      for (const f of config.extraFields) {
        if (values[f.name]?.trim()) metadata[f.name] = values[f.name].trim();
      }
      if (values.school_name?.trim()) metadata.organization_name = values.school_name.trim();

      const { error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: { emailRedirectTo: `${window.location.origin}${target}`, data: metadata },
      });
      if (error) throw error;
      setUnverified(true);
      setMode("signin");
      toast({
        title: "Account created successfully",
        description: `Please check ${values.email.trim()} to confirm your MathGPL account.`,
      });
    } catch (err) {
      toast({ title: "Authentication error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/${roleKey}`,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
    }
  };

  return (
    <main className="cinematic-sky flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-amber-200/15 bg-card/60 p-6 shadow-2xl backdrop-blur">
        <p className="text-center text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>
        <h1 className="mt-2 text-center text-2xl font-semibold">{config.title}</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">{config.blurb}</p>

        {/* Login as — pick the account type first, then enter credentials. */}
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Login as</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["school", "teacher", "parent", "student"] as AuthRoleKey[]).map((k) => (
              <Link
                key={k}
                to={`/auth/${k}`}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  k === roleKey
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {AUTH_ROLES[k].title.replace(" Account", "")}
              </Link>
            ))}
          </div>
        </div>


        <form className="mt-6 space-y-3" onSubmit={submit}>
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" value={values.first_name} onChange={(e) => set("first_name", e.target.value)} maxLength={60} className={AUTH_FIELD} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" value={values.last_name} onChange={(e) => set("last_name", e.target.value)} maxLength={60} className={AUTH_FIELD} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" required value={values.email} onChange={(e) => set("email", e.target.value)} maxLength={255} className={AUTH_FIELD} />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={mode === "signup" ? 8 : 6} value={values.password} onChange={(e) => set("password", e.target.value)} className={AUTH_FIELD} />
            </div>
          )}

          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" required value={values.confirm} onChange={(e) => set("confirm", e.target.value)} className={AUTH_FIELD} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={values.country}
                    onChange={(e) => set("country", e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">Select…</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="time_zone">Time zone</Label>
                  <Input id="time_zone" value={values.time_zone} onChange={(e) => set("time_zone", e.target.value)} className={AUTH_FIELD} />
                </div>
              </div>

              {config.extraFields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label htmlFor={f.name}>{f.label}</Label>
                  {f.type === "select" ? (
                    <select
                      id={f.name}
                      value={values[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      <option value="">Select…</option>
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type}
                      value={values[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      maxLength={200}
                    />
                  )}
                  {f.hint && <p className="text-[11px] leading-tight text-muted-foreground">{f.hint}</p>}
                </div>
              ))}

              <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="text-primary underline">Terms of Service</Link> and{" "}
                  <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
                <span>
                  Send me product updates, new features and educational newsletters. Security and account
                  messages are always sent.
                </span>
              </label>
            </>
          )}

          {mode === "signin" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              <span>Remember me on this device</span>
            </label>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              Continue with Google
            </Button>
          </>
        )}

        <div className="mt-4 flex flex-col items-center gap-2 text-sm">
          {config.allowSignup && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Already registered? Sign in" : "Need an account? Create one"}
            </button>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "forgot" ? "signin" : "forgot")}
          >
            {mode === "forgot" ? "Back to sign in" : "Forgot your password?"}
          </button>
        </div>
      </div>

      <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
        ← Choose a different account type
      </Link>
    </main>
  );
};

export default RoleAuthPage;
