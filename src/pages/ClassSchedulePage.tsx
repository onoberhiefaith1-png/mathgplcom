import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import ClassPageShell from "@/components/class/ClassPageShell";
import ScheduleEditor from "@/components/live/ScheduleEditor";
import VenueEditor from "@/components/schedule/VenueEditor";
import SchedulePlanPanel from "@/components/schedule/SchedulePlanPanel";
import ComingSoonPanel from "@/components/schedule/ComingSoonPanel";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/lib/accounts/viewAs";
import { classRoot, productTerms } from "@/lib/product/workspaceRoutes";
import { EMPTY_CLASS_MEETING, loadClassMeeting, saveClassMeeting, type ClassMeeting } from "@/lib/classes/classMeeting";
import { listPlanEntries, type SchedulePlanEntry } from "@/lib/schedule/plan";
import { newBroadcastEntry } from "@/lib/live/broadcast";

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

/**
 * The Class Schedule: when and where the class meets, plus the dated teaching
 * plan of what will be taught. Everything here is what students see.
 */
const ClassSchedulePage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { viewOnly } = useViewAs();

  const [name, setName] = useState("");
  const [meeting, setMeeting] = useState<ClassMeeting>(EMPTY_CLASS_MEETING);
  const [entries, setEntries] = useState<SchedulePlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/schedule`);
        return;
      }
      const { data: row } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .maybeSingle();
      const loaded = await loadClassMeeting(classId);
      const plan = await listPlanEntries("class", classId);
      if (cancelled) return;
      setName((row as { name?: string } | null)?.name ?? "");
      setMeeting({
        ...loaded,
        timeZone: loaded.timeZone || TIME_ZONES[0],
        venue: {
          ...loaded.venue,
          broadcasts:
            loaded.venue.kind === "online" && loaded.venue.broadcasts.length === 0
              ? [newBroadcastEntry()]
              : loaded.venue.broadcasts,
        },
      });
      setEntries(plan);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, navigate]);

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    const { error } = await saveClassMeeting(classId, meeting);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save the class details", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Class details saved" });
  };

  const canEdit = !viewOnly;

  return (
    <ClassPageShell
      backTo={`${classRoot()}/${classId}`}
      backLabel={productTerms().space}
      title="Schedule"
      subtitle="When and where this class meets, and what will be taught on each date."
    >
      {loading ? (
        <div className="text-center text-sm text-dash-surface/70">Loading…</div>
      ) : (
        <div className="space-y-6">
          <ComingSoonPanel meeting={meeting} entries={entries} />

          <section className="space-y-5 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
            <div>
              <h2 className="text-lg font-semibold">Class meeting details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {name ? `${name} — ` : ""}students see this the moment they join.
              </p>
            </div>

            {canEdit ? (
              <>
                <ScheduleEditor
                  days={meeting.scheduleDays}
                  times={meeting.scheduleTimes}
                  endTimes={meeting.scheduleEndTimes}
                  onChange={(scheduleDays, scheduleTimes) =>
                    setMeeting((m) => ({ ...m, scheduleDays, scheduleTimes }))
                  }
                  onEndChange={(scheduleEndTimes) => setMeeting((m) => ({ ...m, scheduleEndTimes }))}
                />

                <div className="space-y-2">
                  <Label htmlFor="tz">Time Zone</Label>
                  <select
                    id="tz"
                    value={meeting.timeZone ?? TIME_ZONES[0]}
                    onChange={(e) => setMeeting((m) => ({ ...m, timeZone: e.target.value }))}
                    className={`h-10 w-full rounded-md border px-3 text-sm outline-hidden focus:border-primary ${FIELD}`}
                  >
                    {TIME_ZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <VenueEditor
                  kind={meeting.venue.kind}
                  broadcasts={meeting.venue.broadcasts}
                  address={meeting.venue.address ?? ""}
                  details={meeting.venue.details ?? ""}
                  onKindChange={(kind) => setMeeting((m) => ({ ...m, venue: { ...m.venue, kind } }))}
                  onBroadcastsChange={(broadcasts) =>
                    setMeeting((m) => ({ ...m, venue: { ...m.venue, broadcasts } }))
                  }
                  onAddressChange={(address) =>
                    setMeeting((m) => ({ ...m, venue: { ...m.venue, address } }))
                  }
                  onDetailsChange={(details) =>
                    setMeeting((m) => ({ ...m, venue: { ...m.venue, details } }))
                  }
                />

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save class details"}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Read-only view.</p>
            )}
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
            <div>
              <h2 className="text-lg font-semibold">Teaching plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What will be taught, and on which date.
              </p>
            </div>
            {classId && <SchedulePlanPanel scope="class" scopeId={classId} canEdit={canEdit} />}
          </section>
        </div>
      )}
    </ClassPageShell>
  );
};

export default ClassSchedulePage;
