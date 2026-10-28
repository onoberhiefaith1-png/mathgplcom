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
import { toast } from "@/hooks/use-toast";
import { goLiveError, useGoLive } from "@/lib/connections/useConnections";


/**
 * One explanation of Go Live, wherever it is offered.
 *
 * Going Live is discovery only: it makes the account findable in the MathGPL
 * Community. It never opens the private workspace, never exposes an email
 * address or a password, and never joins anybody to a school or a class. The
 * account holder has to read that and agree before it is turned on.
 */
export const GoLiveExplainDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { acceptsRequests, setLive, setAcceptsRequests, saving } = useGoLive();
  const [agreed, setAgreed] = useState(false);

  const confirm = async () => {
    try {
      await setLive(true);
      setAgreed(false);
      onOpenChange(false);
      toast({
        title: "You are Live",
        description: "Your public profile can now be found in the MathGPL Community.",
      });
    } catch (error) {
      toast({
        title: "Could not go Live",
        description: goLiveError(error),
        variant: "destructive",
      });
    }
  };


  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAgreed(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-5 w-5 text-amber-500" /> Go Live
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Going Live makes your account discoverable in the MathGPL Community. Other users may find your
            public profile and send you connection requests.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-slate-700">
          <li>• Going Live does not give anyone access to your private workspace.</li>
          <li>• Your lessons, assignments, classes and student records stay private.</li>
          <li>• Your email address, password and private details are never exposed.</li>
          <li>• Only content you deliberately publish can be viewed by others.</li>
          <li>• Go Live is for discovery and connection — nothing else.</li>
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">Accept connection requests</p>
            <p className="text-xs text-slate-600">
              Turn this off to be discoverable without receiving new requests.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={acceptsRequests}
              disabled={saving}
              onCheckedChange={(value) => {
                void setAcceptsRequests(Boolean(value)).catch((error) =>
                  toast({
                    title: "Could not save that setting",
                    description: goLiveError(error),
                    variant: "destructive",
                  }),
                );
              }}

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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] border-slate-300 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
          >

            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={!agreed || saving} className="min-h-[44px]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
            Go Live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GoLiveExplainDialog;
