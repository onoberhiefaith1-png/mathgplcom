import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Inbox } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { getSubcategory } from "@/data/assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Character3DBillboard from "@/components/Character3DBillboard";
import MusicGenerator from "@/components/MusicGenerator";
import GlbViewer from "@/components/GlbViewer";

const AssetSubcategory = () => {
  const { category, subcategory } = useParams();
  const { category: cat, subcategory: sub } = getSubcategory(category, subcategory);
  const [active, setActive] = useState<{ name: string; src: string } | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  if (!cat) return <Navigate to="/assets" replace />;
  if (!sub) return <Navigate to={`/assets/${cat.slug}`} replace />;

  // Enable rotating 3D detail view for character collections.
  const is3DEnabled =
    cat.slug === "characters" && ["player", "additional-players", "enemy", "npc", "creatures"].includes(sub.slug);

  // Procedural in-browser music generator for the audio/music subcategory.
  const isMusicGenerator = cat.slug === "audio" && sub.slug === "music";

  return (
    <main className="relative min-h-screen text-foreground animate-fade-in">
      <SeamlessBackground file={sub.background} />

      <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm drop-shadow">
            {cat.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl drop-shadow">
            {sub.name}
          </h1>
          {is3DEnabled && (
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
              Tap a character to view in rotating 3D
            </p>
          )}
        </div>
        <Link
          to={`/assets/${cat.slug}`}
          className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      {(() => {
        const hasGroups = !!sub.groups && sub.groups.length > 0;
        const hasAssets = !!sub.assets && sub.assets.length > 0;
        if (isMusicGenerator && !hasAssets && !hasGroups) return <MusicGenerator />;

        const renderCard = (a: { name: string; src: string }) => {
          const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(a.src);
          const is3DModel = /\.(glb|gltf)$/i.test(a.src);
          const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(a.src);
          const card = is3DModel ? (
            <figure className="overflow-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur transition-transform hover:scale-[1.02]">
              <GlbViewer src={a.src} />
              <figcaption className="px-3 py-2 text-center text-sm font-medium">{a.name}</figcaption>
            </figure>
          ) : isVideo ? (
            <figure className="overflow-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur transition-transform hover:scale-[1.02]">
              <div className="aspect-square w-full overflow-hidden bg-black/40">
                <video src={a.src} controls loop muted playsInline preload="metadata" className="h-full w-full object-cover" />
              </div>
              <figcaption className="px-3 py-2 text-center text-sm font-medium">{a.name}</figcaption>
            </figure>
          ) : isAudio ? (
            <figure className="overflow-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur transition-transform hover:scale-[1.02]">
              <div className="flex aspect-square w-full items-center justify-center bg-background/30 p-4">
                <audio src={a.src} controls preload="none" className="w-full" />
              </div>
              <figcaption className="px-3 py-2 text-center text-sm font-medium">{a.name}</figcaption>
            </figure>
          ) : (
            <figure className="overflow-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur transition-transform hover:scale-[1.02]">
              <div className="aspect-square w-full overflow-hidden bg-background/30 p-4">
                <img src={a.src} alt={a.name} className="h-full w-full object-contain" loading="lazy" />
              </div>
              <figcaption className="px-3 py-2 text-center text-sm font-medium">{a.name}</figcaption>
            </figure>
          );
          return is3DEnabled ? (
            <button key={a.src} type="button" onClick={() => setActive(a)} className="text-left" aria-label={`View ${a.name} in 3D`}>
              {card}
            </button>
          ) : (
            <div key={a.src}>{card}</div>
          );
        };

        if (hasGroups) {
          return (
            <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {sub.groups!.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => setOpenGroup(g.name)}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border/40 bg-background/60 text-left backdrop-blur transition hover:scale-[1.03] hover:border-primary/70"
                  >
                    {g.image ? (
                      <img src={g.image} alt={g.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-background" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="text-sm font-semibold drop-shadow sm:text-base">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.assets.length} clips</div>
                    </div>
                  </button>
                ))}
              </div>

              <Dialog open={!!openGroup} onOpenChange={(o) => !o && setOpenGroup(null)}>
                <DialogContent className="max-w-5xl border-border/40 bg-background/95 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle>{openGroup}</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[70vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {sub.groups!.find((g) => g.name === openGroup)?.assets.map(renderCard)}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </section>
          );
        }

        if (hasAssets) {
          return (
            <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {sub.assets!.map(renderCard)}
              </div>
            </section>
          );
        }

        return (
          <section className="relative z-10 mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 pb-24 text-center">
            <div className="rounded-2xl border border-border/40 bg-background/60 p-10 backdrop-blur">
              <Inbox className="mx-auto h-12 w-12 text-primary" />
              <h2 className="mt-4 text-2xl font-semibold">Empty</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                No assets here yet. This folder is ready for {sub.name.toLowerCase()} assets.
              </p>
            </div>
          </section>
        );
      })()}


      {is3DEnabled && (
        <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
          <DialogContent className="max-w-xl border-border/40 bg-background/85 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-center">{active?.name}</DialogTitle>
            </DialogHeader>
            {active && (
              <div className="py-4">
                <Character3DBillboard src={active.src} alt={active.name} />
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Drag to spin • releases to auto-rotate
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
};

export default AssetSubcategory;
