// Guest Link — the shell every guest sees.
//
// A guest has no account and no dashboard: only this resource, an optional
// name and a way to visit MathGPL. Nothing they do here reaches a class.

import { ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  guestLinkDisplayName, guestNameSkipped, setGuestLinkName, skipGuestLinkName,
} from "@/lib/guests/guestSession";

export const GuestLoading = ({ label = "Opening…" }: { label?: string }) => (
  <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-100 text-slate-500">
    <Loader2 className="h-5 w-5 animate-spin" /> {label}
  </div>
);

export const GuestUnavailable = ({ message }: { message: string }) => (
  <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
    <h1 className="text-xl font-semibold">This link isn&rsquo;t available</h1>
    <p className="text-sm text-muted-foreground">{message}</p>
    <a href="/" className="min-h-[44px] rounded-xl border px-5 py-2.5 text-sm font-medium hover:bg-accent">
      Visit MathGPL
    </a>
  </div>
);

/** Asks for a name once — always skippable. */
export const GuestNameGate = ({
  askName,
  onDone,
  children,
}: {
  askName: boolean;
  onDone: () => void;
  children: ReactNode;
}) => {
  const [needed, setNeeded] = useState(askName && !guestNameSkipped() && guestLinkDisplayName().startsWith("Guest "));
  const [draft, setDraft] = useState("");

  if (!needed) return <>{children}</>;

  const finish = () => { setNeeded(false); onDone(); };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <form
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setGuestLinkName(draft); finish(); }}
        className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-6"
      >
        <label htmlFor="guest-name" className="text-sm font-medium">
          What should we call you? (optional)
        </label>
        <input
          id="guest-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-hidden focus:border-primary"
        />
        <button type="submit" className="min-h-[48px] w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground">
          Continue
        </button>
        <button
          type="button"
          onClick={() => { skipGuestLinkName(); finish(); }}
          className="min-h-[44px] w-full rounded-xl border border-border px-4 text-sm"
        >
          Skip
        </button>
      </form>
    </div>
  );
};
