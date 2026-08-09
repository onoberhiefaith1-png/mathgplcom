import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Eye, EyeOff, KeyRound, Loader2, Mail, Save, ShieldCheck } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";

const FIELD = "bg-white text-slate-900 placeholder:text-slate-400";

/**
 * Administrator Security.
 *
 * The administrator changes their own sign-in email and password here. These
 * are real account credentials, so they work from any browser — not only from
 * inside the editor.
 */
const AdminSecurity = () => {
  const { user, ready } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const saveEmail = async () => {
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast({
        title: "Confirm the new address",
        description: `We sent a confirmation link to ${next}. The change takes effect once you open it.`,
      });
    } catch (error) {
      toast({ title: "Could not change email", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 8) {
      toast({ title: "Use at least 8 characters", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "The two passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      toast({ title: "Password updated", description: "Use it the next time you sign in, from any browser." });
    } catch (error) {
      toast({ title: "Could not change password", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <DashboardShell
      title="Administrator security"
      subtitle="Change the email address and password used for administrator access. These credentials work from any browser."
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/admin")}
          className="rounded-full border-dash-surface/25 bg-dash-surface/10 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface hover:bg-dash-surface/20"
        >
          Back to console
        </Button>
      }
    >
      {mathgplId ? (
        <div className="mb-6 max-w-md">
          <MathgplIdCard
            mathgplId={mathgplId}
            typeLabel={typeLabel}
            note="This is your login. Sign in with this ID and your password."
          />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">

        <section className="rounded-2xl border border-dash-border bg-dash-surface p-6 text-dash-surface-foreground shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em]">
            <Mail className="h-4 w-4" /> Administrator email
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {user?.email ?? "—"}. Changing this sends a confirmation link to the new address.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="admin-email">New email address</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
            />
          </div>
          <Button onClick={saveEmail} disabled={savingEmail} className="mt-4">
            {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save email
          </Button>
        </section>

        <section className="rounded-2xl border border-dash-border bg-dash-surface p-6 text-dash-surface-foreground shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em]">
            <KeyRound className="h-4 w-4" /> Administrator password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            At least 8 characters. The new password applies immediately, everywhere.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="admin-password">New password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
                className={`${FIELD} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-800"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Label htmlFor="admin-password-confirm">Confirm new password</Label>
            <Input
              id="admin-password-confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              maxLength={128}
              onChange={(e) => setConfirm(e.target.value)}
              className={FIELD}
            />
          </div>
          <Button onClick={savePassword} disabled={savingPassword} className="mt-4">
            {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Save password
          </Button>
        </section>
      </div>
    </DashboardShell>
  );
};

export default AdminSecurity;
