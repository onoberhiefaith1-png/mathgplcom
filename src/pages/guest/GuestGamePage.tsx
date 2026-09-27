// Guest Link — a shared Game card. Anyone with the link plays every Level of
// that class's Game on their own device, no sign-in. Marks stay under Guest
// Performance and never reach the class.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router-compat";
import GamePlayPage from "@/pages/game/GamePlayPage";
import { fetchGuestPayload, sendGuestHeartbeat, type GuestGamePayload } from "@/lib/guests/guestApi";
import { guestLinkName, guestLinkToken } from "@/lib/guests/guestSession";
import { GuestLoading, GuestNameGate, GuestUnavailable } from "./GuestGate";

const GuestGamePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const code = String(slug ?? "");
  const [payload, setPayload] = useState<GuestGamePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameTick, setNameTick] = useState(0);
  const token = useMemo(() => guestLinkToken(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await fetchGuestPayload(code);
      if (!alive) return;
      if (p && p.kind === "game") setPayload(p);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [code]);

  // Presence for the teacher's Live guests list.
  useEffect(() => {
    if (!payload) return;
    const beat = () => void sendGuestHeartbeat(code, { token, name: guestLinkName() });
    beat();
    const id = window.setInterval(beat, 30_000);
    return () => window.clearInterval(id);
  }, [payload, code, token, nameTick]);

  if (loading) return <GuestLoading label="Opening game…" />;
  if (!payload) {
    return <GuestUnavailable message="The teacher may have turned this guest link off, or the game is not ready yet." />;
  }
  return (
    <GuestNameGate askName={payload.askName} onDone={() => setNameTick((n) => n + 1)}>
      <GamePlayPage key={nameTick} guest={{ code, token, name: guestLinkName(), payload }} />
    </GuestNameGate>
  );
};

export default GuestGamePage;
