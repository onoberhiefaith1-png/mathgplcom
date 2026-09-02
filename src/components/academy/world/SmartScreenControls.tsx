/**
 * SMART SCREEN CONTROLS.
 *
 * Two surfaces over the 3D room, never inside it:
 *  · a viewer bar (play, skip, scrubber, sound) for whoever is watching;
 *  · a teaching panel (upload / replace / remove video, camera on/off) for the
 *    building's teachers and administrators.
 *
 * Both auto-hide, so the room stays a room.
 */
import { useRef, useState } from "react";
import {
  Camera, CameraOff, Loader2, Monitor, Pause, Play, RotateCcw, RotateCw, Trash2, Upload, Volume2, VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { RoomScreenApi } from "@/hooks/useRoomScreen";

const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const SmartScreenControls = ({ api }: { api: RoomScreenApi }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const live = api.mode === "camera";
  const showBar = api.mode !== "idle";

  return (
    <>
      {/* ── Viewer bar ─────────────────────────────────────────────────── */}
      {showBar && (
        <div className="absolute bottom-24 left-1/2 z-30 w-[min(92vw,640px)] -translate-x-1/2 rounded-2xl border border-border/60 bg-background/85 px-3 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Live
              </span>
            ) : (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => api.skip(-10)} aria-label="Back 10 seconds">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={api.togglePlay} aria-label={api.playing ? "Pause" : "Play"}>
                  {api.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => api.skip(10)} aria-label="Forward 10 seconds">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{clock(api.currentTime)}</span>
                <Slider
                  className="mx-1 flex-1"
                  value={[api.currentTime]}
                  min={0}
                  max={Math.max(api.duration, 1)}
                  step={0.5}
                  onValueChange={([v]) => api.seek(v ?? 0)}
                  aria-label="Timeline"
                />
                <span className="w-10 text-[11px] tabular-nums text-muted-foreground">{clock(api.duration)}</span>
              </>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => api.setMuted(!api.muted)} aria-label={api.muted ? "Unmute" : "Mute"}>
              {api.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              className="w-20"
              value={[api.muted ? 0 : api.volume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) => api.setVolume(v ?? 0)}
              aria-label="Volume"
            />
          </div>
        </div>
      )}

      {/* ── Teaching panel ─────────────────────────────────────────────── */}
      {api.canEdit && (
        <div className="absolute right-3 top-16 z-30 w-[min(88vw,300px)]">
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-start gap-2"
            onClick={() => setPanelOpen((o) => !o)}
          >
            <Monitor className="h-4 w-4" /> Smart screen
          </Button>

          {panelOpen && (
            <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/90 p-3 shadow-lg backdrop-blur">
              <p className="text-[11px] text-muted-foreground">
                {api.mode === "camera"
                  ? "Your live camera is on this screen."
                  : api.screen?.video_name
                    ? `Playing: ${api.screen.video_name}`
                    : "No lesson video on this screen yet."}
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void api.uploadVideo(file);
                }}
              />

              <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => fileRef.current?.click()} disabled={!!api.busy}>
                <Upload className="h-4 w-4" /> {api.screen?.video_path ? "Replace video" : "Upload video"}
              </Button>

              {api.screen?.video_path && (
                <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={() => void api.removeVideo()} disabled={!!api.busy}>
                  <Trash2 className="h-4 w-4" /> Remove video
                </Button>
              )}

              {api.mode === "camera" && api.hosting ? (
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => void api.stopCamera()} disabled={!!api.busy}>
                  <CameraOff className="h-4 w-4" /> Turn off camera
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => void api.startCamera()} disabled={!!api.busy || api.mode === "camera"}>
                  <Camera className="h-4 w-4" /> Turn on camera
                </Button>
              )}

              {api.busy && (
                <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> {api.busy}
                </p>
              )}
              {api.error && <p className="text-[11px] text-destructive">{api.error}</p>}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SmartScreenControls;
