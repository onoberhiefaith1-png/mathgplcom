import {participationToken} from "@/lib/arena/accountParticipation";
// Student: join a Timer Arena group through the teacher's link.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchArenaInfo, joinArena, setActiveArena, type ArenaInfo } from "@/lib/arena/arenaClient";
import { ARENA_AVATARS } from "@/lib/arena/ranking";
import { resizeImageToSquare } from "@/lib/arena/photo";
import { setGuestLinkName } from "@/lib/guests/guestSession";

const ERRORS: Record<string, string> = {
  name_required: "Please enter your name to join.",
  name_rejected: "Please choose a different name.",
  avatar_required: "Please pick a picture to join.",
  photo_invalid: "That picture couldn't be used. Please choose another photo.",
  photo_too_large: "That picture is too large. Please choose another photo.",
  closed: "This group is closed.",
};

const ArenaJoinPage = () => {
  const { code } = useParams({ from: "/arena/$code" });
  const navigate = useNavigate();
  const [info, setInfo] = useState<ArenaInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArenaInfo(code.toUpperCase()).then(setInfo).catch(() => setMissing(true));
  }, [code]);

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    const r = await resizeImageToSquare(file);
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) {
      setError(r.reason === "not_image" ? "Please choose an image file." : "That picture couldn't be read. Please try another photo.");
      return;
    }
    setPhoto(r.dataUrl);
    setAvatar(null);
  };

  const join = async (anonymous: boolean) => {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      const token = await participationToken(code.toUpperCase(),info.guestCode);
      const r = await joinArena(code.toUpperCase(), token, anonymous ? null : name.trim() || null, photo ? null : avatar, photo);
      setActiveArena(info.guestCode, code.toUpperCase());
      setGuestLinkName(name.trim() || String(r["anonLabel"] ?? "Learner"));
      navigate({ to: "/ac/$slug", params: { slug: info.guestCode } });
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? "Could not join. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (missing) return <div className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">This link is not valid.</div>;
  if (!info) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const askName = info.entry.name !== "off";
  const askPhoto = info.entry.photo !== "off";
  const canSkipName = info.entry.name !== "required";

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">MathGPL Academia</p>
        <h1 className="mt-1 text-center text-xl font-bold">Join the Session</h1>
        <p className="text-center text-sm text-muted-foreground">{info.title}</p>
        {info.status !== "open" ? (
          <p className="mt-4 text-center text-sm">This group is closed.</p>
        ) : (
          <>
            {askPhoto && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">Your picture{info.entry.photo === "required" ? "" : " (optional)"}</p>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-2xl">
                    {photo ? <img src={photo} alt="Your photo" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" aria-hidden />}
                  </span>
                  <div className="flex flex-col gap-1">
                    <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => void choosePhoto(e.target.files?.[0])} aria-label="Upload your photo" />
                    <Button type="button" size="sm" variant="outline" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                      {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
                      {photo ? "Change photo" : "Take or upload a photo"}
                    </Button>
                    {photo && (
                      <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline" onClick={() => setPhoto(null)}>
                        <X className="h-3 w-3" aria-hidden /> Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">Or pick a character:</p>
                <div className="grid grid-cols-6 gap-2">
                  {ARENA_AVATARS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      aria-label={a.key}
                      aria-pressed={avatar === a.key}
                      onClick={() => { setAvatar(a.key); setPhoto(null); }}
                      className={`grid aspect-square place-items-center rounded-full border text-xl ${avatar === a.key ? "border-primary ring-2 ring-primary" : "border-border"}`}
                    >
                      {a.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {askName && (
              <label className="mt-4 block text-xs text-muted-foreground">
                Your name{canSkipName ? " (optional)" : ""}
                <Input className="mt-1" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <Button className="mt-4 w-full" disabled={busy} onClick={() => join(false)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Session"}
            </Button>
            {askName && canSkipName && (
              <Button variant="ghost" className="mt-1 w-full" disabled={busy} onClick={() => join(true)}>
                Use an anonymous ID instead
              </Button>
            )}
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Your name and picture appear only on this group's leaderboard.</p>
          </>
        )}
      </div>
    </main>
  );
};

export default ArenaJoinPage;
