import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { Eye, EyeOff, KeyRound, Loader2, Mail, Save, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MathgplIdCard } from "@/components/accounts/MathgplIdCard";
import ShareCodeCard from "@/components/connections/ShareCodeCard";
import SchoolCodeCard from "@/components/connections/SchoolCodeCard";
import GoLiveToggle from "@/components/connections/GoLiveToggle";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAccount } from "@/lib/accounts/useAccount";
import { useMathgplId } from "@/lib/accounts/useMathgplId";
import { useConnectionCounts } from "@/lib/connections/useConnections";


const FIELD = "bg-white text-slate-900 placeholder:text-slate-400";

/**
 * My Account — the same page for every role.
 *
 * It shows the person's permanent MathGPL ID (their login), their account
 * type, and lets them change the email address and password on their own
 * account. Nothing here belongs to anybody else.
 */
const MyAccountPage = () => {
  const { user, ready } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { mathgplId, typeLabel, loading } = useMathgplId();
  const { counts } = useConnectionCounts();
  const { roles } = useAccount();
  const isSchool = roles.includes("school");


  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (ready && !user) navigate("/login?next=/account", { replace: true });
  }, [ready, user, navigate]);

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
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      toast({ title: "Password updated", description: "Use your MathGPL ID and new password next time." });
    } catch (error) {
      toast({ title: "Could not change password", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back to my building
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <ShieldCheck className="h-6 w-6 text-amber-500" /> My account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Your MathGPL ID, your sign-in email and your password.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Loading your MathGPL ID…
          </div>
        ) : mathgplId ? (
          <MathgplIdCard mathgplId={mathgplId} typeLabel={typeLabel} tone="light" />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No MathGPL ID is attached to this account yet.
          </div>
        )}

        <AvatarUploader />


{/* A school hands out one code only: its School Code. Personal Share Codes
            belong to individual people, never to an institution. */}
        {isSchool ? <SchoolCodeCard /> : <ShareCodeCard />}
        <GoLiveToggle />



        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Users className="h-4 w-4 text-slate-500" /> Connections
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Schools, teachers, students and parents you work with — and the requests waiting for you.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/requests"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              Requests{counts.pendingIncoming > 0 ? ` (${counts.pendingIncoming})` : ""}
            </Link>
            <Link
              to="/community/discover"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              Community of Practice
            </Link>
            <ConnectByCodeDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
                >
                  Connect with a code
                </button>
              }
            />
          </div>
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Mail className="h-4 w-4 text-slate-500" /> Email address
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Used for account and security emails, and to recover your MathGPL ID.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="account-email" className="text-slate-700">Email address</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              className={FIELD}
            />
            <Button onClick={saveEmail} disabled={savingEmail} className="min-h-[44px]">
              {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save email
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-slate-500" /> Password
          </h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="account-password" className="text-slate-700">New password</Label>
              <div className="relative">
                <Input
                  id="account-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
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
            <div className="space-y-2">
              <Label htmlFor="account-confirm" className="text-slate-700">Confirm new password</Label>
              <Input
                id="account-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                maxLength={128}
                className={FIELD}
              />
            </div>
            <Button onClick={savePassword} disabled={savingPassword} className="min-h-[44px]">
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Update password
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default MyAccountPage;
