import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ScheduleEditor from "@/components/live/ScheduleEditor";
import VenueEditor from "@/components/schedule/VenueEditor";
import { newBroadcastEntry } from "@/lib/live/broadcast";
import { EMPTY_CLASS_MEETING, meetingPayload, type ClassMeeting } from "@/lib/classes/classMeeting";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateJoinCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
const generateClassCode = () => `CLS-${Math.floor(1000 + Math.random() * 9000)}`;

const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

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

type Created = { id: string; class_code: string; join_code: string; invite_link: string };

const CreateClassPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [description, setDescription] = useState("");
  const [meeting, setMeeting] = useState<ClassMeeting>({
    ...EMPTY_CLASS_MEETING,
    timeZone: TIME_ZONES[0],
    venue: { kind: "online", broadcasts: [newBroadcastEntry()], address: null, details: null },
  });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState<string | null>(null);


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate("/auth?redirect=/teaching-hub/classes/create");
    });
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
    if (!name.trim()) {
      toast({ title: "Class name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?redirect=/teaching-hub/classes/create");
      return;
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const class_code = generateClassCode();
      const { data, error } = await supabase
        .from("classes")
        .insert({
          name: name.trim(),
          school: school.trim() || null,
          description: description.trim() || null,
          class_code,
          owner_id: userData.user.id,
          ...meetingPayload(meeting),
        } as never)

        .select("id, class_code")
        .single();
      if (!error && data) {
        const { data: codeRow } = await supabase.rpc("get_class_join_code", { _class_id: data.id });
        const join_code = (codeRow as string | null) ?? "";
        setCreated({
          ...data,
          join_code,
          invite_link: join_code ? `${window.location.origin}/join/${join_code}` : "",
        });
        setSubmitting(false);
        return;
      }
      lastError = error;
      if (error && (error as { code?: string }).code !== "23505") break;
    }
    setSubmitting(false);
    const raw = String((lastError as { message?: string })?.message ?? "");
    // The database refuses a class beyond the plan's limit; say so in plain words.
    const limitReached = raw.includes("plan_limit_reached");
    toast({
      title: limitReached ? "Your plan's class limit is reached" : "Could not create class",
      description: limitReached
        ? `${raw.split("plan_limit_reached:").pop()?.trim()} Open Plans to upgrade.`
        : raw,
      variant: "destructive",
    });
  };


  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/teaching-hub/classes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Classes
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Create Class</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-xl px-6 py-10">
        {!created ? (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school">School (Optional)</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </form>
        ) : (
          <div className="space-y-6 rounded-2xl border border-primary/40 bg-card/40 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Class created</h2>
            {([
              { label: "Class ID", value: created.class_code },
              { label: "Join Code", value: created.join_code },
              { label: "Invite Link", value: created.invite_link },
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
              onClick={() => navigate(`/teaching-hub/classes/${created.id}`)}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
            >
              Open Class Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CreateClassPage;
