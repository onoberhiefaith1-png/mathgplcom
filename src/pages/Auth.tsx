import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Preserve a same-origin redirect target (OAuth consent, or a public Smart
  // Card the visitor was sent to) so nobody ever loses their destination page.
  const RETURN_KEY = "mathgpl:returnTo";
  const rawNext = searchParams.get("next") ?? searchParams.get("redirect") ?? searchParams.get("returnTo") ?? "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  // A provider round-trip can drop the query string, so the destination is
  // also parked in sessionStorage and read back on return.
  const stored = (() => {
    try {
      const v = sessionStorage.getItem(RETURN_KEY) ?? "";
      return v.startsWith("/") && !v.startsWith("//") ? v : "";
    } catch { return ""; }
  })();
  const postLoginTarget = safeNext || stored || "/lesson-notes";

  useEffect(() => {
    if (safeNext) {
      try { sessionStorage.setItem(RETURN_KEY, safeNext); } catch { /* ignore */ }
    }
  }, [safeNext]);

  useEffect(() => {
    const go = () => {
      try { sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
      window.location.href = postLoginTarget;
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) go();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, postLoginTarget]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${postLoginTarget}` },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirm your address to finish signing up." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast({ title: "Auth error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${postLoginTarget}`,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
    }
  };

  return (
    <main className="cinematic-sky flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-amber-200/15 bg-card/60 backdrop-blur p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.4em] text-primary text-center">MathGPL</p>
        <h1 className="mt-2 text-2xl font-semibold text-center">
          {mode === "login" ? "Welcome back" : "Create your notebook"}
        </h1>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "login" ? "Log in" : "Sign up"}
          </Button>
        </form>
        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continue with Google
        </Button>
        <button
          type="button"
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to the academy
      </Link>
    </main>
  );
};

export default Auth;
