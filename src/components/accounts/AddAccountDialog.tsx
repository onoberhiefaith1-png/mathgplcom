import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createPlatformAccount } from "@/lib/accounts/platform.functions";

type NewRole = "school" | "teacher" | "parent" | "student" | "co_admin";

const roles: { value: NewRole; label: string }[] = [
  { value: "school", label: "School" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
  { value: "co_admin", label: "Co-Administrator" },
];

/** Platform administrators can create any account type directly. */
const AddAccountDialog = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { toast } = useToast();
  const create = useServerFn(createPlatformAccount);
  const [role, setRole] = useState<NewRole>("school");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await create({ data: { role, name: name || undefined, organisation: organisation || undefined, email, password } });
      toast({ title: "Account created", description: email });
      onCreated();
      onClose();
    } catch (e) {
      toast({ title: "Could not create account", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-surface-foreground outline-hidden focus:border-dash-gold";
  const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-dash-navy/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-dash-border bg-dash-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-dash-surface-foreground">
            <UserPlus className="h-5 w-5 text-dash-gold" /> Add account
          </h2>
          <button type="button" onClick={onClose} className="rounded-full border border-dash-border p-1.5 text-dash-surface-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className={label}>Account type</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    role === r.value
                      ? "bg-dash-navy text-dash-surface"
                      : "border border-dash-border text-dash-surface-muted hover:border-dash-gold"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={label}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Full name" />
          </label>
          <label className="block">
            <span className={label}>Organisation</span>
            <input
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              className={field}
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className={label}>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="name@school.org" />
          </label>
          <label className="block">
            <span className={label}>Temporary password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder="At least 8 characters"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-dash-border px-4 py-2 text-sm text-dash-surface-foreground">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !email.trim() || password.length < 8}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl bg-dash-navy px-4 py-2 text-sm font-semibold text-dash-surface disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddAccountDialog;
