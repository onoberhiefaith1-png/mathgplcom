// MyGPL source for slide media. Browses the same GPL Asset library
// (Session → Sub-session → Asset) the rest of the app uses, and hands back the
// chosen asset. Nothing is duplicated: the slide item stores a reference to the
// library asset.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import {
  listAssets,
  listSessions,
  listSubSessions,
  type GplAsset,
  type GplSession,
  type GplSubSession,
} from "@/lib/gpl/assetLibrary";
import { useSignedUrl } from "@/components/gamebuilder/SignedMedia";

interface Props {
  kind: "image" | "video";
  onClose: () => void;
  onPick: (asset: GplAsset) => void;
}

function AssetTile({ asset, kind, onPick }: { asset: GplAsset; kind: "image" | "video"; onPick: () => void }) {
  const signed = useSignedUrl(asset.storage_path);
  const url = asset.external_url || signed;
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col gap-1 rounded-lg border p-1.5 text-left hover:bg-muted"
    >
      <span className="grid h-16 w-full place-items-center overflow-hidden rounded bg-muted/60">
        {url && kind === "image" ? (
          <img src={url} alt={asset.name} className="h-full w-full object-contain" />
        ) : url ? (
          <video src={url} muted className="h-full w-full object-contain" />
        ) : (
          <span className="text-lg">{asset.glyph ?? "🖼"}</span>
        )}
      </span>
      <span className="truncate text-[11px] font-medium">{asset.name}</span>
    </button>
  );
}

export function MyGplMediaPicker({ kind, onClose, onPick }: Props) {
  const [sessions, setSessions] = useState<GplSession[]>([]);
  const [session, setSession] = useState<GplSession | null>(null);
  const [subs, setSubs] = useState<GplSubSession[]>([]);
  const [sub, setSub] = useState<GplSubSession | null>(null);
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    listSubSessions(session.id)
      .then(setSubs)
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!sub) return;
    setLoading(true);
    listAssets(sub.id)
      .then((rows) => setAssets(rows.filter((a) => a.media_type === kind && a.is_active)))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [sub, kind]);

  const back = () => {
    if (sub) { setSub(null); setAssets([]); return; }
    if (session) { setSession(null); setSubs([]); return; }
    onClose();
  };

  return createPortal(
    <div
      data-slide-chrome="true"
      className="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/50 p-4"
      onPointerDown={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border bg-background shadow-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={back} title="Back">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              MyGPL {kind === "image" ? "images" : "videos"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {sub ? `${session?.name} › ${sub.name}` : session ? session.name : "Choose a session"}
            </p>
          </div>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {!loading && !session && (
            <div className="space-y-1.5">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSession(s)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {s.name}
                </button>
              ))}
              {!sessions.length && (
                <p className="text-xs text-muted-foreground">No library sessions yet.</p>
              )}
            </div>
          )}

          {!loading && session && !sub && (
            <div className="space-y-1.5">
              {subs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSub(s)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {s.name}
                </button>
              ))}
              {!subs.length && (
                <p className="text-xs text-muted-foreground">No sub-sessions here yet.</p>
              )}
            </div>
          )}

          {!loading && sub && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {assets.map((a) => (
                <AssetTile key={a.id} asset={a} kind={kind} onPick={() => onPick(a)} />
              ))}
              {!assets.length && (
                <p className="col-span-full text-xs text-muted-foreground">
                  No {kind === "image" ? "images" : "videos"} in this sub-session.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default MyGplMediaPicker;
