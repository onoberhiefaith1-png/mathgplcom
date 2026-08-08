import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { useToast } from "@/hooks/use-toast";

type PreviousClass = { id: string; name: string };
type Invitation = { id: string; class_id: string; class_name: string };

const extractCode = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(?:\/join\/)([A-Za-z0-9]+)/);
  if (match) return match[1].toUpperCase();
  const chunks = trimmed.split(/[\/\s?#]+/).filter(Boolean);
  const last = chunks[chunks.length - 1] ?? trimmed;
  return last.toUpperCase();
};

/**
 * Self-contained Join Class surface. Used both inside the Classes page (right
 * panel) and on the standalone /join/:code invite route. Handles join-code /
 * invite-link entry, pending-request banner, invitations, MathGPL ID and the
 * student's previously joined classes.
 */
const JoinClassPanel = ({ initialCode, light }: { initialCode?: string; light?: boolean }) => {
  // `light` renders the panel on a white/elevated surface (Classes page) instead
  // of the translucent dark card used by the standalone /join route.
  const card = light
    ? "rounded-2xl border border-dash-border bg-dash-navy/[0.03] p-5"
    : "rounded-2xl border border-border bg-card/40 p-5 backdrop-blur";
  const label = light
    ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted"
    : "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const field = light
    ? "flex-1 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-dash-surface-foreground outline-hidden focus:border-dash-gold"
    : "flex-1 rounded-md border border-border bg-background px-3 py-2 outline-hidden focus:border-primary";
  const muted = light ? "text-dash-surface-muted" : "text-muted-foreground";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [mathgplId, setMathgplId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [previous, setPrevious] = useState<PreviousClass[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingClassId, setPendingClassId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate(`/auth?redirect=/join${initialCode ? `/${initialCode}` : ""}`);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: profile } = await supabase
      .from("profiles")
      .select("mathgpl_student_id")
      .eq("user_id", uid)
      .maybeSingle();
    setMathgplId(profile?.mathgpl_student_id ?? "");

    const { data: members } = await supabase
      .from("class_members")
      .select("class_id, classes:class_id(id, name)")
      .eq("user_id", uid);
    const prev: PreviousClass[] = (members ?? [])
      .map((m: { classes: { id: string; name: string } | null }) => m.classes)
      .filter((c): c is { id: string; name: string } => !!c);
    setPrevious(prev);

    const { data: pendingReq } = await supabase
      .from("class_join_requests")
      .select("class_id")
      .eq("requester_id", uid)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingReq?.class_id) setPendingClassId(pendingReq.class_id);

    const { data: invs } = await supabase
      .from("class_invitations")
      .select("id, class_id, classes:class_id(name)")
      .eq("invitee_user_id", uid)
      .eq("status", "pending");
    setInvitations(
      ((invs ?? []) as { id: string; class_id: string; classes: { name: string } | null }[]).map((i) => ({
        id: i.id,
        class_id: i.class_id,
        class_name: i.classes?.name ?? "Class",
      })),
    );

    setLoading(false);
  }, [navigate, initialCode]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (initialCode) setJoinCode(initialCode.toUpperCase());
  }, [initialCode]);

  // Realtime: when this user is added as a member → open their classroom.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`member-of-${userId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "class_members", filter: `user_id=eq.${userId}` },
          (payload: { new: { class_id: string } }) => {
            const cid = payload.new.class_id;
            toast({ title: "Approved", description: "Opening your classroom…" });
            navigate(`/student/class/${cid}`);
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [userId, navigate, toast]);

  // Polling fallback — if realtime is delayed or blocked, still bounce the
  // student into the classroom within a few seconds of teacher approval.
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
      if (cancelled) return;
      if (data?.class_id) {
        toast({ title: "Approved", description: "Opening your classroom…" });
        navigate(`/student/class/${data.class_id}`);
      }
    };
    const id = window.setInterval(tick, 3000);
    void tick();
    return () => { cancelled = true; window.clearInterval(id); };
  }, [userId, pendingClassId, navigate, toast]);

  const submit = async (rawCode: string) => {
    const code = extractCode(rawCode);
    if (!code) {
      toast({ title: "Enter a code or invite link", variant: "destructive" });
      return;
    }
    if (!userId) return;
    setSubmitting(true);
    try {
      // The code identifies the class; the relationship grants entry. A code
      // for a private workspace the student has no relationship with is not a
      // way in.
      const { data: gate, error: lookupErr } = await supabase
        .rpc("class_join_gate", { code })
        .maybeSingle();
      if (lookupErr || !gate) {
        toast({ title: "Class not found", description: "Check the code or link and try again.", variant: "destructive" });
        return;
      }
      const { id: classId, allowed } = gate as { id: string; allowed: boolean };
      if (!allowed) {
        toast({
          title: "Ask your teacher to add you",
          description: "This class belongs to a private workspace, so the teacher or school has to invite you.",
          variant: "destructive",
        });
        return;
      }

      const { data: existingMember } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingMember) {
        navigate(`/student/class/${classId}`);
        return;
      }

      const { data: existingReq } = await supabase
        .from("class_join_requests")
        .select("id, status")
        .eq("class_id", classId)
        .eq("requester_id", userId)
        .in("status", ["pending"])
        .maybeSingle();
      if (existingReq) {
        setPendingClassId(classId);
        toast({ title: "Request already pending", description: "Waiting for the teacher to approve." });
        return;
      }

      const { error: insertErr } = await supabase
        .from("class_join_requests")
        .insert({ class_id: classId, requester_id: userId, status: "pending" });
      if (insertErr) {
        toast({ title: "Could not send request", description: insertErr.message, variant: "destructive" });
        return;
      }
      setPendingClassId(classId);
      toast({ title: "Request sent", description: "Waiting for the teacher to approve." });
    } finally {
      setSubmitting(false);
    }
  };

  const copyId = async () => {
    if (!mathgplId) return;
    await navigator.clipboard.writeText(mathgplId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const acceptInvite = async (inv: Invitation) => {
    const { data, error } = await supabase.rpc("accept_class_invitation", { _invitation_id: inv.id });
    if (error) {
      toast({ title: "Could not accept", description: error.message, variant: "destructive" });
      return;
    }
    const cid = (data as string) || inv.class_id;
    toast({ title: "Joined", description: inv.class_name });
    navigate(`/student/class/${cid}`);
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
            You'll be taken into the classroom as soon as the teacher approves you. Keep this page open.
          </p>
        </div>
      )}

      {invitations.length > 0 && (
        <section className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 backdrop-blur">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-200">
            Invitations for you
          </h2>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300/30 bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{inv.class_name}</div>
                  <div className="text-xs text-muted-foreground">A teacher invited you to join.</div>
                </div>
                <button
                  type="button"
                  onClick={() => acceptInvite(inv)}
                  className="rounded-md bg-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/40"
                >
                  Accept
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <label className={`block ${label}`}>Join Code</label>
        <div className="mt-2 flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. A1B2C3D4"
            className={`${field} font-mono tracking-widest`}
          />
          <button
            disabled={submitting || !joinCode.trim()}
            onClick={() => submit(joinCode)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "…" : "Request"}
          </button>
        </div>
      </section>

      <section className={card}>
        <label className={`block ${label}`}>Invite Link</label>
        <div className="mt-2 flex gap-2">
          <input
            value={inviteLink}
            onChange={(e) => setInviteLink(e.target.value)}
            placeholder="https://…/join/XXXXXXXX"
            className={`${field} text-sm`}
          />
          <button
            disabled={submitting || !inviteLink.trim()}
            onClick={() => submit(inviteLink)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "…" : "Request"}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={label}>Your MathGPL ID</div>
        <div className="mt-2 flex items-center gap-2">
          <code className={`${field} font-mono text-base`}>
            {mathgplId || "—"}
          </code>
          <button
            onClick={copyId}
            disabled={!mathgplId}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${light ? "border-dash-border text-dash-surface-foreground hover:border-dash-gold" : "border-border hover:border-primary"}`}
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className={`mt-2 text-xs ${muted}`}>
          Share this ID with your teacher if they ask for it. It identifies you across MathGPL.
        </p>
      </section>

      <section>
        <h2 className={`mb-2 ${label}`}>Classes You've Joined</h2>
        {previous.length === 0 ? (
          <div className={`rounded-xl border border-dashed p-6 text-center text-sm ${light ? "border-dash-border text-dash-surface-muted" : "border-border text-muted-foreground"}`}>
            You haven't joined any classes yet.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {previous.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/student/class/${c.id}`)}
                  className={`block w-full rounded-xl p-4 text-left transition ${light ? "border border-dash-border bg-dash-surface hover:border-dash-gold" : "border border-border bg-card/40 backdrop-blur hover:border-primary/40"}`}
                >
                  <div className="truncate text-base font-semibold">{c.name}</div>
                  <div className={`mt-1 text-xs ${muted}`}>Tap to open</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default JoinClassPanel;
