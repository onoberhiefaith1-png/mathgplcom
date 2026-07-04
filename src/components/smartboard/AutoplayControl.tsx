// AutoplayControl — top-right Autoplay button + speed popover.
// Small chip-style control that fits inside the existing Smartboard chrome.

import { useState } from "react";
import { Play, Square, Gauge } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SPEED_LABEL, type AIState, type SpeedPreset } from "@/lib/smartboard/presentationAI/types";

export interface AutoplayControlProps {
  state: AIState;
  speed: SpeedPreset;
  setSpeed: (s: SpeedPreset) => void;
  onStart: (s: SpeedPreset) => void;
  onStop: () => void;
  onOpenDiagnosis: () => void;
  hasActiveIssue: boolean;
}

const AutoplayControl = ({
  state,
  speed,
  setSpeed,
  onStart,
  onStop,
  onOpenDiagnosis,
  hasActiveIssue,
}: AutoplayControlProps) => {
  const [open, setOpen] = useState(false);
  const running = state !== "idle" && state !== "reporting";

  return (
    <div className="flex items-center gap-2">
      {!running ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition"
              style={{
                borderColor: "rgba(22,163,74,0.4)",
                background: "rgba(22,163,74,0.10)",
                color: "#15803d",
              }}
            >
              <Play className="h-3.5 w-3.5" /> Autoplay
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-neutral-700">
                <Gauge className="h-3.5 w-3.5" /> Teaching Speed
              </p>
              <div className="space-y-1">
                {(Object.keys(SPEED_LABEL) as SpeedPreset[]).map((s) => (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition ${
                      speed === s ? "border-emerald-500 bg-emerald-50" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pai-speed"
                        checked={speed === s}
                        onChange={() => setSpeed(s)}
                        className="h-3 w-3"
                      />
                      {SPEED_LABEL[s]}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setOpen(false);
                    onStart(speed);
                  }}
                >
                  <Play className="h-3.5 w-3.5" /> Start
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <>
          <button
            type="button"
            onClick={onOpenDiagnosis}
            className="relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition"
            style={{
              borderColor: hasActiveIssue ? "rgba(220,38,38,0.55)" : "rgba(22,163,74,0.4)",
              background: hasActiveIssue ? "rgba(220,38,38,0.10)" : "rgba(22,163,74,0.10)",
              color: hasActiveIssue ? "#b91c1c" : "#15803d",
            }}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                hasActiveIssue ? "bg-red-600 animate-pulse" : "bg-emerald-500"
              }`}
            />
            AI Diagnosis
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
        </>
      )}
    </div>
  );
};

export default AutoplayControl;
