import { useCallback, useEffect, useState } from "react";
import { Globe2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PublishDialog from "@/components/community/PublishDialog";
import { findMyPublication, setResourceStatus } from "@/lib/community/community";

/**
 * A class is either Private or Shared with MathGPL Community. Shared classes are
 * discoverable and use Request Access instead of a join code.
 */
const ClassCommunityShare = ({
  classId,
  className,
  description,
}: {
  classId: string;
  className: string;
  description?: string | null;
}) => {
  const [shared, setShared] = useState(false);
  const [students, setStudents] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("classes")
      .select("community_shared")
      .eq("id", classId)
      .maybeSingle();
    setShared(Boolean(data?.community_shared));
    const { count } = await supabase
      .from("class_members")
      .select("user_id", { count: "exact", head: true })
      .eq("class_id", classId);
    setStudents(count ?? 0);
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  const makePrivate = async () => {
    setBusy(true);
    try {
      const pub = await findMyPublication("class", classId);
      if (pub) await setResourceStatus(pub.id, "unpublished");
      await supabase.from("classes").update({ community_shared: false }).eq("id", classId);
      setShared(false);
      toast({ title: "Class is private again", description: "It is no longer listed in MathGPL Community." });
    } catch (e) {
      toast({ title: "Could not update", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onPublished = async () => {
    await supabase.from("classes").update({ community_shared: true }).eq("id", classId);
    setShared(true);
  };

  return (
    <section className="mb-6 rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">
            Community visibility
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-dash-surface-foreground">
            {shared ? <Globe2 className="h-4 w-4 text-dash-gold" /> : <Lock className="h-4 w-4" />}
            {shared
              ? "Shared with MathGPL Community — students can send access requests."
              : "Private — only people with the join code or an invite can enter."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPublishOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-dash-navy px-4 py-2 text-sm font-medium text-dash-surface transition hover:opacity-90 disabled:opacity-60"
          >
            <Globe2 className="h-4 w-4" /> {shared ? "Update listing" : "Share with MathGPL Community"}
          </button>
          {shared && (
            <button
              type="button"
              disabled={busy}
              onClick={makePrivate}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-dash-border px-4 py-2 text-sm text-dash-surface-foreground transition hover:border-dash-gold disabled:opacity-60"
            >
              <Lock className="h-4 w-4" /> Make private
            </button>
          )}
        </div>
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        kind="class"
        sourceId={classId}
        defaultTitle={className}
        defaultDescription={description ?? ""}
        payload={{ class_id: classId, subject: "Mathematics", student_count: students }}
        onPublished={() => { void onPublished(); }}
      />
    </section>
  );
};

export default ClassCommunityShare;
