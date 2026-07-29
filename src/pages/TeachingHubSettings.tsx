import { Link } from "@/lib/router-compat";
import { ArrowLeft, Archive, ChevronRight } from "lucide-react";

const TeachingHubSettings = () => (
  <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
    <header className="flex items-center justify-between px-6 py-5">
      <Link to="/teaching-hub" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Teaching Hub
      </Link>
      <h1 className="text-lg font-semibold tracking-wide">Settings</h1>
      <div className="w-32" />
    </header>
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur">
        <Link
          to="/teaching-hub/settings/archive"
          className="flex items-center justify-between px-5 py-4 transition hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <span className="text-base font-medium">Archive</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </main>
  </div>
);

export default TeachingHubSettings;
