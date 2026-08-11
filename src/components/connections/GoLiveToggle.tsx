import { useState } from "react";
import { Loader2, Radio } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import GoLiveExplainDialog from "@/components/connections/GoLiveExplainDialog";
import { goLiveError, useGoLive } from "@/lib/connections/useConnections";


/**
 * Go Live and Accept requests.
 *
 * Going Live decides one thing only: whether this account can be *found* in
 * the Community of Practice. It never opens the private workspace, and never
 * exposes an email address, a password or any private account information.
 *
 * Accepting requests is a separate setting, so an account can be discoverable
 * while refusing new requests — or stay private and still be reachable by
 * Share Code.
 */
export const GoLiveToggle = ({ blurb }: { blurb?: string }) => {
  const { live, acceptsRequests, loading, setLive, setAcceptsRequests, saving } = useGoLive();
  const [explaining, setExplaining] = useState(false);

  const status = !live
    ? acceptsRequests
      ? { label: "Private", tone: "text-slate-600", note: "Not discoverable. Share Code still works." }
      : { label: "Private · requests off", tone: "text-slate-600", note: "Not discoverable, and no new requests." }
    : acceptsRequests
      ? { label: "Live · accepting requests", tone: "text-emerald-600", note: "Discoverable in the Community." }
      : { label: "Live · requests off", tone: "text-amber-600", note: "Discoverable, but nobody can ask to connect." };

  /** Turning Live ON always explains itself first; turning it off is one click. */
  const onSwitch = async (next: boolean) => {
    if (next) {
      setExplaining(true);
      return;
    }
    try {
      await setLive(false);
    } catch (error) {
      toast({ title: "Could not turn Go Live off", description: goLiveError(error), variant: "destructive" });
    }
  };

  const onAcceptRequests = async (next: boolean) => {
    try {
      await setAcceptsRequests(next);
    } catch (error) {
      toast({ title: "Could not save that setting", description: goLiveError(error), variant: "destructive" });
    }
  };


  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Radio className={`h-4 w-4 ${live ? "text-emerald-500" : "text-slate-400"}`} /> Go Live
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {blurb ??
              "Going Live is discovery only: schools, teachers and students can find you in the MathGPL Community. It never joins you to a school, a class or anybody's workspace."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <Switch
            checked={live}
            disabled={loading || saving}
            onCheckedChange={(value) => onSwitch(Boolean(value))}
            aria-label="Go live in the MathGPL Community"
          />
          <span className="text-sm font-medium text-slate-700">{live ? "Live" : "Off"}</span>
        </div>
      </div>

      {/* One unmistakable state, in the two colours people already expect. */}
      <button
        type="button"
        onClick={() => onSwitch(!live)}
        disabled={loading || saving}
        aria-pressed={live}
        className={`mt-4 flex w-full flex-wrap items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
          live
            ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
            : "border-rose-200 bg-rose-50 hover:bg-rose-100"
        }`}
      >
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.18em] ${
            live ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "bg-white" : "bg-white/80"}`} />
          {live ? "Live" : "Off"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-slate-900">
            {live ? "You are Live" : "Go Live"}
          </span>
          <span className="mt-0.5 block text-sm text-slate-700">
            {live
              ? "Your profile is now discoverable by schools, teachers, or students through Community. Going Live does not automatically connect you to anyone."
              : "You are not discoverable. Nobody can find you in Community — your code still works if you hand it out."}
          </span>
        </span>
      </button>

      <p className={`mt-3 text-sm font-semibold ${status.tone}`}>
        {status.label} <span className="font-normal text-slate-500">· {status.note}</span>
      </p>


      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Accept connection requests</p>
          <p className="mt-0.5 max-w-xl text-sm text-slate-600">
            On by default. Turn it off and nobody can send you a new request — you can still send requests to
            other accounts yourself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={acceptsRequests}
            disabled={loading || saving}
            onCheckedChange={(value) => void setAcceptsRequests(Boolean(value))}
            aria-label="Accept connection requests"
          />
          <span className="text-sm font-medium text-slate-700">{acceptsRequests ? "On" : "Off"}</span>
        </div>
      </div>

      <GoLiveExplainDialog open={explaining} onOpenChange={setExplaining} />

    </section>
  );
};

export default GoLiveToggle;
