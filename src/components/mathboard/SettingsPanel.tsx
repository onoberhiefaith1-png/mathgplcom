import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useMathBoard } from "@/hooks/useMathBoard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimerControl {
  duration: number;
  setDuration: (s: number) => void;
  options: { value: number; label: string }[];
}

export const SettingsPanel = ({
  open,
  onOpenChange,
  timer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional timer control — when present, renders the time-limit row. */
  timer?: TimerControl;
}) => {
  const { reset } = useMathBoard();
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(false);
  useEffect(() => {/* placeholder for future side effects */}, [autoAdvance, sound, music]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>MathBoard Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          {timer && (
            <Row label="Question time limit">
              <Select
                value={String(timer.duration)}
                onValueChange={(v) => timer.setDuration(Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timer.options.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          )}
          <Row label="Sound effects"><Switch checked={sound} onCheckedChange={setSound} /></Row>
          <Row label="Background music"><Switch checked={music} onCheckedChange={setMusic} /></Row>
          <Row label="Auto-advance on ENTER"><Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} /></Row>
          <Button variant="destructive" onClick={() => { reset(); onOpenChange(false); }}>
            Reset board
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-4 py-3">
    <span className="text-sm">{label}</span>
    {children}
  </div>
);

export default SettingsPanel;
