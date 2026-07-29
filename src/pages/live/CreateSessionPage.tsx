import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LiveSession, SessionVisibility, createSession } from "@/lib/live/sessions";
import BroadcastEditor from "@/components/live/BroadcastEditor";
import { BroadcastEntry, newBroadcastEntry } from "@/lib/live/broadcast";


type NotebookOption = { id: string; label: string };

/** Readable, high-contrast field surface (dark inputs were unreadable). */
const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 0.25 → 2 hours in quarter-hour steps, shown as decimal hours. */
const DURATION_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 0.25);

const TIME_ZONES: string[] = (() => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const common = [
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
  ];
  return Array.from(new Set(common));
})();

const CreateSessionPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notebookId, setNotebookId] = useState("");
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeZone, setTimeZone] = useState(TIME_ZONES[0]);
  const [visibility, setVisibility] = useState<SessionVisibility>("private");
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([newBroadcastEntry()]);
  const [notebooks, setNotebooks] = useState<NotebookOption[]>([]);

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
      const { data } = await supabase
        .from("notebooks")
        .select("id, title, subject, subtopic")
        .eq("owner_id", userData.user.id)
        .order("updated_at", { ascending: false })
        .limit(100);
      setNotebooks(
        ((data ?? []) as { id: string; title: string | null; subject: string; subtopic: string }[]).map((n) => ({
          id: n.id,
          label: n.title?.trim() || [n.subject, n.subtopic].filter(Boolean).join(" — ") || "Untitled note",
        })),
      );
    })();
  }, [navigate]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Session title is required", variant: "destructive" });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?redirect=/live/sessions/create");
      return;
    }

    let startsAt: string | null = null;
    if (dateObj && hour !== "" && minute !== "") {
      const local = new Date(`${toISODate(dateObj)}T${hour}:${minute}`);
      if (!Number.isNaN(local.getTime())) startsAt = local.toISOString();
    }

    setSubmitting(true);
    try {
      const session = await createSession({
        title,
        description,
        notebookId: notebookId || null,
        startsAt,
        durationMinutes: Math.max(5, Math.round((Number(durationHours) || 1) * 60)),
        timeZone,
        visibility,
        ownerId: userData.user.id,
        broadcasts,

      });
      setCreated(session);
    } catch (err) {
      toast({ title: "Could not create session", description: String((err as Error).message ?? ""), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/live/sessions" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Sessions
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Create Session</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-xl px-6 py-8">
        {!created ? (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm ${FIELD}`}
                    >
                      <span className={dateObj ? "" : "text-muted-foreground"}>
                        {dateObj ? dateObj.toLocaleDateString(undefined, { dateStyle: "medium" }) : "Pick a date"}
                      </span>
                      <CalendarIcon className="h-4 w-4 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateObj}
                      onSelect={(d) => { setDateObj(d); setDateOpen(false); }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Start Time (24h)</Label>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Hour"
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                    className={`h-10 w-full rounded-md border px-2 text-sm outline-hidden focus:border-primary ${FIELD}`}
                  >
                    <option value="">HH</option>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="text-muted-foreground">:</span>
                  <select
                    aria-label="Minute"
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    className={`h-10 w-full rounded-md border px-2 text-sm outline-hidden focus:border-primary ${FIELD}`}
                  >
                    <option value="">MM</option>
                    {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (hours)</Label>
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
                  { value: "private", title: "Private", hint: "Only people with the Session Code can join." },
                  { value: "public", title: "Public", hint: "Listed for visitors to browse before it begins." },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      visibility === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Session"}
            </button>
          </form>
        ) : (
          <div className="space-y-6 rounded-2xl border border-primary/40 bg-card/40 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Session created</h2>
            {([
              { label: "Session Code", value: created.session_code },
              { label: "Join Link", value: `${window.location.origin}/live/join/${created.session_code}` },
            ] as const).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 text-sm">{row.value}</code>
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
              Open Session Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CreateSessionPage;
