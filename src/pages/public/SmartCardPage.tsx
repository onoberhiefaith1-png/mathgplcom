// Public Smart Card — the shareable landing page. Clean, no menus, no timer,
// no score, no ads. Clicking anywhere opens the Smartboard Challenge.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Play } from "lucide-react";
import SmartCardQuestion from "@/components/smartcards/SmartCardView";
import { fetchPublicCard, type PublicCardPayload } from "@/lib/smartcards/smartCards";

const SmartCardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<PublicCardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setPayload(await fetchPublicCard(slug));
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!payload) return;
    document.title = `${payload.card.title} — MathGPL Life Smart Card`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Solve this maths challenge on the MathGPL Smartboard — instant AI marking.");
  }, [payload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Smart Card…
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-100 text-slate-600">
        <h1 className="text-lg font-semibold">Smart Card not available</h1>
        <a className="text-sm underline" href="/live">Explore more with MathGPL Life</a>
      </div>
    );
  }

  const open = () => navigate(`/c/${payload.card.slug}/solve`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6">
      <button
        type="button"
        onClick={open}
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-left shadow-xl transition hover:shadow-2xl"
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          MathGPL Life · Smart Card
        </p>
        <h1 className="mb-5 text-2xl font-bold text-slate-900">{payload.card.title}</h1>
        <SmartCardQuestion
          presentation={payload.card.presentation}
          scenes={payload.card.geometry?.scenes ?? []}
        />
        <div className="mt-8 flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white">
          <Play className="h-4 w-4" /> Start Challenge
        </div>
      </button>
    </div>
  );
};

export default SmartCardPage;
