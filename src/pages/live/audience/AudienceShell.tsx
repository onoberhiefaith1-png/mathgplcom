import { ReactNode, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Clock, DoorOpen, Radio, UserRound } from "lucide-react";

import { roomLabel, roomStateOf, roomTone } from "@/lib/live/sessions";

import { guestDisplayName } from "@/lib/live/guest";
import type { AudienceAccess } from "@/lib/live/useAudienceAccess";

/**
 * The audience environment.
 *
 * A person who arrived through a MathGPL Live link sees only this session:
 * Notes, SmartBoard, Challenge and Game Challenge. There is no account, no
 * platform navigation and no history — only a way to visit MathGPL itself.
 */
const AudienceShell = ({
  access,
  title,
  backTo,
  children,
}: {
  access: AudienceAccess;
  title?: string;
  backTo?: string;
  children: ReactNode;
}) => {

  const [nameDraft, setNameDraft] = useState("");
  const { loading, notFound, session, decision } = access;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (notFound || !session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">We couldn&rsquo;t find that room</h1>
        <p className="text-sm text-muted-foreground">
          This code doesn&rsquo;t match a MathGPL Live teaching room. Rooms never close or expire, so
          check the code with your teacher and try again.
        </p>
        <Link to="/live/join" className="min-h-[44px] rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
          Enter a room code
        </Link>
      </div>
    );
  }

  const state = roomStateOf(session);
  const needsName = !access.signedIn && session.ask_participant_name && !access.name;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-linear-to-b from-background via-background to-muted/20 text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6">
        {backTo ? (
          <Link to={backTo} className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{title ?? "Session"}</span>
          </Link>
        ) : (
          <span className="truncate text-sm text-muted-foreground">{session.title}</span>
        )}
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${roomTone[state]}`}>
          {state === "live" ? <Radio className="h-3 w-3 animate-pulse" /> : <DoorOpen className="h-3 w-3" />}
          {roomLabel[state]}
        </span>

      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        {needsName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void access.saveName(nameDraft);
            }}
            className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-5"
          >
            <label htmlFor="audience-name" className="text-sm font-medium">
              Your teacher would like to know who&rsquo;s here
            </label>
            <input
              id="audience-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-hidden focus:border-primary"
            />
            <button type="submit" className="min-h-[48px] w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground">
              Continue
            </button>
          </form>
        ) : decision === "removed" ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <div className="text-lg font-semibold">You were removed from this session</div>
            <p className="mt-1 text-sm text-muted-foreground">Ask the teacher for a new invite link.</p>
          </section>
        ) : decision === "waiting" ? (
          <section className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-8 text-center">
            <Clock className="mx-auto h-7 w-7 text-amber-200" />
            <div className="mt-3 text-lg font-semibold text-amber-100">Waiting for teacher approval</div>
            <p className="mt-1 text-sm text-amber-100/80">
              You&rsquo;ll join automatically the moment the teacher lets you in.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{access.name ?? guestDisplayName()}</span>
            </div>
          </section>
        ) : (
          children
        )}
      </main>

      <footer className="border-t border-border/60 px-4 py-6 text-center sm:px-6">
        <Link
          to="/auth"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent"
        >
          Visit MathGPL — Mathematics Reimagined
        </Link>
      </footer>
    </div>
  );
};

export default AudienceShell;
