import { Link } from "@/lib/router-compat";
import { ArrowLeft, Sigma, ChevronRight } from "lucide-react";

const TeachingHubArchive = () => (
  <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
    <header className="flex items-center justify-between px-6 py-5">
      <Link to="/teaching-hub/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <h1 className="text-lg font-semibold tracking-wide">Archive</h1>
      <div className="w-24" />
    </header>
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur">
        <Link
          to="/mathboard"
          className="flex items-center justify-between px-5 py-4 transition hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <Sigma className="h-5 w-5 text-cyan-300" />
            <span className="text-base font-medium">MathBoard Engine</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </main>
  </div>
);

export default TeachingHubArchive;
