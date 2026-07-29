import { Link } from "@/lib/router-compat";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { AdventurePortalScene } from "@/components/adventure/AdventurePortalScene";

const Adventure = () => (
  <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
    <AdventurePortalScene />
    <Link
      to="/teaching-hub"
      className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/20 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition hover:bg-background/35"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </Link>
    <Link
      to="/adventure/games"
      className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/20 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-primary/35"
    >
      <Gamepad2 className="h-4 w-4" /> Game Mode
    </Link>
  </div>
);

export default Adventure;

