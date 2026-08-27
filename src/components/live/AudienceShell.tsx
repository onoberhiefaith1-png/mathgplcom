/**
 * MathGPL Live — the audience shell.
 *
 * Someone who opened an invite link sees only what a guest of the session is
 * meant to see: Notes, SmartBoard, Challenge and Game Challenge. There is no
 * account, no permanent profile and no stored history — a username is asked for
 * only when the teacher switched that on, and it stays on this device.
 */
import { useCallback, useEffect, useState } from "react";
import { BookOpen, ClipboardList, Compass, ExternalLink, Loader2, Lock, Presentation, ArrowLeft } from "lucide-react";
import { NoteReader } from "@/components/lessonnotes/NoteReader";
import BroadcastPanel from "@/components/live/BroadcastPanel";
import { PUBLIC_SITE } from "@/lib/public/publicSite";
import { guestDisplayName, guestName, setGuestName } from "@/lib/live/guest";
import {
  fetchAudienceActivities, fetchAudienceBoard, fetchAudienceNote, fetchAudienceNotes,
  fetchEntryStatus, requestEntry,
  type AudienceActivity, type AudienceNote, type EntryStatus,
} from "@/lib/live/publicAudience";
import type { BroadcastEntry } from "@/lib/live/broadcast";

type View = "home" | "notes" | "smartboard" | "challenge" | "game";

const TILES: { view: View; label: string; icon: typeof BookOpen; hint: string }[] = [
  { view: "notes", label: "Notes", icon: BookOpen, hint: "Read the lesson notes shared with this session." },
  { view: "smartboard", label: "SmartBoard", icon: Presentation, hint: "Follow the board as the teacher works." },
  { view: "challenge", label: "Challenge", icon: ClipboardList, hint: "Take part in the challenge questions." },
  { view: "game", label: "Game Challenge", icon: Compass, hint: "Play the game challenge of this session." },
];

