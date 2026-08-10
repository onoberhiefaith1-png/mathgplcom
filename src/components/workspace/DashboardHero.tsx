import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { useProfileSummary } from "@/lib/accounts/useProfileSummary";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/**
 * The workspace hero: the same rotating building that stands on the homepage,
 * with a greeting over it. It is the building of the workspace you are in.
 */
const DashboardHero = ({ blurb }: { blurb?: string }) => {
  const { firstName, displayName } = useProfileSummary();
  const name = firstName || displayName;

  return (
    <section className="relative h-56 overflow-hidden rounded-3xl border border-border/60 sm:h-72">
      <div className="absolute inset-0">
        <RotatingAdventureScene interactive={false} configMode="self" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-5 sm:p-6">
        <h2 className="truncate text-xl font-semibold sm:text-2xl">
          {greeting()}{name ? `, ${name}` : ""}!
        </h2>
        {blurb && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blurb}</p>}
      </div>
    </section>
  );
};

export default DashboardHero;
