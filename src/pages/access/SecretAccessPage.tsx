import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Link, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { signInWithAccessCode } from "@/lib/access/access.functions";

/**
 * The secret entrance. Reached only from the three dots at the foot of the
 * homepage, it takes an ID, a password and a personal access code, and lands
 * the person in their normal account area with everything unlocked.
 */
const SecretAccessPage = () => {
  const enter = useServerFn(signInWithAccessCode);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mathgplId, setMathgplId] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const session = await enter({ data: { mathgplId, password, accessCode } });
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      if (error) throw error;
      navigate("/", { replace: true });
    } catch (error) {
      toast({ title: "Entrance refused", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[hsl(224_70%_6%)] px-6 py-16 text-white">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur"
      >
        <p className="text-xs font-semibold tracking-[0.4em] text-amber-300/80">MATHGPL</p>
        <h1 className="mt-3 text-2xl font-semibold">Authorised entrance</h1>
        <p className="mt-2 text-sm text-white/60">
          For people who have been given a personal access code.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="access-id" className="text-white/80">MathGPL ID</Label>
            <Input
              id="access-id"
              value={mathgplId}
              onChange={(event) => setMathgplId(event.target.value.toUpperCase())}
              placeholder="TCH/000123"
              autoComplete="username"
              className="mt-1 min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <div>
            <Label htmlFor="access-password" className="text-white/80">Password</Label>
            <Input
              id="access-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 min-h-[44px] bg-white text-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="access-code" className="text-white/80">Access code</Label>
            <Input
              id="access-code"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              placeholder="MG-XXXXX-XXXXX"
              className="mt-1 min-h-[44px] bg-white font-mono text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="mt-6 min-h-[44px] w-full bg-amber-400 text-slate-900 hover:bg-amber-300">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter"}
        </Button>
      </form>
    </main>
  );
};

export default SecretAccessPage;
