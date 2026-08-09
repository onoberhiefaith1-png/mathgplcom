import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { beginImpersonationWithCredentials } from "@/lib/accounts/impersonation";

export type CredentialTarget = {
  email: string;
  name: string;
  role: string;
  home: string;
};

/**
 * Customer accounts are never opened with platform powers. To enter one the
 * owner must sign in with that customer's own email and password.
 */
const CredentialEntryDialog = ({
  target,
  onClose,
}: {
  target: CredentialTarget;
  onClose: () => void;
}) => {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(target.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await beginImpersonationWithCredentials({ ...target, email, password });
      // Every workspace opens on its building first — the dashboard is entered from there.
      window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dash-navy/70 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-3xl border border-dash-border bg-dash-surface p-6 shadow-[var(--shadow-dash)]">
        <div className="flex items-center gap-2 text-dash-surface-foreground">
          <Lock className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Sign in as {target.name}</h2>
        </div>
        <p className="mt-2 text-sm text-dash-surface-muted">
          This account belongs to a customer. Entering it needs their own email and password — the
          platform console cannot open it for you.
        </p>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-dash-surface-muted">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-dash-border bg-background px-3 py-2 text-sm text-foreground"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-dash-surface-muted">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password) void submit();
          }}
          className="mt-1 w-full rounded-xl border border-dash-border bg-background px-3 py-2 text-sm text-foreground"
        />

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-dash-border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-dash-surface-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !password || !email}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-full bg-dash-gold px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-dash-navy disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enter workspace
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialEntryDialog;
