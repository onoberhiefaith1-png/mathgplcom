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

import { describeMicPermission, rememberAsked } from "./micPermission";

export default function AuraMicPermission() {
  const { micPromptOpen, setMicPromptOpen, micPermission, requestMic, micRequesting } = useAura();

  // Something is wrong rather than simply unanswered.
  const blocked =
    micPermission !== "prompt" && micPermission !== "unknown" && micPermission !== "granted";
  // The device itself is fine, so another attempt can genuinely succeed.
  const retryable = micPermission === "in-use" || micPermission === "failed";
  const hopeless =
    micPermission === "unsupported" ||
    micPermission === "insecure" ||
    micPermission === "framed" ||
    micPermission === "no-microphone";

  const title =
    micPermission === "in-use"
      ? "Your microphone is busy"
      : micPermission === "no-microphone"
        ? "No microphone detected"
        : blocked
          ? "Aura can't hear you yet"
          : "Let Aura hear you";

  const action = retryable ? "Try again" : blocked ? "Enable microphone" : "Allow microphone";

  // Closing counts as answering, so nobody is nagged on every visit.
  const close = (open: boolean) => {
    if (!open) rememberAsked();
    setMicPromptOpen(open);
  };


  return (
    <Dialog open={micPromptOpen} onOpenChange={close}>
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
          <Button variant="ghost" onClick={() => close(false)}>
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
