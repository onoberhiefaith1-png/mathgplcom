// Student: join a Timer Arena group through the teacher's link.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchArenaInfo, joinArena, setActiveArena, type ArenaInfo } from "@/lib/arena/arenaClient";
import { ARENA_AVATARS } from "@/lib/arena/ranking";
import { guestLinkToken, setGuestLinkName } from "@/lib/guests/guestSession";

const ERRORS: Record<string, string> = {
  name_required: "Please enter your name to join.",
  name_rejected: "Please choose a different name.",
  avatar_required: "Please pick a picture to join.",
  closed: "This group is closed.",
};

const ArenaJoinPage = () => {
  const { code } = useParams({ from: "/arena/$code" });
  const navigate = useNavigate();
  const [info, setInfo] = useState<ArenaInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArenaInfo(code.toUpperCase()).then(setInfo).catch(() => setMissing(true));
  }, [code]);

  const join = async (anonymous: boolean) => {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      const token = guestLinkToken();
      const r = await joinArena(code.toUpperCase(), token, anonymous ? null : name.trim() || null, avatar);
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
                <div className="grid grid-cols-6 gap-2">
                  {ARENA_AVATARS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      aria-label={a.key}
                      aria-pressed={avatar === a.key}
                      onClick={() => setAvatar(a.key)}
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
