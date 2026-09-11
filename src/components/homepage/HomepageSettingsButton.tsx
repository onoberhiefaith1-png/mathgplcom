/**
 * BUILDING — the one way in.
 *
 * The homepage no longer opens a settings drawer. It opens the Building
 * Selector, where one complete building is shown at a time. Everything that
 * belongs to a single building (its background, its outside, its advertisement)
 * lives in that building's own Settings inside the selector, so selecting a
 * building and editing a building are never mixed together again.
 */
import { Link } from "@/lib/router-compat";
import { Building2 } from "lucide-react";

const HomepageSettingsButton = () => (
  <Link
    to="/buildings"
    aria-label="Building"
    className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-5 py-3 text-sm font-semibold tracking-[0.18em] backdrop-blur transition hover:bg-background"
  >
    <Building2 className="h-4 w-4" />
    BUILDING
  </Link>
);

export default HomepageSettingsButton;
