import { useCallback, useEffect, useState } from "react";
import { classRoot } from "@/lib/product/workspaceRoutes";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, X, UserPlus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";

type Pending = { id: string; requester_id: string; created_at: string; display_name: string | null };
type Member = { id: string; user_id: string; joined_at: string; display_name: string | null };

const StudentsPage = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [className, setClassName] = useState<string>("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [studentId, setStudentId] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
    if (cls) setClassName(cls.name);

    const { data: reqRows } = await supabase
      .from("class_join_requests")
      .select("id, requester_id, created_at, status")
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const { data: memRows } = await supabase
      .from("class_members")
      .select("id, user_id, joined_at")
      .eq("class_id", classId)
      .order("joined_at", { ascending: true });

    const [{ data: memberProfiles }, { data: requestProfiles }] = await Promise.all([
      supabase.rpc("get_class_member_names", { _class_id: classId }),
      supabase.rpc("get_class_join_request_profiles", { _class_id: classId }),
    ]);
    const profiles = [
      ...(memberProfiles ?? []).map((p) => ({ user_id: p.user_id, display_name: p.display_name })),
      ...(requestProfiles ?? []).map((p) => ({ user_id: p.user_id, display_name: p.display_name })),
    ];
    const nameOf = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name ?? null;

    setPending((reqRows ?? []).map((r) => ({ id: r.id, requester_id: r.requester_id, created_at: r.created_at, display_name: nameOf(r.requester_id) })));
    setMembers((memRows ?? []).map((m) => ({ id: m.id, user_id: m.user_id, joined_at: m.joined_at, display_name: nameOf(m.user_id) })));
  }, [classId]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/students`);
        return;
      }
      const redirect = await ensureClassOwner(classId!, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      await load();
    })();
  }, [classId, navigate, load]);

  const accept = async (req: Pending) => {
    const { error: insErr } = await supabase
      .from("class_members")
      .insert({ class_id: classId!, user_id: req.requester_id });
    if (insErr && !insErr.message.includes("duplicate")) {
      toast({ title: "Could not accept", description: insErr.message, variant: "destructive" });
      return;
    }
    await supabase.from("class_join_requests").update({ status: "accepted" }).eq("id", req.id);
    toast({ title: "Student approved" });
    load();
  };

  const decline = async (req: Pending) => {
    await supabase.from("class_join_requests").update({ status: "declined" }).eq("id", req.id);
    load();
  };

  const removeMember = async (m: Member) => {
    await supabase.from("class_members").delete().eq("id", m.id);
    load();
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = studentId.trim().toUpperCase();
    if (!code) return;
    setSending(true);
    const { data: lookup } = await supabase.rpc("lookup_profile_by_student_id", { _student_id: code });
    const prof = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!prof) {
      setSending(false);
      toast({ title: "No student with that ID", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("class_invitations")
      .insert({ class_id: classId!, invitee_user_id: prof.user_id });
    setSending(false);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast({ title: "Invitation already sent" });
      } else {
        toast({ title: "Could not send invitation", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: `Invitation sent to ${prof.display_name ?? code}` });
    setStudentId("");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`${classRoot()}/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Students · {className}</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending Approval</h2>
          {pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending requests.</div>
          ) : (
            <ul className="space-y-2">
              {pending.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3">
                  <div className="text-sm">{r.display_name ?? r.requester_id.slice(0, 8)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => accept(r)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">
                      <Check className="h-4 w-4" /> Accept
                    </button>
                    <button onClick={() => decline(r)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
                      <X className="h-4 w-4" /> Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Students</h2>
          {members.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active students yet.</div>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3">
                  <div className="text-sm">{m.display_name ?? m.user_id.slice(0, 8)}</div>
                  <button onClick={() => removeMember(m)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <UserPlus className="h-4 w-4" /> Add Student
          </h2>
          <form onSubmit={sendInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sid">MathGPL Student ID</Label>
              <Input
                id="sid"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder=""
                autoComplete="off"
                spellCheck={false}
                className="uppercase tracking-widest"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send Invitation"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default StudentsPage;