const AudienceShell = ({
  sessionId,
  title,
  description,
  askName,
  broadcasts,
  locked,
}: {
  sessionId: string;
  title: string;
  description?: string | null;
  askName: boolean;
  broadcasts: BroadcastEntry[];
  locked: boolean;
}) => {
  const [entry, setEntry] = useState<EntryStatus | null>(null);
  const [view, setView] = useState<View>("home");
  const [name, setName] = useState<string | null>(() => guestName());
  const [nameDraft, setNameDraft] = useState("");

  const [notes, setNotes] = useState<AudienceNote[] | null>(null);
  const [openNote, setOpenNote] = useState<Record<string, unknown> | null>(null);
  const [activities, setActivities] = useState<AudienceActivity[] | null>(null);
  const [board, setBoard] = useState<Record<string, unknown> | null>(null);

  // Entry: free entry admits at once, otherwise the guest waits for approval.
  useEffect(() => {
    (async () => setEntry(await requestEntry(sessionId)))();
  }, [sessionId]);

  useEffect(() => {
    if (entry !== "pending") return;
    const t = setInterval(async () => setEntry(await fetchEntryStatus(sessionId)), 4000);
    return () => clearInterval(t);
  }, [entry, sessionId]);

  const load = useCallback(
    async (next: View) => {
      setView(next);
      setOpenNote(null);
      if (next === "notes" && !notes) setNotes(await fetchAudienceNotes(sessionId));
      if (next === "smartboard") {
        const b = await fetchAudienceBoard(sessionId);
        setBoard((b?.state_json as Record<string, unknown>) ?? null);
      }
      if ((next === "challenge" || next === "game") && !activities) {
        setActivities(await fetchAudienceActivities(sessionId));
      }
    },
    [sessionId, notes, activities],
  );

  if (entry === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Entering the session…
      </div>
    );
  }

  if (entry === "unavailable") {
    return (
      <section className="rounded-2xl border border-border bg-card/40 p-6 text-center">
        <h2 className="text-lg font-semibold">This session is not open</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ask the teacher for a fresh invite link.</p>
        <a href={PUBLIC_SITE} className="mt-4 inline-flex items-center gap-1.5 text-sm underline">
          Visit MathGPL <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>
    );
  }

  if (entry === "pending" || entry === "declined") {
    return (
      <section className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-6 text-center">
        <Lock className="mx-auto h-7 w-7 text-amber-200" />
        <h2 className="mt-3 text-lg font-semibold text-amber-100">
          {entry === "pending" ? "Waiting for the teacher to let you in" : "The teacher has not admitted you"}
        </h2>
        <p className="mt-1 text-sm text-amber-100/80">
          {entry === "pending"
            ? `You are in the queue as ${name ?? guestDisplayName()}. This page opens by itself once you're admitted.`
            : "You can ask the teacher and try the link again."}
        </p>
        <a href={PUBLIC_SITE} className="mt-4 inline-flex items-center gap-1.5 text-sm text-amber-100/80 underline">
          Visit MathGPL <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>
    );
  }

  if (askName && !name) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nameDraft.trim()) return;
          setGuestName(nameDraft);
          setName(nameDraft.trim());
        }}
        className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-5"
      >
        <label htmlFor="audience-name" className="text-sm font-medium">
          Your teacher would like to know who's here
        </label>
        <input
          id="audience-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-hidden focus:border-primary"
        />
        <button
          type="submit"
          className="min-h-[48px] w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground"
        >
          Continue
        </button>
        <p className="text-xs text-muted-foreground">
          No account is created — your name is only used for this session.
        </p>
      </form>
    );
  }

  const back = (
    <button
      type="button"
      onClick={() => (openNote ? setOpenNote(null) : setView("home"))}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  if (view === "notes") {
    return (
      <section className="space-y-4">
        {back}
        {openNote ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">{String(openNote.title ?? "Notes")}</h2>
            <NoteReader documentJson={openNote.document_json} />
          </div>
        ) : notes === null ? (
          <div className="text-sm text-muted-foreground">Loading Notes…</div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            The teacher has not shared any Notes with this session yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={async () => setOpenNote(await fetchAudienceNote(sessionId, n.id))}
                className="rounded-2xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/40"
              >
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground">
                  {[n.subject, n.subtopic].filter(Boolean).join(" · ") || "Lesson notes"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (view === "smartboard") {
    return (
      <section className="space-y-4">
        {back}
        <div className="rounded-2xl border border-border bg-card/40 p-6">
          <h2 className="text-lg font-semibold">SmartBoard</h2>
          <BroadcastPanel entries={broadcasts} unlocked={!locked} />
          <p className="mt-3 text-sm text-muted-foreground">
            {board
              ? "The teacher's board is live — follow along with the broadcast above."
              : "The teacher has not opened the SmartBoard yet. This page updates when they do."}
          </p>
        </div>
      </section>
    );
  }

  if (view === "challenge" || view === "game") {
    const wanted = view === "challenge" ? "challenge" : "game_challenge";
    const list = (activities ?? []).filter((a) => a.kind === wanted);
    const label = view === "challenge" ? "Challenge" : "Game Challenge";
    return (
      <section className="space-y-4">
        {back}
        <h2 className="text-lg font-semibold">{label}</h2>
        {activities === null ? (
          <div className="text-sm text-muted-foreground">Loading {label}…</div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No {label} is open in this session yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card/40 p-4">
                <div className="text-sm font-semibold">{a.title ?? label}</div>
                <div className="text-xs text-muted-foreground">
                  {a.status === "active" ? "Open now" : (a.status ?? "")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="text-2xl font-semibold">{title}</div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-3 text-xs text-muted-foreground">
          You're in as {name ?? guestDisplayName()} — no account needed.
        </div>
      </div>

      <BroadcastPanel entries={broadcasts} unlocked={!locked} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {TILES.map(({ view: v, label, icon: Icon, hint }) => (
          <button
            key={v}
            type="button"
            onClick={() => void load(v)}
            className="flex h-28 flex-col justify-between rounded-2xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/40 active:scale-[0.98]"
          >
            <Icon className="h-5 w-5 text-primary" />
            <div>
              <div className="truncate text-sm font-semibold">{label}</div>
              <div className="line-clamp-2 text-[11px] text-muted-foreground">{hint}</div>
            </div>
          </button>
        ))}
      </div>

      <a href={PUBLIC_SITE} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline">
        Visit MathGPL <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </section>
  );
};

export default AudienceShell;
