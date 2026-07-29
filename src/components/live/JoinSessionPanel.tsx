import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const extractCode = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(?:\/live\/join\/)([A-Za-z0-9]+)/);
  if (match) return match[1].toUpperCase();
  const chunks = trimmed.split(/[/\s?#]+/).filter(Boolean);
  return (chunks[chunks.length - 1] ?? trimmed).toUpperCase();
};

type JoinedSession = { id: string; title: string; class_id: string };

/**
 * Join surface for MathGPL Live. Participants enter a Session Code; the teacher
 * approves them exactly like a classroom join request, then they land on the
 * participant session page.
 */
const JoinSessionPanel = ({ initialCode }: { initialCode?: string }) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingClassId, setPendingClassId] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinedSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate(`/auth?redirect=/live/join${initialCode ? `/${initialCode}` : ""}`);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: members } = await supabase.from("class_members").select("class_id").eq("user_id", uid);
    const classIds = (members ?? []).map((m: { class_id: string }) => m.class_id);
    if (classIds.length > 0) {
      const { data: rows } = await supabase
        .from("sessions")
        .select("id, title, class_id")
        .in("class_id", classIds)
        .neq("owner_id", uid);
      setJoined((rows ?? []) as JoinedSession[]);
    } else {
      setJoined([]);
    }

    const { data: pendingReq } = await supabase
      .from("class_join_requests")
      .select("class_id")
      .eq("requester_id", uid)
      .eq("status", "pending")
      .maybeSingle();
    setPendingClassId(pendingReq?.class_id ?? null);
    setLoading(false);
  }, [navigate, initialCode]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (initialCode) setCode(initialCode.toUpperCase()); }, [initialCode]);

  // Poll while a request is pending so approval opens the session automatically.
  useEffect(() => {
    if (!userId || !pendingClassId) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", pendingClassId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data?.class_id) return;
      const { data: s } = await supabase
        .from("sessions")
        .select("id")
        .eq("class_id", data.class_id)
        .maybeSingle();
      toast({ title: "Approved", description: "Opening your session…" });
      navigate(s?.id ? `/live/s/${s.id}` : `/student/class/${data.class_id}`);
    };
    const id = window.setInterval(tick, 3000);
    void tick();
    return () => { cancelled = true; window.clearInterval(id); };
  }, [userId, pendingClassId, navigate, toast]);

  const submit = async (raw: string) => {
    const parsed = extractCode(raw);
    if (!parsed) {
      toast({ title: "Enter a session code", variant: "destructive" });
      return;
    }
    if (!userId) return;
    setSubmitting(true);
    try {
      const { data: session, error } = await supabase
        .rpc("lookup_session_by_code", { code: parsed })
        .maybeSingle();
      if (error || !session) {
        toast({ title: "Session not found", description: "Check the code and try again.", variant: "destructive" });
        return;
      }
      const found = session as { id: string; class_id: string };

      const { data: existing } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", found.class_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        navigate(`/live/s/${found.id}`);
        return;
      }

      const { data: existingReq } = await supabase
        .from("class_join_requests")
        .select("id")
        .eq("class_id", found.class_id)
        .eq("requester_id", userId)
        .eq("status", "pending")
        .maybeSingle();
      if (existingReq) {
        setPendingClassId(found.class_id);
        toast({ title: "Request already pending", description: "Waiting for the teacher to approve." });
        return;
      }

      const { error: insertErr } = await supabase
        .from("class_join_requests")
        .insert({ class_id: found.class_id, requester_id: userId, status: "pending" });
      if (insertErr) {
        toast({ title: "Could not send request", description: insertErr.message, variant: "destructive" });
        return;
      }
      setPendingClassId(found.class_id);
      toast({ title: "Request sent", description: "Waiting for the teacher to approve." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card/40 p-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {pendingClassId && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-200">
            <Loader2 className="h-4 w-4 animate-spin" /> Waiting for approval
          </div>
          <p className="mt-1 text-amber-100/80">
            You'll be taken into the session as soon as the teacher approves you. Keep this page open.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); void submit(code); }}
        className="space-y-3 rounded-2xl border border-border bg-card/40 p-5 backdrop-blur"
      >
        <label htmlFor="session-code" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Session Code
        </label>
        <input
          id="session-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="AB72KD"
          autoComplete="off"
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-center text-lg font-semibold tracking-[0.3em] outline-hidden focus:border-primary"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Joining…" : "Join Session"}
        </button>
      </form>

      {joined.length > 0 && (
        <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Sessions</h3>
          <div className="space-y-2">
            {joined.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/live/s/${s.id}`)}
                className="w-full truncate rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-accent"
              >
                {s.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default JoinSessionPanel;
