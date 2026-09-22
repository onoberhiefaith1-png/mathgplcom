// One sound slot: the chosen sound, a preview, its own volume, and the two
// ways of choosing — the official Sound Gallery for this purpose, or the
// teacher's own upload (which stays inside their own Game).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { putAsset } from "@/lib/slate/assets";
import { previewSound, stopPreview } from "@/lib/slate/gameSound";
import { soundName } from "@/lib/slate/sound";
import {
  SOUND_PURPOSE_NAME,
  addOfficialSound,
  canManageSoundGallery,
  hideOfficialSound,
  listOfficialSounds,
  removeOfficialSound,
  renameOfficialSound,
  type SoundPurpose,
} from "@/lib/slate/soundGallery";
import type { GplAsset } from "@/lib/gpl/assetLibrary";
import type { SoundSlot } from "@/lib/slate/types";

interface Props {
  label: string;
  purpose: SoundPurpose;
  slot: SoundSlot;
  onChange: (next: SoundSlot) => void;
}

const btn =
  "rounded border border-amber-200/20 px-2 py-1 text-[10px] text-amber-100/75 hover:bg-amber-200/10";

export function SoundPicker({ label, purpose, slot, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const chosen = soundName(slot);

  return (
    <div className="space-y-1.5 rounded border border-amber-200/12 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] uppercase tracking-wider text-amber-100/60">
          {label}
        </span>
        <span className="shrink-0 text-[10px] text-amber-100/45">
          {chosen ? "Selected ✓" : "None"}
        </span>
      </div>

      <div className="min-w-0 truncate text-[11px] text-amber-100/85">{chosen || "No sound"}</div>

      <div className="grid grid-cols-3 gap-1">
        <button className={btn} onClick={() => setOpen(true)}>
          Sound Gallery
        </button>
        <button
          className={btn}
          disabled={!slot.ref}
          onClick={() => slot.ref && previewSound(slot.ref.path, slot.volume)}
        >
          Preview ▶
        </button>
        <button
          className={btn}
          disabled={!slot.ref}
          onClick={() => {
            stopPreview();
            onChange({ ...slot, ref: null });
          }}
        >
          Clear
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-amber-100/55">
          <span>Volume</span>
          <span className="tabular-nums text-amber-100/80">{Math.round(slot.volume * 100)}%</span>
        </div>
        <Slider
          value={[slot.volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => onChange({ ...slot, volume: v ?? slot.volume })}
        />
      </div>

      <SoundGalleryDialog
        open={open}
        onOpenChange={setOpen}
        purpose={purpose}
        onPick={(next) => {
          onChange({ ...slot, ref: next });
          setOpen(false);
        }}
      />
    </div>
  );
}

/* ── the gallery, plus the teacher's own upload ─────────────────────────── */

function SoundGalleryDialog({
  open,
  onOpenChange,
  purpose,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purpose: SoundPurpose;
  onPick: (ref: { source: "official" | "user"; path: string; title: string }) => void;
}) {
  const [sounds, setSounds] = useState<GplAsset[]>([]);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<{ path: string; title: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [list, manage] = await Promise.all([
        listOfficialSounds(purpose).catch(() => [] as GplAsset[]),
        canManageSoundGallery(),
      ]);
      if (cancelled) return;
      setSounds(list);
      setAdmin(manage);
    })();
    return () => {
      cancelled = true;
      stopPreview();
    };
  }, [open, purpose]);

  const refresh = async () => {
    setSounds(await listOfficialSounds(purpose).catch(() => [] as GplAsset[]));
  };

  /** Administrator: add one or many sounds to the platform's own library. */
  const uploadOfficial = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) await addOfficialSound(purpose, file);
      await refresh();
      toast.success(files.length > 1 ? `${files.length} sounds added` : "Sound added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That sound could not be added.");
    } finally {
      setBusy(false);
    }
  };

  /** Teacher: their own file, kept with their Game and never added to the gallery. */
  const uploadMine = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added: { path: string; title: string }[] = [];
      for (const file of Array.from(files)) {
        const path = await putAsset(file);
        added.push({ path, title: file.name.replace(/\.[a-z0-9]+$/i, "") });
      }
      // never selected automatically — the teacher chooses it below
      setMine((prev) => [...added, ...prev]);
      toast.success("Uploaded. Choose it below to use it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That sound could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto border-amber-200/20 bg-[#141110] text-amber-50">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-[0.2em] text-amber-200/85">
            {SOUND_PURPOSE_NAME[purpose]} Gallery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {admin ? (
            <label className={`${btn} block cursor-pointer text-center`}>
              {busy ? "Adding…" : "Add sounds to the official gallery"}
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => void uploadOfficial(e.target.files)}
              />
            </label>
          ) : null}

          <div className="space-y-1">
            {sounds.length === 0 ? (
              <p className="text-[11px] text-amber-100/45">
                No official sounds here yet.
              </p>
            ) : null}
            {sounds.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-1.5 rounded border border-amber-200/12 p-1.5"
              >
                {admin ? (
                  <Input
                    defaultValue={asset.name}
                    aria-label="Sound name"
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== asset.name) {
                        void renameOfficialSound(asset.id, name).then(refresh);
                      }
                    }}
                    className="h-7 min-w-0 flex-1 border-amber-200/20 bg-black/40 text-[11px] text-amber-50"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[11px] text-amber-100/85">
                    {asset.name}
                  </span>
                )}
                <button
                  className={btn}
                  onClick={() => asset.storage_path && previewSound(asset.storage_path)}
                >
                  ▶
                </button>
                <button
                  className={btn}
                  onClick={() =>
                    asset.storage_path &&
                    onPick({ source: "official", path: asset.storage_path, title: asset.name })
                  }
                >
                  Use
                </button>
                {admin ? (
                  <>
                    <button
                      className={btn}
                      title="Hide from the gallery"
                      onClick={() => void hideOfficialSound(asset.id, false).then(refresh)}
                    >
                      Hide
                    </button>
                    <button
                      className="rounded border border-red-400/30 px-2 py-1 text-[10px] text-red-200/80 hover:bg-red-400/10"
                      onClick={() => void removeOfficialSound(asset).then(refresh)}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t border-amber-200/10 pt-3">
            <label className={`${btn} block cursor-pointer text-center`}>
              {busy ? "Uploading…" : "Upload My Sound"}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => void uploadMine(e.target.files)}
              />
            </label>
            <p className="text-[9px] leading-snug text-amber-100/40">
              Your own sound stays with your Game. It is not added to the official gallery and
              other teachers never see it.
            </p>
            {mine.map((item) => (
              <div
                key={item.path}
                className="flex items-center gap-1.5 rounded border border-amber-200/12 p-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[11px] text-amber-100/85">
                  {item.title}
                </span>
                <button className={btn} onClick={() => previewSound(item.path)}>
                  ▶
                </button>
                <button
                  className={btn}
                  onClick={() => onPick({ source: "user", path: item.path, title: item.title })}
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
