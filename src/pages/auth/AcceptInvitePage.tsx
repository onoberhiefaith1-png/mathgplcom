import { useEffect, useState } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_FIELD } from "@/lib/accounts/authField";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * Landing page for a teacher invited by a school or a parent. The invitation
 * link signs them in temporarily; here they choose their own password and drop
 * straight into their own empty workspace.
 */
const AcceptInvitePage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast({ title: "Could not set password", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome to MathGPL", description: "Your teaching workspace is ready." });
    navigate("/teaching-hub", { replace: true });
  };

  return (
    <main className="cinematic-sky flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-amber-200/15 bg-card/60 p-6 shadow-2xl backdrop-blur">
        <p className="text-center text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>
        <h1 className="mt-2 text-center text-2xl font-semibold">Accept your invitation</h1>
        {!ready ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Open this page from the invitation link in your email to continue.
          </p>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Choose a password</Label>
              <Input id="invite-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={AUTH_FIELD} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-confirm">Confirm password</Label>
              <Input id="invite-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={AUTH_FIELD} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Enter my workspace</Button>
          </form>
        )}
      </div>
      <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">← Back to sign in</Link>
    </main>
  );
};

export default AcceptInvitePage;
