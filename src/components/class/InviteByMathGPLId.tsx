import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

/**
 * Owner-only. Sends an invitation to a participant identified by their
 * MathGPL ID (MGP-XXXXXX). Writes a row to class_invitations; the
 * participant can accept it from /join.
 */
const InviteByMathGPLId = ({ classId, light }: { classId: string; light?: boolean }) => {
  const shell = light
    ? "rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)] text-dash-surface-foreground"
    : "rounded-2xl border border-border bg-card/40 p-5 backdrop-blur";
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const id = value.trim().toUpperCase();
    if (!id) return;
    setBusy(true);
    try {
      const { data: profile, error: lookupErr } = await supabase
        .rpc("lookup_profile_by_student_id", { _student_id: id })
        .maybeSingle();
      if (lookupErr || !profile) {
        toast({ title: "MathGPL ID not found", variant: "destructive" });
        return;
      }
      const inviteeId = (profile as { user_id: string }).user_id;

      const { data: existingMember } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", inviteeId)
        .maybeSingle();
      if (existingMember) {
        toast({ title: "Already in this class" });
        setValue("");
        return;
      }

      const { data: existingInv } = await supabase
        .from("class_invitations")
        .select("id")
        .eq("class_id", classId)
        .eq("invitee_user_id", inviteeId)
        .eq("status", "pending")
        .maybeSingle();
      if (existingInv) {
        toast({ title: "Invitation already pending" });
        setValue("");
        return;
      }

      const { error: insErr } = await supabase
        .from("class_invitations")
        .insert({ class_id: classId, invitee_user_id: inviteeId, status: "pending" });
      if (insErr) {
        toast({ title: "Could not send invitation", description: insErr.message, variant: "destructive" });
        return;
      }
      toast({ title: "Invitation sent", description: id });
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={shell}>
      <h2 className={`mb-3 ${light ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted" : "text-sm font-semibold uppercase tracking-wider text-muted-foreground"}`}>
        Invite by MathGPL ID
      </h2>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="MGP-123456"
          className={`flex-1 rounded-lg border px-3 py-2 font-mono tracking-widest outline-hidden ${light ? "border-dash-border bg-dash-navy/[0.03] text-dash-surface-foreground focus:border-dash-gold" : "border-border bg-background focus:border-primary"}`}
        />
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={submit}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
      <p className={`mt-2 text-xs ${light ? "text-dash-surface-muted" : "text-muted-foreground"}`}>
        The student will see the invitation under <span className="font-medium">/join</span> and can accept it instantly.
      </p>
    </section>
  );
};

export default InviteByMathGPLId;
