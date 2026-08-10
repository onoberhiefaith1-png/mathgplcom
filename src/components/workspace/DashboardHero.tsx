import { useEffect, useState } from "react";
import { Home } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { useHomepageConfig, resolveMediaUrl } from "@/lib/homepage/homepageConfig";
import { useProfileSummary } from "@/lib/accounts/useProfileSummary";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/**
 * The workspace hero. It wears the background of the workspace you are in — the
 * same one the rotating building stands on — and links straight to that
 * building, which remains the true home of every account.
 */
const DashboardHero = ({ blurb, mode = "self" }: { blurb?: string; mode?: "self" | "school-readonly" }) => {
  const { firstName, displayName } = useProfileSummary();
  const { config } = useHomepageConfig({ mode });
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<"video" | "image">("image");

  useEffect(() => {
    let alive = true;
    const ref = config.background ?? null;
    setKind(ref?.type === "video" ? "video" : "image");
    void resolveMediaUrl(ref).then((resolved) => {
      if (alive) setUrl(resolved);
    });
    return () => {
      alive = false;
    };
  }, [config.background]);

  const name = firstName || displayName;

  return (
    <section className="relative h-48 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/20 via-background to-background sm:h-60">
      {url &&
        (kind === "video" ? (
          <video
            src={url}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold sm:text-2xl">
            {greeting()}
            {name ? `, ${name}` : ""}!
          </h2>
          {blurb && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blurb}</p>}
        </div>
        <Link
          to="/"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm backdrop-blur transition hover:border-primary/50"
        >
          <Home className="h-4 w-4" /> Building
        </Link>
      </div>
    </section>
  );
};

export default DashboardHero;
