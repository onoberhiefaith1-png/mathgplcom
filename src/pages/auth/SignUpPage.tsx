import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  MailCheck,
  Users,
  UserRound,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_FIELD } from "@/lib/accounts/authField";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";
import { detectTimeZone } from "@/lib/accounts/authForms";
import { CountrySelect } from "@/components/auth/CountrySelect";
import { useResendCooldown } from "@/lib/auth/useResendCooldown";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/accounts/roles";

const ROLE_ICON: Record<SignupRole, typeof Building2> = {
  school: Building2,
  teacher: GraduationCap,
  parent: Users,
  student: UserRound,
};

const detailsSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  country: z.string().trim().min(1, "Select your country"),
  email: z.string().trim().email("Enter a valid email address").max(255),
  confirm_email: z.string().trim().email("Confirm your email address").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  confirm_password: z.string(),
});

type Step = 1 | 2 | 3 | 4;

/**
 * Create Account.
 *
 * Step 1 chooses the account type, step 2 collects the details (students also
 * give a date of birth so the platform can serve age-appropriate content),
 * step 3 takes the required consents, and step 4 confirms that the
 * verification email is on its way.
 */
const SignUpPage = () => {
  const navigate = useNavigate();
  const { user, ready } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [values, setValues] = useState({
    first_name: "",
    last_name: "",
    country: "",
    email: "",
    confirm_email: "",
    password: "",
    confirm_password: "",
    date_of_birth: "",
    school_name: "",
  });
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const set = (k: keyof typeof values, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const cooldown = useResendCooldown(values.email);

  useEffect(() => {
    if (!ready || !user || step === 4) return;
    navigate("/", { replace: true });
  }, [ready, user, step, navigate]);

  const validateDetails = () => {
    const parsed = detailsSchema.safeParse(values);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    if (values.email.trim().toLowerCase() !== values.confirm_email.trim().toLowerCase()) {
      throw new Error("The two email addresses do not match");
    }
    if (values.password !== values.confirm_password) throw new Error("The two passwords do not match");
    if (role === "student") {
      if (!values.date_of_birth) throw new Error("Date of birth is required");
      const dob = new Date(values.date_of_birth);
      if (Number.isNaN(dob.getTime()) || dob > new Date() || dob.getFullYear() < 1900) {
        throw new Error("Enter a valid date of birth");
      }
    }
    if (role === "school" && !values.school_name.trim()) throw new Error("School name is required");
  };

  const nextFromDetails = () => {
    try {
      validateDetails();
      setStep(3);
    } catch (error) {
      toast({ title: "Check your details", description: (error as Error).message, variant: "destructive" });
    }
  };

  const submit = async () => {
    if (!role) return;
    if (!terms || !privacy) {
      toast({
        title: "Consent required",
        description: "Please accept the Terms of Service and the Privacy Policy to continue.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      validateDetails();
      const email = values.email.trim();
      const firstName = values.first_name.trim();
      const lastName = values.last_name.trim();
      const metadata: Record<string, string | boolean> = {
        account_role: role,
        full_name: `${firstName} ${lastName}`.trim(),
        display_name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        country: values.country,
        time_zone: detectTimeZone(),
        marketing_opt_in: marketing,
        terms_accepted: true,
      };
      if (role === "student") metadata.date_of_birth = values.date_of_birth;
      if (role === "school") {
        metadata.organization_name = values.school_name.trim();
        metadata.school_name = values.school_name.trim();
      }

      const { data: created, error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verified`,
          data: metadata,
        },
      });
      if (error) {
        if (/already registered/i.test(error.message)) {
          throw new Error("That email address already has an account. Please log in instead.");
        }
        throw error;
      }
      // The database issues the permanent MathGPL ID at signup — show it here.
      if (created.user?.id) {
        try {
          const { mathgplId } = await lookupId({ data: { userId: created.user.id } });
          setIssuedId(mathgplId);
        } catch { /* the confirmation email still carries the ID */ }
      }
      cooldown.start();
      setStep(4);

    } catch (error) {
      toast({ title: "Could not create account", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] px-5 py-14">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_30px_80px_rgba(4,8,25,0.55)] backdrop-blur-xl sm:p-9">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <GraduationCap className="h-4 w-4" /> MathGPL
        </Link>

        {step < 4 && (
          <div className="mt-5 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full transition ${step >= n ? "bg-amber-400" : "bg-white/15"}`}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            <h1 className="mt-6 text-2xl font-semibold text-white">Choose your account type</h1>
            <p className="mt-2 text-sm text-white/60">This decides what your workspace contains.</p>
            <div className="mt-6 grid gap-3">
              {SIGNUP_ROLES.map((r) => {
                const Icon = ROLE_ICON[r.value];
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => { setRole(r.value); setStep(2); }}
                    className="flex min-h-[64px] items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-amber-300/50 hover:bg-white/10"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-white">{r.label}</span>
                      <span className="block text-sm text-white/60">{r.blurb}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-white/40" />
                  </button>
                );
              })}
            </div>
            <p className="mt-6 text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-amber-300 hover:text-amber-200">Log in</Link>
            </p>
          </>
        )}

        {step === 2 && role && (
          <>
            <h1 className="mt-6 text-2xl font-semibold text-white">Your details</h1>
            <p className="mt-2 text-sm text-white/60">
              Creating a {SIGNUP_ROLES.find((r) => r.value === role)?.label.toLowerCase()} account.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-white/80">First name</Label>
                <Input id="first_name" value={values.first_name} onChange={(e) => set("first_name", e.target.value)} maxLength={60} className={`${AUTH_FIELD}`} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-white/80">Last name</Label>
                <Input id="last_name" value={values.last_name} onChange={(e) => set("last_name", e.target.value)} maxLength={60} className={`${AUTH_FIELD}`} />
              </div>

              {role === "school" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="school_name" className="text-white/80">School name</Label>
                  <Input id="school_name" value={values.school_name} onChange={(e) => set("school_name", e.target.value)} maxLength={160} className={`${AUTH_FIELD}`} />
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="country" className="text-white/80">Country</Label>
                <CountrySelect id="country" value={values.country} onChange={(v) => set("country", v)} />
              </div>

              {role === "student" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dob" className="text-white/80">Date of birth</Label>
                  <Input id="dob" type="date" value={values.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className={`${AUTH_FIELD}`} />
                  <p className="text-xs text-white/50">Kept private and used only to recommend age-appropriate content.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/80">Email address</Label>
                <Input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} maxLength={255} className={`${AUTH_FIELD}`} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_email" className="text-white/80">Confirm email</Label>
                <Input id="confirm_email" type="email" value={values.confirm_email} onChange={(e) => set("confirm_email", e.target.value)} maxLength={255} className={`${AUTH_FIELD}`} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-white/80">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={values.password}
                    onChange={(e) => set("password", e.target.value)}
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
                <p className="text-xs text-white/50">At least 8 characters.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password" className="text-white/80">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={values.confirm_password}
                    onChange={(e) => set("confirm_password", e.target.value)}
                    maxLength={128}
                    className={`${AUTH_FIELD} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-800"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="min-h-[48px] border-white/25 bg-white/5 text-white hover:bg-white/15">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={nextFromDetails} className="min-h-[48px] flex-1 bg-amber-400 text-slate-900 hover:bg-amber-300">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="mt-6 text-2xl font-semibold text-white">Almost there</h1>
            <p className="mt-2 text-sm text-white/60">Please confirm the following before we create your account.</p>

            <div className="mt-6 space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(Boolean(v))} className="mt-0.5" />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="font-medium text-amber-300 underline">Terms of Service</Link>.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
                <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(Boolean(v))} className="mt-0.5" />
                <span>
                  I agree to the{" "}
                  <Link to="/privacy" target="_blank" className="font-medium text-amber-300 underline">Privacy Policy</Link>.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(Boolean(v))} className="mt-0.5" />
                <span>Send me occasional MathGPL product updates (optional — account and security emails always send).</span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="min-h-[48px] border-white/25 bg-white/5 text-white hover:bg-white/15">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={submit} disabled={busy} className="min-h-[48px] flex-1 bg-amber-400 text-slate-900 hover:bg-amber-300">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Create Account
              </Button>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="py-4 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30">
              <MailCheck className="h-8 w-8" />
            </span>
            <h1 className="mt-6 text-2xl font-semibold text-white">Account created successfully</h1>

            {issuedId && (
              <div className="mt-5 text-left">
                <MathgplIdCard
                  mathgplId={issuedId}
                  note="This is your login from now on. We've emailed it with your confirmation link."
                />
              </div>
            )}

            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Please check your email to confirm your MathGPL account. We've sent the confirmation
              link to <span className="font-medium text-white">{values.email}</span>.
            </p>
            <p className="mt-3 text-xs text-white/45">
              Nothing in your inbox after a minute? Check your spam folder.
            </p>


            <Button
              type="button"
              variant="outline"
              disabled={cooldown.sending || !cooldown.ready}
              onClick={async () => {
                const result = await cooldown.resend();
                if (result.ok) {
                  setResent(true);
                  toast({
                    title: "Confirmation email sent",
                    description: `We've sent another confirmation link to ${values.email.trim()}.`,
                  });
                } else {
                  toast({ title: "Not sent", description: result.message, variant: "destructive" });
                }
              }}
              className="mt-6 min-h-[48px] w-full border-white/25 bg-white/5 text-white hover:bg-white/15 disabled:opacity-70"
            >
              {cooldown.sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {cooldown.ready
                ? "Didn't receive the email? Resend confirmation email"
                : `Resend available in ${cooldown.seconds} second${cooldown.seconds === 1 ? "" : "s"}`}
            </Button>
            {resent && cooldown.seconds > 0 && (
              <p className="mt-2 text-xs text-emerald-300">
                A new confirmation email is on its way.
              </p>
            )}

            <Link
              to="/login"
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-400 px-6 text-base font-semibold text-slate-900 transition hover:bg-amber-300"
            >
              Go to login
            </Link>
          </div>
        )}
      </section>
    </main>
  );
};

export default SignUpPage;
