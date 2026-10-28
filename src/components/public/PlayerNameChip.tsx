// The one place a public player sets the name that appears on the leaderboard.
// It never blocks anything: a default "User N" is already there, and editing is
// an inline field. Used on the Smart Card page, the challenge board top bar and
// the Game Challenge stage so the name is identical everywhere.

import { useState } from "react";
import { Pencil, UserRound } from "lucide-react";
import { rememberIdentity, type CardIdentity } from "@/lib/smartcards/smartCards";

type Props = {
  identity: CardIdentity;
  onChange: (next: CardIdentity) => void;
  /** "card" is the roomy row on the Smart Card page; "bar" is the compact chip. */
  variant?: "card" | "bar";
  className?: string;
};

const PlayerNameChip = ({ identity, onChange, variant = "bar", className = "" }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(identity.displayName);

  const save = () => {
    const name = draft.trim().slice(0, 40);
    if (name && name !== identity.displayName) {
      const next = { ...identity, displayName: name };
      rememberIdentity(next);
      onChange(next);
    }
    setEditing(false);
  };

  const start = () => { setDraft(identity.displayName); setEditing(true); };

  if (variant === "card") {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 ${className}`}>
        <UserRound className="h-4 w-4 text-slate-400" />
        <span className="text-slate-500">Playing as</span>
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              maxLength={40}
              placeholder="Your name"
              aria-label="Your name"
              className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-hidden focus:border-slate-500"
            />
            <button type="submit" className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">Save</button>
          </form>
        ) : (
          <button
            type="button"
            onClick={start}
            title="Change the name shown on the leaderboard"
            className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline"
          >
            {identity.displayName}
            <Pencil className="h-3 w-3 text-slate-400" />
          </button>
        )}
      </div>
    );
  }

  return editing ? (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className={`flex items-center gap-1 ${className}`}>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        maxLength={40}
        placeholder="Your name"
        aria-label="Your name"
        className="h-7 w-40 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-hidden"
      />
      <button type="submit" className="h-7 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground">Save</button>
    </form>
  ) : (
    <button
      type="button"
      onClick={start}
      title="Change the name shown on the leaderboard"
      className={`inline-flex items-center gap-1 text-muted-foreground hover:underline ${className}`}
    >
      <UserRound className="h-3 w-3" />
      {identity.displayName}
      <Pencil className="h-2.5 w-2.5 opacity-60" />
    </button>
  );
};

export default PlayerNameChip;
