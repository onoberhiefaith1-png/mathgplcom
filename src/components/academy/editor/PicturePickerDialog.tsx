/**
 * PICTURE PICKER — chooses the picture that goes INSIDE a frame or a window.
 *
 * It reads the same MathGPL asset library the Assets pages manage, so anything
 * an administrator or asset manager adds there is immediately available here.
 * The built-in wall samples stay available as a quick fallback. Nothing about
 * the 3D frame or window itself is touched: only the picture is chosen.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { SURFACE_SAMPLES, builtinTexturePath } from "@/lib/building/gallery";
import {
  listAssets,
  listSessions,
  listSubSessions,
  type GplAsset,
  type GplSession,
  type GplSubSession,
} from "@/lib/gpl/assetLibrary";

interface Props {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  /** Receives the stored path (or web address) of the chosen picture. */
  onChoose: (path: string) => void;
}

const PicturePickerDialog = ({ open, title, onOpenChange, onChoose }: Props) => {
  const [sessions, setSessions] = useState<GplSession[]>([]);
  const [subs, setSubs] = useState<GplSubSession[]>([]);
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [session, setSession] = useState<GplSession | null>(null);
  const [sub, setSub] = useState<GplSubSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listSessions()
      .then((rows) => setSessions(rows.filter((s) => s.is_active)))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    listSubSessions(session.id)
      .then((rows) => setSubs(rows.filter((s) => s.is_active)))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!sub) return;
    setLoading(true);
    listAssets(sub.id)
      .then((rows) =>
        setAssets(rows.filter((a) => a.is_active && a.media_type === "image" && a.asset_type !== "emoji")),
      )
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [sub]);

  const pickable = useMemo(
    () => assets.filter((a) => a.storage_path || a.external_url),
    [assets],
  );

  const reset = () => {
    setSession(null);
    setSub(null);
    setAssets([]);
  };

  const take = (path: string) => {
    onChoose(path);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {(session || sub) && (
              <button
                type="button"
                onClick={() => (sub ? setSub(null) : setSession(null))}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {title}
            {session && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {session.name}
                {sub ? ` › ${sub.name}` : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <div className="max-h-[62vh] overflow-y-auto pr-1">
          {/* Level 1 — the library folders. */}
          {!session && (
            <>
              {sessions.length > 0 && (
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSession(s)}
                      className="rounded-xl border border-border/60 bg-background/60 p-3 text-left text-xs font-semibold hover:border-primary"
                    >
                      {s.image_url && (
                        <img
                          src={s.image_url}
                          alt=""
                          className="mb-2 aspect-square w-full rounded-lg object-cover"
                        />
                      )}
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Wall samples
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {SURFACE_SAMPLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    title={s.label}
                    onClick={() => take(builtinTexturePath(s.key))}
                    className="overflow-hidden rounded-lg border border-border/60 hover:border-primary"
                  >
                    <img src={s.url} alt={s.label} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Level 2 — the sub-folders. */}
          {session && !sub && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {subs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSub(s)}
                  className="rounded-xl border border-border/60 bg-background/60 p-3 text-left text-xs font-semibold hover:border-primary"
                >
                  {s.image_url && (
                    <img
                      src={s.image_url}
                      alt=""
                      className="mb-2 aspect-square w-full rounded-lg object-cover"
                    />
                  )}
                  {s.name}
                </button>
              ))}
              {!loading && subs.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground">
                  This folder has no sub-folders yet.
                </p>
              )}
            </div>
          )}

          {/* Level 3 — the pictures themselves. */}
          {sub && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {pickable.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  onClick={() => take((a.storage_path ?? a.external_url)!)}
                  className="overflow-hidden rounded-lg border border-border/60 bg-background/40 p-1 hover:border-primary"
                >
                  <span className="block aspect-square w-full overflow-hidden">
                    {a.storage_path ? (
                      <SignedMedia path={a.storage_path} mediaType="image" fit="cover" className="h-full w-full" />
                    ) : (
                      <img src={a.external_url ?? ""} alt={a.name} className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="mt-1 block truncate text-[10px]">{a.name}</span>
                </button>
              ))}
              {!loading && pickable.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground">
                  No pictures in this folder yet.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PicturePickerDialog;
