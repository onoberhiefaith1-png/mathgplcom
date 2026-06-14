import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, DoorOpen, Lock } from "lucide-react";
import type { SceneKind } from "@/lib/adventure/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (kind: SceneKind) => void;
}

const OPTIONS: { kind: SceneKind; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "obstacle", title: "Obstacle", subtitle: "Collaboration — every solve adds to shared progress.", icon: Shield },
  { kind: "door", title: "Door", subtitle: "Coordination — each question can only be claimed once.", icon: DoorOpen },
  { kind: "vault", title: "Vault", subtitle: "Competition — first correct solver wins the reward.", icon: Lock },
];

export default function ChallengeTypePicker({ open, onClose, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Choose Challenge Type</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => { onPick(o.kind); onClose(); }}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left hover:border-primary hover:bg-accent/40"
            >
              <o.icon className="h-6 w-6 text-primary shrink-0" />
              <div>
                <div className="font-semibold">{o.title}</div>
                <div className="text-sm text-muted-foreground">{o.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
