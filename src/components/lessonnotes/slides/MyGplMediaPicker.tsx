// MyGPL source for slide media. Browses the same GPL Asset library
// (Session → Sub-session → Asset) the rest of the app uses, and hands back the
// chosen asset. Nothing is duplicated: the slide item stores a reference to the
// library asset.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Loader2, Plus, X } from "lucide-react";
import {
  createAsset,
  listAssets,
  listSessions,
  listSubSessions,
  uploadOfficialFile,
  type GplAsset,
  type GplSession,
  type GplSubSession,
} from "@/lib/gpl/assetLibrary";
import { useAssetManager } from "@/lib/gpl/useAssetManager";
import { useSignedUrl } from "@/components/gamebuilder/SignedMedia";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface Props {
  kind: "image" | "video" | "any";
  onClose: () => void;
  onPick: (asset: GplAsset) => void;
}

function AssetTile({ asset, kind, onPick }: { asset: GplAsset; kind: "image" | "video" | "any"; onPick: () => void }) {
  const signed = useSignedUrl(asset.storage_path);
  const url = asset.external_url || signed;
  const previewKind = kind === "any" ? asset.media_type : kind;
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col gap-1 rounded-lg border p-1.5 text-left hover:bg-muted"
    >
      <span className="grid h-16 w-full place-items-center overflow-hidden rounded bg-muted/60">
        {url && previewKind === "image" ? (
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
  useEscapeClose(onClose);
  const [sessions, setSessions] = useState<GplSession[]>([]);
  const [session, setSession] = useState<GplSession | null>(null);
  const [subs, setSubs] = useState<GplSubSession[]>([]);
  const [sub, setSub] = useState<GplSubSession | null>(null);
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [loading, setLoading] = useState(false);
  // Only the site owner, administrators and authorised Asset Managers may ADD to
  // the shared MATHGPL library; everyone else simply browses and uses it.
  const { isManager } = useAssetManager();
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLInputElement | null>(null);

  /**
   * Adding a file here puts it in the shared MATHGPL library itself, so every
   * teacher sees it from then on — it is not a private copy for this frame.
   */
  const addToLibrary = async (file: File | undefined) => {
    if (!file || !sub || !session) return;
    setAdding(true);
    try {
      const path = await uploadOfficialFile(file, session.slug, sub.slug);
      const created = await createAsset({
        subsession_id: sub.id,
        name: file.name.replace(/\.[a-z0-9]+$/i, ""),
        asset_type: file.type.startsWith("video/") ? "video" : "image",
        storage_path: path,
        media_type: file.type.startsWith("video/") ? "video" : "image",
      });
      setAssets((prev) => [created, ...prev]);
    } catch (err) {
      console.error("could not add to the MATHGPL library", err);
    } finally {
      setAdding(false);
    }
  };

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
      .then((rows) =>
        setAssets(
          rows.filter((a) =>
            kind === "any"
              ? a.is_active && (a.media_type === "image" || a.media_type === "video")
              : a.is_active && a.media_type === kind,
          ),
        ),
      )
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
              {kind === "any" ? "MyGPL media" : `MyGPL ${kind === "image" ? "images" : "videos"}`}
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
              {isManager && (
                <>
                  <input
                    ref={addRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      void addToLibrary(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={adding}
                    onClick={() => addRef.current?.click()}
                    className="flex h-[86px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {adding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add
                  </button>
                </>
              )}
              {assets.map((a) => (
                <AssetTile key={a.id} asset={a} kind={kind} onPick={() => onPick(a)} />
              ))}
              {!assets.length && (
                <p className="col-span-full text-xs text-muted-foreground">
                  No {kind === "any" ? "media" : kind === "image" ? "images" : "videos"} in this sub-session.
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
