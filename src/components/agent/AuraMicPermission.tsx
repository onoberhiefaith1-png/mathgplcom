// The one-time microphone request every teacher sees before Aura can listen:
// what it is for, an Allow button, and plain instructions if it was blocked.

import { Mic, MicOff } from "lucide-react";

import auraMark from "@/assets/aura-mark.png";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAura } from "@/lib/agent/AuraProvider";

import { describeMicPermission } from "./micPermission";

export default function AuraMicPermission() {
  const { micPromptOpen, setMicPromptOpen, micPermission, requestMic, micRequesting } = useAura();

  const blocked =
    micPermission === "denied" ||
    micPermission === "no-microphone" ||
    micPermission === "unsupported";

  return (
    <Dialog open={micPromptOpen} onOpenChange={setMicPromptOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <img src={auraMark} alt="" width={40} height={40} className="size-10 rounded-full" />
            <span
              className={
                blocked
                  ? "flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                  : "flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
              }
            >
              {blocked ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </span>
          </div>
          <DialogTitle>
            {blocked ? "Aura can't hear you yet" : "Let Aura hear you"}
          </DialogTitle>
          <DialogDescription>{describeMicPermission(micPermission)}</DialogDescription>
        </DialogHeader>

        {!blocked ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Speak to her instead of typing — she writes notes and sets up classes as you talk.</li>
            <li>Call her by name and she answers, anywhere in the platform.</li>
            <li>Nothing is recorded or stored; she only listens while you are speaking to her.</li>
          </ul>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setMicPromptOpen(false)}>
            {blocked ? "Close" : "Not now"}
          </Button>
          {micPermission === "unsupported" ? null : (
            <Button onClick={() => void requestMic()} disabled={micRequesting}>
              {micRequesting
                ? "Waiting for your browser…"
                : blocked
                  ? "Try again"
                  : "Allow microphone"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
