import { Gamepad2, X } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { algebraCurriculumGames } from "@/lib/mathLab/curriculumGames";

/** Algebra practice games inside Math Lab. The list is the curriculum. */
export default function CurriculumGamesPanel({ onClose }: { onClose: () => void }) {
  const groups = algebraCurriculumGames();
  return (
    <section aria-label="Algebra games" className="absolute inset-y-0 right-0 z-30 flex w-[min(420px,100%)] flex-col gap-4 overflow-y-auto border-l bg-card p-4 text-card-foreground shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><Gamepad2 className="h-4 w-4" />Games</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close games" onClick={onClose}><X /></Button>
      </div>
      <p className="text-sm text-muted-foreground">Algebra practice games, in the same order as the curriculum.</p>
      {groups.map((group) => (
        <section key={group.slug} aria-label={group.name} className="space-y-2">
          <h3 className="text-sm font-semibold">{group.name}</h3>
          <ul className="space-y-1">
            {group.games.map((game) => (
              <li key={game.slug}>
                {game.comingSoon || !game.href ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                    <span>{game.name}</span>
                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Coming Soon</span>
                  </div>
                ) : (
                  <Link
                    to={game.href}
                    className="block rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
                  >
                    {game.name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
