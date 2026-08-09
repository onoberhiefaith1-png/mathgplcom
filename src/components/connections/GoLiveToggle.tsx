import { useState } from "react";
import { Loader2, Radio, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useGoLive } from "@/lib/connections/useConnections";

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
  const [agreed, setAgreed] = useState(false);

  const status = !live
    ? acceptsRequests
      ? { label: "Private", tone: "text-slate-600", note: "Not discoverable. Share Code still works." }
      : { label: "Private · requests off", tone: "text-slate-600", note: "Not discoverable, and no new requests." }
    : acceptsRequests
      ? { label: "Live · accepting requests", tone: "text-emerald-600", note: "Discoverable in the Community." }
      : { label: "Live · requests off", tone: "text-amber-600", note: "Discoverable, but nobody can ask to connect." };

  /** Turning Live ON always explains itself first; turning it off is one click. */
  const onSwitch = (next: boolean) => {
    if (next) {
      setAgreed(false);
      setExplaining(true);
      return;
    }
    void setLive(false);
  };

  const confirm = async () => {
    await setLive(true);
    setExplaining(false);
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

      <Dialog open={explaining} onOpenChange={setExplaining}>
        <DialogContent className="max-w-lg bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Go live with MathGPL
            </DialogTitle>
            <DialogDescription className="text-slate-600">When you go live:</DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm text-slate-700">
            <li>• Your account becomes discoverable in the MathGPL Community.</li>
            <li>• Other accounts may find your public profile.</li>
            <li>• People may send you connection requests while you allow them.</li>
            <li>• Your private workspace stays private.</li>
            <li>• Your password and private details are never exposed.</li>
            <li>• Only the information you make public can be seen by others.</li>
            <li>• Going live does not let anyone enter your workspace.</li>
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-sm font-medium text-slate-800">Accept connection requests</span>
            <div className="flex items-center gap-2">
              <Switch
                checked={acceptsRequests}
                disabled={saving}
                onCheckedChange={(value) => void setAcceptsRequests(Boolean(value))}
                aria-label="Accept connection requests"
              />
              <span className="text-sm text-slate-700">{acceptsRequests ? "On" : "Off"}</span>
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm text-slate-800">
            <Checkbox
              checked={agreed}
              onCheckedChange={(value) => setAgreed(Boolean(value))}
              aria-label="I understand and agree"
              className="mt-0.5"
            />
            I understand and agree
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExplaining(false)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={() => void confirm()} disabled={!agreed || saving} className="min-h-[44px]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
              Go live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default GoLiveToggle;
