import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Copy, UserRound, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AudienceMember,
  isPresent,
  listAudience,
  setAllowFreeEntry,
  setAudienceStatus,
} from "@/lib/live/audience";
import {
  LiveSession,
  querySessions,
  fetchAllowFreeEntry,
  fetchSessionCode,
  hydrateSession,
} from "@/lib/live/sessions";
import { joinUrl } from "@/lib/links/publicUrl";
import { copyText, selectAllIn } from "@/lib/clipboard/copyText";

/**
 * Teacher's Audience page for a MathGPL Live session.
 *
 * "Allow Free Entry" on: anyone with the link or Join Code walks straight in.
 * Off: they wait here until approved.
 */
const SessionAudiencePage = () => {
  const { sessionId } = useParams();
  const { toast } = useToast();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [code, setCode] = useState("");
  const [members, setMembers] = useState<AudienceMember[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setMembers(await listAudience(sessionId));
  }, [sessionId]);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      const data = await querySessions<Record<string, unknown>>((cols) =>
        supabase.from("sessions").select(cols).eq("id", sessionId).maybeSingle() as never,
      );

      if (data) {
        const row = {
          ...hydrateSession(data as unknown as Record<string, unknown>),
          allow_free_entry: await fetchAllowFreeEntry(sessionId),
        };
        setSession(row);
        setCode(await fetchSessionCode(row.id));
      }
      await refresh();
      setLoading(false);
    })();
  }, [sessionId, refresh]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`audience-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_audience", filter: `session_id=eq.${sessionId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, refresh]);

  const joinLink = code ? joinUrl(code) : "";

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
      return;
    }
    toast({
      title: "Copy blocked by your browser",
      description: "Select the link and copy it manually.",
      variant: "destructive",
    });
  };

  const toggleFreeEntry = async () => {
    if (!session) return;
    const next = !session.allow_free_entry;
    setSession({ ...session, allow_free_entry: next });
    await setAllowFreeEntry(session.id, next);
    toast({ title: next ? "Free entry is on" : "Approval is now required" });
  };

  const decide = async (member: AudienceMember, status: "approved" | "removed") => {
    await setAudienceStatus(member.id, status);
    await refresh();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const waiting = members.filter((m) => m.status === "waiting");
  const inSession = members.filter((m) => m.status === "approved");
  const now = Date.now();

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-background via-background to-muted/20 text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6">
        <Link
          to={`/live/sessions/${sessionId}`}
          className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{session?.title ?? "Session"}</span>
        </Link>
        <h1 className="shrink-0 text-base font-semibold sm:text-lg">Audience</h1>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-12 sm:px-6">
        <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Allow Free Entry</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {session?.allow_free_entry
                  ? "Anyone with the invite link or Join Code enters instantly — no login, no approval."
                  : "Visitors wait here until you approve them."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(session?.allow_free_entry)}
              onClick={toggleFreeEntry}
              className={`h-7 w-12 shrink-0 rounded-full border transition ${
                session?.allow_free_entry ? "border-primary bg-primary" : "border-border bg-muted"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-background transition ${
                  session?.allow_free_entry ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              { label: "Join Code", value: code },
              { label: "Invite Link", value: joinLink },
            ] as const).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                <div className="flex items-center gap-2">
                  <code
                    onClick={(e) => selectAllIn(e.currentTarget)}
                    className="min-w-0 flex-1 cursor-text rounded-md border border-border bg-background px-2 py-1.5 text-xs break-all select-all"
                  >
                    {row.value}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(row.label, row.value)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent"
                    aria-label={`Copy ${row.label}`}
                  >
                    {copied === row.label ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <h2 className="text-sm font-semibold">Waiting for approval ({waiting.length})</h2>
          {waiting.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nobody is waiting.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waiting.map((m) => (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3">
                  <span className="truncate text-sm">{m.display_name ?? "Guest"}</span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(m, "approved")}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(m, "removed")}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-3 text-xs hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <h2 className="text-sm font-semibold">In the session ({inSession.length})</h2>
          {inSession.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No audience members yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {inSession.map((m) => (
                <li key={m.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3">
                  <UserRound className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-sm">
                    {m.display_name ?? "Guest"}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {isPresent(m, now) ? "watching" : "away"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void decide(m, "removed")}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md border border-border px-3 text-xs hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default SessionAudiencePage;
