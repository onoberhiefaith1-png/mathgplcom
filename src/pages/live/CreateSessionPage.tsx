import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LiveSession,
  SessionVisibility,
  ScheduleTimes,
  createSession,
  fetchAllowFreeEntry,
  hydrateSession,
  querySessions,
  updateSession,
} from "@/lib/live/sessions";
import ScheduleEditor from "@/components/live/ScheduleEditor";
import BroadcastEditor from "@/components/live/BroadcastEditor";
import { BroadcastEntry, newBroadcastEntry } from "@/lib/live/broadcast";
import { activeSchoolOrgId } from "@/lib/accounts/workspaceScope";
import { joinUrl } from "@/lib/links/publicUrl";
import { copyText, selectAllIn } from "@/lib/clipboard/copyText";

type NotebookOption = { id: string; label: string };

/** Readable, high-contrast field surface (dark inputs were unreadable). */
const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

/** 0.25 → 6 hours in quarter-hour steps, shown as decimal hours. */
const DURATION_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 0.25);

const TIME_ZONES: string[] = (() => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return Array.from(
    new Set([
      local,
      "UTC",
      "Africa/Lagos",
      "Europe/London",
      "Europe/Berlin",
      "America/New_York",
      "America/Los_Angeles",
      "Asia/Dubai",
      "Asia/Kolkata",
      "Asia/Singapore",
      "Australia/Sydney",
    ]),
  );
})();

/**
 * Open or edit a permanent Live teaching room.
 *
 * With a `sessionId` this is the room's Settings: it loads the existing room's
 * values and saves back to that same room, so the code and join link never
 * change and no second room is ever created.
 */
const CreateSessionPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const editing = Boolean(sessionId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notebookId, setNotebookId] = useState("");
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleTimes, setScheduleTimes] = useState<ScheduleTimes>({});
  const [durationHours, setDurationHours] = useState(1);

  const [timeZone, setTimeZone] = useState(TIME_ZONES[0]);
  const [visibility, setVisibility] = useState<SessionVisibility>("public");
  const [askParticipantName, setAskParticipantName] = useState(false);
  const [allowFreeEntry, setAllowFreeEntry] = useState(true);

  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([newBroadcastEntry()]);
  const [notebooks, setNotebooks] = useState<NotebookOption[]>([]);

  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<LiveSession | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate("/auth?redirect=/live/sessions/create");
        return;
      }
      // Only the active workspace's notes can be taught in a room.
      const orgId = await activeSchoolOrgId();
      let notesQuery = supabase
        .from("notebooks")
        .select("id, title, subject, subtopic")
        .eq("owner_id", userData.user.id);
      notesQuery = orgId ? notesQuery.eq("org_id", orgId) : notesQuery.is("org_id", null);
      const { data } = await notesQuery.order("updated_at", { ascending: false }).limit(100);

      setNotebooks(
        ((data ?? []) as { id: string; title: string | null; subject: string; subtopic: string }[]).map((n) => ({
          id: n.id,
          label: n.title?.trim() || [n.subject, n.subtopic].filter(Boolean).join(" — ") || "Untitled note",
        })),
      );
    })();
  }, [navigate]);

  // Settings: load this room's own values into the form.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const row = await querySessions<Record<string, unknown>>((cols) =>
        supabase.from("sessions").select(cols).eq("id", sessionId).maybeSingle() as never,
      );
      if (cancelled) return;
      if (!row) {
        toast({ title: "Room not found", variant: "destructive" });
        navigate("/live/sessions");
        return;
      }
      const s = hydrateSession(row);
      setTitle(s.title);
      setDescription(s.description ?? "");
      setNotebookId(s.notebook_id ?? "");
      setScheduleDays(s.schedule_days);
      setScheduleTimes(s.schedule_times);
      setDurationHours(Math.max(0.25, (s.duration_minutes || 60) / 60));
      setTimeZone(s.time_zone || TIME_ZONES[0]);
      setVisibility(s.visibility);
      setAskParticipantName(s.ask_participant_name);
      setBroadcasts(s.broadcasts.length ? s.broadcasts : [newBroadcastEntry()]);
      setAllowFreeEntry(await fetchAllowFreeEntry(sessionId));
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate, toast]);

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
      return;
    }
    toast({
      title: "Copy blocked by your browser",
      description: "Select the link below and copy it manually.",
      variant: "destructive",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Room title is required", variant: "destructive" });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?redirect=/live/sessions/create");
      return;
    }

    const durationMinutes = Math.max(5, Math.round((Number(durationHours) || 1) * 60));
    setSubmitting(true);
    try {
      if (editing && sessionId) {
        const { error } = await updateSession(sessionId, {
          title,
          description,
          notebookId: notebookId || null,
          scheduleDays,
          scheduleTimes,
          durationMinutes,
          timeZone,
          visibility,
          askParticipantName,
          allowFreeEntry,
          broadcasts,
        });
        if (error) throw new Error(error.message);
        toast({ title: "Room updated" });
        navigate(`/live/sessions/${sessionId}`);
        return;
      }

      const session = await createSession({
        title,
        description,
        notebookId: notebookId || null,
        scheduleDays,
        scheduleTime: null,
        scheduleTimes,
        durationMinutes,
        timeZone,
        visibility,
        askParticipantName,
        ownerId: userData.user.id,
        broadcasts,
      });
      setCreated(session);
    } catch (err) {
      toast({
        title: editing ? "Could not save the room" : "Could not create the room",
        description: String((err as Error).message ?? ""),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const Toggle = ({
    on,
    onToggle,
    title: label,
    hint,
  }: {
    on: boolean;
    onToggle: () => void;
    title: string;
    hint: string;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-4 text-left transition ${
        on ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${
            on ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          to={editing && sessionId ? `/live/sessions/${sessionId}` : "/live/sessions"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {editing ? "Room" : "Sessions"}
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">{editing ? "Room Settings" : "Create Teaching Room"}</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-xl px-6 py-8">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        ) : !created ? (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
            <div className="space-y-2">
              <Label htmlFor="title">Room Title</Label>
              <Input id="title" className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notebook">Lesson Note (Optional)</Label>
              <select
                id="notebook"
                value={notebookId}
                onChange={(e) => setNotebookId(e.target.value)}
                className={`h-10 w-full rounded-md border px-3 text-sm outline-hidden focus:border-primary ${FIELD}`}
              >
                <option value="">No lesson note attached</option>
                {notebooks.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" className={FIELD} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <ScheduleEditor
              days={scheduleDays}
              times={scheduleTimes}
              onChange={(days, times) => {
                setScheduleDays(days);
                setScheduleTimes(times);
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="duration">Lesson length (hours)</Label>
                <select
                  id="duration"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className={`h-10 w-full rounded-md border px-3 text-sm outline-hidden focus:border-primary ${FIELD}`}
                >
                  {DURATION_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h.toFixed(2)} hours</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tz">Time Zone</Label>
                <select
                  id="tz"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className={`h-10 w-full rounded-md border px-3 text-sm outline-hidden focus:border-primary ${FIELD}`}
                >
                  {TIME_ZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            <BroadcastEditor value={broadcasts} onChange={setBroadcasts} />

            <div className="space-y-2">
              <Label>Visibility</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "public", title: "Public", hint: "Listed in Community so anyone can find your teaching room." },
                  { value: "private", title: "Private", hint: "Only people with the room code can come in." },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      visibility === opt.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              on={allowFreeEntry}
              onToggle={() => setAllowFreeEntry((v) => !v)}
              title="Free entry"
              hint="Live is public broadcasting: anyone with the link comes straight in. Turn this off to approve visitors one by one."
            />

            <Toggle
              on={askParticipantName}
              onToggle={() => setAskParticipantName((v) => !v)}
              title="Ask participants for a name"
              hint="Audience members join instantly. Turn this on to request a display name first."
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : editing ? "Save Room" : "Create Teaching Room"}
            </button>
          </form>
        ) : (
          <div className="space-y-6 rounded-2xl border border-primary/40 bg-card/40 p-6 backdrop-blur">
            <div>
              <h2 className="text-xl font-semibold">Teaching room opened</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This code and link are permanent — share them once and reuse them for every lesson.
              </p>
            </div>
            {([
              { label: "Room Code", value: created.session_code },
              { label: "Join Link", value: joinUrl(created.session_code) },
            ] as const).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                <div className="flex items-center gap-2">
                  <code
                    onClick={(e) => selectAllIn(e.currentTarget)}
                    className="flex-1 cursor-text rounded-md border border-border bg-background px-3 py-2 text-sm break-all select-all"
                  >
                    {row.value}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(row.label, row.value)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent"
                    aria-label={`Copy ${row.label}`}
                  >
                    {copied === row.label ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate(`/live/sessions/${created.id}`)}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
            >
              Open Room Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CreateSessionPage;
